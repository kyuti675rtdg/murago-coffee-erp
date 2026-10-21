"""Module 16 — Logistics Management: transporters, fleet, waybills, transit."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class Transporter(TimeStampedUUIDModel):
    """Sub-Module 16.1 — registered transport company."""

    code = models.CharField(max_length=24, unique=True)
    company_name = models.CharField(max_length=240)
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    license_number = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)


class Vehicle(TimeStampedUUIDModel):
    """Sub-Module 16.1 — truck + driver registry."""

    transporter = models.ForeignKey(Transporter, on_delete=models.CASCADE, related_name="vehicles")
    plate_number = models.CharField(max_length=32, unique=True)
    vehicle_type = models.CharField(max_length=64, blank=True, help_text="e.g. dry cargo truck, container carrier")
    capacity_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    driver_name = models.CharField(max_length=200, blank=True)
    driver_phone = models.CharField(max_length=32, blank=True)
    driver_license = models.CharField(max_length=64, blank=True)


class Waybill(TimeStampedUUIDModel):
    """Sub-Module 16.1 — Vehicle Assignment & Waybill Generator."""

    class Status(models.TextChoices):
        ISSUED = "issued", "Issued"
        IN_TRANSIT = "in_transit", "In Transit"
        DELIVERED = "delivered", "Delivered"
        CLOSED = "closed", "Closed"

    waybill_number = models.CharField(max_length=40, unique=True)
    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="waybills")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="waybills")
    from_station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="waybills_out")
    to_station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="waybills_in")
    dispatched_kg = models.DecimalField(max_digits=12, decimal_places=2)
    bags = models.PositiveIntegerField(default=0)
    dispatched_at = models.DateTimeField(db_index=True)
    delivered_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ISSUED, db_index=True)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="waybills_issued")

    @property
    def shrinkage_kg(self):
        if self.delivered_kg is None:
            return None
        return self.dispatched_kg - self.delivered_kg

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["from_station", "status"])]


class TransitCheckpoint(TimeStampedUUIDModel):
    """Sub-Module 16.2 — Station-to-Addis & Djibouti Port Transit Monitor."""

    class CheckpointKind(models.TextChoices):
        CHECKPOINT = "checkpoint", "Corridor checkpoint"
        ARRIVAL = "arrival", "Arrival"
        PORT = "port", "Djibouti Port delivery"

    waybill = models.ForeignKey(Waybill, on_delete=models.CASCADE, related_name="checkpoints")
    kind = models.CharField(max_length=16, choices=CheckpointKind.choices, default=CheckpointKind.CHECKPOINT)
    location_label = models.CharField(max_length=200)
    arrived_at = models.DateTimeField(db_index=True)
    verified_weight_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        ordering = ["arrived_at"]
