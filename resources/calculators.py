"""Automated efficiency & mass-balance engines (brief §2 constraint 4, Module 11).

Formulas (exact, per brief):
  fuel_ratio  = fuel litres used / kg of cherry pulped THAT day
  water_ratio = water litres consumed / PREVIOUS day's kg of pulped cherry
  cherry->parchment, parchment->green, cherry->green outturns as % and ratios.
Anomaly flags compare a ratio to configured thresholds (sysconf.ThresholdConfig
values passed in as a plain object/dict so the engine stays unit-testable).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


class CalculationError(Exception):
    pass


def _d(value) -> Decimal:
    return Decimal(str(value))


@dataclass
class EfficiencyResult:
    ratio: Decimal | None          # litres per kg; None when undefined (zero denominator)
    is_anomaly: bool
    note: str = ""


def fuel_ratio(fuel_added_litres, cherry_pulped_kg, *, max_ratio=None) -> EfficiencyResult:
    """Daily fuel efficiency: litres / kg pulped cherry."""
    litres, kg = _d(fuel_added_litres), _d(cherry_pulped_kg)
    if kg <= 0:
        return EfficiencyResult(None, False, "No cherry pulped that day; fuel ratio undefined.")
    ratio = (litres / kg).quantize(Decimal("0.00001"))
    anomaly = bool(max_ratio is not None and ratio > _d(max_ratio))
    return EfficiencyResult(ratio, anomaly, "Fuel ratio above threshold." if anomaly else "")


def water_ratio(consumption_litres, previous_day_pulped_kg, *, max_ratio=None) -> EfficiencyResult:
    """Daily water efficiency: litres consumed / PREVIOUS day kg pulped.

    The denominator is deliberately the previous day's pulped weight — water
    metered at midday today processed yesterday's pulped cherry (brief 11.2).
    """
    litres, kg = _d(consumption_litres), _d(previous_day_pulped_kg)
    if kg <= 0:
        return EfficiencyResult(None, False, "No cherry pulped the previous day; water ratio undefined.")
    ratio = (litres / kg).quantize(Decimal("0.00001"))
    anomaly = bool(max_ratio is not None and ratio > _d(max_ratio))
    return EfficiencyResult(ratio, anomaly, "Water ratio above threshold." if anomaly else "")


def water_consumption(meter_reading_litres, previous_reading_litres) -> Decimal:
    """Litres consumed between two cumulative meter readings."""
    consumption = _d(meter_reading_litres) - _d(previous_reading_litres)
    if consumption < 0:
        raise CalculationError("Meter reading went backwards: consumption cannot be negative (meter reset must be recorded).")
    return consumption


@dataclass
class YieldResult:
    ratio: Decimal | None      # output / input
    pct: Decimal | None        # ratio * 100
    loss_kg: Decimal


def outturn(input_kg, output_kg) -> YieldResult:
    """Generic yield outturn: cherry->parchment, parchment->green, cherry->green."""
    inp, out = _d(input_kg), _d(output_kg)
    if inp <= 0:
        return YieldResult(None, None, Decimal("0"))
    if out > inp:
        raise CalculationError(f"Output {out} kg cannot exceed input {inp} kg in a yield outturn.")
    ratio = (out / inp).quantize(Decimal("0.0001"))
    return YieldResult(ratio, (ratio * 100).quantize(Decimal("0.01")), inp - out)


def cherry_to_parchment(cherry_kg, parchment_kg) -> YieldResult:
    return outturn(cherry_kg, parchment_kg)


def parchment_to_green(parchment_kg, green_kg) -> YieldResult:
    return outturn(parchment_kg, green_kg)


def cherry_to_green(cherry_kg, green_kg) -> YieldResult:
    return outturn(cherry_kg, green_kg)


def apply_fuel_entry(entry, *, max_ratio=None):
    """Compute + persist the ratio/anomaly flag on a FuelRegisterEntry."""
    result = fuel_ratio(entry.fuel_added_litres, entry.cherry_pulped_kg, max_ratio=max_ratio)
    entry.fuel_ratio = result.ratio
    entry.is_anomaly = result.is_anomaly
    entry.save(update_fields=["fuel_ratio", "is_anomaly", "updated_at"])
    return result


def apply_water_entry(entry, *, max_ratio=None):
    """Compute + persist consumption, ratio and anomaly flag on a WaterRegisterEntry."""
    entry.compute_consumption()
    result = water_ratio(entry.consumption_litres, entry.previous_day_pulped_kg, max_ratio=max_ratio)
    entry.water_ratio = result.ratio
    entry.is_anomaly = result.is_anomaly
    entry.save(update_fields=["consumption_litres", "water_ratio", "is_anomaly", "updated_at"])
    return result
