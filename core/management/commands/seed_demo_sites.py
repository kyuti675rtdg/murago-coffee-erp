"""Seed site profiles, equipment, the 7 site roles + their users, and a
second washing station (Bensa Daye) with real operating data so the
Site Performance comparison dashboard has meaningful contrast.

Idempotent throughout (get_or_create keyed; profile fields only fill
blanks, never overwrite an admin's edits).
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand

DEMO_PASSWORD = "MuragoAdmin2026!"

ROLE_PERMISSIONS = {
    "site_manager": ["*site*"],
    "procurement_officer": ["farmers.*", "collection.*", "procurement.*", "payments.read"],
    "weighing_clerk": ["collection.*", "resources.fuel_water", "sync.*"],
    "quality_controller": ["quality.*", "traceability.*"],
    "warehouse_officer": ["warehouse.*", "inventory.*", "logistics.*"],
    "field_officer": ["farmers.*", "collection.*", "sync.*"],
    "finance_officer": ["payments.*", "procurement.*", "finance.read", "payroll.read", "bi.*"],
}

ROLE_USERS = [
    # username, role_code, station_code
    ("sitemanager", "site_manager", "MUR"),
    ("sitemanager_ben", "site_manager", "BEN"),
    ("procurement1", "procurement_officer", "MUR"),
    ("weigher1", "weighing_clerk", "MUR"),
    ("quality1", "quality_controller", "MUR"),
    ("warehouse1", "warehouse_officer", "ADD"),
    ("field1", "field_officer", "MUR"),
    ("financeofficer1", "finance_officer", "MUR"),
]


def fill_profile(station, **fields):
    """Set profile fields only where they are still blank/zero (never stomp edits)."""
    changed = []
    for key, value in fields.items():
        current = getattr(station, key)
        if current in (None, "", 0, Decimal("0"), [], False) and value not in (None, ""):
            setattr(station, key, value)
            changed.append(key)
    if changed:
        station.save(update_fields=changed + ["updated_at"])


class Command(BaseCommand):
    help = "Seed site profiles, equipment, site roles/users and the Bensa Daye station."

    def handle(self, *args, **opts):
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        from collection.models import CherryIntake, CollectionCenter
        from core.models import (Organization, Role, SignatureCredential, Station,
                                 StationEquipment, UserStationRole)
        from farmers.models import Farmer, FarmPlot
        from hr.models import Worker
        from processing.models import DryingBed, Lot
        from quality.models import CuppingScore
        from resources import calculators
        from resources.models import FuelRegisterEntry, WaterRegisterEntry

        User = get_user_model()
        org, _ = Organization.objects.get_or_create(name="Murago Coffee / Bean Power ERP",
                                                    defaults={"country": "Ethiopia"})
        mur, _ = Station.objects.get_or_create(code="MUR", defaults={
            "organization": org, "name": "Murago Washing Station", "station_type": "washing",
            "region": "Sidama", "woreda": "Aleta Wondo", "altitude_m": 1950,
            "latitude": Decimal("6.600000"), "longitude": Decimal("38.416700")})
        addis, _ = Station.objects.get_or_create(code="ADD", defaults={
            "organization": org, "name": "Addis Central Warehouse", "station_type": "central_warehouse",
            "region": "Addis Ababa", "altitude_m": 2355})

        fill_profile(mur, kebele="Murago", phone="0460000001", email="murago@murago.local",
                     manager_name="Station Manager (Murago)", established_year=2016,
                     daily_cherry_capacity_kg=Decimal("25000"), drying_bed_count=42,
                     drying_capacity_kg=Decimal("38000"), storage_capacity_kg=Decimal("120000"),
                     fermentation_tank_count=12, processing_methods=["washed", "natural"],
                     water_source="River + borehole", water_tank_capacity_litres=Decimal("60000"),
                     power_source="Grid + generator", has_generator=True,
                     generator_capacity_kva=Decimal("75"), internet_type="4G")
        fill_profile(addis, kebele="Akaki Kality", phone="0110000002", email="addis@murago.local",
                     manager_name="Warehouse Manager (Addis)", established_year=2019,
                     daily_cherry_capacity_kg=Decimal("0"), drying_bed_count=0,
                     storage_capacity_kg=Decimal("900000"), processing_methods=[],
                     water_source="Municipal", power_source="Grid", internet_type="Fibre")

        # ---- second washing station: Bensa Daye ----
        ben, _ = Station.objects.get_or_create(code="BEN", defaults={
            "organization": org, "name": "Bensa Daye Washing Station", "station_type": "washing",
            "region": "Sidama", "woreda": "Bensa", "kebele": "Daye", "altitude_m": 2150,
            "latitude": Decimal("6.516700"), "longitude": Decimal("38.850000"),
            "phone": "0460000003", "email": "bensa@murago.local",
            "manager_name": "Station Manager (Bensa)", "established_year": 2021,
            "daily_cherry_capacity_kg": Decimal("12000"), "drying_bed_count": 24,
            "drying_capacity_kg": Decimal("19000"), "storage_capacity_kg": Decimal("60000"),
            "fermentation_tank_count": 6, "processing_methods": ["washed"],
            "water_source": "Spring", "water_tank_capacity_litres": Decimal("25000"),
            "power_source": "Generator", "has_generator": True,
            "generator_capacity_kva": Decimal("40"), "internet_type": "4G"})

        center_ben, _ = CollectionCenter.objects.get_or_create(code="CC-BEN-01", defaults={
            "station": ben, "name": "Bensa Collection Center 01", "altitude_m": 2120})

        rng = random.Random(777)
        ben_farmers = []
        for i, (name, gender) in enumerate([
                ("Wolde Gebremariam", "male"), ("Alemnesh Tadesse", "female"),
                ("Bekelech Alemu", "female"), ("Haile Giorgis", "male"),
                ("Zinash Worku", "female"), ("Mulugeta Desta", "male")], start=1):
            farmer, _ = Farmer.objects.get_or_create(farmer_code=f"FRM-2026-02{i:02d}", defaults={
                "full_name": name, "gender": gender, "phone": f"092{rng.randint(1000000, 9999999)}",
                "station": ben, "kebele": "Daye",
                "region": "Sidama", "zone": "Eastern Sidama", "woreda": "Bensa",
                "coffee_variety": "Heirloom Kurume",
                "family_size": rng.randint(3, 8),
                "coffee_tree_count": rng.randint(1500, 4200),
                "total_plot_ha": Decimal(rng.choice(["0.950", "1.400", "1.850", "2.200"])),
                "annual_cherry_cap_kg": Decimal(rng.randint(4500, 10000)), "kyc_status": "verified"})
            ben_farmers.append(farmer)
            FarmPlot.objects.get_or_create(farmer=farmer, plot_name="Daye Plot 1", defaults={
                "area_ha": farmer.total_plot_ha, "elevation_m": rng.randint(2050, 2280),
                "coffee_variety": "Heirloom Kurume", "tree_count": farmer.coffee_tree_count,
                "deforestation_free": True,
                "boundary_geojson": {"type": "Polygon", "coordinates": [[
                    [38.84 + i * 0.004, 6.51], [38.844 + i * 0.004, 6.51],
                    [38.844 + i * 0.004, 6.513], [38.84 + i * 0.004, 6.513],
                    [38.84 + i * 0.004, 6.51]]]}})
        season_kg = {}
        for farmer in ben_farmers:
            total = Decimal("0")
            for d in range(rng.randint(3, 5)):
                gross = Decimal(rng.randint(150, 620))
                intake, _ = CherryIntake.objects.get_or_create(
                    intake_number=f"INT-2026-B{farmer.farmer_code[-2:]}-{d}",
                    defaults={"farmer": farmer, "center": center_ben, "station": ben,
                              "intake_date": date(2026, 10, rng.randint(3, 19)),
                              "coffee_variety": "Heirloom Kurume", "site_altitude_m": 2120,
                              "gross_kg": gross, "tare_kg": (gross * Decimal("0.02")).quantize(Decimal("0.01")),
                              "floater_deduction_pct": Decimal(rng.randint(3, 9)),
                              "unit_price": Decimal(rng.randint(76, 88)),
                              "qr_receipt_code": f"QR-INT-2026-B{farmer.farmer_code[-2:]}-{d}"})
                total += intake.payable_kg
            season_kg[farmer.id] = total
            if float(farmer.delivered_this_season_kg or 0) != float(total):
                farmer.delivered_this_season_kg = total
                farmer.save(update_fields=["delivered_this_season_kg"])

        lot_ben, _ = Lot.objects.get_or_create(lot_code="BEN-20261010-W-001", defaults={
            "station": ben, "process_type": "washed", "current_stage": "drying",
            "altitude_m": 2120, "variety": "Heirloom", "cherry_kg": Decimal("6800"),
            "parchment_kg": Decimal("1150"), "current_weight_kg": Decimal("1150"),
            "pulping_date": timezone.now() - timedelta(days=3),
            "washing_date": timezone.now() - timedelta(days=1), "certification_tags": ["eudr"]})
        CherryIntake.objects.filter(station=ben).update(lot=lot_ben)
        base = Decimal("7.85")  # Bensa cups a little lower than Murago on purpose (contrast)
        CuppingScore.objects.get_or_create(lot=lot_ben, cupped_on=date(2026, 10, 18), defaults={
            "fragrance_aroma": base, "flavour": base, "aftertaste": base, "acidity": base,
            "body": base, "balance": base, "uniformity": Decimal("8.2"),
            "clean_cup": Decimal("8.2"), "sweetness": base, "overall": base})

        for d in range(3):
            day = date(2026, 10, 15 + d)
            fuel, fc = FuelRegisterEntry.objects.get_or_create(
                station=ben, entry_date=day, machine_label="Generator 1",
                defaults={"fuel_purchased_litres": Decimal("60"), "fuel_added_litres": Decimal("38"),
                          "cherry_pulped_kg": Decimal("900")})
            if fc:
                calculators.apply_fuel_entry(fuel, max_ratio=Decimal("0.05"))
            water, wc = WaterRegisterEntry.objects.get_or_create(
                station=ben, entry_date=day,
                defaults={"meter_reading_litres": Decimal(18000 + d * 6500),
                          "previous_reading_litres": Decimal(18000 + (d - 1) * 6500) if d else Decimal("11500"),
                          "previous_day_pulped_kg": Decimal("900")})
            if wc:
                calculators.apply_water_entry(water, max_ratio=Decimal("8"))
        for i, (code, name, kind) in enumerate([
                ("BW-001", "Tesfaye Alemu", "cherry_sorter"), ("BW-002", "Meron Haile", "bed_turner"),
                ("BW-003", "Kebede Worku", "machine_operator"), ("BW-004", "Saba Desta", "cherry_sorter")]):
            Worker.objects.get_or_create(worker_code=code, defaults={
                "full_name": name, "station": ben, "kind": kind, "wage_type": "daily",
                "wage_rate": Decimal("300"), "hired_on": date(2026, 10, 1)})
        for n in ("7", "8"):
            DryingBed.objects.get_or_create(station=ben, bed_no=n, defaults={"capacity_kg": Decimal("700")})

        # ---- equipment registers ----
        today = date.today()
        equipment = [
            (mur, "Eco-Pulper A", "pulper", "4500", "kg/day", "operational", today + timedelta(days=40)),
            (mur, "Generator 75 kVA", "generator", "75", "kVA", "operational", today - timedelta(days=12)),  # overdue
            (mur, "Platform Scale 1", "scale", "1000", "kg", "operational", today + timedelta(days=80)),
            (mur, "Moisture Meter 1", "moisture_meter", None, "", "operational", today + timedelta(days=80)),
            (mur, "Water Pump Main", "water_pump", "9000", "L/h", "operational", today + timedelta(days=25)),
            (mur, "Drying Bed Set A", "drying_bed", "38000", "kg", "operational", today + timedelta(days=120)),
            (ben, "Eco-Pulper B1", "pulper", "3000", "kg/day", "operational", today + timedelta(days=30)),
            (ben, "Eco-Pulper B2", "pulper", "3000", "kg/day", "out_of_service", today + timedelta(days=30)),
            (ben, "Generator 40 kVA", "generator", "40", "kVA", "operational", today + timedelta(days=60)),
            (ben, "Platform Scale B", "scale", "800", "kg", "maintenance", today + timedelta(days=10)),
            (addis, "Huller Main", "huller", "2000", "kg/day", "operational", today + timedelta(days=45)),
            (addis, "Colour Sorter", "grader", "1500", "kg/day", "operational", today + timedelta(days=45)),
            (addis, "Warehouse Scale", "scale", "30000", "kg", "operational", today + timedelta(days=90)),
        ]
        for stn, name, etype, cap, unit, status_, next_m in equipment:
            StationEquipment.objects.get_or_create(station=stn, name=name, defaults={
                "equipment_type": etype,
                "capacity_value": Decimal(cap) if cap else None, "capacity_unit": unit,
                "status": status_, "purchase_date": date(2023, 5, 1),
                "last_maintenance_date": today - timedelta(days=90), "next_maintenance_date": next_m})

        # ---- roles (all codes incl. the 7 site roles) + role users ----
        roles = {}
        for code, label in Role.RoleCode.choices:
            roles[code], _ = Role.objects.get_or_create(code=code, defaults={"description": label})
            if code in ROLE_PERMISSIONS and not roles[code].permissions:
                roles[code].permissions = ROLE_PERMISSIONS[code]
                roles[code].save(update_fields=["permissions"])
        stations_by_code = {s.code: s for s in (mur, ben, addis)}
        for username, role_code, stn_code in ROLE_USERS:
            u, created = User.objects.get_or_create(username=username, defaults={
                "email": f"{username}@murago.local"})
            if created or not u.has_usable_password():
                u.set_password(DEMO_PASSWORD)
                u.save()
            UserStationRole.objects.get_or_create(user=u, role=roles[role_code],
                                                  station=stations_by_code[stn_code])
            cred, c = SignatureCredential.objects.get_or_create(user=u, defaults={"pin_hash": ""})
            if c or not cred.pin_hash:
                cred.set_pin("1234")
                cred.save()

        self.stdout.write(self.style.SUCCESS(
            f"Sites seeded: BEN farmers={len(ben_farmers)} · BEN season kg="
            f"{sum(season_kg.values())} · equipment={StationEquipment.objects.count()} · "
            f"role users={len(ROLE_USERS)}"))
