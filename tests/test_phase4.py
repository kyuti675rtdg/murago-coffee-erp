"""Phase 4 tests: journal balance enforcement, voucher approval hierarchy,
stock reconciliation, export checklist, mass-balance flags, notifications, backup."""
import os
import tempfile
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.models import Notification, Organization, Role, Station, UserStationRole
from exports.checklist import ChecklistError, document_checklist, mark_container_ready
from exports.models import ContainerLoading, ExportDocument
from finance.models import Account, JournalEntry, JournalLine
from inventory.models import InventoryItem, StockAdjustment, StockAudit
from processing.models import Lot
from procurement.models import PurchaseVoucher, Supplier
from sysconf.models import ThresholdConfig

User = get_user_model()


def mk_role(code):
    role, _ = Role.objects.get_or_create(code=code)
    return role


class P4Base(TestCase):
    def setUp(self):
        org = Organization.objects.create(name="Murago")
        self.st = Station.objects.create(organization=org, code="MUR", name="Murago WS", station_type="washing")
        self.admin = User.objects.create_user("admin", password="pw12345!", is_superuser=True)
        self.supervisor = User.objects.create_user("sup", password="pw12345!")
        self.finance = User.objects.create_user("fin", password="pw12345!")
        self.operator = User.objects.create_user("op", password="pw12345!")
        UserStationRole.objects.create(user=self.supervisor, role=mk_role("station_supervisor"), station=self.st)
        UserStationRole.objects.create(user=self.finance, role=mk_role("finance_manager"), station=self.st)
        UserStationRole.objects.create(user=self.operator, role=mk_role("machine_operator"), station=self.st)

    def api_client(self, user):
        c = APIClient()
        token, _ = Token.objects.get_or_create(user=user)
        c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return c


class JournalBalanceTests(P4Base):
    _seq = 0

    def _entry(self, balanced=True):
        JournalBalanceTests._seq += 1
        n = JournalBalanceTests._seq
        a1 = Account.objects.create(code=f"10{n}0", name="Cash", account_type="asset")
        a2 = Account.objects.create(code=f"40{n}0", name="Sales", account_type="revenue")
        e = JournalEntry.objects.create(entry_number=f"JE-{n}", entry_date=date.today(), description="sale", station=self.st)
        JournalLine.objects.create(entry=e, account=a1, debit=Decimal("1000"), credit=0)
        JournalLine.objects.create(entry=e, account=a2, debit=0, credit=Decimal("1000") if balanced else Decimal("900"))
        return e

    def test_model_blocks_posting_unbalanced(self):
        e = self._entry(balanced=False)
        e.status = "posted"
        with self.assertRaises(ValidationError):
            e.save()

    def test_post_endpoint(self):
        bad = self._entry(balanced=False)
        resp = self.api_client(self.finance).post(f"/api/journal-entries/{bad.id}/post-entry/", {}, format="json")
        self.assertEqual(resp.status_code, 400)
        good = self._entry(balanced=True)
        # second entry reuses same accounts fine; post it
        resp2 = self.api_client(self.finance).post(f"/api/journal-entries/{good.id}/post-entry/", {}, format="json")
        self.assertEqual(resp2.status_code, 200, resp2.data)
        self.assertEqual(resp2.data["status"], "posted")
        # lines of a posted journal are frozen
        line_id = good.lines.first().id
        resp3 = self.api_client(self.admin).patch(f"/api/journal-lines/{line_id}/", {"memo": "x"}, format="json")
        self.assertEqual(resp3.status_code, 400)


class VoucherHierarchyTests(P4Base):
    def _voucher(self, amount, creator):
        s = Supplier.objects.create(code=f"S-{amount}", name="Coop")
        return PurchaseVoucher.objects.create(
            voucher_number=f"V-{amount}-{creator.username}", station=self.st, supplier=s,
            voucher_date=date.today(), quantity_kg=Decimal("100"), unit_price=Decimal("10"),
            total_amount=Decimal(amount), status="pending", created_by=creator)

    def test_supervisor_cannot_approve_above_level(self):
        v = self._voucher("100000", self.admin)
        resp = self.api_client(self.supervisor).post(f"/api/purchase-vouchers/{v.id}/approve/", {}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_finance_approves_mid_level_and_admin_top_level(self):
        v = self._voucher("100000", self.admin)
        resp = self.api_client(self.finance).post(f"/api/purchase-vouchers/{v.id}/approve/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        v2 = self._voucher("900000", self.supervisor)
        resp2 = self.api_client(self.admin).post(f"/api/purchase-vouchers/{v2.id}/approve/", {}, format="json")
        self.assertEqual(resp2.status_code, 200)

    def test_creator_cannot_approve_own(self):
        v = self._voucher("40000", self.supervisor)
        resp = self.api_client(self.supervisor).post(f"/api/purchase-vouchers/{v.id}/approve/", {}, format="json")
        self.assertEqual(resp.status_code, 403)


class StockReconcileTests(P4Base):
    def _audit(self, approver):
        item = InventoryItem.objects.create(sku="BAG-60", name="Jute bag 60kg", category="jute_bags")
        audit = StockAudit.objects.create(audit_number="AUD-1", station=self.st, audit_date=date.today(),
                                          conducted_by=self.supervisor)
        StockAdjustment.objects.create(audit=audit, item=item, book_qty=Decimal("100"), counted_qty=Decimal("95"),
                                       variance_reason="damaged bags", approved_by=approver)
        return audit, item

    def test_reconcile_blocked_when_approver_is_conductor(self):
        audit, _item = self._audit(self.supervisor)
        resp = self.api_client(self.admin).post(f"/api/stock-audits/{audit.id}/reconcile/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_reconcile_posts_adjustment_movement(self):
        audit, item = self._audit(self.finance)
        resp = self.api_client(self.admin).post(f"/api/stock-audits/{audit.id}/reconcile/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["movements_posted"], 1)
        self.assertEqual(item.stock_at(self.st), Decimal("-5"))


class ExportChecklistTests(P4Base):
    def test_checklist_and_mark_ready(self):
        c = ContainerLoading.objects.create(container_number="MSKU-1", seal_number="SEAL-1", station=self.st,
                                            total_bags=10, total_net_kg=Decimal("600"), status="loading")
        self.assertFalse(document_checklist(c)["complete"])
        with self.assertRaises(ChecklistError):
            mark_container_ready(c)
        for dt in ("ico_cert", "phytosanitary", "ecta", "commercial_invoice", "packing_list", "eudr_dossier"):
            ExportDocument.objects.create(container=c, doc_type=dt, document_number=f"DOC-{dt}")
        self.assertTrue(document_checklist(c)["complete"])
        mark_container_ready(c)
        self.assertEqual(c.status, "sealed")


class MassBalanceNotificationTests(P4Base):
    def test_critical_mass_balance_flags_and_notifies(self):
        lot = Lot.objects.create(lot_code="MB-1", station=self.st, process_type="washed",
                                 current_stage="drying", cherry_kg=Decimal("1000"),
                                 parchment_kg=Decimal("90"), current_weight_kg=Decimal("90"))
        resp = self.api_client(self.admin).post(f"/api/lots/{lot.id}/mass-balance/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["worst_status"], "critical")
        self.assertTrue(Notification.objects.filter(user=self.supervisor, category="anomaly").exists())

    def test_fuel_anomaly_creates_notification(self):
        ThresholdConfig.objects.create(station=self.st, max_fuel_ratio_l_per_kg=Decimal("0.01000"),
                                       max_water_ratio_l_per_kg=Decimal("8"))
        resp = self.api_client(self.operator).post("/api/fuel-entries/", {
            "station": str(self.st.id), "entry_date": "2026-10-21", "machine_label": "Gen 9",
            "fuel_purchased_litres": "50", "fuel_added_litres": "50", "cherry_pulped_kg": "1000"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(resp.data["is_anomaly"])
        n = Notification.objects.filter(user=self.supervisor, category="anomaly")
        self.assertTrue(n.exists())
        c = self.api_client(self.supervisor)
        count = c.get("/api/notifications/unread-count/")
        self.assertGreaterEqual(count.data["unread"], 1)
        nid = n.first().id
        read = c.post(f"/api/notifications/{nid}/mark-read/", {}, format="json")
        self.assertEqual(read.status_code, 200)
        self.assertTrue(read.data["is_read"])


class AttendanceUpsertTests(P4Base):
    def test_grid_cell_resave_updates_instead_of_duplicating(self):
        from hr.models import AttendanceEntry, AttendanceSheet, Worker
        sheet = AttendanceSheet.objects.create(station=self.st, ethiopian_month=3, ethiopian_year=2018)
        w = Worker.objects.create(worker_code="W-U", full_name="Upsert Worker", station=self.st,
                                  wage_type="daily", wage_rate=Decimal("300"))
        c = self.api_client(self.supervisor)
        payload = {"sheet": str(sheet.id), "worker": str(w.id), "day": 5, "mark": "present", "hours": "8", "pieces": "0"}
        r1 = c.post("/api/attendance-entries/", payload, format="json")
        self.assertEqual(r1.status_code, 201)
        payload["mark"] = "half"; payload["hours"] = "4"
        r2 = c.post("/api/attendance-entries/", payload, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(AttendanceEntry.objects.filter(sheet=sheet, worker=w, day=5).count(), 1)
        self.assertEqual(AttendanceEntry.objects.get(sheet=sheet, worker=w, day=5).mark, "half")


class BackupTests(P4Base):
    def test_backup_command_produces_file(self):
        with tempfile.TemporaryDirectory() as td:
            call_command("backup_db", out=td)
            files = os.listdir(td)
            self.assertEqual(len(files), 1)
            self.assertTrue(files[0].startswith("murago-backup-"))
            self.assertGreater(os.path.getsize(os.path.join(td, files[0])), 0)
