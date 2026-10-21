"""Module 19 — Inventory Management: consumables/spares + stock audits."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class InventoryItem(TimeStampedUUIDModel):
    """Sub-Module 19.1 — Packaging Material, Fuel Drum & Spare Parts Ledger."""

    class Category(models.TextChoices):
        JUTE_BAGS = "jute_bags", "Jute bags"
        GRAINPRO = "grainpro", "GrainPro liners"
        BED_MESH = "bed_mesh", "Drying bed mesh"
        TWINE = "twine", "Twine"
        DIESEL = "diesel", "Bulk diesel fuel"
        SPARE_PART = "spare_part", "Spare part"
        OTHER = "other", "Other"

    sku = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=16, choices=Category.choices, db_index=True)
    unit = models.CharField(max_length=16, default="pcs")
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def stock_at(self, station) -> "object":
        from django.db.models import Sum
        return StockMovement.objects.filter(item=self, station=station).aggregate(s=Sum("delta_qty"))["s"] or 0


class StockMovement(TimeStampedUUIDModel):
    """Station-level issue/receipt movements for an inventory item."""

    class MovementType(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        ISSUE = "issue", "Station issue (requisition)"
        ADJUSTMENT = "adjustment", "Audit adjustment"
        RETURN = "return", "Return"

    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="movements")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="inventory_movements")
    movement_type = models.CharField(max_length=12, choices=MovementType.choices, db_index=True)
    delta_qty = models.DecimalField(max_digits=12, decimal_places=2, help_text="+ in, - out")
    movement_date = models.DateField(db_index=True)
    reference = models.CharField(max_length=120, blank=True)
    issued_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="inventory_issues")

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["item", "station", "movement_date"])]


class StockAudit(TimeStampedUUIDModel):
    """Sub-Module 19.2 — Physical Stock Audits (coffee + material stores)."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"

    audit_number = models.CharField(max_length=40, unique=True)
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="stock_audits")
    store = models.ForeignKey("warehouse.Store", null=True, blank=True, on_delete=models.SET_NULL, related_name="audits")
    audit_date = models.DateField(db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    conducted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="stock_audits")


class StockAdjustment(TimeStampedUUIDModel):
    """Sub-Module 19.2 — Stock Reconciliation & Adjustment Worksheet lines."""

    audit = models.ForeignKey(StockAudit, on_delete=models.CASCADE, related_name="adjustments")
    item = models.ForeignKey(InventoryItem, null=True, blank=True, on_delete=models.PROTECT, related_name="adjustments")
    lot = models.ForeignKey("processing.Lot", null=True, blank=True, on_delete=models.PROTECT, related_name="stock_adjustments")
    book_qty = models.DecimalField(max_digits=12, decimal_places=2)
    counted_qty = models.DecimalField(max_digits=12, decimal_places=2)
    variance_reason = models.CharField(max_length=300, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="adjustments_approved")

    @property
    def variance(self):
        return self.counted_qty - self.book_qty
