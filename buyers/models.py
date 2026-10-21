"""Module 14 — Buyer & Contract Management: buyer CRM, PSS, contracts, allocations."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class Buyer(TimeStampedUUIDModel):
    """Sub-Module 14.1 — International Buyer CRM."""

    code = models.CharField(max_length=24, unique=True)
    company_name = models.CharField(max_length=240)
    country = models.CharField(max_length=120, blank=True)
    contact_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    consignee_details = models.TextField(blank=True, help_text="Consignee / notify party for B/L")
    shipping_preferences = models.TextField(blank=True)
    preferred_incoterm = models.CharField(max_length=8, blank=True, help_text="FOB / CIF / CFR")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.company_name


class SampleFeedback(TimeStampedUUIDModel):
    """Sub-Module 14.1 — Pre-Shipment Sample (PSS) approval history."""

    class PSSStatus(models.TextChoices):
        SENT = "sent", "Sample sent"
        APPROVED = "approved", "PSS Approved"
        REJECTED = "rejected", "PSS Rejected"

    buyer = models.ForeignKey(Buyer, on_delete=models.CASCADE, related_name="sample_feedback")
    lot = models.ForeignKey("processing.Lot", null=True, blank=True, on_delete=models.SET_NULL, related_name="sample_feedback")
    sample_code = models.CharField(max_length=64)
    sent_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=PSSStatus.choices, default=PSSStatus.SENT, db_index=True)
    feedback = models.TextField(blank=True)
    responded_on = models.DateField(null=True, blank=True)


class SalesContract(TimeStampedUUIDModel):
    """Sub-Module 14.2 — Sales Contract & Price Fixation Ledger."""

    class PricingBasis(models.TextChoices):
        OUTRIGHT = "outright", "Outright fixed price"
        DIFFERENTIAL = "differential", "ICE 'C' differential"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SIGNED = "signed", "Signed"
        FIXED = "fixed", "Price fixed"
        SHIPPED = "shipped", "Shipped"
        SETTLED = "settled", "Settled"
        CANCELLED = "cancelled", "Cancelled"

    contract_number = models.CharField(max_length=48, unique=True)
    buyer = models.ForeignKey(Buyer, on_delete=models.PROTECT, related_name="contracts")
    grade = models.CharField(max_length=8, help_text="Contracted grade, e.g. G1")
    quantity_mt = models.DecimalField(max_digits=10, decimal_places=3, help_text="Quantity in metric tonnes")
    quantity_bags = models.PositiveIntegerField(default=0)
    bag_weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=60)
    pricing_basis = models.CharField(max_length=16, choices=PricingBasis.choices, default=PricingBasis.OUTRIGHT)
    outright_price = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True,
                                         help_text="USD per lb/kg when outright")
    ice_differential = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True,
                                           help_text="Differential vs ICE C (cents/lb) when unfixed")
    fixed_price = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    fixed_on = models.DateField(null=True, blank=True)
    incoterm = models.CharField(max_length=8, default="FOB")
    currency = models.CharField(max_length=3, default="USD")
    shipment_window_start = models.DateField(null=True, blank=True)
    shipment_window_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    signed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="contracts_signed")

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["buyer", "status"])]


class ContractLotAllocation(TimeStampedUUIDModel):
    """Sub-Module 14.2 — lot allocation locks against a contract."""

    contract = models.ForeignKey(SalesContract, on_delete=models.CASCADE, related_name="allocations")
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="contract_allocations")
    allocated_kg = models.DecimalField(max_digits=12, decimal_places=2)
    allocated_bags = models.PositiveIntegerField(default=0)
    is_locked = models.BooleanField(default=True, help_text="Locked stock cannot be re-allocated elsewhere")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["contract", "lot"], name="uniq_contract_lot")]
