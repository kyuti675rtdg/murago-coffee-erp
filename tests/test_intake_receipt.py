"""Record Intake flow: the weighbridge form posts only the fields an
operator types (farmer, center, station, date, weights, price). The API
must compute net/payable/total, auto-generate the intake number and the
QR receipt code, and never 400 on the missing computed fields."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class IntakeReceiptTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        farmers = self.client.get("/api/farmers/").json()["results"]
        self.farmer = [f for f in farmers if f["farmer_code"] == "FRM-2026-0101"][0]
        centers = self.client.get("/api/collection-centers/").json()["results"]
        self.center = centers[0]
        stations = self.client.get("/api/stations/").json()["results"]
        self.station = [s for s in stations if s["code"] == "MUR"][0]

    def _payload(self):
        # exactly what the form sends — no net_kg / intake_number / qr code
        return {"farmer": self.farmer["id"], "center": self.center["id"],
                "station": self.station["id"], "intake_date": "2026-10-21",
                "coffee_variety": "74110", "gross_kg": 120, "tare_kg": 5,
                "floater_deduction_pct": 2, "unit_price": 85}

    def test_form_payload_creates_intake_with_computed_fields(self):
        r = self.client.post("/api/cherry-intakes/", self._payload(), format="json")
        self.assertEqual(r.status_code, 201, r.content)
        d = r.json()
        self.assertEqual(float(d["net_kg"]), 115.0)
        self.assertEqual(float(d["payable_kg"]), 112.7)
        self.assertEqual(float(d["total_amount"]), 9579.5)
        self.assertTrue(d["intake_number"].startswith("INT-2026-"))
        self.assertEqual(d["qr_receipt_code"], f"QR-{d['intake_number']}")

    def test_second_intake_gets_unique_number_and_qr(self):
        r1 = self.client.post("/api/cherry-intakes/", self._payload(), format="json")
        r2 = self.client.post("/api/cherry-intakes/", self._payload(), format="json")
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)
        self.assertNotEqual(r1.json()["intake_number"], r2.json()["intake_number"])
        self.assertNotEqual(r1.json()["qr_receipt_code"], r2.json()["qr_receipt_code"])
