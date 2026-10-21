"""Phase 2 API tests: auth, RBAC, station scoping, FSM endpoint, fuel/water
computed ratios, attendance->payroll endpoint flow, sync idempotency."""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.models import Organization, Role, Station, UserStationRole
from farmers.models import Farmer
from hr.models import AttendanceEntry, AttendanceSheet, Worker
from processing.models import Lot

User = get_user_model()


def mk_role(code):
    role, _ = Role.objects.get_or_create(code=code)
    return role


class ApiBase(TestCase):
    def setUp(self):
        org = Organization.objects.create(name="Murago")
        self.st_a = Station.objects.create(organization=org, code="MUR", name="Murago WS", station_type="washing")
        self.st_b = Station.objects.create(organization=org, code="SID", name="Sidama WS", station_type="washing")
        self.admin = User.objects.create_user("admin", password="pw12345!", is_superuser=True)
        self.supervisor = User.objects.create_user("sup", password="pw12345!")
        self.operator = User.objects.create_user("op", password="pw12345!")
        self.finance = User.objects.create_user("fin", password="pw12345!")
        UserStationRole.objects.create(user=self.supervisor, role=mk_role("station_supervisor"), station=self.st_a)
        UserStationRole.objects.create(user=self.operator, role=mk_role("machine_operator"), station=self.st_a)
        UserStationRole.objects.create(user=self.finance, role=mk_role("finance_manager"), station=self.st_a)

    def api_client(self, user):
        c = APIClient()
        token, _ = Token.objects.get_or_create(user=user)
        c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return c


class AuthTests(ApiBase):
    def test_auth_required(self):
        resp = APIClient().get("/api/farmers/")
        self.assertIn(resp.status_code, (401, 403))

    def test_login_endpoint(self):
        resp = APIClient().post("/api/auth/login/", {"username": "admin", "password": "pw12345!"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.data)
        bad = APIClient().post("/api/auth/login/", {"username": "admin", "password": "wrong"}, format="json")
        self.assertEqual(bad.status_code, 401)


class RbacScopingTests(ApiBase):
    def test_rbac_denial_operator_cannot_write_payroll(self):
        resp = self.api_client(self.operator).post("/api/payroll-periods/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_rbac_denial_operator_cannot_read_payroll(self):
        resp = self.api_client(self.operator).get("/api/payroll-periods/")
        self.assertEqual(resp.status_code, 403)

    def test_station_scoping(self):
        Farmer.objects.create(farmer_code="F-A", full_name="A Farmer", station=self.st_a)
        Farmer.objects.create(farmer_code="F-B", full_name="B Farmer", station=self.st_b)
        resp = self.api_client(self.supervisor).get("/api/farmers/")
        codes = [r["farmer_code"] for r in resp.data["results"]]
        self.assertIn("F-A", codes)
        self.assertNotIn("F-B", codes)
        resp_admin = self.api_client(self.admin).get("/api/farmers/")
        codes_admin = [r["farmer_code"] for r in resp_admin.data["results"]]
        self.assertIn("F-B", codes_admin)


class FsmEndpointTests(ApiBase):
    def test_illegal_skip_400_and_legal_transition(self):
        lot = Lot.objects.create(lot_code="MUR-1", station=self.st_a, process_type="washed",
                                 current_stage="harvesting_sorting", current_weight_kg=100)
        c = self.api_client(self.supervisor)
        bad = c.post(f"/api/lots/{lot.id}/transition/", {"to_stage": "drying"}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = c.post(f"/api/lots/{lot.id}/transition/", {"to_stage": "receiving"}, format="json")
        self.assertEqual(ok.status_code, 200)
        lot.refresh_from_db()
        self.assertEqual(lot.current_stage, "receiving")


class ResourceEndpointTests(ApiBase):
    def test_fuel_entry_returns_computed_ratio(self):
        c = self.api_client(self.operator)
        resp = c.post("/api/fuel-entries/", {
            "station": str(self.st_a.id), "entry_date": "2026-10-21", "machine_label": "Gen 1",
            "fuel_purchased_litres": "100", "fuel_added_litres": "20", "cherry_pulped_kg": "1000"},
            format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["fuel_ratio"], "0.02000")

    def test_water_entry_uses_previous_day_kg(self):
        c = self.api_client(self.operator)
        resp = c.post("/api/water-entries/", {
            "station": str(self.st_a.id), "entry_date": "2026-10-21",
            "meter_reading_litres": "52000", "previous_reading_litres": "40000",
            "previous_day_pulped_kg": "2000"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["water_ratio"], "6.00000")
        self.assertEqual(resp.data["consumption_litres"], "12000.00")


class PayrollFlowTests(ApiBase):
    def _sheet(self, verified=True):
        sheet = AttendanceSheet.objects.create(station=self.st_a, ethiopian_month=2, ethiopian_year=2018)
        w = Worker.objects.create(worker_code="W-1", full_name="Test Worker", station=self.st_a,
                                  wage_type="daily", wage_rate=Decimal("300"))
        for d in range(1, 11):
            AttendanceEntry.objects.create(sheet=sheet, worker=w, day=d, mark="present",
                                           hours=Decimal("8"), pieces=Decimal("0"))
        return sheet

    def test_payroll_blocked_without_dual_verification(self):
        sheet = self._sheet()
        resp = self.api_client(self.finance).post(f"/api/attendance-sheets/{sheet.id}/generate-payroll/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_full_flow_verify_generate_approve(self):
        sheet = self._sheet()
        c = self.api_client(self.finance)
        v = c.post(f"/api/attendance-sheets/{sheet.id}/verify/",
                   {"controlled_by": self.supervisor.id, "verified_by": self.admin.id}, format="json")
        self.assertEqual(v.status_code, 200, v.data)
        g = c.post(f"/api/attendance-sheets/{sheet.id}/generate-payroll/", {}, format="json")
        self.assertEqual(g.status_code, 201, g.data)
        self.assertEqual(g.data["total_gross"], "3000.00")
        same = c.post(f"/api/payroll-periods/{g.data['id']}/approve/",
                      {"approved_by": self.finance.id}, format="json")
        self.assertEqual(same.status_code, 400)  # preparer == approver blocked
        ok = c.post(f"/api/payroll-periods/{g.data['id']}/approve/",
                    {"approved_by": self.admin.id}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["status"], "approved")


class SyncTests(ApiBase):
    def test_sync_push_idempotent(self):
        c = self.api_client(self.supervisor)
        payload = {"records": [{"client_uuid": "01922f3a-7b2c-7000-8000-000000000001",
                                "device_id": "dev-1", "entity_type": "resources.FuelRegisterEntry",
                                "payload": {}, "client_created_at": "2026-10-21T06:00:00Z"}]}
        r1 = c.post("/api/sync/push/", payload, format="json")
        self.assertEqual(r1.status_code, 200)
        r2 = c.post("/api/sync/push/", payload, format="json")
        self.assertEqual(r2.data["acks"][0]["status"], "duplicate")
        from sync.models import SyncQueueItem
        self.assertEqual(SyncQueueItem.objects.count(), 1)
        pull = c.get("/api/sync/pull/")
        self.assertEqual(pull.status_code, 200)
        self.assertIn("changes", pull.data)


class DashboardTests(ApiBase):
    def test_dashboard_and_schema(self):
        c = self.api_client(self.admin)
        self.assertEqual(c.get("/api/dashboard/").status_code, 200)
        self.assertEqual(c.get("/api/schema/").status_code, 200)
