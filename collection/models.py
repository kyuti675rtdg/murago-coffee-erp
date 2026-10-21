"""Module 3 — Coffee Collection Management: centers, agents, floats, intake."""
from decimal import Decimal

from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class CollectionCenter(TimeStampedUUIDModel):
    """Sub-Module 3.1 — remote collection center configuration."""

    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="collection_centers")
    code = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=200)
    altitude_m = models.PositiveIntegerField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class AgentAssignment(TimeStampedUUIDModel):
    """Sub-Module 3.1 — field purchasing agent assigned to a center for a period."""

    center = models.ForeignKey(CollectionCenter, on_delete=models.CASCADE, related_name="agent_assignments")
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="collection_assignments")
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["center", "valid_from"])]


class CashFloat(TimeStampedUUIDModel):
    """Sub-Module 3.1 / Module 1.2 — daily cash float allocated to a center/agent."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RECONCILED = "reconciled", "Reconciled"
        SHORT = "short", "Short"
        CLOSED = "closed", "Closed"

    center = models.ForeignKey(CollectionCenter, on_delete=models.PROTECT, related_name="cash_floats")
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_floats")
    float_date = models.DateField(db_index=True)
    amount_allocated = models.DecimalField(max_digits=14, decimal_places=2)
    amount_spent = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_returned = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["center", "agent", "float_date"], name="uniq_float_center_agent_date")]

    @property
    def balance(self) -> Decimal:
        return self.amount_allocated - self.amount_spent - self.amount_returned


class CherryIntake(TimeStampedUUIDModel):
    """Sub-Module 3.2 — Weighbridge & Cherry Intake (Daily Cherry Intake & Scale Terminal)."""

    class Source(models.TextChoices):
        SCALE_SERIAL = "scale_serial", "WebSerial digital scale"
        MANUAL = "manual", "Manual entry"

    intake_number = models.CharField(max_length=40, unique=True)
    farmer = models.ForeignKey("farmers.Farmer", on_delete=models.PROTECT, related_name="intakes")
    center = models.ForeignKey(CollectionCenter, on_delete=models.PROTECT, related_name="intakes")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="cherry_intakes")
    intake_date = models.DateField(db_index=True)
    coffee_variety = models.CharField(max_length=120, blank=True)
    site_altitude_m = models.PositiveIntegerField(null=True, blank=True)
    gross_kg = models.DecimalField(max_digits=12, decimal_places=2)
    tare_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="gross - tare, computed on save")
    floater_deduction_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                                help_text="Visual sorting / floatation deduction %")
    payable_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                     help_text="net after deduction, computed on save")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    weight_source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    qr_receipt_code = models.CharField(max_length=64, unique=True, help_text="QR payload printed on the intake receipt")
    lot = models.ForeignKey("processing.Lot", null=True, blank=True, on_delete=models.SET_NULL, related_name="source_intakes")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.CheckConstraint(condition=models.Q(gross_kg__gte=models.F("tare_kg")), name="intake_gross_gte_tare"),
            models.CheckConstraint(condition=models.Q(floater_deduction_pct__gte=0, floater_deduction_pct__lte=100),
                                   name="intake_deduction_pct_range"),
        ]
        indexes = [models.Index(fields=["station", "intake_date"]), models.Index(fields=["farmer", "intake_date"])]

    def compute(self) -> None:
        self.net_kg = (self.gross_kg or Decimal("0")) - (self.tare_kg or Decimal("0"))
        deduction = self.net_kg * (self.floater_deduction_pct or Decimal("0")) / Decimal("100")
        self.payable_kg = self.net_kg - deduction
        self.total_amount = self.payable_kg * (self.unit_price or Decimal("0"))

    def save(self, *args, **kwargs):
        self.compute()
        super().save(*args, **kwargs)
