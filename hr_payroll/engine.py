"""Attendance -> Payroll aggregation engine (Modules 12.2 + 13.1/13.2).

Hard rules (real enforcement, tested):
  1. Payroll cannot be generated from an attendance sheet lacking BOTH the
     Controlled By and Verified By signatures, and the two must be different
     users (dual verification).
  2. Gross pay by wage type:
       daily  -> days_worked * daily rate   (half day = 0.5 day)
       hourly -> total_hours * hourly rate
       piece  -> total_pieces * piece rate
  3. Deductions = the worker's advances recorded against that sheet (ተቆራጭ).
     Net = Gross - Deductions (የተጣራ ክፍያ).
  4. Approval requires Prepared By and Approved By to be DIFFERENT users.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.signoff import SignOffError, record_dual_signoff, require_different_users
from hr.models import AttendanceEntry, AttendanceSheet, WageType, WorkerAdvance
from payroll.models import PayrollLine, PayrollPeriod

DAY_FRACTION = {
    AttendanceEntry.Mark.PRESENT: Decimal("1"),
    AttendanceEntry.Mark.HALF: Decimal("0.5"),
    AttendanceEntry.Mark.ABSENT: Decimal("0"),
    AttendanceEntry.Mark.LEAVE: Decimal("0"),
}


class PayrollError(Exception):
    pass


def verify_attendance_sheet(sheet: AttendanceSheet, *, controlled_by, verified_by,
                            controlled_pin=None, verified_pin=None) -> AttendanceSheet:
    """Apply the dual Controlled By / Verified By sign-off to a sheet."""
    require_different_users(controlled_by, verified_by)
    signoff = record_dual_signoff(
        document_type="hr.AttendanceSheet", document_id=sheet.id,
        first_label="Controlled By", first_user=controlled_by, first_pin=controlled_pin,
        second_label="Verified By", second_user=verified_by, second_pin=verified_pin,
    )
    now = timezone.now()
    sheet.controlled_by, sheet.controlled_at = controlled_by, now
    sheet.verified_by, sheet.verified_at = verified_by, now
    sheet.signoff = signoff
    sheet.status = AttendanceSheet.Status.VERIFIED
    sheet.save(update_fields=["controlled_by", "controlled_at", "verified_by", "verified_at",
                              "signoff", "status", "updated_at"])
    return sheet


def compute_worker_totals(sheet: AttendanceSheet, worker_id) -> dict:
    """Aggregate one worker's 30-day grid cells into payroll inputs."""
    days = Decimal("0")
    hours = Decimal("0")
    pieces = Decimal("0")
    for entry in AttendanceEntry.objects.filter(sheet=sheet, worker_id=worker_id):
        days += DAY_FRACTION.get(entry.mark, Decimal("0"))
        hours += Decimal(entry.hours or 0)
        pieces += Decimal(entry.pieces or 0)
    deductions = sum(
        (Decimal(a.amount) for a in WorkerAdvance.objects.filter(sheet=sheet, worker_id=worker_id)),
        Decimal("0"),
    )
    return {"total_days": days, "total_hours": hours, "total_pieces": pieces, "deductions": deductions}


def gross_for(worker, totals: dict) -> Decimal:
    rate = Decimal(worker.wage_rate or 0)
    if worker.wage_type == WageType.DAILY:
        gross = totals["total_days"] * rate
    elif worker.wage_type == WageType.HOURLY:
        gross = totals["total_hours"] * rate
    elif worker.wage_type == WageType.PIECE:
        gross = totals["total_pieces"] * rate
    else:
        raise PayrollError(f"Unknown wage type {worker.wage_type!r} for worker {worker.worker_code}")
    return gross.quantize(Decimal("0.01"))


@transaction.atomic
def generate_payroll(sheet: AttendanceSheet, *, prepared_by) -> PayrollPeriod:
    """Aggregate a DUAL-VERIFIED 30-day attendance grid into payroll lines."""
    sheet = AttendanceSheet.objects.select_for_update().get(pk=sheet.pk)
    if not sheet.controlled_by_id or not sheet.verified_by_id:
        missing = "Controlled By" if not sheet.controlled_by_id else "Verified By"
        raise PayrollError(
            f"Payroll blocked: attendance sheet {sheet.ethiopian_month}/{sheet.ethiopian_year} "
            f"is missing the {missing} signature. Both dual signatures are required."
        )
    if sheet.controlled_by_id == sheet.verified_by_id:
        raise PayrollError("Payroll blocked: Controlled By and Verified By must be two different users.")
    if PayrollPeriod.objects.filter(sheet=sheet).exists():
        raise PayrollError("Payroll already generated for this attendance sheet.")

    worker_ids = list(AttendanceEntry.objects.filter(sheet=sheet)
                      .values_list("worker_id", flat=True).distinct().order_by("worker__worker_code"))
    period = PayrollPeriod.objects.create(sheet=sheet, station=sheet.station,
                                          status=PayrollPeriod.Status.PREPARED, prepared_by=prepared_by)
    total_gross = total_ded = total_net = Decimal("0")
    from hr.models import Worker
    for idx, worker_id in enumerate(worker_ids, start=1):
        worker = Worker.objects.get(pk=worker_id)
        totals = compute_worker_totals(sheet, worker_id)
        gross = gross_for(worker, totals)
        net = (gross - totals["deductions"]).quantize(Decimal("0.01"))
        PayrollLine.objects.create(
            period=period, worker=worker, row_no=idx,
            total_days=totals["total_days"], total_hours=totals["total_hours"],
            total_pieces=totals["total_pieces"], wage_rate=worker.wage_rate,
            gross_pay=gross, deductions=totals["deductions"], net_pay=net,
        )
        total_gross += gross
        total_ded += totals["deductions"]
        total_net += net
    period.total_gross, period.total_deductions, period.total_net = total_gross, total_ded, total_net
    period.save(update_fields=["total_gross", "total_deductions", "total_net", "updated_at"])
    sheet.status = AttendanceSheet.Status.LOCKED
    sheet.save(update_fields=["status", "updated_at"])
    return period


@transaction.atomic
def approve_payroll(period: PayrollPeriod, *, approved_by, prepared_pin=None, approved_pin=None) -> PayrollPeriod:
    """Approve a prepared payroll. Prepared By != Approved By (enforced)."""
    if not period.prepared_by_id:
        raise PayrollError("Payroll must be Prepared before it can be Approved.")
    try:
        require_different_users(period.prepared_by, approved_by)
    except SignOffError as exc:
        raise PayrollError(str(exc)) from exc
    signoff = record_dual_signoff(
        document_type="payroll.PayrollPeriod", document_id=period.id,
        first_label="Prepared By", first_user=period.prepared_by, first_pin=prepared_pin,
        second_label="Approved By", second_user=approved_by, second_pin=approved_pin,
    )
    period.approved_by = approved_by
    period.approved_at = timezone.now()
    period.signoff = signoff
    period.status = PayrollPeriod.Status.APPROVED
    period.save(update_fields=["approved_by", "approved_at", "signoff", "status", "updated_at"])
    return period
