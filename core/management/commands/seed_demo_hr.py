"""Idempotent HRM demo seed (called at the end of seed_demo; safe standalone).

Creates: HRM departments, grades/positions, 3 employees, salary structures,
Ethiopian tax brackets, pension + payroll rules, an annual leave type, one
open vacancy and one leave balance. Demo users (demo password only, PIN
1234 — DEMO ONLY, same pattern as seed_demo): `hradmin` (hr_administrator)
and `hrpayroll` (payroll_officer) at station MUR. Safe to re-run:
everything is get_or_create keyed.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()
DEMO_PASSWORD = "MuragoAdmin2026!"


class Command(BaseCommand):
    help = "Seed idempotent HRM demo data (departments, employees, tax brackets, vacancy)"

    def handle(self, *args, **opts):
        from core.models import Organization, Role, SignatureCredential, Station, UserStationRole
        from hrm.models import (Department, Employee, JobGrade, JobPosition, LeaveBalance,
                                LeaveType, JobVacancy, PensionRule, PayrollRule, ReportingLine,
                                SalaryStructure, TaxBracket)

        org, _ = Organization.objects.get_or_create(
            name="Murago Coffee / Bean Power ERP",
            defaults={"legal_name": "Murago Coffee Processing PLC", "tin": "0012345678"})
        station, _ = Station.objects.get_or_create(code="MUR", defaults={
            "organization": org, "name": "Murago Washing Station", "station_type": "washing",
            "region": "Sidama", "woreda": "Aleta Wondo", "altitude_m": 1950,
            "latitude": Decimal("6.600000"), "longitude": Decimal("38.416700")})

        roles = {}
        for code, label in Role.RoleCode.choices:
            roles[code], _ = Role.objects.get_or_create(code=code, defaults={"description": label})

        def mkuser(username, role_code, stn=station):
            u, created = User.objects.get_or_create(
                username=username, defaults={"email": f"{username}@murago.local"})
            if created or not u.has_usable_password():
                u.set_password(DEMO_PASSWORD)
                u.save()
            UserStationRole.objects.get_or_create(user=u, role=roles[role_code], station=stn)
            cred, c = SignatureCredential.objects.get_or_create(user=u, defaults={"pin_hash": ""})
            if c or not cred.pin_hash:
                cred.set_pin("1234")
                cred.save()
            return u

        mkuser("hradmin", "hr_administrator")
        mkuser("hrpayroll", "payroll_officer")

        ops, _ = Department.objects.get_or_create(code="OPS", defaults={
            "name": "Operations", "station": station})
        fin, _ = Department.objects.get_or_create(code="FIN", defaults={
            "name": "Finance", "station": station})
        g5, _ = JobGrade.objects.get_or_create(code="G5", defaults={
            "title": "Grade 5", "min_salary": Decimal("8000"), "max_salary": Decimal("15000")})
        g6, _ = JobGrade.objects.get_or_create(code="G6", defaults={
            "title": "Grade 6", "min_salary": Decimal("15000"), "max_salary": Decimal("25000")})
        mgr_pos, _ = JobPosition.objects.get_or_create(code="OPMGR", defaults={
            "title": "Operations Manager", "department": ops, "grade": g6, "station": station})
        fin_pos, _ = JobPosition.objects.get_or_create(code="FINOFF", defaults={
            "title": "Finance Officer", "department": fin, "grade": g5, "station": station})
        wh_pos, _ = JobPosition.objects.get_or_create(code="WHOFF", defaults={
            "title": "Warehouse Officer", "department": ops, "grade": g5, "station": station})
        JobPosition.objects.get_or_create(code="QOFF", defaults={
            "title": "Quality Officer", "department": ops, "grade": g5, "station": station})

        def mkemployee(national_id, full_name, dept, pos, manager, salary, phone, dob, hire):
            emp, _ = Employee.objects.get_or_create(national_id=national_id, defaults={
                "full_name": full_name, "department": dept, "position": pos, "station": station,
                "manager": manager, "phone": phone, "email": f"{full_name.split()[0].lower()}@murago.local",
                "dob": dob, "hire_date": hire, "basic_salary": Decimal(salary),
                "status": "active", "employment_type": "permanent"})
            return emp

        tesfaye = mkemployee("ET-1001", "Tesfaye Alemu", ops, mgr_pos, None, "18000",
                             "0911000011", date(1988, 3, 12), date(2020, 1, 15))
        hanna = mkemployee("ET-1002", "Hanna Girma", fin, fin_pos, tesfaye, "12000",
                           "0911000012", date(1994, 7, 4), date(2022, 6, 1))
        kebede = mkemployee("ET-1003", "Kebede Woldemariam", ops, wh_pos, tesfaye, "9000",
                            "0911000013", date(1996, 11, 20), date(2023, 2, 10))
        if ops.head_id != tesfaye.id:
            ops.head = tesfaye
            ops.save(update_fields=["head", "updated_at"])
        for emp in (hanna, kebede):
            ReportingLine.objects.get_or_create(
                employee=emp, manager=tesfaye, effective_from=emp.hire_date,
                defaults={"station": station})

        for emp, basic, housing, transport in (
                (tesfaye, "18000", "2000", "1000"), (hanna, "12000", "1500", "800"),
                (kebede, "9000", "1000", "500")):
            SalaryStructure.objects.get_or_create(
                employee=emp, effective_from=date(2026, 1, 1), defaults={
                    "station": station, "basic_salary": Decimal(basic),
                    "housing_allowance": Decimal(housing), "transport_allowance": Decimal(transport)})

        brackets = [
            (Decimal("0"), Decimal("600"), Decimal("0"), Decimal("0"), 1),
            (Decimal("601"), Decimal("1650"), Decimal("10"), Decimal("60"), 2),
            (Decimal("1651"), Decimal("3200"), Decimal("15"), Decimal("142.50"), 3),
            (Decimal("3201"), Decimal("5250"), Decimal("20"), Decimal("302.50"), 4),
            (Decimal("5251"), Decimal("7800"), Decimal("25"), Decimal("565"), 5),
            (Decimal("7801"), Decimal("10900"), Decimal("30"), Decimal("955"), 6),
            (Decimal("10901"), None, Decimal("35"), Decimal("1500"), 7),
        ]
        for lower, upper, rate, deduction, order in brackets:
            TaxBracket.objects.get_or_create(
                lower_bound=lower, order=order, defaults={
                    "upper_bound": upper, "rate_pct": rate, "deduction_amount": deduction})
        PensionRule.objects.get_or_create(name="Standard Pension", defaults={
            "employee_pct": Decimal("7"), "employer_pct": Decimal("11"), "applies_to": "All permanent staff"})
        PayrollRule.objects.get_or_create(name="Default Payroll Rule", defaults={})
        annual, _ = LeaveType.objects.get_or_create(code="ANNUAL", defaults={
            "name": "Annual Leave", "annual_entitlement_days": Decimal("16"), "paid": True})
        JobVacancy.objects.get_or_create(title="Coffee Quality Officer", station=station, defaults={
            "position": JobPosition.objects.get(code="QOFF"), "openings": 1, "status": "open",
            "description": "Cupping and quality control at Murago washing station."})
        LeaveBalance.objects.get_or_create(
            employee=hanna, leave_type=annual, year=date.today().year, defaults={
                "station": station, "entitled": Decimal("16"), "used": Decimal("0")})

        self.stdout.write(self.style.SUCCESS(
            f"HRM demo seed complete: employees={Employee.objects.count()} "
            f"tax_brackets={TaxBracket.objects.count()} vacancies={JobVacancy.objects.count()} (idempotent)"))
