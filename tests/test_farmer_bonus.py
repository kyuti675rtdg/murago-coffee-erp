"""Farmer profile, season plans and the bonus workflow (calculate → approve → pay)."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class FarmerBonusTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_demo_farmers_seeded_with_history(self):
        from farmers.models import Farmer, FarmerSeasonPlan
        self.assertGreaterEqual(Farmer.objects.filter(farmer_code__startswith="FRM-2026-01").count(), 20)
        self.assertEqual(FarmerSeasonPlan.objects.filter(plan_year=2027).count(), 20)

    def test_profile_endpoint_aggregates(self):
        from farmers.models import Farmer
        farmer = Farmer.objects.get(farmer_code="FRM-2026-0101")
        r = self.client.get(f"/api/farmers/{farmer.id}/profile/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["farmer"]["farmer_code"], "FRM-2026-0101")
        self.assertGreater(Decimal(body["stats"]["total_delivered_kg"]), 0)
        self.assertGreaterEqual(len(body["procurement_history"]), 5)
        self.assertEqual(len(body["plans"]), 1)
        self.assertEqual(len(body["bonuses"]), 1)

    def test_bonus_run_and_approval_flow(self):
        from farmers.models import BonusCalculation, BonusScheme
        scheme = BonusScheme.objects.get(season_year=2026)
        r = self.client.post("/api/bonus-calculations/run/", {"scheme": str(scheme.id)}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["calculated"], 20)

        calc = (BonusCalculation.objects.filter(status="pending_approval", gross_bonus_etb__gt=0)
                .order_by("-gross_bonus_etb").first())
        self.assertIsNotNone(calc)
        # cannot pay before approval
        r = self.client.post(f"/api/bonus-calculations/{calc.id}/pay/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        # approve, then pay → disbursement created and linked
        r = self.client.post(f"/api/bonus-calculations/{calc.id}/approve/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "approved")
        r = self.client.post(f"/api/bonus-calculations/{calc.id}/pay/", {"method": "bank"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "paid")
        self.assertTrue(r.json()["disbursement"])

    def test_bonus_tier_and_quality_math(self):
        from farmers.bonus import quality_multiplier_for, tier_for
        from farmers.models import BonusScheme
        scheme = BonusScheme.objects.get(season_year=2026)
        _t, rate = tier_for(scheme, Decimal("2600"))
        self.assertEqual(rate, Decimal("5.00"))
        _t, rate = tier_for(scheme, Decimal("500"))
        self.assertEqual(rate, Decimal("2.00"))
        self.assertEqual(quality_multiplier_for(scheme, Decimal("87")), Decimal("1.25"))
        self.assertEqual(quality_multiplier_for(scheme, Decimal("84")), Decimal("1.10"))
        self.assertEqual(quality_multiplier_for(scheme, None), Decimal("1"))

    def test_plan_create_via_api(self):
        from farmers.models import Farmer
        farmer = Farmer.objects.get(farmer_code="FRM-2026-0102")
        r = self.client.post("/api/farmer-season-plans/", {
            "farmer": str(farmer.id), "plan_year": 2028, "planned_cherry_kg": "9000",
            "planned_new_trees": 300, "status": "draft"}, format="json")
        self.assertEqual(r.status_code, 201)
