"""Module 13 — Payroll Management: seasonal wage computation + sign-off sheets."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class PayrollPeriod(TimeStampedUUIDModel):
    """Sub-Module 13.1/13.2 — payroll run generated from ONE verified attendance sheet."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PREPARED = "prepared", "Prepared"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"

    sheet = models.OneToOneField("hr.AttendanceSheet", on_delete=models.PROTECT, related_name="payroll")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="payrolls")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    prepared_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="payrolls_prepared")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="payrolls_approved")
    approved_at = models.DateTimeField(null=True, blank=True)
    signoff = models.ForeignKey("core.DualSignOff", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="payrolls")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(
            condition=models.Q(approved_by__isnull=True) | ~models.Q(prepared_by=models.F("approved_by")),
            name="payroll_preparer_ne_approver")]


class PayrollLine(TimeStampedUUIDModel):
    """Sub-Module 13.1 — one row of the Daily Worker Payroll Sheet (የቀን ሠራተኞች መክፈያ ፔሮል).
    Sub-Module 13.2 — recipient sign-off column (የተቀባይ ስምና ፊርማ), rows 1–40+."""

    period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="lines")
    worker = models.ForeignKey("hr.Worker", on_delete=models.PROTECT, related_name="payroll_lines")
    row_no = models.PositiveIntegerField(help_text="Printed row number on the payroll sheet (1–40+)")
    total_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_pieces = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    wage_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_pay = models.DecimalField(max_digits=14, decimal_places=2, default=0, help_text="Gross Pay (ጠቅላላ ክፍያ)")
    deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                     help_text="Deductions / Advances (ተቆራጭ)")
    net_pay = models.DecimalField(max_digits=14, decimal_places=2, default=0, help_text="Net Pay (የተጣራ ክፍያ)")
    recipient_signed = models.BooleanField(default=False, help_text="Recipient Name & Signature captured")
    recipient_signature_sha256 = models.CharField(max_length=64, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["period", "worker"], name="uniq_payroll_line"),
                       models.UniqueConstraint(fields=["period", "row_no"], name="uniq_payroll_row")]
        ordering = ["row_no"]
