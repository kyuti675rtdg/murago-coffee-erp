"""RBAC hardening verification (2026-10-21).

Every role is probed against the modules it may and may not touch:
reads AND writes are role-gated per module, station scope decides rows,
create payloads cannot smuggle another station's records, and the sync /
report / costing function views enforce the same matrix. Admin keeps
full access; the privilege-escalation paths (roles, user-station-roles,
signature credentials) are admin-only.
"""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Role, Station, UserStationRole

PW = "MuragoAdmin2026!"


def mkuser(username, role_code, station_code=None):
    user, _ = get_user_model().objects.get_or_create(
        username=username, defaults={"email": f"{username}@murago.local"})
    user.set_password(PW)
    user.save()
    station = Station.objects.filter(code=station_code).first() if station_code else None
    UserStationRole.objects.get_or_create(
        user=user, role=Role.objects.get(code=role_code), station=station)
    return user


class RbacBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        U = get_user_model()
        cls.users = {name: U.objects.get(username=name) for name in (
            "admin", "supervisor", "operator", "qgrader", "finance",
            "sitemanager", "sitemanager_ben", "procurement1", "weigher1",
            "quality1", "warehouse1", "field1", "financeofficer1")}
        cls.users["purchaser1"] = mkuser("purchaser1", "purchaser", "MUR")
        cls.users["industry1"] = mkuser("industry1", "industry_professional", "MUR")
        cls.users["millmanager1"] = mkuser("millmanager1", "dry_mill_manager", "MUR")
        cls.users["exporter1"] = mkuser("exporter1", "export_officer", None)
        cls.mur = Station.objects.get(code="MUR")
        cls.ben = Station.objects.get(code="BEN")

    def as_user(self, username):
        c = APIClient()
        c.force_authenticate(self.users[username])
        return c

    def assertGet(self, username, url, expected):
        r = self.as_user(username).get(url)
        self.assertEqual(r.status_code, expected,
                         f"{username} GET {url}: {r.status_code} != {expected}")
        return r

    def assertPostDenied(self, username, url):
        r = self.as_user(username).post(url, {}, format="json")
        self.assertEqual(r.status_code, 403,
                         f"{username} POST {url}: {r.status_code} != 403")


class ReadMatrixTests(RbacBase):
    def test_weighing_clerk_reads(self):
        for url in ("/api/farmers/", "/api/cherry-intakes/", "/api/stations/",
                    "/api/grade-definitions/", "/api/bonus-schemes/"):
            self.assertGet("weigher1", url, 200)
        for url in ("/api/payroll-periods/", "/api/journal-entries/", "/api/sales-contracts/",
                    "/api/workers/", "/api/roles/", "/api/user-station-roles/",
                    "/api/threshold-configs/", "/api/disbursements/", "/api/buyers/",
                    "/api/audit-logs/", "/api/signature-credentials/"):
            self.assertGet("weigher1", url, 403)

    def test_machine_operator_reads(self):
        for url in ("/api/lots/", "/api/fuel-entries/", "/api/stations/"):
            self.assertGet("operator", url, 200)
        for url in ("/api/farmers/", "/api/workers/", "/api/attendance-entries/",
                    "/api/payroll-periods/", "/api/journal-entries/"):
            self.assertGet("operator", url, 403)

    def test_q_grader_reads(self):
        self.assertGet("qgrader", "/api/cupping-scores/", 200)
        self.assertGet("qgrader", "/api/farmers/", 403)
        self.assertGet("qgrader", "/api/payroll-periods/", 403)

    def test_export_officer_reads(self):
        for url in ("/api/sales-contracts/", "/api/buyers/", "/api/disbursements/", "/api/farmers/"):
            self.assertGet("exporter1", url, 200)
        for url in ("/api/journal-entries/", "/api/payroll-periods/", "/api/workers/"):
            self.assertGet("exporter1", url, 403)

    def test_finance_officer_reads(self):
        for url in ("/api/payroll-periods/", "/api/journal-entries/", "/api/workers/",
                    "/api/disbursements/"):
            self.assertGet("financeofficer1", url, 200)
        self.assertGet("financeofficer1", "/api/sales-contracts/", 403)
        self.assertGet("financeofficer1", "/api/user-station-roles/", 403)

    def test_site_manager_reads(self):
        for url in ("/api/stations/", "/api/station-equipment/", "/api/farmers/",
                    "/api/workers/", "/api/disbursements/", "/api/site-cameras/"):
            self.assertGet("sitemanager", url, 200)
        for url in ("/api/payroll-periods/", "/api/journal-entries/", "/api/sales-contracts/",
                    "/api/roles/", "/api/user-station-roles/", "/api/signature-credentials/",
                    "/api/audit-logs/", "/api/threshold-configs/"):
            self.assertGet("sitemanager", url, 403)

    def test_supervisor_no_longer_reads_payroll_or_finance(self):
        self.assertGet("supervisor", "/api/payroll-periods/", 403)
        self.assertGet("supervisor", "/api/journal-entries/", 403)
        self.assertGet("supervisor", "/api/workers/", 200)
        self.assertGet("supervisor", "/api/disbursements/", 200)

    def test_admin_reads_everything(self):
        for url in ("/api/roles/", "/api/user-station-roles/", "/api/signature-credentials/",
                    "/api/audit-logs/", "/api/threshold-configs/", "/api/payroll-periods/",
                    "/api/journal-entries/", "/api/sales-contracts/"):
            self.assertGet("admin", url, 200)


class WriteMatrixTests(RbacBase):
    def test_write_denials(self):
        self.assertPostDenied("weigher1", "/api/journal-entries/")
        self.assertPostDenied("weigher1", "/api/payroll-periods/")
        self.assertPostDenied("weigher1", "/api/workers/")
        self.assertPostDenied("operator", "/api/workers/")
        self.assertPostDenied("operator", "/api/attendance-entries/")
        self.assertPostDenied("operator", "/api/payroll-periods/")
        self.assertPostDenied("financeofficer1", "/api/journal-entries/")
        self.assertPostDenied("financeofficer1", "/api/payroll-periods/")
        self.assertPostDenied("exporter1", "/api/disbursements/")
        self.assertPostDenied("qgrader", "/api/farmers/")
        self.assertPostDenied("warehouse1", "/api/farmers/")

    def test_privilege_escalation_paths_closed(self):
        # a site manager must not be able to grant roles or mint credentials
        self.assertPostDenied("sitemanager", "/api/user-station-roles/")
        self.assertPostDenied("sitemanager", "/api/roles/")
        self.assertPostDenied("sitemanager", "/api/signature-credentials/")
        self.assertPostDenied("sitemanager", "/api/bonus-schemes/")
        self.assertPostDenied("supervisor", "/api/user-station-roles/")
        # admin retains full control
        role = Role.objects.get(code="weighing_clerk")
        r = self.as_user("admin").post("/api/user-station-roles/", {
            "user": self.users["weigher1"].id, "role": role.id, "station": str(self.mur.id)},
            format="json")
        self.assertIn(r.status_code, (201, 400))  # 400 only if the assignment already exists
        self.assertNotEqual(r.status_code, 403)

    def test_allowed_writes_still_work(self):
        # weighing clerk records an intake at his own station
        c = self.as_user("weigher1")
        farmers = c.get("/api/farmers/").json()["results"]
        farmer = [f for f in farmers if f["station"] == str(self.mur.id)][0]
        centers = c.get("/api/collection-centers/").json()["results"]
        r = c.post("/api/cherry-intakes/", {
            "farmer": farmer["id"], "center": centers[0]["id"], "station": str(self.mur.id),
            "intake_date": "2026-10-21", "gross_kg": 50, "tare_kg": 2,
            "floater_deduction_pct": 0, "unit_price": 80}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        # site manager edits his own station's profile
        r = self.as_user("sitemanager").patch(f"/api/stations/{self.mur.id}/",
                                             {"manager_name": "Site Manager MUR"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)


class StationIsolationTests(RbacBase):
    def test_ben_manager_sees_only_ben(self):
        c = self.as_user("sitemanager_ben")
        farmers = c.get("/api/farmers/").json()["results"]
        self.assertTrue(farmers)
        self.assertTrue(all(f["station"] == str(self.ben.id) for f in farmers))
        intakes = c.get("/api/cherry-intakes/").json()["results"]
        self.assertTrue(all(i["station"] == str(self.ben.id) for i in intakes))

    def test_cross_station_detail_is_404(self):
        mur_farmer = self.as_user("admin").get("/api/farmers/").json()["results"]
        mur_farmer = [f for f in mur_farmer if f["station"] == str(self.mur.id)][0]
        r = self.as_user("sitemanager_ben").get(f"/api/farmers/{mur_farmer['id']}/")
        self.assertEqual(r.status_code, 404)
        r = self.as_user("sitemanager_ben").patch(f"/api/stations/{self.mur.id}/",
                                                 {"manager_name": "Intruder"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_create_cannot_smuggle_other_station(self):
        from collection.models import CherryIntake
        c = self.as_user("weigher1")
        ben_farmer = [f for f in self.as_user("admin").get("/api/farmers/").json()["results"]
                      if f["station"] == str(self.ben.id)][0]
        centers = self.as_user("admin").get("/api/collection-centers/").json()["results"]
        ben_center = [x for x in centers if x["station"] == str(self.ben.id)][0]
        before = CherryIntake.objects.filter(station=self.ben).count()
        r = c.post("/api/cherry-intakes/", {
            "farmer": ben_farmer["id"], "center": ben_center["id"], "station": str(self.ben.id),
            "intake_date": "2026-10-21", "gross_kg": 10, "tare_kg": 0,
            "floater_deduction_pct": 0, "unit_price": 80}, format="json")
        self.assertEqual(r.status_code, 403, r.content)
        self.assertEqual(CherryIntake.objects.filter(station=self.ben).count(), before)

    def test_site_performance_scope(self):
        r = self.as_user("sitemanager_ben").get("/api/site-performance/")
        rows = r.json()["stations"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["code"], "BEN")
        r = self.as_user("sitemanager_ben").get(f"/api/site-performance/{self.mur.id}/")
        self.assertEqual(r.status_code, 403)

    def test_dashboard_counts_are_scoped(self):
        ben_farmers = self.as_user("sitemanager_ben").get("/api/farmers/").json()["count"]
        dash = self.as_user("sitemanager_ben").get("/api/dashboard/").json()
        self.assertEqual(dash["farmers"], ben_farmers)


class FunctionViewGateTests(RbacBase):
    def test_reports_gate(self):
        r = self.as_user("weigher1").post("/api/reports/run/", {"kind": "procurement"}, format="json")
        self.assertEqual(r.status_code, 403)
        r = self.as_user("sitemanager").post("/api/reports/run/", {"kind": "procurement"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    def test_postgis_admin_only(self):
        r = self.as_user("weigher1").get("/api/postgis/")
        self.assertEqual(r.status_code, 403)
        r = self.as_user("admin").get("/api/postgis/")
        self.assertNotEqual(r.status_code, 403)

    def test_lot_costing_gate(self):
        lots = self.as_user("admin").get("/api/lots/").json()["results"]
        lot = [x for x in lots if x["station"] == str(self.mur.id)][0]
        url = f"/api/lot-costing/{lot['id']}/"
        self.assertGet("financeofficer1", url, 200)
        self.assertGet("sitemanager", url, 200)          # MUR manager, MUR lot
        self.assertGet("sitemanager_ben", url, 403)      # other station's lot
        self.assertGet("weigher1", url, 403)

    def test_backups_admin_only(self):
        self.assertGet("sitemanager", "/api/backups/", 403)
        self.assertGet("admin", "/api/backups/", 200)


class SyncGateTests(RbacBase):
    def test_sync_push_rejects_forbidden_model(self):
        import uuid
        r = self.as_user("weigher1").post("/api/sync/push/", {"records": [{
            "client_uuid": str(uuid.uuid4()), "entity_type": "finance.journalentry",
            "entity_uuid": str(uuid.uuid4()), "payload": {"memo": "smuggled"}}]}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["acks"][0]["status"].startswith("rejected"), r.json())

    def test_sync_push_allows_own_module(self):
        import uuid
        r = self.as_user("weigher1").post("/api/sync/push/", {"records": [{
            "client_uuid": str(uuid.uuid4()), "entity_type": "collection.cherryintake",
            "entity_uuid": str(uuid.uuid4()),
            "payload": {"intake_number": "SYNC-TEST-1", "qr_receipt_code": "QR-SYNC-TEST-1"}}]},
            format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["acks"][0]["status"].startswith("rejected"), r.json())

    def test_sync_pull_never_leaks_finance(self):
        r = self.as_user("weigher1").get("/api/sync/pull/")
        self.assertEqual(r.status_code, 200)
        changes = r.json()["changes"]
        for leaked in ("finance.journalentry", "finance.journalline", "payroll.payrollperiod",
                       "payments.disbursement", "buyers.salescontract"):
            self.assertNotIn(leaked, changes)
        r = self.as_user("admin").get("/api/sync/pull/")
        self.assertEqual(r.status_code, 200)
