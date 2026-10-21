"""Seed 20 realistic demo farmers with complete profiles.

Idempotent (get_or_create keyed throughout — safe to re-run, and safe on
every boot from seed_demo): full farmer registry rows, farm plots with
GeoJSON boundaries, certifications, two seasons of cherry intakes
(2025 history + 2026 current season), purchase vouchers, disbursement
payment records, cupping-linked lots for quality history, next-year
(2027) season plans, and the default 2026 bonus scheme computed through
the real scoring engine — with a few calculations approved and paid so
the full workflow is visible in the UI.
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

FARMERS = [
    # name, gender, kebele, family, trees, plot_ha, cap_kg
    ("Alemayehu Bekele", "male", "Arbegona", 7, 5200, "2.750", "12500"),
    ("Tigist Haile", "female", "Arbegona", 5, 3100, "1.600", "7600"),
    ("Girma Tadesse", "male", "Dale", 6, 4400, "2.300", "10800"),
    ("Meseret Alemu", "female", "Dale", 4, 2600, "1.350", "6400"),
    ("Dereje Worku", "male", "Aleta Wondo", 8, 6100, "3.200", "14900"),
    ("Hanna Girma", "female", "Aleta Wondo", 3, 1950, "1.050", "4700"),
    ("Solomon Desta", "male", "Arbegona", 6, 4800, "2.500", "11700"),
    ("Rahel Tesfaye", "female", "Bensa", 5, 3350, "1.800", "8200"),
    ("Yonas Mekonnen", "male", "Bensa", 7, 5600, "2.900", "13600"),
    ("Frehiwot Assefa", "female", "Dale", 4, 2200, "1.150", "5400"),
    ("Tadesse Negash", "male", "Arbegona", 9, 6800, "3.500", "16400"),
    ("Selam Woldemariam", "female", "Aleta Wondo", 5, 2900, "1.500", "7100"),
    ("Bereket Alemayehu", "male", "Bensa", 6, 3950, "2.050", "9600"),
    ("Marta Kifle", "female", "Dale", 3, 1750, "0.900", "4300"),
    ("Samuel Girma", "male", "Arbegona", 5, 4600, "2.400", "11200"),
    ("Lidya Assefa", "female", "Bensa", 4, 2400, "1.250", "5900"),
    ("Daniel Teshome", "male", "Aleta Wondo", 6, 5050, "2.650", "12300"),
    ("Genet Abebe", "female", "Arbegona", 7, 3600, "1.900", "8800"),
    ("Kifle Mohammed", "male", "Dale", 5, 4150, "2.150", "10100"),
    ("Aster Negash", "female", "Bensa", 4, 2050, "1.100", "5000"),
]

VARIETIES = ["Heirloom Kurume", "Heirloom Wolisho", "75227", "74110", "Heirloom Dega"]


class Command(BaseCommand):
    help = "Seed 20 demo farmers with profiles, procurement history, plans and bonuses."

    def handle(self, *args, **opts):
        from collection.models import CherryIntake, CollectionCenter
        from core.models import Organization, Station
        from farmers.bonus import run_scheme
        from farmers.models import (BonusCalculation, BonusScheme, BonusTier, Certification,
                                    Farmer, FarmerSeasonPlan, FarmPlot)
        from payments.models import Disbursement
        from processing.models import Lot
        from procurement.models import PurchaseVoucher
        from quality.models import CuppingScore

        org, _ = Organization.objects.get_or_create(name="Murago Coffee / Bean Power ERP",
                                                    defaults={"country": "Ethiopia"})
        station, _ = Station.objects.get_or_create(code="MUR", defaults={
            "organization": org, "name": "Murago Washing Station", "station_type": "washing",
            "region": "Sidama", "woreda": "Arbegona"})
        center, _ = CollectionCenter.objects.get_or_create(code="CC-MUR-01", defaults={
            "station": station, "name": "Murago Collection Center 01", "altitude_m": 1950})
        center2, _ = CollectionCenter.objects.get_or_create(code="CC-MUR-02", defaults={
            "station": station, "name": "Murago Collection Center 02", "altitude_m": 2080})

        # ---- default bonus scheme (Settings-editable) ----
        scheme, _ = BonusScheme.objects.get_or_create(
            name="2026 Season Loyalty & Quality Bonus", season_year=2026,
            defaults={"is_active": True, "min_eligible_kg": Decimal("300"),
                      "quality_bands": [{"min_score": 86, "multiplier": 1.25},
                                        {"min_score": 83, "multiplier": 1.10},
                                        {"min_score": 80, "multiplier": 1.00}],
                      "notes": "Second payment: kg tier rate x quality multiplier."})
        for frm, to, rate, label in [(Decimal("300"), Decimal("1000"), Decimal("2.00"), "Bronze"),
                                     (Decimal("1000"), Decimal("2500"), Decimal("3.50"), "Silver"),
                                     (Decimal("2500"), None, Decimal("5.00"), "Gold")]:
            BonusTier.objects.get_or_create(scheme=scheme, from_kg=frm,
                                            defaults={"to_kg": to, "rate_per_kg": rate, "label": label})

        created_farmers = 0
        for idx, (name, gender, kebele, family, trees, ha, cap) in enumerate(FARMERS, start=1):
            rng = random.Random(20260 + idx)
            code = f"FRM-2026-{100 + idx:04d}"
            farmer, created = Farmer.objects.get_or_create(farmer_code=code, defaults={
                "full_name": name, "gender": gender, "phone": f"09{rng.randint(10000000, 99999999)}",
                "national_id_number": f"ET{rng.randint(100000000, 999999999)}" if idx % 5 else "",
                "station": station, "kebele": kebele, "family_size": family,
                "coffee_tree_count": trees, "total_plot_ha": Decimal(ha),
                "annual_cherry_cap_kg": Decimal(cap),
                "kyc_status": "verified" if idx % 6 else "pending"})
            created_farmers += int(created)
            lat, lon = 6.55 + idx * 0.004, 38.38 + idx * 0.005
            FarmPlot.objects.get_or_create(farmer=farmer, plot_name=f"{kebele} Plot 1", defaults={
                "area_ha": Decimal(ha), "elevation_m": rng.randint(1750, 2250),
                "coffee_variety": VARIETIES[idx % len(VARIETIES)], "tree_count": trees,
                "deforestation_free": idx % 7 != 0,
                "boundary_geojson": {"type": "Polygon", "coordinates": [[
                    [lon, lat], [lon + 0.004, lat], [lon + 0.004, lat + 0.003],
                    [lon, lat + 0.003], [lon, lat]]]}})
            if idx % 3 == 0:
                Certification.objects.get_or_create(
                    farmer=farmer, cert_type="organic" if idx % 2 else "rainforest",
                    defaults={"certificate_number": f"CERT-2026-{idx:03d}",
                              "issued_on": date(2026, 1, 15), "expires_on": date(2028, 1, 14)})

            # ---- intakes: 2025 history + 2026 current season ----
            season_kg_2026 = Decimal("0")
            for year, n_deliveries, base_month in [(2025, rng.randint(3, 5), 10), (2026, rng.randint(2, 5), 10)]:
                for d in range(n_deliveries):
                    month = base_month + (d % 3)
                    day = rng.randint(2, 26)
                    gross = Decimal(rng.randint(140, 880))
                    tare = (gross * Decimal("0.02")).quantize(Decimal("0.01"))
                    intake, _ = CherryIntake.objects.get_or_create(
                        intake_number=f"INT-{year}-{1000 + idx * 20 + (0 if year == 2025 else 10) + d}",
                        defaults={"farmer": farmer, "center": center if d % 2 else center2,
                                  "station": station, "intake_date": date(year, month, day),
                                  "coffee_variety": VARIETIES[idx % len(VARIETIES)],
                                  "site_altitude_m": rng.randint(1750, 2250),
                                  "gross_kg": gross, "tare_kg": tare,
                                  "floater_deduction_pct": Decimal(rng.randint(2, 8)),
                                  "unit_price": Decimal(rng.randint(78, 92)),
                                  "qr_receipt_code": f"QR-INT-{year}-{1000 + idx * 20 + (0 if year == 2025 else 10) + d}"})
                    if year == 2026:
                        season_kg_2026 += intake.payable_kg
            if float(season_kg_2026) != float(farmer.delivered_this_season_kg or 0):
                farmer.delivered_this_season_kg = season_kg_2026
                farmer.save(update_fields=["delivered_this_season_kg"])

            # ---- a voucher + payment record for most farmers ----
            if idx % 4 != 0:
                voucher, _ = PurchaseVoucher.objects.get_or_create(
                    voucher_number=f"PV-2026-{2000 + idx}",
                    defaults={"station": station, "farmer": farmer, "voucher_date": date(2026, 10, 12),
                              "quantity_kg": (season_kg_2026 / 2).quantize(Decimal("0.01")),
                              "unit_price": Decimal("85.00"),
                              "total_amount": (season_kg_2026 / 2 * Decimal("85.00")).quantize(Decimal("0.01")),
                              "status": "paid" if idx % 3 else "approved"})
                if voucher.status == "paid":
                    Disbursement.objects.get_or_create(
                        reference=f"PAY-2026-{3000 + idx}",
                        defaults={"payee_type": "farmer", "farmer": farmer, "voucher": voucher,
                                  "amount": voucher.total_amount,
                                  "method": ["cash", "bank", "mobile"][idx % 3],
                                  "paid_on": date(2026, 10, 14), "status": "paid"})

            # ---- quality: cupping for every 3rd farmer via a linked lot ----
            if idx % 3 == 0:
                lot, _ = Lot.objects.get_or_create(lot_code=f"MUR-DEMO-{idx:02d}", defaults={
                    "station": station, "process_type": "washed", "current_stage": "drying",
                    "altitude_m": 1980, "variety": "Heirloom", "cherry_kg": Decimal("2000"),
                    "current_weight_kg": Decimal("420")})
                CherryIntake.objects.filter(farmer=farmer, intake_date__year=2026).update(lot=lot)
                base = Decimal("7.9") + Decimal(idx % 4) * Decimal("0.18")
                CuppingScore.objects.get_or_create(lot=lot, cupped_on=date(2026, 10, 15), defaults={
                    "fragrance_aroma": base, "flavour": base, "aftertaste": base,
                    "acidity": base + Decimal("0.1"), "body": base, "balance": base,
                    "uniformity": Decimal("8.4"), "clean_cup": Decimal("8.4"),
                    "sweetness": base, "overall": base})

            # ---- next-year plan (2027) ----
            FarmerSeasonPlan.objects.get_or_create(farmer=farmer, plan_year=2027, defaults={
                "planned_cherry_kg": (season_kg_2026 * Decimal("1.2")).quantize(Decimal("0.01")),
                "planned_new_trees": rng.randint(100, 600),
                "planned_area_expansion_ha": Decimal(rng.choice(["0.00", "0.10", "0.25", "0.50"])),
                "inputs_support": rng.choice([
                    "Kurume seedlings + compost training", "Fertiliser support on credit",
                    "Pruning tools and agronomy follow-up", "Seedlings for gap filling; no credit needed"]),
                "agronomy_notes": "Plan agreed at kebele farmer meeting, Oct 2026.",
                "status": ["draft", "submitted", "approved"][idx % 3]})

        # ---- run the real bonus engine, then show the workflow states ----
        calcs = run_scheme(scheme)
        admin = None
        from django.contrib.auth import get_user_model
        admin = get_user_model().objects.filter(username="admin").first()
        paid_refs = 0
        for pos, calc in enumerate(sorted(calcs, key=lambda c: c.gross_bonus_etb, reverse=True)):
            if pos < 3 and calc.gross_bonus_etb > 0 and calc.status in ("pending_approval", "calculated"):
                calc.status = BonusCalculation.Status.APPROVED
                calc.approved_by = admin
                calc.approved_at = timezone.now()
                calc.save(update_fields=["status", "approved_by", "approved_at"])
                disb, _ = Disbursement.objects.get_or_create(
                    reference=f"BONUS-2026-{calc.farmer.farmer_code}-{str(calc.id)[:8]}",
                    defaults={"payee_type": "farmer", "farmer": calc.farmer,
                              "amount": calc.gross_bonus_etb, "method": "bank",
                              "paid_on": date.today(), "status": "paid", "paid_by": admin})
                calc.disbursement = disb
                calc.status = BonusCalculation.Status.PAID
                calc.save(update_fields=["disbursement", "status"])
                paid_refs += 1
            elif pos < 6 and calc.status in ("pending_approval", "calculated"):
                calc.status = BonusCalculation.Status.APPROVED
                calc.approved_by = admin
                calc.approved_at = timezone.now()
                calc.save(update_fields=["status", "approved_by", "approved_at"])

        self.stdout.write(self.style.SUCCESS(
            f"Demo farmers seeded: {created_farmers} new of 20 · bonus calculations: {len(calcs)} · paid: {paid_refs}"))
