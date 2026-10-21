"""Module 15 — Export Management: bag marking/packing, containers, documents."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class BagMarking(TimeStampedUUIDModel):
    """Sub-Module 15.1 — Export Bagging & Stencil Generator (Steps 7 & 8)."""

    lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="bag_markings")
    contract = models.ForeignKey("buyers.SalesContract", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="bag_markings")
    ico_mark = models.CharField(max_length=64, help_text="ICO identification mark, e.g. 011/0688/0001")
    buyer_stencil = models.CharField(max_length=200, help_text="Buyer stencil text printed on the bag")
    bag_type = models.CharField(max_length=32, default="60kg jute + GrainPro liner")
    crop_year = models.CharField(max_length=16, blank=True)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="bag_markings")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["lot", "ico_mark"], name="uniq_ico_per_lot")]


class PackingRecord(TimeStampedUUIDModel):
    """Sub-Module 15.1 — final packing tallies per lot/mark."""

    marking = models.ForeignKey(BagMarking, on_delete=models.CASCADE, related_name="packing_records")
    packed_on = models.DateField(db_index=True)
    bags_packed = models.PositiveIntegerField(default=0)
    gross_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tare_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class ContainerLoading(TimeStampedUUIDModel):
    """Sub-Module 15.2 — Container Loading & stuffing manifest (Step 10)."""

    class Status(models.TextChoices):
        LOADING = "loading", "Loading"
        SEALED = "sealed", "Sealed"
        DISPATCHED = "dispatched", "Dispatched to port"
        SHIPPED = "shipped", "Shipped"

    container_number = models.CharField(max_length=32, unique=True)
    seal_number = models.CharField(max_length=64)
    contract = models.ForeignKey("buyers.SalesContract", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="containers")
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="containers")
    total_bags = models.PositiveIntegerField(default=0)
    total_net_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stuffed_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.LOADING, db_index=True)


class ContainerLot(TimeStampedUUIDModel):
    """Bags of one lot/mark stuffed into one container (loading manifest line)."""

    container = models.ForeignKey(ContainerLoading, on_delete=models.CASCADE, related_name="manifest_lines")
    marking = models.ForeignKey(BagMarking, on_delete=models.PROTECT, related_name="container_lines")
    bags = models.PositiveIntegerField(default=0)
    net_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["container", "marking"], name="uniq_container_marking")]


class ExportDocument(TimeStampedUUIDModel):
    """Sub-Module 15.2 — Customs Documentation Suite artefacts."""

    class DocType(models.TextChoices):
        COMMERCIAL_INVOICE = "commercial_invoice", "Commercial Invoice"
        PACKING_LIST = "packing_list", "Packing List"
        ICO_CERT = "ico_cert", "ICO Certificate of Origin"
        ECTA = "ecta", "ECTA Clearance"
        PHYTOSANITARY = "phytosanitary", "Phytosanitary Certificate"
        EUDR_DOSSIER = "eudr_dossier", "EUDR GeoJSON Dossier"
        BILL_OF_LADING = "bill_of_lading", "Bill of Lading"

    class Status(models.TextChoices):
        GENERATED = "generated", "Generated"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"

    container = models.ForeignKey(ContainerLoading, null=True, blank=True,
                                  on_delete=models.CASCADE, related_name="documents")
    contract = models.ForeignKey("buyers.SalesContract", null=True, blank=True,
                                 on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=24, choices=DocType.choices, db_index=True)
    document_number = models.CharField(max_length=64, blank=True)
    payload = models.JSONField(default=dict, blank=True, help_text="Generated document payload (invoice lines, GeoJSON, ...)")
    file_path = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.GENERATED)
