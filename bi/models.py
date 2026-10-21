"""Module 20 — Business Intelligence + Module 1 report outputs."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class ReportDefinition(TimeStampedUUIDModel):
    """Sub-Module 20.1 — Custom Report Builder definitions."""

    class ReportKind(models.TextChoices):
        PROCUREMENT = "procurement", "Procurement volumes"
        YIELD = "yield", "Cherry-to-green conversion yields"
        EFFICIENCY = "efficiency", "Fuel / water efficiency ratios"
        QUALITY = "quality", "Quality grade distribution"
        STOCK_AGING = "stock_aging", "Stock aging"
        MARGIN = "margin", "Financial margins / lot profitability"
        ECTA = "ecta", "ECTA statutory report"
        EUDR = "eudr", "EUDR auditor report"
        BOARD = "board", "Executive board pack"

    code = models.CharField(max_length=48, unique=True)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=ReportKind.choices, db_index=True)
    query_spec = models.JSONField(default=dict, help_text="Declarative filters/measures for the report builder")
    is_active = models.BooleanField(default=True)


class GeneratedReport(TimeStampedUUIDModel):
    """A rendered report artefact (PDF/Excel) for ECTA / EUDR / board export."""

    class Format(models.TextChoices):
        PDF = "pdf", "PDF"
        XLSX = "xlsx", "Excel"
        JSON = "json", "JSON"

    definition = models.ForeignKey(ReportDefinition, on_delete=models.PROTECT, related_name="generated")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.SET_NULL, related_name="generated_reports")
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    fmt = models.CharField(max_length=8, choices=Format.choices, default=Format.PDF)
    file_path = models.CharField(max_length=500, blank=True)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="generated_reports")
