"""HRM tests: duplicate detection, recruitment->offer->onboarding chain,
leave balances, payroll worked example + journal, separation, self-approval
blocks, role denials, self-service and the HR dashboard."""
from datetime import date, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from core.models import Organization, Role, Station, UserStationRole
from hrm.engine import compute_hr_payroll_line
from hrm.models import (Application, Candidate, Employee, EmploymentContract,
                        HRPayrollRun, JobGrade, JobPosition, Department, JobVacancy,
                        LeaveBalance, LeaveRequest, LeaveType, ManpowerRequest,
                        OfferLetter, OnboardingChecklist, OnboardingTask, PensionRule,
                        SalaryStructure, TaxBracket, TimeEntry)

User = get_user_model()


def mk_role(code):
    role, _ = Role.objects.get_or_create(code=code)
    return role


BRACKETS = [
    (Decimal("0"), Decimal("600"), Decimal("0"), Decimal("0"), 1),
    (Decimal("601"), Decimal("1650"), Decimal("10"), Decimal("60"), 2),
    (Decimal("1651"), Decimal("3200"), Decimal("15"), Decimal("142.50"), 3),
    (Decimal("3201"), Decimal("5250"), Decimal("20"), Decimal("302.50"), 4),
    (Decimal("5251"), Decimal("7800"), Decimal("25"), Decimal("565"), 5),
    (Decimal("7801"), Decimal("10900"), Decimal("30"), Decimal("955"), 6),
    (Decimal("10901"), None, Decimal("35"), Decimal("1500"), 7),
]


class HRMBase(TestCase):
    def setUp(self):
        org = Organization.objects.create(name="Murago")
        self.st_a = Station.objects.create(organization=org, code="MUR", name="Murago WS",
                                           station_type="washing")
        self.st_b = Station.objects.create(organization=org, code="SID", name="Sidama WS",
                                           station_type="washing")
        self.admin = User.objects.create_user("admin", password="pw12345!", is_superuser=True)
        self.hradmin = User.objects.create_user("hradmin", password="pw12345!")
        self.hrpayroll = User.objects.create_user("hrpayroll", password="pw12345!")
        self.recruiter = User.objects.create_user("recruiter", password="pw12345!")
        self.hrmanager = User.objects.create_user("hrmanager", password="pw12345!")
        self.finance = User.objects.create_user("fin", password="pw12345!")
        self.supervisor = User.objects.create_user("sup", password="pw12345!")
        self.operator = User.objects.create_user("op", password="pw12345!")
        self.emp_user = User.objects.create_user("empuser", password="pw12345!")
        UserStationRole.objects.create(user=self.hradmin, role=mk_role("hr_administrator"), station=self.st_a)
        UserStationRole.objects.create(user=self.hrpayroll, role=mk_role("payroll_officer"), station=self.st_a)
        UserStationRole.objects.create(user=self.recruiter, role=mk_role("recruitment_officer"), station=self.st_a)
        UserStationRole.objects.create(user=self.hrmanager, role=mk_role("hr_manager"), station=self.st_a)
        UserStationRole.objects.create(user=self.finance, role=mk_role("finance_manager"), station=self.st_a)
        UserStationRole.objects.create(user=self.supervisor, role=mk_role("station_supervisor"), station=self.st_a)
        UserStationRole.objects.create(user=self.operator, role=mk_role("machine_operator"), station=self.st_a)
        UserStationRole.objects.create(user=self.emp_user, role=mk_role("employee"), station=self.st_a)

        self.dept = Department.objects.create(code="OPS", name="Operations", station=self.st_a)
        self.grade = JobGrade.objects.create(code="G5", title="Grade 5",
                                             min_salary=Decimal("8000"), max_salary=Decimal("15000"))
        self.position = JobPosition.objects.create(code="WHOFF", title="Warehouse Officer",
                                                   department=self.dept, grade=self.grade,
                                                   station=self.st_a)
        self.leave_type = LeaveType.objects.create(code="ANNUAL", name="Annual Leave",
                                                   annual_entitlement_days=Decimal("16"))
        for lower, upper, rate, deduction, order in BRACKETS:
            TaxBracket.objects.create(lower_bound=lower, upper_bound=upper, rate_pct=rate,
                                      deduction_amount=deduction, order=order)
        PensionRule.objects.create(name="Standard", employee_pct=Decimal("7"),
                                   employer_pct=Decimal("11"))
        self.emp1 = Employee.objects.create(
            full_name="Hanna Girma", user=self.emp_user, department=self.dept,
            position=self.position, station=self.st_a, national_id="ET-2001",
            phone="0911000021", email="hanna@murago.local", dob=date(1994, 7, 4),
            hire_date=date(2024, 1, 10), basic_salary=Decimal("10000"), status="active")
        self.emp2 = Employee.objects.create(
            full_name="Kebede Woldemariam", department=self.dept, position=self.position,
            station=self.st_a, national_id="ET-2002", phone="0911000022",
            dob=date(1996, 11, 20), hire_date=date(2024, 2, 1),
            basic_salary=Decimal("8000"), status="active")
        SalaryStructure.objects.create(
            employee=self.emp1, station=self.st_a, basic_salary=Decimal("10000"),
            housing_allowance=Decimal("1000"), transport_allowance=Decimal("500"),
            other_allowances=Decimal("500"), effective_from=date(2024, 1, 10))
        SalaryStructure.objects.create(
            employee=self.emp2, station=self.st_a, basic_salary=Decimal("8000"),
            effective_from=date(2024, 2, 1))
        LeaveBalance.objects.create(employee=self.emp1, leave_type=self.leave_type,
                                    station=self.st_a, year=2026, entitled=Decimal("16"),
                                    used=Decimal("0"))

    def api_client(self, user):
        c = APIClient()
        token, _ = Token.objects.get_or_create(user=user)
        c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return c

    def emp_payload(self, **overrides):
        payload = {"full_name": "New Person", "department": str(self.dept.id),
                   "position": str(self.position.id), "station": str(self.st_a.id),
                   "national_id": "ET-3001", "phone": "0911000031",
                   "dob": "1990-05-05", "hire_date": "2024-03-01",
                   "probation_end": "2024-06-01", "basic_salary": "9000", "status": "active"}
        payload.update(overrides)
        return payload


class DuplicateEmployeeTests(HRMBase):
    def test_duplicate_national_id_409(self):
        c = self.api_client(self.hradmin)
        r1 = c.post("/api/hr-employees/", self.emp_payload(), format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        r2 = c.post("/api/hr-employees/", self.emp_payload(full_name="Different Name"), format="json")
        self.assertEqual(r2.status_code, 409, r2.data)
        self.assertTrue(r2.data["matches"])

    def test_duplicate_name_dob_phone_409(self):
        c = self.api_client(self.hradmin)
        r1 = c.post("/api/hr-employees/", self.emp_payload(), format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        r2 = c.post("/api/hr-employees/",
                    self.emp_payload(national_id="ET-9999"), format="json")
        self.assertEqual(r2.status_code, 409, r2.data)

    def test_hire_after_probation_end_400(self):
        c = self.api_client(self.hradmin)
        resp = c.post("/api/hr-employees/",
                      self.emp_payload(hire_date="2024-07-01", probation_end="2024-06-01"),
                      format="json")
        self.assertEqual(resp.status_code, 400, resp.data)


class RecruitmentOnboardingTests(HRMBase):
    def test_recruitment_offer_onboarding_chain(self):
        c = self.api_client(self.hradmin)
        cand = c.post("/api/hr-candidates/", {
            "full_name": "Selam Teshome", "phone": "0911000099", "email": "selam@example.com",
            "national_id": "ET-4001", "dob": "1998-02-02", "source": "referral"}, format="json")
        self.assertEqual(cand.status_code, 201, cand.data)
        vac = c.post("/api/hr-job-vacancies/", {
            "position": str(self.position.id), "station": str(self.st_a.id),
            "title": "Warehouse Officer", "openings": 1, "status": "open"}, format="json")
        self.assertEqual(vac.status_code, 201, vac.data)
        app = c.post("/api/hr-applications/", {
            "vacancy": vac.data["id"], "candidate": cand.data["id"], "status": "pending"},
            format="json")
        self.assertEqual(app.status_code, 201, app.data)
        offer = c.post("/api/hr-offer-letters/", {
            "application": app.data["id"], "candidate": cand.data["id"],
            "position": str(self.position.id), "salary_offered": "9000",
            "start_date": "2026-11-01", "status": "sent"}, format="json")
        self.assertEqual(offer.status_code, 201, offer.data)
        acc = c.post(f"/api/hr-offer-letters/{offer.data['id']}/accept/", {}, format="json")
        self.assertEqual(acc.status_code, 200, acc.data)
        self.assertEqual(acc.data["status"], "accepted")
        chk = c.post("/api/hr-onboarding-checklists/", {
            "candidate": cand.data["id"], "application": app.data["id"], "status": "in_progress"},
            format="json")
        self.assertEqual(chk.status_code, 201, chk.data)
        for task_type, title in (("contract", "Sign contract"), ("orientation", "Orientation")):
            t = c.post("/api/hr-onboarding-tasks/", {
                "checklist": chk.data["id"], "task_type": task_type, "title": title,
                "status": "completed"}, format="json")
            self.assertEqual(t.status_code, 201, t.data)
        done = c.post(f"/api/hr-onboarding-checklists/{chk.data['id']}/complete/",
                      {"create_account": True, "username": "selam_emp"}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        emp = Employee.objects.get(pk=done.data["employee_id"])
        self.assertTrue(emp.employee_id.startswith("EMP-2026-"))
        self.assertEqual(emp.basic_salary, Decimal("9000"))
        contract = EmploymentContract.objects.get(pk=done.data["contract_id"])
        self.assertEqual(contract.status, "active")
        self.assertEqual(contract.employee_id, emp.id)
        user = User.objects.get(pk=done.data["user_id"])
        self.assertFalse(user.has_usable_password())
        self.assertTrue(UserStationRole.objects.filter(user=user, role__code="employee").exists())

    def test_onboarding_incomplete_blocked(self):
        c = self.api_client(self.hradmin)
        cand = Candidate.objects.create(full_name="Pending Person", national_id="ET-4002")
        chk = OnboardingChecklist.objects.create(candidate=cand, station=self.st_a)
        OnboardingTask.objects.create(checklist=chk, task_type="contract", title="Sign",
                                      status="pending", station=self.st_a)
        resp = c.post(f"/api/hr-onboarding-checklists/{chk.id}/complete/", {}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_onboarding_duplicate_blocked(self):
        c = self.api_client(self.hradmin)
        cand = Candidate.objects.create(full_name="Copy Person", national_id="ET-2001",
                                        phone="0911000021", dob=date(1994, 7, 4))
        chk = OnboardingChecklist.objects.create(candidate=cand, station=self.st_a)
        OnboardingTask.objects.create(checklist=chk, task_type="contract", title="Sign",
                                      status="completed", station=self.st_a)
        resp = c.post(f"/api/hr-onboarding-checklists/{chk.id}/complete/", {}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)


class LeaveTests(HRMBase):
    def _request(self, days_start="2026-11-02", days_end="2026-11-06"):
        return self.api_client(self.hradmin).post("/api/hr-leave-requests/", {
            "employee": str(self.emp1.id), "leave_type": str(self.leave_type.id),
            "start_date": days_start, "end_date": days_end, "reason": "Rest"}, format="json")

    def test_balance_only_on_approval(self):
        resp = self._request()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["days"], "5.00")
        bal = LeaveBalance.objects.get(employee=self.emp1, leave_type=self.leave_type, year=2026)
        self.assertEqual(bal.used, Decimal("0"))
        ok = self.api_client(self.hradmin).post(
            f"/api/hr-leave-requests/{resp.data['id']}/approve/", {}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        bal.refresh_from_db()
        self.assertEqual(bal.used, Decimal("5"))
        self.assertEqual(bal.remaining, Decimal("11"))

    def test_overlap_rejected_on_approve(self):
        r1 = self._request()
        r2 = self._request("2026-11-05", "2026-11-08")
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertEqual(r2.status_code, 201, r2.data)
        c = self.api_client(self.hradmin)
        self.assertEqual(c.post(f"/api/hr-leave-requests/{r1.data['id']}/approve/", {},
                                format="json").status_code, 200)
        bad = c.post(f"/api/hr-leave-requests/{r2.data['id']}/approve/", {}, format="json")
        self.assertEqual(bad.status_code, 400, bad.data)

    def test_overlap_with_approved_rejected_on_create(self):
        r1 = self._request()
        self.api_client(self.hradmin).post(f"/api/hr-leave-requests/{r1.data['id']}/approve/",
                                           {}, format="json")
        r2 = self._request("2026-11-04", "2026-11-07")
        self.assertEqual(r2.status_code, 400, r2.data)

    def test_insufficient_balance_rejected(self):
        resp = self._request("2026-12-01", "2026-12-20")  # 20 days > 16 entitled
        self.assertEqual(resp.status_code, 201, resp.data)
        bad = self.api_client(self.hradmin).post(
            f"/api/hr-leave-requests/{resp.data['id']}/approve/", {}, format="json")
        self.assertEqual(bad.status_code, 400, bad.data)
        bal = LeaveBalance.objects.get(employee=self.emp1, leave_type=self.leave_type, year=2026)
        self.assertEqual(bal.used, Decimal("0"))

    def test_cancel_after_approval_restores_balance(self):
        resp = self._request()
        c = self.api_client(self.hradmin)
        c.post(f"/api/hr-leave-requests/{resp.data['id']}/approve/", {}, format="json")
        cancelled = c.post(f"/api/hr-leave-requests/{resp.data['id']}/cancel/", {}, format="json")
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(cancelled.data["status"], "cancelled")
        bal = LeaveBalance.objects.get(employee=self.emp1, leave_type=self.leave_type, year=2026)
        self.assertEqual(bal.used, Decimal("0"))
        self.assertEqual(bal.remaining, Decimal("16"))

    def test_end_before_start_400(self):
        resp = self._request("2026-11-06", "2026-11-02")
        self.assertEqual(resp.status_code, 400, resp.data)


class PayrollTests(HRMBase):
    def test_worked_example_exact(self):
        emp = Employee.objects.create(full_name="Worked Example", station=self.st_a,
                                      basic_salary=Decimal("10000"))
        structure = SalaryStructure.objects.create(
            employee=emp, station=self.st_a, basic_salary=Decimal("10000"),
            housing_allowance=Decimal("1000"), transport_allowance=Decimal("500"),
            other_allowances=Decimal("500"), effective_from=date(2026, 1, 1))
        calc = compute_hr_payroll_line(emp, structure, overtime_amount=Decimal("500"))
        self.assertEqual(calc["gross"], Decimal("12500.00"))
        self.assertEqual(calc["pension_employee"], Decimal("700.00"))
        self.assertEqual(calc["taxable_income"], Decimal("11800.00"))
        self.assertEqual(calc["income_tax"], Decimal("2630.00"))
        self.assertEqual(calc["total_deductions"], Decimal("3330.00"))
        self.assertEqual(calc["net_pay"], Decimal("9170.00"))

    def test_bracket_editable_recompute_differs(self):
        emp = Employee.objects.create(full_name="Bracket Edit", station=self.st_a,
                                      basic_salary=Decimal("10000"))
        structure = SalaryStructure.objects.create(
            employee=emp, station=self.st_a, basic_salary=Decimal("10000"),
            housing_allowance=Decimal("1000"), transport_allowance=Decimal("500"),
            other_allowances=Decimal("500"), effective_from=date(2026, 1, 1))
        before = compute_hr_payroll_line(emp, structure, overtime_amount=Decimal("500"))
        top = TaxBracket.objects.get(order=7)
        top.deduction_amount = Decimal("1000")
        top.save()
        after = compute_hr_payroll_line(emp, structure, overtime_amount=Decimal("500"))
        self.assertEqual(after["income_tax"], Decimal("3130.00"))
        self.assertEqual(after["net_pay"], Decimal("8670.00"))
        self.assertNotEqual(before["net_pay"], after["net_pay"])

    def _run(self):
        return self.api_client(self.hrpayroll).post("/api/hr-payroll-runs/", {
            "name": "Oct 2026", "station": str(self.st_a.id),
            "period_start": "2026-10-01", "period_end": "2026-10-31",
            "ethiopian_month": 2, "ethiopian_year": 2019}, format="json")

    def test_payroll_flow_journal_balanced_and_paid(self):
        run = self._run()
        self.assertEqual(run.status_code, 201, run.data)
        run_id = run.data["id"]
        calc = self.api_client(self.hrpayroll).post(
            f"/api/hr-payroll-runs/{run_id}/calculate/", {}, format="json")
        self.assertEqual(calc.status_code, 200, calc.data)
        self.assertEqual(calc.data["status"], "calculated")
        self.assertEqual(calc.data["total_gross"], "20000.00")
        self.assertEqual(calc.data["total_net"], "14990.00")
        self.assertEqual(self.api_client(self.hrmanager).post(
            f"/api/hr-payroll-runs/{run_id}/verify/", {}, format="json").status_code, 200)
        self.assertEqual(self.api_client(self.admin).post(
            f"/api/hr-payroll-runs/{run_id}/approve/", {}, format="json").status_code, 200)
        posted = self.api_client(self.hrpayroll).post(
            f"/api/hr-payroll-runs/{run_id}/post-journal/", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        run_obj = HRPayrollRun.objects.get(pk=run_id)
        entry = run_obj.journal_entry
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, "posted")
        self.assertEqual(entry.lines.count(), 4)
        debits = sum((l.debit for l in entry.lines.all()), Decimal("0"))
        credits = sum((l.credit for l in entry.lines.all()), Decimal("0"))
        self.assertEqual(debits, credits)
        self.assertEqual(debits, Decimal("20000.00"))
        paid = self.api_client(self.hrpayroll).post(
            f"/api/hr-payroll-runs/{run_id}/pay/", {}, format="json")
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual(paid.data["status"], "paid")
        from hrm.models import Payslip
        self.assertEqual(Payslip.objects.filter(released=True).count(), 2)

    def test_payroll_calculate_twice_blocked(self):
        run_id = self._run().data["id"]
        c = self.api_client(self.hrpayroll)
        self.assertEqual(c.post(f"/api/hr-payroll-runs/{run_id}/calculate/", {},
                                format="json").status_code, 200)
        self.assertEqual(c.post(f"/api/hr-payroll-runs/{run_id}/calculate/", {},
                                format="json").status_code, 400)

    def test_payroll_self_approval_blocked(self):
        run_id = self._run().data["id"]
        c_pay = self.api_client(self.hrpayroll)
        c_pay.post(f"/api/hr-payroll-runs/{run_id}/calculate/", {}, format="json")
        # Preparer cannot verify their own run.
        self.assertEqual(c_pay.post(f"/api/hr-payroll-runs/{run_id}/verify/", {},
                                    format="json").status_code, 400)
        # Verifier cannot also approve; preparer cannot approve either.
        self.api_client(self.hrmanager).post(f"/api/hr-payroll-runs/{run_id}/verify/",
                                             {}, format="json")
        self.assertEqual(c_pay.post(f"/api/hr-payroll-runs/{run_id}/approve/", {},
                                    format="json").status_code, 400)
        self.assertEqual(self.api_client(self.hrmanager).post(
            f"/api/hr-payroll-runs/{run_id}/approve/", {}, format="json").status_code, 400)


class ManpowerApprovalTests(HRMBase):
    def _request(self):
        return self.api_client(self.recruiter).post("/api/hr-manpower-requests/", {
            "requester": self.recruiter.id, "department": str(self.dept.id),
            "station": str(self.st_a.id), "position": str(self.position.id),
            "headcount": 2, "justification": "Harvest cover", "status": "submitted"},
            format="json")

    def test_self_approval_blocked(self):
        resp = self._request()
        self.assertEqual(resp.status_code, 201, resp.data)
        bad = self.api_client(self.recruiter).post(
            f"/api/hr-manpower-requests/{resp.data['id']}/approve/", {}, format="json")
        self.assertEqual(bad.status_code, 403, bad.data)

    def test_approve_by_other_creates_approval_record(self):
        resp = self._request()
        ok = self.api_client(self.hradmin).post(
            f"/api/hr-manpower-requests/{resp.data['id']}/approve/", {}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["status"], "approved")
        from hrm.models import ApprovalRecord
        self.assertTrue(ApprovalRecord.objects.filter(
            workflow_type="manpower", object_id=resp.data["id"],
            decision="approved").exists())


class SeparationTests(HRMBase):
    def test_separation_preserves_deactivates_and_blocks_login(self):
        c = self.api_client(self.hradmin)
        sep = c.post("/api/hr-separation-requests/", {
            "employee": str(self.emp1.id), "separation_type": "resignation",
            "requested_by": self.hradmin.id, "reason": "Relocation",
            "last_working_date": "2026-11-30", "status": "pending"}, format="json")
        self.assertEqual(sep.status_code, 201, sep.data)
        sep_id = sep.data["id"]
        self.assertEqual(self.api_client(self.hrmanager).post(
            f"/api/hr-separation-requests/{sep_id}/manager-approve/", {},
            format="json").status_code, 200)
        self.assertEqual(self.api_client(self.hrpayroll).post(
            f"/api/hr-separation-requests/{sep_id}/hr-approve/", {},
            format="json").status_code, 200)
        self.assertEqual(c.post(f"/api/hr-separation-requests/{sep_id}/settle/", {},
                                format="json").status_code, 200)
        done = c.post(f"/api/hr-separation-requests/{sep_id}/deactivate/", {}, format="json")
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data["status"], "archived")
        self.emp1.refresh_from_db()
        self.assertEqual(self.emp1.status, "archived")
        self.assertFalse(self.emp1.is_active)
        self.assertTrue(self.emp1.account_deactivated)
        self.emp_user.refresh_from_db()
        self.assertFalse(self.emp_user.is_active)
        self.assertFalse(Token.objects.filter(user=self.emp_user).exists())
        # Record still exists (preserved, not deleted).
        self.assertEqual(c.get(f"/api/hr-employees/{self.emp1.id}/").status_code, 200)

    def test_login_blocked_for_deactivated_employee(self):
        user = User.objects.create_user("deactemp", password="pw12345!")
        Employee.objects.create(
            full_name="Deactivated Person", user=user, station=self.st_a,
            national_id="ET-2009", status="archived", account_deactivated=True)
        resp = APIClient().post("/api/auth/login/",
                                {"username": "deactemp", "password": "pw12345!"}, format="json")
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_employee_hard_delete_blocked(self):
        c = self.api_client(self.hradmin)
        resp = c.delete(f"/api/hr-employees/{self.emp2.id}/")
        self.assertIn(resp.status_code, (400, 409), resp.data)
        self.assertTrue(Employee.objects.filter(pk=self.emp2.pk).exists())
        # Model-level delete also raises.
        with self.assertRaises(ValueError):
            Employee.objects.get(pk=self.emp2.pk).delete()


class RoleDenialTests(HRMBase):
    def test_employee_cannot_approve_payroll(self):
        run = self.api_client(self.hrpayroll).post("/api/hr-payroll-runs/", {
            "name": "Nov 2026", "station": str(self.st_a.id),
            "period_start": "2026-11-01", "period_end": "2026-11-30"}, format="json")
        resp = self.api_client(self.emp_user).post(
            f"/api/hr-payroll-runs/{run.data['id']}/approve/", {}, format="json")
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_employee_cannot_read_payroll_runs(self):
        resp = self.api_client(self.emp_user).get("/api/hr-payroll-runs/")
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_operator_cannot_write_hr_employees(self):
        resp = self.api_client(self.operator).post(
            "/api/hr-employees/", self.emp_payload(), format="json")
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_employee_self_service(self):
        c = self.api_client(self.emp_user)
        me = c.get("/api/hr-employees/me/")
        self.assertEqual(me.status_code, 200, me.data)
        self.assertEqual(me.data["id"], str(self.emp1.id))
        listing = c.get("/api/hr-employees/")
        self.assertEqual(listing.status_code, 200)
        ids = [r["id"] for r in listing.data["results"]]
        self.assertEqual(ids, [str(self.emp1.id)])


class TimeOvertimeTests(HRMBase):
    def test_time_entry_hours_computed(self):
        resp = self.api_client(self.hradmin).post("/api/hr-time-entries/", {
            "employee": str(self.emp1.id), "station": str(self.st_a.id),
            "entry_date": "2026-10-27", "check_in": "08:00:00", "check_out": "17:00:00",
            "source": "manual"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["hours_worked"], "9.00")

    def test_overtime_amount_computed(self):
        resp = self.api_client(self.hradmin).post("/api/hr-overtime-records/", {
            "employee": str(self.emp1.id), "overtime_date": "2026-10-26",
            "hours": "2.00", "rate_multiplier": "1.50", "status": "approved"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        # 2 x 1.5 x (10000 / 208) = 144.23
        self.assertEqual(resp.data["amount"], "144.23")


class HRDashboardTests(HRMBase):
    def test_dashboard_200_with_counts(self):
        c = self.api_client(self.hradmin)
        JobVacancy.objects.create(title="Open Role", station=self.st_a, position=self.position,
                                  status="open", openings=1)
        cand = Candidate.objects.create(full_name="Applicant One")
        vac = JobVacancy.objects.get(title="Open Role")
        Application.objects.create(vacancy=vac, candidate=cand, status="pending")
        TimeEntry.objects.create(employee=self.emp1, station=self.st_a,
                                 entry_date=date.today(), check_in=time(8, 0),
                                 check_out=time(17, 0))
        LeaveRequest.objects.create(employee=self.emp1, leave_type=self.leave_type,
                                    station=self.st_a, start_date=date(2026, 12, 1),
                                    end_date=date(2026, 12, 2), status="pending")
        resp = c.get("/api/hr-dashboard/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["headcount"], 2)
        self.assertEqual(resp.data["active_employees"], 2)
        self.assertEqual(resp.data["vacancies_open"], 1)
        self.assertEqual(resp.data["applications_pending"], 1)
        self.assertEqual(resp.data["attendance_today"], 1)
        self.assertEqual(resp.data["leave_pending"], 1)
        self.assertIn("by_department", resp.data)
        self.assertIn("by_station", resp.data)
        self.assertIn("turnover_last_12m", resp.data)
        schema = c.get("/api/schema/")
        self.assertEqual(schema.status_code, 200)
        self.assertIn("hr-employees", schema.content.decode("utf-8", "ignore"))

    def test_dashboard_employee_forbidden(self):
        resp = self.api_client(self.emp_user).get("/api/hr-dashboard/")
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_registry_route_count(self):
        from api.views import REGISTRY
        hr_routes = [r for r, _ in REGISTRY if r.startswith("hr-")]
        self.assertEqual(len(hr_routes), 59)
