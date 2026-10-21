"""Module 12 — HR & Attendance Management: workers + 30-day time control matrix."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class WageType(models.TextChoices):
    DAILY = "daily", "Daily rate"
    HOURLY = "hourly", "Hourly rate"
    PIECE = "piece", "Piece rate"


class Worker(TimeStampedUUIDModel):
    """Sub-Module 12.1 — Seasonal Worker Registry (casual labour & operators)."""

    class WorkerKind(models.TextChoices):
        DAILY_LABOUR = "daily_labour", "Daily Labourer"
        CHERRY_SORTER = "cherry_sorter", "Cherry Sorter"
        BED_TURNER = "bed_turner", "Drying Bed Turner"
        MACHINE_OPERATOR = "machine_operator", "Machine Operator"
        OTHER = "other", "Other"

    worker_code = models.CharField(max_length=24, unique=True, help_text="Worker ID (ተ.ቁ)")
    full_name = models.CharField(max_length=200, help_text="Worker Name (የሠራተኛው ስም)")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="workers")
    kind = models.CharField(max_length=24, choices=WorkerKind.choices, db_index=True)
    wage_type = models.CharField(max_length=12, choices=WageType.choices, default=WageType.DAILY)
    wage_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                    help_text="ETB per day / per hour / per piece, per wage_type")
    phone = models.CharField(max_length=32, blank=True)
    hired_on = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "kind"])]

    def __str__(self):
        return f"{self.worker_code} — {self.full_name}"


class AttendanceSheet(TimeStampedUUIDModel):
    """Sub-Module 12.2 — 30-Day Worker Attendance Grid (የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ).

    One sheet = one station + one Ethiopian month/year (ወር / ዓ.ም). The grid
    itself is AttendanceEntry rows (worker x day 1..30). Payroll may only be
    generated once BOTH dual signatures exist: Controlled By
    (የተቆጣጠረው ስምና ፊርማ) and Verified By (ያረጋገጠው ስምና ፊርማ), by two
    different users — enforced in hr_payroll.engine.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open (entry in progress)"
        CONTROLLED = "controlled", "Controlled (1st signature)"
        VERIFIED = "verified", "Verified (both signatures — payroll-ready)"
        LOCKED = "locked", "Locked (payroll generated)"

    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="attendance_sheets")
    ethiopian_month = models.PositiveSmallIntegerField(help_text="Ethiopian month 1–13 (ወር)")
    ethiopian_year = models.PositiveIntegerField(help_text="Ethiopian year (ዓ.ም), e.g. 2018")
    controlled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="attendance_controlled")
    controlled_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="attendance_verified")
    verified_at = models.DateTimeField(null=True, blank=True)
    signoff = models.ForeignKey("core.DualSignOff", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="attendance_sheets")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["station", "ethiopian_month", "ethiopian_year"],
                                    name="uniq_attendance_sheet"),
            models.CheckConstraint(condition=models.Q(ethiopian_month__gte=1, ethiopian_month__lte=13),
                                   name="eth_month_1_13"),
        ]

    @property
    def is_dual_verified(self) -> bool:
        return bool(self.controlled_by_id and self.verified_by_id
                    and self.controlled_by_id != self.verified_by_id)


class AttendanceEntry(TimeStampedUUIDModel):
    """One cell of the 30-day grid: a worker on a day (1–30 of the sheet month)."""

    class Mark(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        HALF = "half", "Half day"
        LEAVE = "leave", "Leave"

    sheet = models.ForeignKey(AttendanceSheet, on_delete=models.CASCADE, related_name="entries")
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="attendance_entries")
    day = models.PositiveSmallIntegerField(help_text="Day of month, 1–30")
    mark = models.CharField(max_length=8, choices=Mark.choices, default=Mark.PRESENT)
    hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    pieces = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                 help_text="Piece count for piece-rate workers (e.g. kg sorted)")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["sheet", "worker", "day"], name="uniq_attendance_cell"),
            models.CheckConstraint(condition=models.Q(day__gte=1, day__lte=30), name="attendance_day_1_30"),
        ]
        indexes = [models.Index(fields=["sheet", "worker"])]


class WorkerAdvance(TimeStampedUUIDModel):
    """Cash advance to a worker — becomes a payroll deduction (ተቆራጭ)."""

    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="advances")
    sheet = models.ForeignKey(AttendanceSheet, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="advances")
    advance_date = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True)
