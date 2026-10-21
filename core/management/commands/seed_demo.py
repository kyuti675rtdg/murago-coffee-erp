"""Idempotent demo seed for Murago Coffee ERP (explorable live deployment).

Creates: organization, Murago station + Addis central warehouse, all roles,
demo users (admin + supervisor + operator + q-grader, signature PIN 1234),
farmers + plot, collection center + intake, a lot mid-pipeline (Drying),
drying bed, fuel + water entries (ratios computed by the real calculators),
workers + a dual-verified attendance sheet + entries, thresholds, buyer +
contract. Safe to re-run: everything is get_or_create keyed.
Demo credentials are documented ONLY in the delivery docs as demo logins.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()
DEMO_PASSWORD = "MuragoAdmin2026!"


class Command(BaseCommand):
    help = "Seed idempotent Murago demo data"

    def handle(self, *args, **opts):
        from core.models import Organization, Role, SignatureCredential, Station, UserStationRole
        from sysconf.models import ThresholdConfig as TC
        from farmers.models import Farmer, FarmPlot
        from collection.models import CollectionCenter, CherryIntake
        from processing.models import DryingBed, Lot
        from resources.models import FuelRegisterEntry, WaterRegisterEntry
        from resources import calculators
        from hr.models import AttendanceEntry, AttendanceSheet, Worker
        from hr_payroll.engine import verify_attendance_sheet
        from buyers.models import Buyer, SalesContract

        org, _ = Organization.objects.get_or_create(name="Murago Coffee / Bean Power ERP",
                                                    defaults={"legal_name": "Murago Coffee Processing PLC", "tin": "0012345678"})
        station, _ = Station.objects.get_or_create(code="MUR", defaults={
            "organization": org, "name": "Murago Washing Station", "station_type": "washing",
            "region": "Sidama", "woreda": "Aleta Wondo", "altitude_m": 1950,
            "latitude": Decimal("6.600000"), "longitude": Decimal("38.416700")})
        addis, _ = Station.objects.get_or_create(code="ADD", defaults={
            "organization": org, "name": "Addis Central Warehouse", "station_type": "central_warehouse",
            "region": "Addis Ababa", "altitude_m": 2355})

        roles = {}
        for code, label in Role.RoleCode.choices:
            roles[code], _ = Role.objects.get_or_create(code=code, defaults={"description": label})

        def mkuser(username, role_code, stn=station, staff=False, superuser=False):
            u, created = User.objects.get_or_create(username=username, defaults={
                "email": f"{username}@murago.local", "is_staff": staff or superuser, "is_superuser": superuser})
            if created or not u.has_usable_password():
                u.set_password(DEMO_PASSWORD); u.save()
            UserStationRole.objects.get_or_create(user=u, role=roles[role_code], station=stn)
            cred, c = SignatureCredential.objects.get_or_create(user=u, defaults={"pin_hash": ""})
            if c or not cred.pin_hash:
                cred.set_pin("1234"); cred.save()
            return u

        admin = mkuser("admin", "admin", None, staff=True, superuser=True)
        supervisor = mkuser("supervisor", "station_supervisor")
        operator = mkuser("operator", "machine_operator")
        qgrader = mkuser("qgrader", "q_grader")
        finance = mkuser("finance", "finance_manager")

        TC.objects.get_or_create(station=station, defaults={
            "moisture_min_pct": Decimal("10.5"), "moisture_max_pct": Decimal("11.5"),
            "max_fuel_ratio_l_per_kg": Decimal("0.05000"), "max_water_ratio_l_per_kg": Decimal("8.00000"),
            "max_transit_shrinkage_pct": Decimal("1.00")})

        farmer, _ = Farmer.objects.get_or_create(farmer_code="FRM-2026-0001", defaults={
            "full_name": "Zenebe Genale", "gender": "male", "phone": "0911000001", "station": station,
            "kebele": "Murago", "family_size": 6, "coffee_tree_count": 2400,
            "total_plot_ha": Decimal("1.250"), "annual_cherry_cap_kg": Decimal("6000"),
            "kyc_status": "verified"})
        farmer2, _ = Farmer.objects.get_or_create(farmer_code="FRM-2026-0002", defaults={
            "full_name": "Tigist Alemu", "gender": "female", "phone": "0911000002", "station": station,
            "kebele": "Murago", "family_size": 4, "coffee_tree_count": 1800,
            "total_plot_ha": Decimal("0.950"), "annual_cherry_cap_kg": Decimal("4500"), "kyc_status": "verified"})
        FarmPlot.objects.get_or_create(farmer=farmer, plot_name="Murago Plot A", defaults={
            "area_ha": Decimal("1.250"), "elevation_m": 1980, "coffee_variety": "Heirloom Kurume",
            "tree_count": 2400, "deforestation_free": True,
            "boundary_geojson": {"type": "Polygon", "coordinates": [[[38.414, 6.598], [38.419, 6.598],
                                                                      [38.419, 6.603], [38.414, 6.603], [38.414, 6.598]]]}})

        center, _ = CollectionCenter.objects.get_or_create(code="CC-MUR-01", defaults={
            "station": station, "name": "Murago Collection Center 01", "altitude_m": 1950})

        today = date.today()
        lot, _ = Lot.objects.get_or_create(lot_code=f"MUR-{today.strftime('%Y%m%d')}-W-001", defaults={
            "station": station, "process_type": "washed", "current_stage": "drying",
            "altitude_m": 1950, "variety": "Heirloom", "cherry_kg": Decimal("5000"),
            "parchment_kg": Decimal("980"), "current_weight_kg": Decimal("980"),
            "pulping_date": timezone.now() - timedelta(days=4),
            "washing_date": timezone.now() - timedelta(days=2), "certification_tags": ["eudr"]})
        # Walk a second lot legally through the FSM to Receiving for the kanban demo
        lot2, created2 = Lot.objects.get_or_create(lot_code=f"MUR-{today.strftime('%Y%m%d')}-W-002", defaults={
            "station": station, "process_type": "washed", "current_stage": "harvesting_sorting",
            "cherry_kg": Decimal("1200"), "current_weight_kg": Decimal("1200")})
        if created2:
            from processing import fsm
            fsm.transition(lot2, "receiving", actor=supervisor)

        CherryIntake.objects.get_or_create(intake_number="INT-2026-0001", defaults={
            "farmer": farmer, "center": center, "station": station, "intake_date": today,
            "coffee_variety": "Heirloom", "site_altitude_m": 1950, "gross_kg": Decimal("520"),
            "tare_kg": Decimal("20"), "floater_deduction_pct": Decimal("2.00"),
            "unit_price": Decimal("85.00"), "qr_receipt_code": "QR-INT-2026-0001", "lot": lot})

        bed, _ = DryingBed.objects.get_or_create(station=station, bed_no="12", defaults={"capacity_kg": Decimal("800")})
        DryingBed.objects.get_or_create(station=station, bed_no="13", defaults={"capacity_kg": Decimal("800")})

        fuel, fc = FuelRegisterEntry.objects.get_or_create(station=station, entry_date=today, machine_label="Generator 1",
                                                           defaults={"fuel_purchased_litres": Decimal("100"),
                                                                     "fuel_added_litres": Decimal("20"),
                                                                     "cherry_pulped_kg": Decimal("1000"), "operator": operator})
        if fc:
            calculators.apply_fuel_entry(fuel, max_ratio=Decimal("0.05"))
        water, wc = WaterRegisterEntry.objects.get_or_create(station=station, entry_date=today, defaults={
            "meter_reading_litres": Decimal("52000"), "previous_reading_litres": Decimal("40000"),
            "previous_day_pulped_kg": Decimal("2000"), "recorded_by": operator})
        if wc:
            calculators.apply_water_entry(water, max_ratio=Decimal("8"))

        workers = []
        for i, (code, name, kind, wtype, rate) in enumerate([
                ("W-001", "Alemu Bekele", "cherry_sorter", "daily", "300"), ("W-002", "Sara Tesfaye", "machine_operator", "hourly", "50"),
                ("W-003", "Dawit Haile", "cherry_sorter", "piece", "2")]):
            w, _ = Worker.objects.get_or_create(worker_code=code, defaults={
                "full_name": name, "station": station, "kind": kind, "wage_type": wtype,
                "wage_rate": Decimal(rate), "hired_on": today - timedelta(days=30)})
            workers.append(w)
        sheet, sc = AttendanceSheet.objects.get_or_create(station=station, ethiopian_month=2, ethiopian_year=2018)
        if sc:
            for w in workers:
                for d in range(1, 11):
                    AttendanceEntry.objects.get_or_create(sheet=sheet, worker=w, day=d, defaults={
                        "mark": "present", "hours": Decimal("8"), "pieces": Decimal("100")})
            verify_attendance_sheet(sheet, controlled_by=supervisor, verified_by=admin)

        buyer, _ = Buyer.objects.get_or_create(code="BUY-DE-001", defaults={
            "company_name": "Hamburg Coffee Import GmbH", "country": "Germany",
            "contact_name": "Anna Schmidt", "email": "buyer@example.com", "preferred_incoterm": "FOB"})
        SalesContract.objects.get_or_create(contract_number="SC-2026-001", defaults={
            "buyer": buyer, "grade": "1", "quantity_mt": Decimal("19.20"), "quantity_bags": 320,
            "pricing_basis": "outright", "outright_price": Decimal("5.40"), "incoterm": "FOB",
            "currency": "USD", "status": "signed", "signed_by": admin})

        # 20-farmer demo registry (profiles, history, plans, bonuses) — idempotent
        from django.core.management import call_command
        call_command("seed_demo_farmers")
        # Site profiles, equipment, site roles/users, Bensa station — idempotent
        call_command("seed_demo_sites")
        # Site Monitoring camera wall (8 demo cameras) — idempotent
        call_command("seed_demo_cameras")

        self.stdout.write(self.style.SUCCESS(
            f"Murago demo seed complete: station={station.code} lots={Lot.objects.count()} "
            f"farmers={Farmer.objects.count()} workers={Worker.objects.count()} (idempotent)"))
