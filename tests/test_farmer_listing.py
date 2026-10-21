"""Farmer Listing Table contract: fields, production totals, edit, safe delete,
plus the management KPI additions on the dashboard endpoint."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class FarmerListingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_list_has_listing_fields_and_production(self):
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, 200)
        rows = r.json()["results"]
        self.assertGreaterEqual(len(rows), 26)
        demo = [x for x in rows if x["farmer_code"] == "FRM-2026-0103"][0]
        for field in ("farmer_code", "full_name", "phone", "region", "zone", "woreda",
                      "kebele", "station", "total_plot_ha", "coffee_variety",
                      "total_production_kg", "created_at", "is_active", "kyc_status"):
            self.assertIn(field, demo)
        self.assertEqual(demo["region"], "Sidama")
        self.assertTrue(demo["zone"])
        self.assertTrue(demo["coffee_variety"])
        self.assertGreater(float(demo["total_production_kg"]), 2000)

    def test_edit_farmer_via_patch(self):
        r = self.client.get("/api/farmers/")
        fid = [x for x in r.json()["results"] if x["farmer_code"] == "FRM-2026-0105"][0]["id"]
        r = self.client.patch(f"/api/farmers/{fid}/", {"phone": "0911223344", "zone": "Central Sidama"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["phone"], "0911223344")

    def test_delete_farmer_with_history_deactivates(self):
        r = self.client.get("/api/farmers/")
        fid = [x for x in r.json()["results"] if x["farmer_code"] == "FRM-2026-0103"][0]["id"]
        r = self.client.delete(f"/api/farmers/{fid}/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["deactivated"])
        from farmers.models import Farmer
        self.assertFalse(Farmer.objects.get(id=fid).is_active)

    def test_delete_fresh_farmer_hard_deletes(self):
        from core.models import Station
        mur = Station.objects.get(code="MUR")
        r = self.client.post("/api/farmers/", {
            "farmer_code": "FRM-TMP-001", "full_name": "Temporary Farmer",
            "station": str(mur.id), "region": "Sidama", "zone": "Central Sidama",
            "woreda": "Aleta Wondo", "kebele": "Murago", "coffee_variety": "74110"}, format="json")
        self.assertEqual(r.status_code, 201)
        fid = r.json()["id"]
        r = self.client.delete(f"/api/farmers/{fid}/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.client.get(f"/api/farmers/{fid}/").status_code, 404)

    def test_dashboard_management_kpis(self):
        r = self.client.get("/api/dashboard/")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        for key in ("procurement_cost_etb", "avg_price_per_kg", "active_farmers",
                    "active_farmer_pct", "pending_vouchers", "pending_bonuses",
                    "bonus_liability_etb", "top_station_code", "top_station_kg"):
            self.assertIn(key, d)
        self.assertGreater(float(d["procurement_cost_etb"]), 0)
        self.assertGreater(float(d["avg_price_per_kg"]), 0)
        self.assertEqual(d["top_station_code"], "MUR")
