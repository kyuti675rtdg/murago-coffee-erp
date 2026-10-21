"""Bonus (second-payment) scoring engine.

Pure, scheme-driven computation — no rates or thresholds are hard-coded;
everything comes from the BonusScheme + BonusTier rows an admin maintains
under Settings. A farmer's season delivery is the sum of payable kg on
their cherry intakes whose intake_date falls in the scheme's season year.
Quality is the average cupping total (0–100) across lots that sourced
from the farmer's intakes; farmers whose coffee was never cupped get the
neutral multiplier 1.0.
"""
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from collection.models import CherryIntake
from quality.models import CuppingScore

from .models import BonusCalculation, BonusScheme, Farmer


def quality_multiplier_for(scheme: BonusScheme, avg_score):
    """Pick the multiplier from the scheme's quality bands (highest band wins)."""
    if avg_score is None:
        return Decimal("1")
    bands = sorted(scheme.quality_bands or [], key=lambda b: Decimal(str(b.get("min_score", 0))), reverse=True)
    for band in bands:
        if avg_score >= Decimal(str(band.get("min_score", 0))):
            return Decimal(str(band.get("multiplier", 1)))
    return Decimal("1")


def tier_for(scheme: BonusScheme, delivered_kg: Decimal):
    """Return (tier, rate_per_kg) for a delivered quantity, or (None, 0)."""
    for tier in scheme.tiers.all():
        if delivered_kg >= tier.from_kg and (tier.to_kg is None or delivered_kg < tier.to_kg):
            return tier, tier.rate_per_kg
    return None, Decimal("0")


def farmer_season_stats(farmer: Farmer, season_year: int):
    """(delivered_kg, intake_count, avg_quality_score|None) for one farmer + season."""
    intakes = CherryIntake.objects.filter(farmer=farmer, intake_date__year=season_year)
    agg = intakes.aggregate(kg=Sum("payable_kg"), n=Count("id"))
    delivered = agg["kg"] or Decimal("0")
    lot_ids = intakes.exclude(lot__isnull=True).values_list("lot_id", flat=True).distinct()
    scores = []
    for cs in CuppingScore.objects.filter(lot_id__in=list(lot_ids)):
        scores.append(cs.total_score)
    avg_quality = (sum(scores) / len(scores)) if scores else None
    return delivered, agg["n"] or 0, avg_quality


def compute_bonus(scheme: BonusScheme, farmer: Farmer):
    """Compute (or refresh) one farmer's BonusCalculation under a scheme.

    Rows already approved / paid / rejected are returned untouched so a
    re-run can never rewrite a decision.
    """
    delivered, count, avg_quality = farmer_season_stats(farmer, scheme.season_year)
    calc, _ = BonusCalculation.objects.get_or_create(
        scheme=scheme, farmer=farmer,
        defaults={"station": farmer.station, "season_year": scheme.season_year},
    )
    if calc.status in (BonusCalculation.Status.APPROVED, BonusCalculation.Status.PAID,
                       BonusCalculation.Status.REJECTED):
        return calc, False
    if delivered < (scheme.min_eligible_kg or Decimal("0")):
        rate, multiplier, gross = Decimal("0"), Decimal("1"), Decimal("0")
    else:
        _tier, rate = tier_for(scheme, delivered)
        multiplier = quality_multiplier_for(scheme, avg_quality)
        gross = (delivered * rate * multiplier).quantize(Decimal("0.01"))
    calc.station = farmer.station
    calc.season_year = scheme.season_year
    calc.delivered_kg = delivered
    calc.intake_count = count
    calc.avg_quality_score = avg_quality.quantize(Decimal("0.01")) if avg_quality is not None else None
    calc.tier_rate_per_kg = rate
    calc.quality_multiplier = multiplier
    calc.gross_bonus_etb = gross
    calc.calculated_at = timezone.now()
    if calc.status == BonusCalculation.Status.CALCULATED:
        calc.status = BonusCalculation.Status.PENDING
    calc.save()
    return calc, True


def run_scheme(scheme: BonusScheme):
    """Compute bonuses for every farmer with at least one intake in the season."""
    farmer_ids = (CherryIntake.objects.filter(intake_date__year=scheme.season_year)
                  .values_list("farmer_id", flat=True).distinct())
    results = []
    for farmer in Farmer.objects.filter(id__in=list(farmer_ids)).select_related("station"):
        calc, changed = compute_bonus(scheme, farmer)
        results.append(calc)
    return results
