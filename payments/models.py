"""Module 18 — Payment Management: disbursements + export proceeds/forex."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class Disbursement(TimeStampedUUIDModel):
    """Sub-Module 18.1 — Outgoing Payment Processing Center."""

    class PayeeType(models.TextChoices):
        FARMER = "farmer", "Farmer (cash float payout)"
        SUPPLIER = "supplier", "Supplier (bank transfer)"
        WORKER_PAYROLL = "worker_payroll", "Seasonal payroll"
        OTHER = "other", "Other"

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank transfer"
        MOBILE = "mobile", "Mobile money"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        RECONCILED = "reconciled", "Reconciled"
        FAILED = "failed", "Failed"

    reference = models.CharField(max_length=48, unique=True)
    payee_type = models.CharField(max_length=16, choices=PayeeType.choices, db_index=True)
    farmer = models.ForeignKey("farmers.Farmer", null=True, blank=True, on_delete=models.PROTECT, related_name="disbursements")
    supplier = models.ForeignKey("procurement.Supplier", null=True, blank=True, on_delete=models.PROTECT, related_name="disbursements")
    voucher = models.ForeignKey("procurement.PurchaseVoucher", null=True, blank=True, on_delete=models.SET_NULL, related_name="disbursements")
    payroll_period = models.ForeignKey("payroll.PayrollPeriod", null=True, blank=True, on_delete=models.SET_NULL, related_name="disbursements")
    cash_float = models.ForeignKey("collection.CashFloat", null=True, blank=True, on_delete=models.SET_NULL, related_name="disbursements")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="ETB")
    method = models.CharField(max_length=8, choices=Method.choices, default=Method.CASH)
    paid_on = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="disbursements_made")


class ExportProceeds(TimeStampedUUIDModel):
    """Sub-Module 18.2 — Buyer Settlement & LC/CAD Reconciliation (SWIFT receipts)."""

    class SettlementType(models.TextChoices):
        LC = "lc", "Letter of Credit"
        CAD = "cad", "Cash Against Documents"
        TT = "tt", "Telegraphic Transfer"
        DP = "dp", "Documents Against Payment"

    contract = models.ForeignKey("buyers.SalesContract", on_delete=models.PROTECT, related_name="proceeds")
    settlement_type = models.CharField(max_length=8, choices=SettlementType.choices, db_index=True)
    swift_reference = models.CharField(max_length=64, blank=True, help_text="SWIFT MT103 reference")
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2)
    received_on = models.DateField(null=True, blank=True, db_index=True)
    bank_name = models.CharField(max_length=200, blank=True)
    is_reconciled = models.BooleanField(default=False)


class ForexRetention(TimeStampedUUIDModel):
    """Sub-Module 18.2 — NBE forex retention split on export proceeds."""

    proceeds = models.OneToOneField(ExportProceeds, on_delete=models.CASCADE, related_name="forex_retention")
    retention_pct = models.DecimalField(max_digits=5, decimal_places=2, help_text="Exporter retention % per NBE directive")
    retained_usd = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    surrendered_usd = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    etb_credited = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=0)
