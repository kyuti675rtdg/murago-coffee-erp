"""HRM — HR & Employees (new app).

Permanent-staff HR on top of the existing seasonal `hr` (workers) and
`payroll` (seasonal payroll) apps. Those apps and their tests are untouched;
this app covers organisation, employees, recruitment, onboarding,
attendance/time, leave, salaried payroll, performance, relations, assets,
separation, settings and approval audit.

Every model inherits core.base.TimeStampedUUIDModel (UUIDv7 PK + audit
timestamps). Every model that belongs to a site carries a `station` FK
(nullable where the station is inherited via employee/department/vacancy)
and station scoping paths are registered in api/views.py STATION_PATHS.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.base import TimeStampedUUIDModel

D0 = Decimal("0")
CENT = Decimal("0.01")


def _q(value):
    return Decimal(value or 0).quantize(CENT)


class StationAutoMixin:
    """Populate `station` from a related record when it was left blank.

    `station_source_paths` are "__"-paths ending in a Station instance,
    tried in order. Only runs when station_id is empty, so an explicitly
    supplied station is never overwritten.
    """

    station_source_paths = ()

    def _auto_station(self):
        if getattr(self, "station_id", None):
            return
        for path in self.station_source_paths:
            cur = self
            for part in path.split("__"):
                cur = getattr(cur, part, None)
                if cur is None:
                    break
            if cur is not None:
                self.station = cur
                return

    def save(self, *args, **kwargs):
        self._auto_station()
        super().save(*args, **kwargs)


# ---------------------------------------------------------------- organisation
class Department(StationAutoMixin, TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_departments")
    head = models.ForeignKey("Employee", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="headed_departments")
    description = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "code"])]

    def __str__(self):
        return f"{self.code} — {self.name}"


class JobGrade(TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code} — {self.title}"


class JobPosition(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("department__station",)
    code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="positions")
    grade = models.ForeignKey(JobGrade, null=True, blank=True, on_delete=models.SET_NULL,
                              related_name="positions")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_positions")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} — {self.title}"


class ReportingLine(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey("Employee", on_delete=models.CASCADE, related_name="reporting_lines")
    manager = models.ForeignKey("Employee", on_delete=models.PROTECT, related_name="direct_reports")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_reporting_lines")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["employee", "manager", "effective_from"],
                                               name="uniq_reporting_line")]

    def __str__(self):
        return f"{self.employee} reports to {self.manager}"


# ---------------------------------------------------------------- employees
class Employee(TimeStampedUUIDModel):
    class EmploymentType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        CONTRACT = "contract", "Contract"
        TEMPORARY = "temporary", "Temporary"
        INTERN = "intern", "Intern"

    class Status(models.TextChoices):
        PROBATION = "probation", "Probation"
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On Leave"
        SUSPENDED = "suspended", "Suspended"
        SEPARATED = "separated", "Separated"
        ARCHIVED = "archived", "Archived"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    employee_id = models.CharField(max_length=24, unique=True, blank=True, db_index=True,
                                   help_text='Auto-generated "EMP-YYYY-####" when blank')
    full_name = models.CharField(max_length=200, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="hrm_employees")
    worker = models.ForeignKey("hr.Worker", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="hrm_employees")
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.PROTECT,
                                   related_name="employees")
    position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="employees")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_employees")
    manager = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="subordinates")
    national_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, blank=True)
    address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
    employment_type = models.CharField(max_length=16, choices=EmploymentType.choices,
                                       default=EmploymentType.PERMANENT, db_index=True)
    contract_type = models.CharField(max_length=64, blank=True)
    hire_date = models.DateField(null=True, blank=True, db_index=True)
    probation_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    is_active = models.BooleanField(default=True, db_index=True)
    account_deactivated = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(
            fields=["national_id"], condition=models.Q(national_id__gt=""),
            name="uniq_employee_national_id_nonempty")]
        indexes = [models.Index(fields=["station", "status"]),
                   models.Index(fields=["department", "status"])]

    def save(self, *args, **kwargs):
        if not self.employee_id:
            year = self.hire_date.year if self.hire_date else timezone.now().year
            prefix = f"EMP-{year}-"
            seq = Employee.objects.filter(employee_id__startswith=prefix).count() + 1
            candidate = f"{prefix}{seq:04d}"
            while Employee.objects.filter(employee_id=candidate).exists():
                seq += 1
                candidate = f"{prefix}{seq:04d}"
            self.employee_id = candidate
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Hard delete is blocked: separated/archived employees are legal
        # history. Use the archive action instead.
        raise ValueError("Employees cannot be hard-deleted; archive the record instead.")

    def __str__(self):
        return f"{self.employee_id} — {self.full_name}"


class EmployeeDocument(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class DocType(models.TextChoices):
        NATIONAL_ID = "national_id", "National ID"
        CV = "cv", "CV / Resume"
        CERTIFICATE = "certificate", "Certificate"
        CONTRACT = "contract", "Contract"
        PHOTO = "photo", "Photo"
        OTHER = "other", "Other"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="documents")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_employee_documents")
    doc_type = models.CharField(max_length=24, choices=DocType.choices, default=DocType.OTHER, db_index=True)
    file = models.FileField(upload_to="hr_docs/", null=True, blank=True)
    file_path = models.CharField(max_length=500, blank=True,
                                 help_text="Fallback path/URL when no file upload is stored")
    verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="verified_employee_documents")
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.employee} · {self.doc_type}"


class EmploymentHistory(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class EventType(models.TextChoices):
        TRANSFER = "transfer", "Transfer"
        PROMOTION = "promotion", "Promotion"
        DEMOTION = "demotion", "Demotion"
        ACTING = "acting", "Acting Appointment"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="employment_history")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_employment_histories")
    event_type = models.CharField(max_length=16, choices=EventType.choices, db_index=True)
    from_department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL,
                                        related_name="history_from")
    to_department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="history_to")
    from_position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="history_from")
    to_position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="history_to")
    from_grade = models.ForeignKey(JobGrade, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="history_from")
    to_grade = models.ForeignKey(JobGrade, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="history_to")
    effective_date = models.DateField(db_index=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="approved_employment_histories")
    notes = models.TextField(blank=True)


class EmployeeStatusLog(StationAutoMixin, TimeStampedUUIDModel):
    """Append-only status history: rows are created, never edited/deleted."""
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="status_logs")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_status_logs")
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                              related_name="employee_status_logs")
    reason = models.TextField(blank=True)

    def delete(self, *args, **kwargs):
        raise ValueError("EmployeeStatusLog is append-only and cannot be deleted.")

    def __str__(self):
        return f"{self.employee} {self.from_status} → {self.to_status}"

# ---------------------------------------------------------------- recruitment
class ManpowerRequest(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("department__station",)

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        FULFILLED = "fulfilled", "Fulfilled"

    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                  related_name="manpower_requests")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="manpower_requests")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_manpower_requests")
    position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="manpower_requests")
    headcount = models.PositiveIntegerField(default=1)
    justification = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="approved_manpower_requests")
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "status"])]


class JobVacancy(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("position__department__station",)

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        FILLED = "filled", "Filled"

    manpower_request = models.ForeignKey(ManpowerRequest, null=True, blank=True, on_delete=models.SET_NULL,
                                         related_name="vacancies")
    position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="vacancies")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_vacancies")
    title = models.CharField(max_length=200)
    openings = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    closing_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    requirements = models.TextField(blank=True)

    def __str__(self):
        return self.title


class Candidate(TimeStampedUUIDModel):
    full_name = models.CharField(max_length=200, db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    national_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    dob = models.DateField(null=True, blank=True)
    cv_path = models.CharField(max_length=500, blank=True)
    source = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.full_name


class Application(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("vacancy__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        UNDER_REVIEW = "under_review", "Under Review"
        SHORTLISTED = "shortlisted", "Shortlisted"
        REJECTED = "rejected", "Rejected"
        SELECTED = "selected", "Selected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    vacancy = models.ForeignKey(JobVacancy, on_delete=models.CASCADE, related_name="applications")
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="applications")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_applications")
    cover_note = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["vacancy", "candidate"],
                                               name="uniq_application_vacancy_candidate")]
        indexes = [models.Index(fields=["vacancy", "status"])]


class Screening(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("application__vacancy__station",)

    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"

    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name="screening")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_screenings")
    screener = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="screenings")
    score = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    decision = models.CharField(max_length=16, choices=Decision.choices, default=Decision.PENDING, db_index=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=models.Q(score__gte=0, score__lte=100),
                                              name="screening_score_0_100")]


class Interview(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("application__vacancy__station",)

    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="interviews")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_interviews")
    panel = models.JSONField(default=list, blank=True, help_text="Panel member names/roles")
    interviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="interviews")
    interview_date = models.DateTimeField(null=True, blank=True, db_index=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    decision = models.CharField(max_length=16, choices=Decision.choices, default=Decision.PENDING, db_index=True)
    notes = models.TextField(blank=True)


class Assessment(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("application__vacancy__station",)

    class Result(models.TextChoices):
        PENDING = "pending", "Pending"
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="assessments")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_assessments")
    assessment_type = models.CharField(max_length=120)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    result = models.CharField(max_length=16, choices=Result.choices, default=Result.PENDING, db_index=True)
    assessed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="assessments")
    assessed_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)


class SelectionDecision(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("application__vacancy__station",)

    class Decision(models.TextChoices):
        SELECTED = "selected", "Selected"
        REJECTED = "rejected", "Rejected"
        WAITLISTED = "waitlisted", "Waitlisted"

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="selection_decisions")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_selection_decisions")
    decision = models.CharField(max_length=16, choices=Decision.choices, db_index=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="selection_decisions")
    decided_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)


class OfferLetter(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("application__vacancy__station",)

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="offer_letters")
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="offer_letters")
    position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="offer_letters")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_offer_letters")
    salary_offered = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    start_date = models.DateField(null=True, blank=True)
    terms = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)


# ---------------------------------------------------------------- onboarding
class EmploymentContract(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        TERMINATED = "terminated", "Terminated"

    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="contracts")
    candidate = models.ForeignKey(Candidate, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="contracts")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_contracts")
    contract_type = models.CharField(max_length=64, blank=True)
    start_date = models.DateField(null=True, blank=True, db_index=True)
    end_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    probation_months = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    terms = models.TextField(blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)


class OnboardingChecklist(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station", "application__vacancy__station")

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    candidate = models.ForeignKey(Candidate, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="onboarding_checklists")
    application = models.ForeignKey(Application, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="onboarding_checklists")
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="onboarding_checklists")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_onboarding_checklists")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class OnboardingTask(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("checklist__station", "checklist__employee__station",
                            "checklist__application__vacancy__station")

    class TaskType(models.TextChoices):
        DOCUMENT_VERIFICATION = "document_verification", "Document Verification"
        CONTRACT = "contract", "Contract"
        ORIENTATION = "orientation", "Orientation"
        DEPARTMENT_ASSIGNMENT = "department_assignment", "Department Assignment"
        ACCOUNT_CREATION = "account_creation", "Account Creation"
        EQUIPMENT = "equipment", "Equipment"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        BLOCKED = "blocked", "Blocked"

    checklist = models.ForeignKey(OnboardingChecklist, on_delete=models.CASCADE, related_name="tasks")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_onboarding_tasks")
    task_type = models.CharField(max_length=32, choices=TaskType.choices, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    due_date = models.DateField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="completed_onboarding_tasks")
    completed_at = models.DateTimeField(null=True, blank=True)


class DocumentVerification(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    candidate = models.ForeignKey(Candidate, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="document_verifications")
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="document_verifications")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_document_verifications")
    document_type = models.CharField(max_length=120)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="document_verifications")
    verified = models.BooleanField(default=False, db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

# ---------------------------------------------------------------- attendance / time
class Shift(TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    start_time = models.TimeField()
    end_time = models.TimeField()
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="hrm_shifts")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class ShiftAssignment(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="shift_assignments")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="assignments")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_shift_assignments")
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)


class TimeEntry(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        BIOMETRIC_IMPORT = "biometric_import", "Biometric Import"
        OFFLINE = "offline", "Offline"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="time_entries")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_time_entries")
    entry_date = models.DateField(db_index=True)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    source = models.CharField(max_length=24, choices=Source.choices, default=Source.MANUAL, db_index=True)
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    late_minutes = models.PositiveIntegerField(default=0)
    absent = models.BooleanField(default=False, db_index=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["employee", "entry_date"],
                                               name="uniq_time_entry_employee_date")]
        indexes = [models.Index(fields=["station", "entry_date"])]

    def save(self, *args, **kwargs):
        if self.check_in is not None and self.check_out is not None:
            from datetime import datetime as _dt
            start = _dt.combine(self.entry_date, self.check_in)
            end = _dt.combine(self.entry_date, self.check_out)
            if end < start:  # overnight shift
                from datetime import timedelta as _td
                end += _td(days=1)
            self.hours_worked = _q((end - start).total_seconds() / 3600)
        super().save(*args, **kwargs)


class Timesheet(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="timesheets")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_timesheets")
    period_start = models.DateField(db_index=True)
    period_end = models.DateField(db_index=True)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=D0)
    total_overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=D0)
    total_late_minutes = models.PositiveIntegerField(default=0)
    total_absent_days = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="approved_timesheets")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["employee", "period_start", "period_end"],
                                               name="uniq_timesheet_period")]


class OvertimeRecord(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="overtime_records")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_overtime_records")
    overtime_date = models.DateField(db_index=True)
    hours = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    rate_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.50"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=D0,
                                 help_text="Computed: hours x rate_multiplier x (basic_salary / overtime_divisor)")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="approved_overtime_records")
    notes = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if self.employee_id:
            divisor = Decimal("208")
            try:
                rule = PayrollRule.objects.filter(is_active=True).order_by("-created_at").first()
                if rule and rule.overtime_divisor:
                    divisor = Decimal(rule.overtime_divisor)
            except Exception:
                pass
            hourly_rate = Decimal(self.employee.basic_salary or 0) / divisor if divisor else D0
            self.amount = _q(Decimal(self.hours or 0) * Decimal(self.rate_multiplier or 0) * hourly_rate)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------- leave
class LeaveType(TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    annual_entitlement_days = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class LeaveBalance(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_balances")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="balances")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_leave_balances")
    year = models.PositiveIntegerField(db_index=True)
    entitled = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    used = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    remaining = models.DecimalField(max_digits=5, decimal_places=2, default=D0,
                                    help_text="Computed on save: entitled - used")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["employee", "leave_type", "year"],
                                               name="uniq_leave_balance")]

    def save(self, *args, **kwargs):
        self.remaining = _q(Decimal(self.entitled or 0) - Decimal(self.used or 0))
        super().save(*args, **kwargs)


class LeaveRequest(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="leave_requests")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_leave_requests")
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    days = models.DecimalField(max_digits=5, decimal_places=2, default=D0)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="decided_leave_requests")
    decided_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.start_date and self.end_date:
            self.days = _q((self.end_date - self.start_date).days + 1)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------- payroll / benefits
class SalaryStructure(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_structures")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_salary_structures")
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    hardship_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    exempt_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["employee", "effective_from"],
                                               name="uniq_salary_structure_effective")]

    @property
    def total_allowances(self):
        return sum((self.housing_allowance, self.transport_allowance, self.hardship_allowance,
                    self.other_allowances, self.exempt_allowance), D0)


class Benefit(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class BenefitType(models.TextChoices):
        HOUSING = "housing", "Housing"
        TRANSPORT = "transport", "Transport"
        MEDICAL = "medical", "Medical"
        HARDSHIP = "hardship", "Hardship"
        OTHER = "other", "Other"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="benefits")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_benefits")
    benefit_type = models.CharField(max_length=24, choices=BenefitType.choices, default=BenefitType.OTHER,
                                    db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)


class PayrollRule(TimeStampedUUIDModel):
    name = models.CharField(max_length=120, unique=True)
    pension_employee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("7.00"))
    pension_employer_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("11.00"))
    overtime_divisor = models.PositiveIntegerField(default=208)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(default="CONFIGURABLE DEFAULTS — confirm with Finance/HR", blank=True)

    def __str__(self):
        return self.name


class TaxBracket(TimeStampedUUIDModel):
    lower_bound = models.DecimalField(max_digits=12, decimal_places=2, db_index=True)
    upper_bound = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                      help_text="Null = no upper bound (top bracket)")
    rate_pct = models.DecimalField(max_digits=5, decimal_places=2)
    deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    order = models.PositiveIntegerField(default=1, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        ordering = ["order", "lower_bound"]
        indexes = [models.Index(fields=["is_active", "order"])]

    def __str__(self):
        upper = str(self.upper_bound) if self.upper_bound is not None else "∞"
        return f"{self.lower_bound}–{upper} @ {self.rate_pct}% − {self.deduction_amount}"


class PensionRule(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    employee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("7.00"))
    employer_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("11.00"))
    applies_to = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class HRPayrollRun(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        CALCULATED = "calculated", "Calculated"
        VERIFIED = "verified", "Verified"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"

    name = models.CharField(max_length=200)
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="hrm_payroll_runs")
    period_start = models.DateField(db_index=True)
    period_end = models.DateField(db_index=True)
    ethiopian_month = models.PositiveSmallIntegerField(null=True, blank=True)
    ethiopian_year = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    prepared_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="hrm_runs_prepared")
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="hrm_runs_verified")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="hrm_runs_approved")
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    total_pension_employee = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    total_pension_employer = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    total_tax = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    total_net = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    journal_entry = models.ForeignKey("finance.JournalEntry", null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="hrm_payroll_runs")
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "status"])]


class HRPayrollLine(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("run__station",)
    run = models.ForeignKey(HRPayrollRun, on_delete=models.CASCADE, related_name="lines")
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="hrm_payroll_lines")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_payroll_lines")
    basic = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    overtime_amount = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    bonuses = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    gross = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    pension_employee = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    pension_employer = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    taxable_income = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    income_tax = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    net_pay = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    payslip_number = models.CharField(max_length=64, blank=True, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["run", "employee"], name="uniq_hr_payroll_line")]


class Payslip(TimeStampedUUIDModel):
    line = models.OneToOneField(HRPayrollLine, on_delete=models.CASCADE, related_name="payslip")
    released = models.BooleanField(default=False, db_index=True)
    released_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Payslip {self.line.payslip_number or self.line_id}"

# ---------------------------------------------------------------- performance
class KPI(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station", "position__department__station")
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.CASCADE,
                                 related_name="kpis")
    position = models.ForeignKey(JobPosition, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="kpis")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_kpis")
    title = models.CharField(max_length=200)
    target_value = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    actual_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=40, blank=True)
    period = models.CharField(max_length=40, blank=True, db_index=True)
    notes = models.TextField(blank=True)


class PerformanceReview(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"

    class Rating(models.TextChoices):
        EXCELLENT = "excellent", "Excellent"
        GOOD = "good", "Good"
        SATISFACTORY = "satisfactory", "Satisfactory"
        NEEDS_IMPROVEMENT = "needs_improvement", "Needs Improvement"
        POOR = "poor", "Poor"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="performance_reviews")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="performance_reviews")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_performance_reviews")
    period_start = models.DateField(db_index=True)
    period_end = models.DateField(db_index=True)
    scores = models.JSONField(default=dict, blank=True)
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    rating = models.CharField(max_length=24, choices=Rating.choices, blank=True)
    development_plan = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)


class TrainingCourse(TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    provider = models.CharField(max_length=200, blank=True)
    duration_days = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code} — {self.title}"


class TrainingPlan(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station", "department__station")

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    course = models.ForeignKey(TrainingCourse, on_delete=models.PROTECT, related_name="training_plans")
    employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.CASCADE,
                                 related_name="training_plans")
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.PROTECT,
                                   related_name="training_plans")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_training_plans")
    planned_date = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED, db_index=True)
    notes = models.TextField(blank=True)


class TrainingEnrollment(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station", "plan__station")

    class Status(models.TextChoices):
        ENROLLED = "enrolled", "Enrolled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        DROPPED = "dropped", "Dropped"

    plan = models.ForeignKey(TrainingPlan, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="enrollments")
    course = models.ForeignKey(TrainingCourse, null=True, blank=True, on_delete=models.PROTECT,
                               related_name="enrollments")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="training_enrollments")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_training_enrollments")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ENROLLED, db_index=True)
    attended = models.BooleanField(default=False)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)


class Certification(StationAutoMixin, TimeStampedUUIDModel):
    """HRM employee certification (distinct from farmers.Certification)."""
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="hrm_certifications")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_certifications")
    title = models.CharField(max_length=200)
    issuer = models.CharField(max_length=200, blank=True)
    issued_date = models.DateField(null=True, blank=True, db_index=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    credential_id = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)


class CompetencyAssessment(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="competency_assessments")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_competency_assessments")
    skill = models.CharField(max_length=200)
    rating = models.PositiveSmallIntegerField(default=1)
    assessed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="competency_assessments")
    assessed_on = models.DateField(null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5),
                                              name="competency_rating_1_5")]


# ---------------------------------------------------------------- relations
class Grievance(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATION = "investigation", "Under Investigation"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="grievances")
    complainant = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="grievances_filed")
    complainant_employee = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                             related_name="grievances_filed_as_employee")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_grievances")
    category = models.CharField(max_length=120, db_index=True)
    description = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="assigned_grievances")
    resolution = models.TextField(blank=True)


class DisciplinaryCase(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class CaseType(models.TextChoices):
        WARNING = "warning", "Warning"
        FINAL_WARNING = "final_warning", "Final Warning"
        SUSPENSION = "suspension", "Suspension"
        TERMINATION = "termination", "Termination"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATION = "investigation", "Under Investigation"
        DECIDED = "decided", "Decided"
        APPEALED = "appealed", "Appealed"
        CLOSED = "closed", "Closed"

    class AppealStatus(models.TextChoices):
        NONE = "none", "None"
        APPEALED = "appealed", "Appealed"
        UPHELD = "upheld", "Upheld"
        OVERTURNED = "overturned", "Overturned"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="disciplinary_cases")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_disciplinary_cases")
    case_type = models.CharField(max_length=16, choices=CaseType.choices, db_index=True)
    description = models.TextField()
    investigation_notes = models.TextField(blank=True)
    decision = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="decided_disciplinary_cases")
    appeal_status = models.CharField(max_length=16, choices=AppealStatus.choices,
                                     default=AppealStatus.NONE, db_index=True)


# ---------------------------------------------------------------- assets
class CompanyAsset(TimeStampedUUIDModel):
    class AssetType(models.TextChoices):
        UNIFORM = "uniform", "Uniform"
        EQUIPMENT = "equipment", "Equipment"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        ASSIGNED = "assigned", "Assigned"
        MAINTENANCE = "maintenance", "Under Maintenance"
        RETURNED = "returned", "Returned"
        LOST = "lost", "Lost"

    asset_code = models.CharField(max_length=32, unique=True, db_index=True)
    asset_type = models.CharField(max_length=16, choices=AssetType.choices, db_index=True)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="company_assets")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="hrm_company_assets")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE, db_index=True)
    purchase_date = models.DateField(null=True, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, default=D0)

    def __str__(self):
        return f"{self.asset_code} — {self.asset_type}"


class AssetReturn(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("asset__station",)
    asset = models.ForeignKey(CompanyAsset, on_delete=models.CASCADE, related_name="returns")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_asset_returns")
    returned_date = models.DateField(db_index=True)
    condition = models.CharField(max_length=120, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="received_asset_returns")
    notes = models.TextField(blank=True)


class ClearanceChecklist(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("separation__employee__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CLEARED = "cleared", "Cleared"
        WAIVED = "waived", "Waived"

    separation = models.ForeignKey("SeparationRequest", on_delete=models.CASCADE,
                                   related_name="clearance_items")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_clearance_checklists")
    item = models.CharField(max_length=200)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    cleared_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="cleared_checklists")
    cleared_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)


# ---------------------------------------------------------------- separation
class SeparationRequest(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("employee__station",)

    class SeparationType(models.TextChoices):
        RESIGNATION = "resignation", "Resignation"
        TERMINATION = "termination", "Termination"
        RETIREMENT = "retirement", "Retirement"
        CONTRACT_EXPIRY = "contract_expiry", "Contract Expiry"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        MANAGER_APPROVED = "manager_approved", "Manager Approved"
        HR_APPROVED = "hr_approved", "HR Approved"
        REJECTED = "rejected", "Rejected"
        CLEARED = "cleared", "Cleared"
        SETTLED = "settled", "Settled"
        ARCHIVED = "archived", "Archived"

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="separation_requests")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_separation_requests")
    separation_type = models.CharField(max_length=24, choices=SeparationType.choices, db_index=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="requested_separations")
    reason = models.TextField(blank=True)
    notice_start = models.DateField(null=True, blank=True)
    notice_end = models.DateField(null=True, blank=True)
    last_working_date = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    manager_approver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                         on_delete=models.SET_NULL, related_name="manager_approved_separations")
    hr_approver = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="hr_approved_separations")
    decided_at = models.DateTimeField(null=True, blank=True)


class Handover(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("separation__employee__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    separation = models.ForeignKey(SeparationRequest, on_delete=models.CASCADE, related_name="handovers")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_handovers")
    handover_to = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="incoming_handovers")
    items = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class ExitInterview(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("separation__employee__station",)
    separation = models.OneToOneField(SeparationRequest, on_delete=models.CASCADE,
                                      related_name="exit_interview")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_exit_interviews")
    interviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="exit_interviews")
    interview_date = models.DateField(null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(
            condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=5),
            name="exit_interview_rating_1_5")]


class FinalSettlement(StationAutoMixin, TimeStampedUUIDModel):
    station_source_paths = ("separation__employee__station",)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CALCULATED = "calculated", "Calculated"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"

    separation = models.OneToOneField(SeparationRequest, on_delete=models.CASCADE,
                                      related_name="final_settlement")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT,
                                related_name="hrm_final_settlements")
    final_salary = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    unused_leave_pay = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    benefits_due = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=D0)
    total_payable = models.DecimalField(max_digits=14, decimal_places=2, default=D0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        total = (Decimal(self.final_salary or 0) + Decimal(self.unused_leave_pay or 0)
                 + Decimal(self.benefits_due or 0) - Decimal(self.deductions or 0))
        self.total_payable = _q(max(total, D0))
        super().save(*args, **kwargs)


# ---------------------------------------------------------------- settings / reports
class HRPolicy(TimeStampedUUIDModel):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True, db_index=True)
    effective_from = models.DateField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return f"{self.code} — {self.title}"


class ApprovalWorkflowConfig(TimeStampedUUIDModel):
    workflow_type = models.CharField(
        max_length=64, db_index=True,
        help_text="e.g. manpower / leave / payroll / separation / disciplinary")
    step_order = models.PositiveIntegerField(default=1)
    role_code = models.CharField(max_length=32, db_index=True)
    requires_dual = models.BooleanField(default=False)
    amount_threshold = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["workflow_type", "step_order"],
                                               name="uniq_approval_workflow_step")]
        ordering = ["workflow_type", "step_order"]


class ShiftPolicy(TimeStampedUUIDModel):
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="policies")
    name = models.CharField(max_length=200)
    policy_rules = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)


class SalaryRule(TimeStampedUUIDModel):
    """Small named rule blobs (JSON) kept for compatibility alongside the
    structured PayrollRule / TaxBracket / PensionRule configuration."""
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    rule_json = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return self.name


class HRReportDefinition(TimeStampedUUIDModel):
    class Kind(models.TextChoices):
        HEADCOUNT = "headcount", "Headcount"
        TURNOVER = "turnover", "Turnover"
        ATTENDANCE = "attendance", "Attendance"
        PAYROLL_COST = "payroll_cost", "Payroll Cost"
        VACANCY = "vacancy", "Vacancy"
        PERFORMANCE = "performance", "Performance"
        LEAVE = "leave", "Leave"
        SITE = "site", "Site"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=24, choices=Kind.choices, db_index=True)
    filters = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)


class ApprovalRecord(TimeStampedUUIDModel):
    """Generic audit of every approval action (workflow, object, step, actor)."""
    workflow_type = models.CharField(max_length=64, db_index=True)
    object_type = models.CharField(max_length=128, db_index=True)
    object_id = models.UUIDField(db_index=True)
    step_order = models.PositiveIntegerField(default=1)
    role_code = models.CharField(max_length=32, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="hrm_approval_records")
    decision = models.CharField(max_length=16, choices=[("approved", "Approved"), ("rejected", "Rejected")],
                                db_index=True)
    comment = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["workflow_type", "object_type", "object_id"]),
                   models.Index(fields=["actor", "decided_at"])]
