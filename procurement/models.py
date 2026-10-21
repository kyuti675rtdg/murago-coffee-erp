"""Module 4 — Procurement Management: suppliers, daily prices, vouchers, GRNs."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class Supplier(TimeStampedUUIDModel):
    """Sub-Module 4.1 — external suppliers (ACRs / cooperatives / estates)."""

    class SupplierType(models.TextChoices):
        ACR = "acr", "Accredited Cherry Receiver (ACR)"
        COOPERATIVE = "cooperative", "Cooperative"
        ESTATE = "estate", "Estate Farm"
        OTHER = "other", "Other"

    code = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=200)
    supplier_type = models.CharField(max_length=16, choices=SupplierType.choices, db_index=True)
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    license_number = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class DailyPrice(TimeStampedUUIDModel):
    """Sub-Module 4.1 — Daily Buying Price & Supplier Configuration."""

    class Product(models.TextChoices):
        RED_CHERRY = "red_cherry", "Red Cherry"
        PARCHMENT = "parchment", "Parchment"
        DRIED_CHERRY = "dried_cherry", "Dried (Natural) Cherry"

    station = models.ForeignKey("core.Station", on_delete=models.CASCADE, related_name="daily_prices")
    price_date = models.DateField(db_index=True)
    product = models.CharField(max_length=16, choices=Product.choices, db_index=True)
    grade = models.CharField(max_length=32, blank=True, help_text="Grade label, e.g. G1 / G2 / local")
    price_per_kg = models.DecimalField(max_digits=12, decimal_places=2)
    set_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="daily_prices_set")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "price_date", "product", "grade"],
                                               name="uniq_daily_price")]


class PurchaseVoucher(TimeStampedUUIDModel):
    """Sub-Module 4.2 — Purchase Ledger & Voucher Approval."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending Approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        PAID = "paid", "Paid"

    voucher_number = models.CharField(max_length=40, unique=True)
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="purchase_vouchers")
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.PROTECT, related_name="vouchers")
    farmer = models.ForeignKey("farmers.Farmer", null=True, blank=True, on_delete=models.PROTECT, related_name="vouchers")
    intake = models.ForeignKey("collection.CherryIntake", null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="vouchers")
    voucher_date = models.DateField(db_index=True)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="vouchers_approved")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "status", "voucher_date"])]


class GoodsReceivedNote(TimeStampedUUIDModel):
    """Sub-Module 4.2 — GRN confirming physical receipt against a voucher."""

    grn_number = models.CharField(max_length=40, unique=True)
    voucher = models.ForeignKey(PurchaseVoucher, on_delete=models.PROTECT, related_name="grns")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="grns")
    received_date = models.DateField(db_index=True)
    received_kg = models.DecimalField(max_digits=12, decimal_places=2)
    variance_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="grns_received")
    notes = models.TextField(blank=True)
