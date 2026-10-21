"""Module 10 — Warehouse Management: segregated stores/bins, transfers, gate passes."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class CoffeeForm(models.TextChoices):
    PARCHMENT = "parchment", "Parchment"
    NATURAL_CHERRY = "natural_cherry", "Dried Natural Cherry"
    GREEN = "green", "Milled Green Coffee"


class Store(TimeStampedUUIDModel):
    """Sub-Module 10.1 — a physical store, segregated by coffee form."""

    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="stores")
    code = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=200)
    coffee_form = models.CharField(max_length=16, choices=CoffeeForm.choices, db_index=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class Bin(TimeStampedUUIDModel):
    """Sub-Module 10.1 — bin location inside a store (anti-commingling grid cell)."""

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="bins")
    bin_code = models.CharField(max_length=24)
    capacity_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    certified_only = models.BooleanField(default=False, help_text="Reserved for certified / EUDR / micro-lots")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["store", "bin_code"], name="uniq_bin_per_store")]


class StockReceipt(TimeStampedUUIDModel):
    """Sub-Module 10.2 — warehouse receipt (dual-signed from drying beds / mills)."""

    receipt_number = models.CharField(max_length=40, unique=True)
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="receipts")
    bin = models.ForeignKey(Bin, null=True, blank=True, on_delete=models.SET_NULL, related_name="receipts")
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="stock_receipts")
    received_date = models.DateField(db_index=True)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2)
    bags = models.PositiveIntegerField(default=0)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="receipts_issued")
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="receipts_received")
    signoff = models.ForeignKey("core.DualSignOff", null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_receipts")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=~models.Q(issued_by=models.F("received_by")),
                                              name="receipt_two_different_users")]
        indexes = [models.Index(fields=["store", "received_date"])]


class StockTransfer(TimeStampedUUIDModel):
    """Sub-Module 10.2 — inter-store / station-to-Addis transfer with out-turn check."""

    class Status(models.TextChoices):
        DISPATCHED = "dispatched", "Dispatched"
        IN_TRANSIT = "in_transit", "In Transit"
        RECEIVED = "received", "Received"
        DISPUTED = "disputed", "Disputed (weight variance)"

    transfer_number = models.CharField(max_length=40, unique=True)
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="stock_transfers")
    from_store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="transfers_out")
    to_store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="transfers_in")
    dispatched_kg = models.DecimalField(max_digits=12, decimal_places=2)
    received_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    dispatch_date = models.DateField(db_index=True)
    received_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DISPATCHED, db_index=True)

    @property
    def shrinkage_kg(self):
        if self.received_kg is None:
            return None
        return self.dispatched_kg - self.received_kg


class GatePass(TimeStampedUUIDModel):
    """Sub-Module 10.2 — Gate Pass Manager: authorised dispatch out of a store."""

    pass_number = models.CharField(max_length=40, unique=True)
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="gate_passes")
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="gate_passes")
    vehicle_plate = models.CharField(max_length=32, blank=True)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2)
    issued_at = models.DateTimeField(auto_now_add=True)
    authorised_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="gate_passes")
    exited_at = models.DateTimeField(null=True, blank=True)


class StockLedgerEntry(TimeStampedUUIDModel):
    """Append-only stock movement ledger per lot/store (in/out with running balance)."""

    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="ledger_entries")
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="ledger_entries")
    entry_date = models.DateField(db_index=True)
    delta_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="+ in, - out")
    balance_kg = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True, help_text="Receipt / transfer / gate-pass number")

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["store", "lot", "entry_date"])]
