"""Module 2 — Farmer Management: outgrower registry/KYC + Farm GIS & EUDR.

GIS: in production (PostGIS + GDAL present) FarmPlot.boundary / .centroid are
real GeoDjango PolygonField / PointField (SRID 4326). When GDAL is unavailable
locally the same fields fall back to JSONField GeoJSON storage so
check/migrate/test run on SQLite — see README. sql/phase1_schema.sql carries
the production geometry DDL either way.
"""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel

# Single source of truth: settings.GIS_AVAILABLE (deploy fix 2026-10-21 — the
# model must never disagree with the DB engine about GIS; a mismatch crashed
# the first Render seed when this import succeeded but the engine was non-GIS).
GIS_AVAILABLE = bool(getattr(settings, "GIS_AVAILABLE", False))
if GIS_AVAILABLE:
    try:
        from django.contrib.gis.db.models import PointField, PolygonField
    except Exception:
        GIS_AVAILABLE = False


class Farmer(TimeStampedUUIDModel):
    """Sub-Module 2.1 — Outgrower Registry & KYC (Farmer Directory & Profile)."""

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    class KYCStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    farmer_code = models.CharField(max_length=32, unique=True, help_text="Unique Farmer ID, e.g. FRM-000123")
    full_name = models.CharField(max_length=200)
    gender = models.CharField(max_length=8, choices=Gender.choices, blank=True)
    phone = models.CharField(max_length=32, blank=True, db_index=True)
    national_id_number = models.CharField(max_length=64, blank=True)
    station = models.ForeignKey("core.Station", on_delete=models.PROTECT, related_name="farmers")
    kebele = models.CharField(max_length=120, blank=True)
    family_size = models.PositiveIntegerField(default=1)
    coffee_tree_count = models.PositiveIntegerField(default=0)
    total_plot_ha = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    # Anti-illicit-blending control (brief 2.1): annual cap derived from plot size.
    annual_cherry_cap_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                               help_text="Max annual cherry deliveries allowed for this farmer")
    delivered_this_season_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    kyc_status = models.CharField(max_length=16, choices=KYCStatus.choices, default=KYCStatus.PENDING, db_index=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station", "kyc_status"])]

    def remaining_cap_kg(self):
        return max(self.annual_cherry_cap_kg - self.delivered_this_season_kg, 0)

    def __str__(self):
        return f"{self.farmer_code} — {self.full_name}"


class FarmerDocument(TimeStampedUUIDModel):
    """KYC document vault entries (national ID, land certificate, photos)."""

    class DocType(models.TextChoices):
        NATIONAL_ID = "national_id", "National ID"
        LAND_CERT = "land_cert", "Land Certificate"
        PHOTO = "photo", "Farmer Photo"
        OTHER = "other", "Other"

    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=24, choices=DocType.choices, db_index=True)
    file_path = models.CharField(max_length=500, help_text="Object-storage key / path (bytes live outside the DB)")
    sha256 = models.CharField(max_length=64, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="verified_farmer_documents")
    verified_at = models.DateTimeField(null=True, blank=True)


class FarmPlot(TimeStampedUUIDModel):
    """Sub-Module 2.2 — Farm GIS & EUDR Compliance (polygon map + document vault)."""

    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name="plots")
    plot_name = models.CharField(max_length=120, blank=True)
    area_ha = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    elevation_m = models.PositiveIntegerField(null=True, blank=True, help_text="Auto-detected / recorded elevation")
    coffee_variety = models.CharField(max_length=120, blank=True)
    tree_count = models.PositiveIntegerField(default=0)
    if GIS_AVAILABLE:
        boundary = PolygonField(srid=4326, null=True, blank=True, help_text="Farm polygon (PostGIS geometry, EUDR)")
        centroid = PointField(srid=4326, null=True, blank=True)
    else:
        boundary = models.JSONField(null=True, blank=True,
                                    help_text="GeoJSON Polygon — FALLBACK storage (no GDAL locally); geometry(Polygon,4326) in production DDL")
        centroid = models.JSONField(null=True, blank=True,
                                    help_text="GeoJSON Point — FALLBACK storage (no GDAL locally); geometry(Point,4326) in production DDL")
    boundary_geojson = models.JSONField(default=dict, blank=True,
                                        help_text="Canonical GeoJSON copy of the polygon, used for EUDR DDS export in every environment")
    deforestation_free = models.BooleanField(default=False)
    cutoff_checked_at = models.DateTimeField(null=True, blank=True, help_text="EUDR deforestation cutoff (2020-12-31) check time")

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["farmer"])]


class Certification(TimeStampedUUIDModel):
    """Organic / Fairtrade / Rainforest / EUDR certification records per farmer or plot."""

    class CertType(models.TextChoices):
        ORGANIC = "organic", "Organic"
        FAIRTRADE = "fairtrade", "Fairtrade"
        RAINFOREST = "rainforest", "Rainforest Alliance"
        EUDR = "eudr", "EUDR"
        UTZ = "utz", "UTZ / RA"

    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name="certifications")
    plot = models.ForeignKey(FarmPlot, null=True, blank=True, on_delete=models.CASCADE, related_name="certifications")
    cert_type = models.CharField(max_length=24, choices=CertType.choices, db_index=True)
    certificate_number = models.CharField(max_length=120, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    document_path = models.CharField(max_length=500, blank=True)


class EUDRDueDiligenceStatement(TimeStampedUUIDModel):
    """Sub-Module 2.2 — generated EUDR Due Diligence Statement (DDS) per plot/consignment."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    reference_number = models.CharField(max_length=64, unique=True)
    plot = models.ForeignKey(FarmPlot, on_delete=models.PROTECT, related_name="dds_statements")
    farmer = models.ForeignKey(Farmer, on_delete=models.PROTECT, related_name="dds_statements")
    geojson_dossier = models.JSONField(default=dict, help_text="EUDR GeoJSON dossier payload")
    risk_assessment = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
