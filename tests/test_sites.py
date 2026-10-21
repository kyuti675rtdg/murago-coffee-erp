"""Site management: profiles, equipment, site roles, performance API."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class SiteManagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_stations_have_profiles_and_second_station_exists(self):
        from core.models import Station
        ben = Station.objects.get(code="BEN")
        self.assertEqual(ben.daily_cherry_capacity_kg, 12000)
        self.assertTrue(ben.latitude)
        self.assertEqual(ben.processing_methods, ["washed"])
        mur = Station.objects.get(code="MUR")
        self.assertEqual(mur.drying_bed_count, 42)
        self.assertTrue(mur.has_generator)

    def test_equipment_register(self):
        from core.models import StationEquipment
        self.assertGreaterEqual(StationEquipment.objects.count(), 13)
        r = self.client.get("/api/station-equipment/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()["results"]), 13)

    def test_site_roles_and_users_seeded(self):
        from core.models import Role, UserStationRole
        for code in ("site_manager", "procurement_officer", "weighing_clerk",
                     "quality_controller", "warehouse_officer", "field_officer", "finance_officer"):
            self.assertTrue(Role.objects.filter(code=code).exists(), code)
        self.assertTrue(UserStationRole.objects.filter(
            user__username="sitemanager_ben", role__code="site_manager",
            station__code="BEN").exists())

    def test_performance_comparison(self):
        r = self.client.get("/api/site-performance/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        by_code = {s["code"]: s for s in body["stations"]}
        self.assertIn("MUR", by_code); self.assertIn("BEN", by_code); self.assertIn("ADD", by_code)
        self.assertGreater(float(by_code["BEN"]["collected_kg"]), 5000)
        self.assertGreater(float(by_code["MUR"]["collected_kg"]), 0)
        # Bensa's out-of-service pulper must surface as a critical alert
        self.assertTrue(any(a["level"] == "critical" for a in by_code["BEN"]["alerts"]))
        self.assertIsNotNone(by_code["BEN"]["avg_quality"])

    def test_performance_detail_drilldown(self):
        from core.models import Station
        ben = Station.objects.get(code="BEN")
        r = self.client.get(f"/api/site-performance/{ben.id}/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["daily_series"])
        self.assertEqual(len(body["top_farmers"]), 6)
        self.assertTrue(any(s["username"] == "sitemanager_ben" for s in body["staff"]))
        self.assertTrue(body["equipment"])
        self.assertEqual(body["profile"]["code"], "BEN")

    def test_weighing_clerk_scope(self):
        from core.models import Station
        from farmers.models import Farmer
        from collection.models import CollectionCenter
        clerk = get_user_model().objects.get(username="weigher1")
        c = APIClient(); c.force_authenticate(clerk)
        farmer = Farmer.objects.filter(station__code="MUR").first()
        center = CollectionCenter.objects.filter(station__code="MUR").first()
        mur = Station.objects.get(code="MUR")
        r = c.post("/api/cherry-intakes/", {
            "intake_number": "INT-TEST-W1", "farmer": str(farmer.id), "center": str(center.id),
            "station": str(mur.id), "intake_date": "2026-10-20", "gross_kg": "100", "tare_kg": "2",
            "floater_deduction_pct": "3", "unit_price": "85", "qr_receipt_code": "QR-INT-TEST-W1"},
            format="json")
        self.assertEqual(r.status_code, 201)
        # ...but payroll is outside the clerk's role
        r = c.post("/api/payroll-periods/", {"name": "X"}, format="json")
        self.assertEqual(r.status_code, 403)
        # ...and finance reads are restricted
        r = c.get("/api/journal-entries/")
        self.assertEqual(r.status_code, 403)
        # ...and the clerk only sees their own station in performance
        r = c.get("/api/site-performance/")
        self.assertEqual(r.status_code, 200)
        codes = {s["code"] for s in r.json()["stations"]}
        self.assertEqual(codes, {"MUR"})
