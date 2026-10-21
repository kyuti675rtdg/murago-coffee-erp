"""Module 5 — Processing Management (FSM) + Module 8 — Lot & Batch Management."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class LotStage(models.TextChoices):
    """FSM stages in the brief's EXACT sequence (§2, constraint 1).

    Note: the brief orders Storing before Exporting even though Bag Marking /
    Packing precede them after Dry Milling — this enum follows the brief.
    """

    HARVESTING_SORTING = "harvesting_sorting", "Harvesting/Sorting"
    RECEIVING = "receiving", "Receiving"
    PULPING = "pulping", "Pulping"
    FERMENTING = "fermenting", "Fermenting"
    WASHING = "washing", "Washing"
    DRYING = "drying", "Drying"
    CONDITIONING = "conditioning", "Conditioning"
    DRY_MILLING = "dry_milling", "Dry Milling"
    BAG_MARKING = "bag_marking", "Bag Marking"
    PACKING = "packing", "Packing"
    STORING = "storing", "Storing"
    EXPORTING = "exporting", "Exporting"


STAGE_ORDER = list(LotStage.values)


class Lot(TimeStampedUUIDModel):
    """Sub-Module 8.1 — Lot Creation, Splitting & Blending Studio (the FSM entity)."""

    class ProcessType(models.TextChoices):
        WASHED = "washed", "Washed"
        NATURAL = "natural", "Natural"
        HONEY = "honey", "Honey"

    lot_code = models.CharField(max_length=48, unique=True,
                                help_text="Structured: STATION-YYYYMMDD-PROCESS-SEQ, e.g. MUR-20261021-W-001")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="lots")
    process_type = models.CharField(max_length=16, choices=ProcessType.choices, db_index=True)
    current_stage = models.CharField(max_length=24, choices=LotStage.choices,
                                     default=LotStage.HARVESTING_SORTING, db_index=True)
    altitude_m = models.PositiveIntegerField(null=True, blank=True)
    variety = models.CharField(max_length=120, blank=True)
    # Live weights per form (kg) — updated by stage services / milling.
    cherry_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    parchment_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    green_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_weight_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                            help_text="Weight of the lot in its current form")
    # Special action timestamps required by Sub-Module 5.1.
    pulping_date = models.DateTimeField(null=True, blank=True, help_text="Date of Pulping (wet processing)")
    laid_date = models.DateTimeField(null=True, blank=True, help_text="Laid Date (natural processing, on drying beds)")
    washing_date = models.DateTimeField(null=True, blank=True, help_text="Date of Washing")
    is_micro_lot = models.BooleanField(default=False)
    certification_tags = models.JSONField(default=list, blank=True, help_text="e.g. ['organic','eudr']")
    is_closed = models.BooleanField(default=False)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(
            condition=models.Q(current_stage__in=STAGE_ORDER), name="lot_stage_valid")]
        indexes = [models.Index(fields=["station", "current_stage"]),
                   models.Index(fields=["station", "process_type"])]

    def __str__(self):
        return f"{self.lot_code} [{self.current_stage}]"


class LotStageEvent(TimeStampedUUIDModel):
    """Immutable FSM transition record (timestamp + actor + dual sign-off fields)."""

    lot = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="stage_events")
    from_stage = models.CharField(max_length=24, choices=LotStage.choices, null=True, blank=True)
    to_stage = models.CharField(max_length=24, choices=LotStage.choices)
    occurred_at = models.DateTimeField(db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="lot_stage_events")
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="lot_events_issued")
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="lot_events_received")
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        ordering = ["occurred_at"]
        indexes = [models.Index(fields=["lot", "occurred_at"])]


class DryingBed(TimeStampedUUIDModel):
    """Sub-Module 5.2 / 22.1 — a physical drying bed at a station."""

    station = models.ForeignKey("core.Station", on_delete=models.CASCADE, related_name="drying_beds")
    bed_no = models.CharField(max_length=24, help_text="Bed No. as printed on the handover form")
    capacity_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "bed_no"], name="uniq_bed_per_station")]

    def __str__(self):
        return f"{self.station.code} Bed {self.bed_no}"


class BedAssignment(TimeStampedUUIDModel):
    """A lot occupying a drying bed between laid and removal dates."""

    lot = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="bed_assignments")
    bed = models.ForeignKey(DryingBed, on_delete=models.PROTECT, related_name="assignments")
    laid_at = models.DateTimeField()
    removed_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["bed", "laid_at"])]


class MoistureReading(TimeStampedUUIDModel):
    """Sub-Module 5.2 — daily moisture meter readings (target 10.5%–11.5%)."""

    lot = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="moisture_readings")
    bed = models.ForeignKey(DryingBed, null=True, blank=True, on_delete=models.SET_NULL, related_name="moisture_readings")
    reading_date = models.DateField(db_index=True)
    moisture_pct = models.DecimalField(max_digits=5, decimal_places=2)
    read_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="moisture_readings")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=models.Q(moisture_pct__gte=0, moisture_pct__lte=100),
                                              name="moisture_pct_range")]
        indexes = [models.Index(fields=["lot", "reading_date"])]


class DryingHandover(TimeStampedUUIDModel):
    """Sub-Module 5.2 — 'Zenebe Genale / Murago' Drying Bed & Storage Handover Form.

    Mandatory dual digital signatures: Issued By (Purchaser/Station Officer)
    and Received By (Industry Professional). Enforced by core.signoff.
    """

    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="drying_handovers")
    bed = models.ForeignKey(DryingBed, on_delete=models.PROTECT, related_name="handovers")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="drying_handovers")
    site_name = models.CharField(max_length=200)
    altitude_m = models.PositiveIntegerField(null=True, blank=True)
    final_moisture_pct = models.DecimalField(max_digits=5, decimal_places=2)
    dried_coffee_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="Amount of Dried Coffee in kg")
    storage_date = models.DateField(help_text="Date of Storage entering the warehouse")
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="handovers_issued")
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="handovers_received")
    signoff = models.ForeignKey("core.DualSignOff", null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="drying_handovers")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(condition=~models.Q(issued_by=models.F("received_by")),
                                              name="handover_two_different_users")]


class LotLabel(TimeStampedUUIDModel):
    """Sub-Module 8.2 — Lot Barcode/QR Print Queue (weather-resistant tags)."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PRINTED = "printed", "Printed"

    lot = models.ForeignKey(Lot, on_delete=models.CASCADE, related_name="labels")
    bed = models.ForeignKey(DryingBed, null=True, blank=True, on_delete=models.SET_NULL, related_name="labels")
    qr_payload = models.CharField(max_length=200, unique=True)
    net_weight_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED, db_index=True)
    printed_at = models.DateTimeField(null=True, blank=True)
