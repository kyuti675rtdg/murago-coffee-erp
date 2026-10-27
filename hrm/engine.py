"""HRM engines: salaried payroll, leave approval, separation finalisation,
onboarding completion. Mirrors the style of hr_payroll/engine.py — hard
rules raise HRPayrollError/HRMError and write nothing on failure.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .approvals import record_approval
from .models import (
    ApprovalRecord, Employee, EmployeeStatusLog, EmploymentContract, HRPayrollLine,
    HRPayrollRun, LeaveBalance, LeaveRequest, OvertimeRecord, Payslip, PensionRule,
    SalaryStructure, TaxBracket, PayrollRule,
)

User = get_user_model()
D0 = Decimal("0")
CENT = Decimal("0.01")


def _q(value):
    return Decimal(value or 0).quantize(CENT)


class HRMError(Exception):
    pass


class HRPayrollError(HRMError):
    pass


# ---------------------------------------------------------------- payroll maths
def active_tax_brackets():
    return list(TaxBracket.objects.filter(is_active=True).order_by("order", "lower_bound"))


def active_pension_rule():
    return PensionRule.objects.filter(is_active=True).order_by("-created_at").first()


def compute_income_tax(taxable_income, brackets=None):
    """Ethiopian-style bracket formula: tax = rate * taxable - deduction,
    floored at 0, using the bracket containing the taxable income."""
    taxable = Decimal(taxable_income or 0)
    if taxable <= 0:
        return D0
    brackets = brackets if brackets is not None else active_tax_brackets()
    chosen = None
    for b in brackets:
        if Decimal(b.lower_bound) <= taxable and (b.upper_bound is None or taxable <= Decimal(b.upper_bound)):
            chosen = b
            break
    if chosen is None and brackets:
        chosen = brackets[-1]
    if chosen is None:
        return D0
    tax = taxable * Decimal(chosen.rate_pct) / Decimal("100") - Decimal(chosen.deduction_amount)
    return _q(max(tax, D0))


def compute_hr_payroll_line(employee, structure, overtime_amount=0, bonuses=0,
                            other_deductions=0, tax_brackets=None, pension_rule=None):
    """Worked example (must stay exact — see tests/test_hrm.py):
    basic 10000 + allowances 2000 + overtime 500 = gross 12500;
    pension emp 700 (7% of basic); taxable 11800; bracket >10900 at
    35% − 1500 → tax 2630; deductions 3330; net 9170.
    taxable = gross − pension_employee − exempt_allowance (0 in the example).
    """
    basic = Decimal(structure.basic_salary) if structure is not None else Decimal(employee.basic_salary or 0)
    if structure is not None:
        allowances = sum((Decimal(structure.housing_allowance or 0),
                          Decimal(structure.transport_allowance or 0),
                          Decimal(structure.hardship_allowance or 0),
                          Decimal(structure.other_allowances or 0),
                          Decimal(structure.exempt_allowance or 0)), D0)
        exempt = Decimal(structure.exempt_allowance or 0)
    else:
        allowances, exempt = D0, D0
    overtime_amount = Decimal(overtime_amount or 0)
    bonuses = Decimal(bonuses or 0)
    other_deductions = Decimal(other_deductions or 0)
    gross = _q(basic + allowances + overtime_amount + bonuses)

    if pension_rule is None:
        pension_rule = active_pension_rule()
    if pension_rule is not None:
        emp_pct, er_pct = Decimal(pension_rule.employee_pct), Decimal(pension_rule.employer_pct)
    else:
        rule = PayrollRule.objects.filter(is_active=True).order_by("-created_at").first()
        if rule is not None:
            emp_pct, er_pct = Decimal(rule.pension_employee_pct), Decimal(rule.pension_employer_pct)
        else:
            emp_pct, er_pct = Decimal("7"), Decimal("11")
    pension_employee = _q(basic * emp_pct / Decimal("100"))
    pension_employer = _q(basic * er_pct / Decimal("100"))
    taxable_income = _q(gross - pension_employee - exempt)
    income_tax = compute_income_tax(taxable_income, brackets=tax_brackets)
    total_deductions = _q(pension_employee + income_tax + other_deductions)
    net_pay = _q(gross - total_deductions)
    return {
        "basic": _q(basic), "allowances": _q(allowances),
        "overtime_amount": _q(overtime_amount), "bonuses": _q(bonuses),
        "gross": gross, "pension_employee": pension_employee,
        "pension_employer": pension_employer, "taxable_income": taxable_income,
        "income_tax": income_tax, "other_deductions": _q(other_deductions),
        "total_deductions": total_deductions, "net_pay": net_pay,
    }


def _active_structure(employee, period_end):
    return (SalaryStructure.objects.filter(employee=employee, is_active=True,
                                           effective_from__lte=period_end)
            .order_by("-effective_from").first())


@transaction.atomic
def generate_hr_payroll_run(run: HRPayrollRun, actor) -> HRPayrollRun:
    """Create lines for active employees with an active SalaryStructure at
    the run's station. Idempotent: a non-draft run raises (already calculated)."""
    run = HRPayrollRun.objects.select_for_update().get(pk=run.pk)
    if run.status != HRPayrollRun.Status.DRAFT:
        raise HRPayrollError(f"Payroll run {run.name} is {run.status} and cannot be (re)calculated.")
    brackets = active_tax_brackets()
    pension_rule = active_pension_rule()
    employees = (Employee.objects.filter(station=run.station, is_active=True,
                                         status__in=[Employee.Status.ACTIVE, Employee.Status.PROBATION,
                                                     Employee.Status.ON_LEAVE])
                 .order_by("employee_id"))
    totals = {k: D0 for k in ("gross", "pension_employee", "pension_employer", "tax",
                              "deductions", "net")}
    seq = 0
    for employee in employees:
        structure = _active_structure(employee, run.period_end)
        if structure is None:
            continue
        overtime = (OvertimeRecord.objects.filter(employee=employee, status=OvertimeRecord.Status.APPROVED,
                                                  overtime_date__gte=run.period_start,
                                                  overtime_date__lte=run.period_end)
                    .aggregate(s=Sum("amount"))["s"] or D0)
        calc = compute_hr_payroll_line(employee, structure, overtime_amount=overtime,
                                       tax_brackets=brackets, pension_rule=pension_rule)
        seq += 1
        HRPayrollLine.objects.create(
            run=run, employee=employee, station=run.station,
            payslip_number=f"PS-{str(run.id)[:8]}-{seq:03d}", **calc)
        totals["gross"] += calc["gross"]
        totals["pension_employee"] += calc["pension_employee"]
        totals["pension_employer"] += calc["pension_employer"]
        totals["tax"] += calc["income_tax"]
        totals["deductions"] += calc["total_deductions"]
        totals["net"] += calc["net_pay"]
    run.total_gross, run.total_pension_employee = _q(totals["gross"]), _q(totals["pension_employee"])
    run.total_pension_employer, run.total_tax = _q(totals["pension_employer"]), _q(totals["tax"])
    run.total_deductions, run.total_net = _q(totals["deductions"]), _q(totals["net"])
    run.status = HRPayrollRun.Status.CALCULATED
    if not run.prepared_by_id:
        run.prepared_by = actor
    run.save(update_fields=["total_gross", "total_pension_employee", "total_pension_employer",
                            "total_tax", "total_deductions", "total_net", "status",
                            "prepared_by", "updated_at"])
    return run


def verify_hr_payroll_run(run: HRPayrollRun, actor) -> HRPayrollRun:
    if run.status != HRPayrollRun.Status.CALCULATED:
        raise HRPayrollError(f"Only a calculated run can be verified (current: {run.status}).")
    if run.prepared_by_id and run.prepared_by_id == actor.pk:
        raise HRPayrollError("Self-approval is not allowed: the preparer cannot verify this run.")
    run.verified_by = actor
    run.status = HRPayrollRun.Status.VERIFIED
    run.save(update_fields=["verified_by", "status", "updated_at"])
    return run


def approve_hr_payroll_run(run: HRPayrollRun, actor) -> HRPayrollRun:
    if run.status != HRPayrollRun.Status.VERIFIED:
        raise HRPayrollError(f"Only a verified run can be approved (current: {run.status}).")
    if run.prepared_by_id and run.prepared_by_id == actor.pk:
        raise HRPayrollError("Self-approval is not allowed: the preparer cannot approve this run.")
    if run.verified_by_id and run.verified_by_id == actor.pk:
        raise HRPayrollError("Dual control: the verifier cannot also approve this run.")
    run.approved_by = actor
    run.status = HRPayrollRun.Status.APPROVED
    run.save(update_fields=["approved_by", "status", "updated_at"])
    return run


@transaction.atomic
def post_hr_payroll_journal(run: HRPayrollRun) -> HRPayrollRun:
    """Balanced journal: debit Salaries Expense (gross) / credit Pension
    Payable (employee pension) / credit Income Tax Payable (tax) /
    credit Salary Payable (net). Entry is saved POSTED (balanced, so the
    finance model allows it) and linked to the run."""
    from finance.models import Account, JournalEntry, JournalLine
    run = HRPayrollRun.objects.select_for_update().get(pk=run.pk)
    if run.status != HRPayrollRun.Status.APPROVED:
        raise HRPayrollError(f"Only an approved run can be posted (current: {run.status}).")
    if run.journal_entry_id:
        raise HRPayrollError("This run already has a posted journal entry.")
    if Decimal(run.total_deductions or 0) != (Decimal(run.total_pension_employee or 0)
                                              + Decimal(run.total_tax or 0)):
        raise HRPayrollError("Journal would not balance: run carries other deductions outside pension + tax.")

    def _account(code, name, kind):
        acct, _ = Account.objects.get_or_create(code=code, defaults={
            "name": name, "account_type": kind, "currency": "ETB"})
        return acct

    entry = JournalEntry.objects.create(
        entry_number=f"JE-HR-{run.id}", entry_date=run.period_end or date.today(),
        station=run.station, description=f"HR payroll {run.name}",
        status=JournalEntry.Status.DRAFT)
    lines = [
        (_account("5010", "Salaries Expense", Account.AccountType.EXPENSE),
         Decimal(run.total_gross or 0), D0),
        (_account("2010", "Pension Payable", Account.AccountType.LIABILITY),
         D0, Decimal(run.total_pension_employee or 0)),
        (_account("2020", "Income Tax Payable", Account.AccountType.LIABILITY),
         D0, Decimal(run.total_tax or 0)),
        (_account("2030", "Salary Payable", Account.AccountType.LIABILITY),
         D0, Decimal(run.total_net or 0)),
    ]
    for account, debit, credit in lines:
        if debit > 0 or credit > 0:
            JournalLine.objects.create(entry=entry, account=account, debit=debit, credit=credit,
                                       currency="ETB")
    if not entry.is_balanced():
        raise HRPayrollError("Journal does not balance; posting aborted.")
    entry.status = JournalEntry.Status.POSTED
    entry.save(update_fields=["status", "updated_at"])
    run.journal_entry = entry
    run.save(update_fields=["journal_entry", "updated_at"])
    return run


@transaction.atomic
def mark_hr_payroll_paid(run: HRPayrollRun, actor=None) -> HRPayrollRun:
    if run.status != HRPayrollRun.Status.APPROVED:
        raise HRPayrollError(f"Only an approved run can be marked paid (current: {run.status}).")
    if not run.verified_by_id or not run.approved_by_id:
        raise HRPayrollError("Dual control: a run needs both verification and approval before payment.")
    now = timezone.now()
    for line in run.lines.all():
        Payslip.objects.update_or_create(line=line, defaults={"released": True, "released_at": now})
    run.status = HRPayrollRun.Status.PAID
    run.save(update_fields=["status", "updated_at"])
    return run


# ---------------------------------------------------------------- leave
def _leave_overlaps(employee, start, end, exclude_id=None):
    qs = LeaveRequest.objects.filter(employee=employee, status=LeaveRequest.Status.APPROVED,
                                     start_date__lte=end, end_date__gte=start)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()


@transaction.atomic
def approve_leave(leave_request: LeaveRequest, approver) -> LeaveRequest:
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status != LeaveRequest.Status.PENDING:
        raise HRMError(f"Only a pending leave request can be approved (current: {leave_request.status}).")
    if _leave_overlaps(leave_request.employee, leave_request.start_date, leave_request.end_date,
                       exclude_id=leave_request.pk):
        raise HRMError("Leave overlaps an already approved leave request for this employee.")
    balance, _ = LeaveBalance.objects.get_or_create(
        employee=leave_request.employee, leave_type=leave_request.leave_type,
        year=leave_request.start_date.year,
        defaults={"entitled": leave_request.leave_type.annual_entitlement_days, "used": D0,
                  "station": leave_request.station or leave_request.employee.station})
    if Decimal(leave_request.days or 0) > Decimal(balance.remaining):
        raise HRMError(
            f"Insufficient leave balance: requested {leave_request.days} days, "
            f"remaining {balance.remaining} days.")
    balance.used = _q(Decimal(balance.used or 0) + Decimal(leave_request.days or 0))
    balance.save(update_fields=["used", "remaining", "updated_at"])
    leave_request.status = LeaveRequest.Status.APPROVED
    leave_request.approver = approver
    leave_request.decided_at = timezone.now()
    leave_request.save(update_fields=["status", "approver", "decided_at", "updated_at"])
    record_approval("leave", leave_request, actor=approver, decision="approved")
    try:
        from core.notify import notify_user
        notify_user(leave_request.employee.user, category="approval", link="hr",
                    title=f"Leave approved: {leave_request.start_date} → {leave_request.end_date}",
                    body=f"{leave_request.days} days of {leave_request.leave_type.name}.",
                    station=leave_request.station)
    except Exception:
        pass
    return leave_request


@transaction.atomic
def cancel_leave(leave_request: LeaveRequest, actor=None) -> LeaveRequest:
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status not in (LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED):
        raise HRMError(f"A {leave_request.status} leave request cannot be cancelled.")
    if leave_request.status == LeaveRequest.Status.APPROVED:
        balance = LeaveBalance.objects.filter(
            employee=leave_request.employee, leave_type=leave_request.leave_type,
            year=leave_request.start_date.year).first()
        if balance is not None:
            balance.used = _q(max(Decimal(balance.used or 0) - Decimal(leave_request.days or 0), D0))
            balance.save(update_fields=["used", "remaining", "updated_at"])
    leave_request.status = LeaveRequest.Status.CANCELLED
    leave_request.save(update_fields=["status", "updated_at"])
    return leave_request


# ---------------------------------------------------------------- separation
@transaction.atomic
def finalize_separation(separation, actor=None) -> Employee:
    """Archive the employee and deactivate the linked login account."""
    from .models import SeparationRequest
    separation = SeparationRequest.objects.select_for_update().get(pk=separation.pk)
    employee = separation.employee
    previous = employee.status
    employee.status = Employee.Status.ARCHIVED
    employee.is_active = False
    employee.account_deactivated = True
    employee.archived_at = timezone.now()
    employee.save(update_fields=["status", "is_active", "account_deactivated", "archived_at", "updated_at"])
    EmployeeStatusLog.objects.create(employee=employee, station=employee.station,
                                     from_status=previous, to_status=Employee.Status.ARCHIVED,
                                     actor=actor, reason=f"Separation finalised ({separation.separation_type})")
    if employee.user_id:
        user = employee.user
        user.is_active = False
        user.save(update_fields=["is_active"])
        Token.objects.filter(user=user).delete()
    separation.status = SeparationRequest.Status.ARCHIVED
    separation.save(update_fields=["status", "updated_at"])
    return employee


# ---------------------------------------------------------------- onboarding
def _find_duplicate_employee(candidate):
    """Exact national_id match, else name + DOB + phone match."""
    if getattr(candidate, "national_id", ""):
        matches = Employee.objects.filter(national_id=candidate.national_id)
        if matches.exists():
            return list(matches)
    if candidate.full_name and candidate.dob and candidate.phone:
        matches = Employee.objects.filter(full_name__iexact=candidate.full_name,
                                          dob=candidate.dob, phone=candidate.phone)
        if matches.exists():
            return list(matches)
    return []


@transaction.atomic
def complete_onboarding(checklist, actor, *, create_account=False, username=None):
    """When every task is completed: create the Employee (duplicate-checked),
    activate the EmploymentContract, optionally create a login account with
    an UNUSABLE password + the `employee` role (never a default password)."""
    from core.models import Role, UserStationRole
    from .models import OnboardingChecklist
    checklist = OnboardingChecklist.objects.select_for_update().get(pk=checklist.pk)
    if checklist.status == OnboardingChecklist.Status.COMPLETED:
        raise HRMError("This onboarding checklist is already completed.")
    pending = checklist.tasks.exclude(status="completed")
    if pending.exists():
        raise HRMError(f"Onboarding incomplete: {pending.count()} task(s) not completed.")
    candidate = checklist.candidate
    if candidate is None:
        raise HRMError("Onboarding checklist has no candidate.")
    duplicates = _find_duplicate_employee(candidate)
    if duplicates:
        raise HRMError(f"Duplicate employee detected: {[str(e.id) for e in duplicates]}")
    vacancy = checklist.application.vacancy if checklist.application_id else None
    position = vacancy.position if vacancy else None
    department = position.department if position else None
    station = vacancy.station if vacancy else (checklist.station or None)
    offer = None
    if checklist.application_id:
        offer = checklist.application.offer_letters.filter(
            status="accepted").order_by("-created_at").first()
    salary = Decimal(offer.salary_offered) if offer is not None else D0
    start_date = offer.start_date if offer is not None else date.today()
    employee = Employee.objects.create(
        full_name=candidate.full_name, phone=candidate.phone, email=candidate.email,
        national_id=candidate.national_id or "", dob=candidate.dob,
        department=department, position=position, station=station,
        employment_type=Employee.EmploymentType.PERMANENT,
        hire_date=start_date, basic_salary=salary, status=Employee.Status.ACTIVE)
    contract = EmploymentContract.objects.filter(candidate=candidate).order_by("-created_at").first()
    if contract is None:
        contract = EmploymentContract.objects.create(
            candidate=candidate, employee=employee, station=station,
            start_date=start_date, salary=salary, status=EmploymentContract.Status.ACTIVE,
            signed_at=timezone.now())
    else:
        contract.employee = employee
        contract.status = EmploymentContract.Status.ACTIVE
        contract.save(update_fields=["employee", "status", "updated_at"])
    user = None
    if create_account and username:
        user, _created = User.objects.get_or_create(
            username=username, defaults={"email": candidate.email or f"{username}@murago.local"})
        user.set_unusable_password()
        user.save(update_fields=["password"])
        role, _ = Role.objects.get_or_create(code="employee")
        UserStationRole.objects.get_or_create(user=user, role=role, station=station)
        employee.user = user
        employee.save(update_fields=["user", "updated_at"])
    checklist.employee = employee
    checklist.status = OnboardingChecklist.Status.COMPLETED
    checklist.completed_at = timezone.now()
    checklist.save(update_fields=["employee", "status", "completed_at", "updated_at"])
    return {"employee": employee, "contract": contract, "user": user}
