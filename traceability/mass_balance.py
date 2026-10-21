"""End-to-end mass-balance reconciliation engine (Phase 4 P0).

Chain: cherry intake (payable kg) -> lot cherry kg -> parchment kg -> green kg
-> milling outturn -> bagged/packed net kg -> container-loaded net kg.
Each segment compares ACTUAL output to the benchmark-EXPECTED output
(sysconf.YieldBenchmark when present, else system defaults) and flags the
variance: ok <= tolerance, warning <= 2x tolerance, otherwise critical.
Checks are persisted as MassBalanceCheck rows so variances are auditable and
never silently allowed; critical segments notify station supervisors.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import MassBalanceCheck

# segment -> (expected ratio, relative tolerance %)
DEFAULT_BENCHMARKS = {
    "intake_to_cherry": (Decimal("1.00"), Decimal("2")),
    "cherry_to_parchment": (Decimal("0.20"), Decimal("25")),
    "parchment_to_green": (Decimal("0.80"), Decimal("15")),
    "green_to_bagged": (Decimal("0.995"), Decimal("2")),
    "bagged_to_exported": (Decimal("1.00"), Decimal("1")),
}


def _sum(qs, field):
    return qs.aggregate(s=Sum(field))["s"] or Decimal("0")


def _status(deviation_pct: Decimal, tolerance_pct: Decimal) -> str:
    d = abs(deviation_pct)
    if d <= tolerance_pct:
        return MassBalanceCheck.Status.OK
    if d <= tolerance_pct * 2:
        return MassBalanceCheck.Status.WARNING
    return MassBalanceCheck.Status.CRITICAL


def compute_segments(lot) -> list[dict]:
    """Compute (not persist) the mass-balance segments for a lot."""
    from collection.models import CherryIntake
    from drymill.models import MillingOutput
    from exports.models import ContainerLot, PackingRecord

    segments = []
    intake_kg = _sum(CherryIntake.objects.filter(lot=lot), "payable_kg")
    if intake_kg > 0:
        segments.append(("intake_to_cherry", intake_kg, Decimal(lot.cherry_kg or 0)))
    if lot.cherry_kg and lot.parchment_kg:
        segments.append(("cherry_to_parchment", Decimal(lot.cherry_kg), Decimal(lot.parchment_kg)))
    if lot.parchment_kg and lot.green_kg:
        segments.append(("parchment_to_green", Decimal(lot.parchment_kg), Decimal(lot.green_kg)))
    # Milling segment: real measured outturn vs input (imbalance beyond tolerance is the flag)
    for out in MillingOutput.objects.filter(work_order__input_lot=lot):
        segments.append(("milling_outturn", Decimal(out.input_kg), Decimal(out.green_out_kg),
                         Decimal("0.80"), Decimal("15"),
                         f"imbalance {out.imbalance_kg} kg (tolerance {out.tolerance_kg} kg), mass_balance_ok={out.mass_balance_ok}"))
    bagged_kg = _sum(PackingRecord.objects.filter(marking__lot=lot), "net_kg")
    if lot.green_kg and bagged_kg > 0:
        segments.append(("green_to_bagged", Decimal(lot.green_kg), bagged_kg))
    exported_kg = _sum(ContainerLot.objects.filter(marking__lot=lot), "net_kg")
    if bagged_kg > 0 and exported_kg > 0:
        segments.append(("bagged_to_exported", bagged_kg, exported_kg))

    results = []
    for seg in segments:
        name, inp, outp = seg[0], Decimal(seg[1]), Decimal(seg[2])
        ratio, tol = (Decimal(seg[3]), Decimal(seg[4])) if len(seg) > 4 else DEFAULT_BENCHMARKS[name]
        notes = seg[5] if len(seg) > 5 else ""
        expected = (inp * ratio).quantize(Decimal("0.01"))
        variance = (outp - expected).quantize(Decimal("0.01"))
        deviation = ((variance / expected * 100).quantize(Decimal("0.01")) if expected else Decimal("0"))
        results.append({"segment": name, "input_kg": inp, "output_kg": outp,
                        "expected_output_kg": expected, "variance_kg": variance,
                        "variance_pct": deviation,
                        "status": _status(deviation, tol) if expected else MassBalanceCheck.Status.NO_DATA,
                        "notes": notes})
    return results


@transaction.atomic
def run_mass_balance(lot, *, actor=None, notify=True) -> list[MassBalanceCheck]:
    """Compute + persist MassBalanceCheck rows; critical segments notify."""
    results = compute_segments(lot)
    checks = []
    for r in results:
        checks.append(MassBalanceCheck.objects.create(lot=lot, **r))
    if notify:
        critical = [c for c in checks if c.status == MassBalanceCheck.Status.CRITICAL]
        if critical:
            from core.notify import notify_station_roles
            notify_station_roles(
                lot.station, ["station_supervisor", "admin"], category="anomaly",
                severity="critical", link="traceability",
                title=f"Mass-balance CRITICAL variance on lot {lot.lot_code}",
                body="; ".join(f"{c.segment}: {c.variance_pct}% vs expected" for c in critical))
    return checks


def worst_status(checks) -> str:
    order = {"ok": 0, "no_data": 1, "warning": 2, "critical": 3}
    if not checks:
        return "no_data"
    return max((c.status for c in checks), key=lambda s: order.get(s, 0))
