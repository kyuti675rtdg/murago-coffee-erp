"""Phase 4 E2E scenario: the full farm-to-export chain in one flow.

farmer + plot -> cherry intake (mass in) -> lot -> FSM processing -> dry
milling outturn -> cupping approval -> warehouse storage (dual sign) ->
contract allocation -> FSM bag marking/packing/storing -> bagging/packing ->
container + export document checklist -> mass-balance reconciliation ->
lot split genealogy -> balanced finance journal -> buyer settlement (LC).
Quantities, genealogy and journal balance are asserted at each step.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.models import Organization, Role, Station, UserStationRole
from finance.models import Account, JournalEntry
from processing.models import Lot
from traceability.models import LotLineageEdge

User = get_user_model()


def mk_role(code):
    role, _ = Role.objects.get_or_create(code=code)
    return role


class FullChainE2ETests(TestCase):
    def setUp(self):
        org = Organization.objects.create(name="Murago")
        self.st = Station.objects.create(organization=org, code="MUR", name="Murago WS",
                                         station_type="washing", altitude_m=1950)
        self.admin = User.objects.create_user("admin", password="pw12345!", is_superuser=True)
        self.supervisor = User.objects.create_user("sup", password="pw12345!")
        self.finance = User.objects.create_user("fin", password="pw12345!")
        UserStationRole.objects.create(user=self.supervisor, role=mk_role("station_supervisor"), station=self.st)
        UserStationRole.objects.create(user=self.finance, role=mk_role("finance_manager"), station=self.st)
        c = APIClient()
        token, _ = Token.objects.get_or_create(user=self.admin)
        c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.c = c

    def post(self, path, payload, expect=(200, 201)):
        resp = self.c.post(path, payload, format="json")
        self.assertIn(resp.status_code, expect, f"POST {path} -> {resp.status_code}: {resp.data}")
        return resp.data

    def test_full_farm_to_export_chain(self):
        c = self.c
        # 1) Farmer registration + farm plot (EUDR GeoJSON polygon)
        farmer = self.post("/api/farmers/", {
            "farmer_code": "FRM-E2E-001", "full_name": "E2E Farmer", "station": str(self.st.id),
            "coffee_tree_count": 2000, "annual_cherry_cap_kg": "5000", "kyc_status": "verified"})
        plot = self.post("/api/farm-plots/", {
            "farmer": farmer["id"], "plot_name": "E2E Plot", "area_ha": "1.000", "elevation_m": 1980,
            "boundary_geojson": {"type": "Polygon", "coordinates": [[[38.414, 6.598], [38.419, 6.598],
                                                                     [38.419, 6.603], [38.414, 6.603], [38.414, 6.598]]]},
            "deforestation_free": True})
        self.assertTrue(plot["deforestation_free"])

        # 2) Lot creation, then cherry intake linked to it (mass in: 1000 kg payable)
        lot = self.post("/api/lots/", {
            "lot_code": "MUR-E2E-W-001", "station": str(self.st.id), "process_type": "washed",
            "current_stage": "harvesting_sorting", "cherry_kg": "1000", "current_weight_kg": "1000"})
        center = self.post("/api/collection-centers/", {"station": str(self.st.id), "code": "CC-E2E", "name": "E2E Center"})
        intake = self.post("/api/cherry-intakes/", {
            "intake_number": "INT-E2E-001", "farmer": farmer["id"], "center": center["id"],
            "station": str(self.st.id), "intake_date": str(date.today()), "gross_kg": "1020",
            "tare_kg": "20", "floater_deduction_pct": "0", "unit_price": "80",
            "qr_receipt_code": "QR-E2E-001", "lot": lot["id"]})
        self.assertEqual(intake["net_kg"], "1000.00")
        self.assertEqual(intake["payable_kg"], "1000.00")
        self.assertEqual(intake["total_amount"], "80000.00")

        # 3) FSM through wet processing (illegal skip must fail mid-chain too)
        bad = c.post(f"/api/lots/{lot['id']}/transition/", {"to_stage": "drying"}, format="json")
        self.assertEqual(bad.status_code, 400)
        for stage in ("receiving", "pulping", "fermenting", "washing"):
            self.post(f"/api/lots/{lot['id']}/transition/", {"to_stage": stage})
        lot_obj = Lot.objects.get(pk=lot["id"])
        self.assertIsNotNone(lot_obj.pulping_date)
        self.assertIsNotNone(lot_obj.washing_date)
        # Processing yield: 1000 kg cherry -> 200 kg parchment (20% benchmark)
        lot_obj.parchment_kg = Decimal("200"); lot_obj.current_weight_kg = Decimal("200"); lot_obj.save()
        for stage in ("drying", "conditioning"):
            self.post(f"/api/lots/{lot['id']}/transition/", {"to_stage": stage})

        # 4) Dry milling: 200 in -> 170 green + 28 husk + 2 loss (mass balanced)
        wo = self.post("/api/milling-work-orders/", {
            "order_number": "MWO-E2E-001", "mill_station": str(self.st.id), "input_lot": lot["id"],
            "scheduled_date": str(date.today())})
        out = self.post("/api/milling-outputs/", {
            "work_order": wo["id"], "input_kg": "200", "green_out_kg": "170",
            "husk_kg": "28", "loss_kg": "2"})
        self.assertEqual(out["input_kg"], "200.00")
        lot_obj.refresh_from_db(); lot_obj.green_kg = Decimal("170"); lot_obj.current_weight_kg = Decimal("170"); lot_obj.save()
        self.post(f"/api/lots/{lot['id']}/transition/", {"to_stage": "dry_milling"})

        # 5) Quality: cupping scorecard -> Q-grader approval for export
        cup = self.post("/api/cupping-scores/", {
            "lot": lot["id"], "cupped_on": str(date.today()),
            **{f: "8.5" for f in ("fragrance_aroma", "flavour", "aftertaste", "acidity", "body", "balance", "overall")},
            "uniformity": "10", "clean_cup": "10", "sweetness": "10"})
        self.assertEqual(cup["total_score"], "89.50")
        approval = self.post(f"/api/cupping-scores/{cup['id']}/decide/", {"decision": "approved", "grade": "1"})
        self.assertEqual(approval["decision"], "approved")

        # 6) Warehouse storage with dual sign-off
        store = self.post("/api/stores/", {"station": str(self.st.id), "code": "WH-GRN", "name": "Green Store", "coffee_form": "green"})
        receipt = self.post("/api/stock-receipts/", {
            "receipt_number": "RC-E2E-001", "store": store["id"], "lot": lot["id"],
            "received_date": str(date.today()), "weight_kg": "170", "bags": 3,
            "issued_by": self.supervisor.id, "received_by": self.admin.id})
        signed = self.post(f"/api/stock-receipts/{receipt['id']}/dual-sign/", {})
        self.assertEqual(signed["status"], "complete")

        # 7) Buyer + contract + lot allocation lock (170 kg of a 170 kg contract)
        buyer = self.post("/api/buyers/", {"code": "BUY-E2E", "company_name": "E2E Import GmbH", "country": "Germany"})
        contract = self.post("/api/sales-contracts/", {
            "contract_number": "SC-E2E-001", "buyer": buyer["id"], "grade": "1",
            "quantity_mt": "0.17", "quantity_bags": 3, "pricing_basis": "outright",
            "outright_price": "5.40", "incoterm": "FOB", "currency": "USD", "status": "signed"})
        alloc = self.post("/api/contract-allocations/", {
            "contract": contract["id"], "lot": lot["id"], "allocated_kg": "170", "allocated_bags": 3, "is_locked": True})
        self.assertTrue(alloc["is_locked"])
        over = c.post("/api/contract-allocations/", {
            "contract": contract["id"], "lot": lot["id"], "allocated_kg": "50", "allocated_bags": 1}, format="json")
        self.assertEqual(over.status_code, 400)  # exceeds contract capacity

        # 8) FSM: bag marking -> packing -> storing
        for stage in ("bag_marking", "packing", "storing"):
            self.post(f"/api/lots/{lot['id']}/transition/", {"to_stage": stage})

        # 9) Bagging/packing: 169.5 kg net packed
        marking = self.post("/api/bag-markings/", {
            "lot": lot["id"], "contract": contract["id"], "ico_mark": "ICO-ET-2026-001",
            "buyer_stencil": "E2E IMPORT GMBH", "bag_type": "jute_60kg", "crop_year": "2026"})
        packing = self.post("/api/packing-records/", {
            "marking": marking["id"], "packed_on": str(date.today()), "bags_packed": 3,
            "gross_kg": "171.00", "tare_kg": "1.50", "net_kg": "169.50"})
        self.assertEqual(packing["net_kg"], "169.50")

        # 10) Container + export document checklist gate
        container = self.post("/api/containers/", {
            "container_number": "MSKU-E2E-1", "seal_number": "SEAL-E2E", "contract": contract["id"],
            "station": str(self.st.id), "total_bags": 3, "total_net_kg": "169.50",
            "stuffed_on": str(date.today()), "status": "loading"})
        self.post("/api/container-lots/", {"container": container["id"], "marking": marking["id"], "bags": 3, "net_kg": "169.50"})
        early = c.post(f"/api/containers/{container['id']}/mark-ready/", {}, format="json")
        self.assertEqual(early.status_code, 400)  # documents missing
        for dt in ("ico_cert", "phytosanitary", "ecta", "commercial_invoice", "packing_list"):
            self.post("/api/export-documents/", {"container": container["id"], "contract": contract["id"],
                                                 "doc_type": dt, "document_number": f"E2E-{dt}"})
        chk = c.get(f"/api/containers/{container['id']}/checklist/")
        self.assertFalse(chk.data["complete"])
        self.assertIn("EUDR GeoJSON Dossier", chk.data["missing"])
        self.post("/api/export-documents/", {"container": container["id"], "contract": contract["id"],
                                              "doc_type": "eudr_dossier", "document_number": "E2E-eudr",
                                              "payload": {"type": "FeatureCollection", "features": []}})
        ready = self.post(f"/api/containers/{container['id']}/mark-ready/", {})
        self.assertEqual(ready["status"], "sealed")

        # 11) Mass-balance reconciliation across the whole chain
        lot_obj.refresh_from_db(); lot_obj.current_weight_kg = Decimal("169.50"); lot_obj.save()
        mb = self.post(f"/api/lots/{lot['id']}/mass-balance/", {})
        segments = {s["segment"]: s for s in mb["checks"]}
        self.assertEqual(segments["intake_to_cherry"]["status"], "ok")
        self.assertEqual(segments["cherry_to_parchment"]["status"], "ok")
        self.assertEqual(segments["parchment_to_green"]["status"], "ok")
        self.assertEqual(segments["green_to_bagged"]["status"], "ok")
        self.assertEqual(segments["bagged_to_exported"]["status"], "ok")
        self.assertEqual(mb["worst_status"], "ok")

        # 12) Genealogy: split the stored lot, lineage ratios preserved
        split = self.post(f"/api/lots/{lot['id']}/split/", {"splits": [{"lot_code": "MUR-E2E-W-001-A", "weight_kg": "69.50"}]})
        self.assertEqual(split["edges"][0]["ratio"], "0.4100")
        self.assertTrue(LotLineageEdge.objects.filter(parent_lot_id=lot["id"]).exists())
        trace = c.get(f"/api/lots/{lot['id']}/traceability/")
        self.assertEqual(len(trace.data["descendant_ids"]), 1)

        # 13) Finance: balanced journal posts; unbalanced is rejected
        cash = self.post("/api/accounts/", {"code": "1000", "name": "Cash ETB", "account_type": "asset", "currency": "ETB"})
        sales = self.post("/api/accounts/", {"code": "4000", "name": "Export Sales", "account_type": "revenue", "currency": "USD"})
        je = self.post("/api/journal-entries/", {"entry_number": "JE-E2E-001", "entry_date": str(date.today()),
                                                 "station": str(self.st.id), "description": "E2E export sale"})
        self.post("/api/journal-lines/", {"entry": je["id"], "account": cash["id"], "debit": "918.00", "credit": "0", "currency": "USD", "lot": lot["id"]})
        self.post("/api/journal-lines/", {"entry": je["id"], "account": sales["id"], "debit": "0", "credit": "918.00", "currency": "USD"})
        posted = self.post(f"/api/journal-entries/{je['id']}/post-entry/", {})
        self.assertEqual(posted["status"], "posted")
        entry_obj = JournalEntry.objects.get(pk=je["id"])
        self.assertTrue(entry_obj.is_balanced())  # 170 kg x 5.40 USD = 918.00

        # 14) Buyer settlement: LC proceeds + forex retention split
        proceeds = self.post("/api/export-proceeds/", {
            "contract": contract["id"], "settlement_type": "lc", "swift_reference": "SWIFT-E2E-001",
            "amount_usd": "918.00", "received_on": str(date.today()), "bank_name": "CBE", "is_reconciled": True})
        forex = self.post("/api/forex-retentions/", {
            "proceeds": proceeds["id"], "retention_pct": "30.00", "retained_usd": "275.40",
            "surrendered_usd": "642.60", "etb_credited": "0", "exchange_rate": "0"})
        self.assertEqual(forex["retained_usd"], "275.40")
        self.assertEqual(Decimal(proceeds["amount_usd"]), Decimal("918.00"))
