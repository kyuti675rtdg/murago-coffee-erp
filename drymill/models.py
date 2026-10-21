"""Module 6 — Dry Mill Management: work orders, hulling mass-balance, grading."""
from decimal import Decimal

from django.db import models

from core.base import TimeStampedUUIDModel


class MillingWorkOrder(TimeStampedUUIDModel):
    """Sub-Module 6.1 — Dry Mill Batch Processing Terminal."""

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    order_number = models.CharField(max_length=40, unique=True)
    mill_station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="milling_orders")
    input_lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="milling_inputs")
    output_lot = models.ForeignKey("processing.Lot", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="milling_outputs")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED, db_index=True)
    scheduled_date = models.DateField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)


class MillingOutput(TimeStampedUUIDModel):
    """Sub-Module 6.1 — hulling mass-balance: input = green + husk + loss (validated)."""

    work_order = models.OneToOneField(MillingWorkOrder, on_delete=models.CASCADE, related_name="output")
    input_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="Conditioned parchment / dried cherry in")
    green_out_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="Clean green coffee out")
    husk_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loss_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Unaccounted hulling loss")
    tolerance_kg = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.50"))

    @property
    def accounted_kg(self) -> Decimal:
        return (self.green_out_kg or 0) + (self.husk_kg or 0) + (self.loss_kg or 0)

    @property
    def imbalance_kg(self) -> Decimal:
        return (self.input_kg or 0) - self.accounted_kg

    @property
    def outturn_pct(self) -> Decimal:
        if not self.input_kg:
            return Decimal("0")
        return (self.green_out_kg / self.input_kg * Decimal("100")).quantize(Decimal("0.01"))

    @property
    def mass_balance_ok(self) -> bool:
        return abs(self.imbalance_kg) <= (self.tolerance_kg or Decimal("0"))

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=models.Q(input_kg__gte=0, green_out_kg__gte=0),
                                              name="milling_weights_nonneg")]


class GradingRecord(TimeStampedUUIDModel):
    """Sub-Module 6.2 — Screen Sizing, Gravity & Color Sorting Log (per lot/batch)."""

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="grading_records")
    work_order = models.ForeignKey(MillingWorkOrder, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="grading_records")
    graded_on = models.DateField(db_index=True)
    gravity_table_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    color_sorted_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    hand_picked_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rejects_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)


class ScreenDistribution(TimeStampedUUIDModel):
    """Sub-Module 6.2 — weight per screen size (Screen 14–18+) for a grading record."""

    grading = models.ForeignKey(GradingRecord, on_delete=models.CASCADE, related_name="screen_distribution")
    screen_size = models.PositiveSmallIntegerField(help_text="14, 15, 16, 17, 18 (18 = 18+)")
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["grading", "screen_size"], name="uniq_screen_per_grading"),
            models.CheckConstraint(condition=models.Q(screen_size__gte=14, screen_size__lte=18),
                                   name="screen_size_14_18"),
        ]

    @property
    def pct_of_graded(self) -> Decimal:
        total = sum((row.weight_kg for row in self.grading.screen_distribution.all()), Decimal("0"))
        if not total:
            return Decimal("0")
        return (self.weight_kg / total * Decimal("100")).quantize(Decimal("0.01"))
