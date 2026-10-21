"""Site & washing-station performance aggregation.

One place computes every per-station KPI used by the Admin Site
Performance dashboard and the site profile drill-down, so the comparison
table and the detail view can never disagree. All figures come from live
operational tables (intakes, lots, cupping, stock ledger, fuel/water
registers, HR, equipment) — nothing is cached or hard-coded.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from collection.models import CherryIntake, CollectionCenter
from core.models import Station, StationEquipment, UserStationRole
from farmers.models import Farmer
from hr.models import Worker
from processing.models import Lot
from quality.models import CuppingScore
from resources.models import FuelRegisterEntry, WaterRegisterEntry
from warehouse.models import StockLedgerEntry, Store

FUEL_RATIO_LIMIT = Decimal("0.05")   # litres per kg pulped (ThresholdConfig default)
WATER_RATIO_LIMIT = Decimal("8")     # litres per kg pulped


def _d(v):
    return Decimal("0") if v is None else Decimal(v)


def station_stock_kg(station) -> Decimal:
    """Current stock: latest ledger balance per store; falls back to lot weights."""
    total = Decimal("0")
    stores = Store.objects.filter(station=station)
    for store in stores:
        latest = (StockLedgerEntry.objects.filter(store=store)
                  .order_by("-created_at").values_list("balance_kg", flat=True).first())
        if latest is not None:
            total += _d(latest)
    if total == 0 and not StockLedgerEntry.objects.filter(store__station=station).exists():
        total = _d(Lot.objects.filter(station=station).aggregate(v=Sum("current_weight_kg"))["v"])
    return total


def station_metrics(station, date_from=None, date_to=None):
    """All KPIs + alerts for one station in an optional intake/register date range."""
    intakes = CherryIntake.objects.filter(station=station)
    fuel = FuelRegisterEntry.objects.filter(station=station)
    water = WaterRegisterEntry.objects.filter(station=station)
    if date_from:
        intakes = intakes.filter(intake_date__gte=date_from)
        fuel = fuel.filter(entry_date__gte=date_from)
        water = water.filter(entry_date__gte=date_from)
    if date_to:
        intakes = intakes.filter(intake_date__lte=date_to)
        fuel = fuel.filter(entry_date__lte=date_to)
        water = water.filter(entry_date__lte=date_to)

    agg = intakes.aggregate(kg=Sum("payable_kg"), cost=Sum("total_amount"), n=Count("id"))
    collected = _d(agg["kg"]); cost = _d(agg["cost"])
    avg_price = (cost / collected).quantize(Decimal("0.01")) if collected else Decimal("0")

    lots = Lot.objects.filter(station=station)
    lot_agg = lots.aggregate(cherry=Sum("cherry_kg"), parch=Sum("parchment_kg"), n=Count("id"))
    cherry_in = _d(lot_agg["cherry"]); parch = _d(lot_agg["parch"])
    yield_pct = (parch / cherry_in * 100).quantize(Decimal("0.1")) if cherry_in and parch else None

    scores = [cs.total_score for cs in CuppingScore.objects.filter(lot__station=station)]
    avg_quality = (sum(scores) / len(scores)).quantize(Decimal("0.01")) if scores else None

    fuel_agg = fuel.aggregate(litres=Sum("fuel_added_litres"), ratio=Avg("fuel_ratio"))
    fuel_anomalies = fuel.filter(is_anomaly=True).count()
    water_anomalies = water.filter(is_anomaly=True).count()
    fuel_ratio = _d(fuel_agg["ratio"]).quantize(Decimal("0.00000")) if fuel_agg["ratio"] is not None else None
    water_ratio = None
    w_avg = water.aggregate(ratio=Avg("water_ratio"))["ratio"]
    if w_avg is not None:
        water_ratio = _d(w_avg).quantize(Decimal("0.00000"))
    water_litres = _d(water.aggregate(v=Sum("consumption_litres"))["v"])

    equipment = StationEquipment.objects.filter(station=station)
    today = timezone.now().date()
    overdue = equipment.filter(next_maintenance_date__lt=today).exclude(
        status=StationEquipment.Status.OUT_OF_SERVICE).count()
    out_of_service = equipment.filter(status=StationEquipment.Status.OUT_OF_SERVICE).count()

    days = None
    if date_from and date_to:
        days = (date_to - date_from).days + 1
    capacity = station.daily_cherry_capacity_kg or Decimal("0")
    utilization = None
    if capacity and days:
        utilization = (collected / (capacity * days) * 100).quantize(Decimal("0.1"))

    # Indicative composite efficiency (0–100): yield 40%, quality 30%, fuel discipline 30%.
    eff_parts = []
    if yield_pct is not None:
        eff_parts.append(min(yield_pct / Decimal("20") * 40, Decimal("40")))
    if avg_quality is not None:
        eff_parts.append(avg_quality / 100 * 30)
    if fuel_ratio is not None:
        eff_parts.append(max(Decimal("0"), (1 - fuel_ratio / FUEL_RATIO_LIMIT)) * 30)
    efficiency = sum(eff_parts).quantize(Decimal("0.1")) if eff_parts else None

    alerts = []
    if out_of_service:
        alerts.append({"level": "critical", "message": f"{out_of_service} equipment item(s) out of service"})
    if fuel_anomalies:
        alerts.append({"level": "critical", "message": f"{fuel_anomalies} fuel anomaly day(s) in range"})
    if fuel_ratio is not None and fuel_ratio > FUEL_RATIO_LIMIT:
        alerts.append({"level": "warning", "message": f"Average fuel ratio {fuel_ratio} L/kg above {FUEL_RATIO_LIMIT} limit"})
    if water_ratio is not None and water_ratio > WATER_RATIO_LIMIT:
        alerts.append({"level": "warning", "message": f"Average water ratio {water_ratio} L/kg above {WATER_RATIO_LIMIT} limit"})
    if yield_pct is not None and lot_agg["n"] >= 3 and yield_pct < Decimal("16"):
        alerts.append({"level": "warning", "message": f"Processing yield {yield_pct}% is below the 16% healthy band"})
    if avg_quality is not None and avg_quality < Decimal("80"):
        alerts.append({"level": "warning", "message": f"Average cupping score {avg_quality} is below 80"})
    if overdue:
        alerts.append({"level": "warning", "message": f"{overdue} equipment maintenance item(s) overdue"})
    if utilization is not None and utilization > 100:
        alerts.append({"level": "warning", "message": f"Capacity utilisation {utilization}% — site is over its daily capacity"})
    if days and days >= 7 and agg["n"] == 0:
        alerts.append({"level": "info", "message": "No cherry collections recorded in this period"})

    return {
        "station_id": str(station.id), "code": station.code, "name": station.name,
        "station_type": station.station_type, "region": station.region, "woreda": station.woreda,
        "is_active": station.is_active,
        "farmers": Farmer.objects.filter(station=station, is_active=True).count(),
        "centers": CollectionCenter.objects.filter(station=station, is_active=True).count(),
        "intakes": agg["n"] or 0,
        "collected_kg": str(collected), "procurement_cost_etb": str(cost),
        "avg_price_per_kg": str(avg_price),
        "lots": lot_agg["n"] or 0, "cherry_in_kg": str(cherry_in), "parchment_kg": str(parch),
        "yield_pct": str(yield_pct) if yield_pct is not None else None,
        "avg_quality": str(avg_quality) if avg_quality is not None else None,
        "cuppings": len(scores),
        "stock_kg": str(station_stock_kg(station)),
        "fuel_litres": str(_d(fuel_agg["litres"])), "fuel_ratio": str(fuel_ratio) if fuel_ratio is not None else None,
        "fuel_anomalies": fuel_anomalies,
        "water_litres": str(water_litres), "water_ratio": str(water_ratio) if water_ratio is not None else None,
        "water_anomalies": water_anomalies,
        "workers": Worker.objects.filter(station=station).count(),
        "system_users": UserStationRole.objects.filter(station=station).values("user").distinct().count(),
        "equipment_total": equipment.count(), "equipment_out_of_service": out_of_service,
        "maintenance_overdue": overdue,
        "capacity_kg_day": str(capacity),
        "capacity_utilization_pct": str(utilization) if utilization is not None else None,
        "efficiency_score": str(efficiency) if efficiency is not None else None,
        "alerts": alerts,
    }


def station_detail(station, date_from=None, date_to=None):
    """Drill-down: metrics + daily series + top farmers + staff + recent lots."""
    data = station_metrics(station, date_from, date_to)
    intakes = CherryIntake.objects.filter(station=station)
    if date_from:
        intakes = intakes.filter(intake_date__gte=date_from)
    if date_to:
        intakes = intakes.filter(intake_date__lte=date_to)
    series = list(intakes.values("intake_date")
                  .annotate(kg=Sum("payable_kg"), cost=Sum("total_amount"), n=Count("id"))
                  .order_by("intake_date"))
    data["daily_series"] = [{"date": str(r["intake_date"]), "kg": str(r["kg"] or 0),
                             "cost_etb": str(r["cost"] or 0), "intakes": r["n"]} for r in series]
    top = (intakes.values("farmer__farmer_code", "farmer__full_name")
           .annotate(kg=Sum("payable_kg"), amount=Sum("total_amount"), n=Count("id"))
           .order_by("-kg")[:10])
    data["top_farmers"] = [{"farmer_code": r["farmer__farmer_code"], "full_name": r["farmer__full_name"],
                            "kg": str(r["kg"] or 0), "amount_etb": str(r["amount"] or 0),
                            "deliveries": r["n"]} for r in top]
    staff = (UserStationRole.objects.filter(station=station)
             .select_related("user", "role").order_by("user__username"))
    data["staff"] = [{"username": s.user.username, "role": s.role.code,
                      "role_label": s.role.get_code_display()} for s in staff]
    lots = Lot.objects.filter(station=station).order_by("-created_at")[:10]
    data["recent_lots"] = [{"lot_code": l.lot_code, "process_type": l.process_type,
                            "current_stage": l.current_stage, "cherry_kg": str(l.cherry_kg or 0),
                            "parchment_kg": str(l.parchment_kg or 0),
                            "current_weight_kg": str(l.current_weight_kg or 0)} for l in lots]
    return data


def parse_range(request):
    def _p(name):
        v = request.query_params.get(name)
        if not v:
            return None
        try:
            return date.fromisoformat(v)
        except ValueError:
            return None
    return _p("from"), _p("to")
