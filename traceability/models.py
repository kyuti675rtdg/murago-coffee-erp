"""Module 7 — Coffee Traceability Management: DAG lineage + anti-commingling."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class LotLineageEdge(TimeStampedUUIDModel):
    """DAG edge parent -> child. Splits: one parent, many children.
    Blends: many parents, one child. ratio = weight contributed / parent weight."""

    class EdgeType(models.TextChoices):
        SPLIT = "split", "Split"
        BLEND = "blend", "Blend / Bulk"
        TRANSFER = "transfer", "Transfer"
        MILLING = "milling", "Milling (parchment -> green)"
        INTAKE = "intake", "Intake (origin)"

    parent_lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="child_edges")
    child_lot = models.ForeignKey("processing.Lot", on_delete=models.PROTECT, related_name="parent_edges")
    edge_type = models.CharField(max_length=16, choices=EdgeType.choices, db_index=True)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=2, help_text="Kg flowing from parent into child")
    ratio = models.DecimalField(max_digits=7, decimal_places=4,
                                help_text="weight_kg / parent lot weight at time of the operation (0–1)")
    occurred_at = models.DateTimeField(db_index=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="lineage_edges")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.CheckConstraint(condition=~models.Q(parent_lot=models.F("child_lot")), name="lineage_no_self_edge"),
            models.CheckConstraint(condition=models.Q(ratio__gte=0, ratio__lte=1), name="lineage_ratio_0_1"),
            models.UniqueConstraint(fields=["parent_lot", "child_lot", "edge_type"], name="uniq_lineage_edge"),
        ]
        indexes = [models.Index(fields=["child_lot"]), models.Index(fields=["parent_lot"])]


class ComminglingCheck(TimeStampedUUIDModel):
    """Sub-Module 7.2 — Commingling Risk & Audit Monitor."""

    class Result(models.TextChoices):
        PASS = "pass", "Pass — physically separated"
        RISK = "risk", "Risk flagged"
        VIOLATION = "violation", "Violation"

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="commingling_checks")
    checked_at = models.DateTimeField(db_index=True)
    location_label = models.CharField(max_length=200, help_text="Bed / tank / bin / truck where separation was verified")
    certified_separation_ok = models.BooleanField(default=True)
    result = models.CharField(max_length=16, choices=Result.choices, default=Result.PASS, db_index=True)
    checked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="commingling_checks")
    notes = models.TextField(blank=True)


class MassBalanceCheck(TimeStampedUUIDModel):
    """Phase 4 — end-to-end mass-balance reconciliation for a lot.

    One row per chain segment (intake->cherry, cherry->parchment,
    parchment->green, milling, green->bagged, bagged->exported) with the
    actual output vs the benchmark-expected output and a flagged status.
    Variances are FLAGGED (ok/warning/critical), never silently allowed.
    """

    class Status(models.TextChoices):
        OK = "ok", "Within tolerance"
        WARNING = "warning", "Variance warning"
        CRITICAL = "critical", "Critical variance"
        NO_DATA = "no_data", "Insufficient data"

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="mass_balance_checks")
    segment = models.CharField(max_length=48, db_index=True)
    input_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    output_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expected_output_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    variance_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    variance_pct = models.DecimalField(max_digits=8, decimal_places=2, default=0,
                                       help_text="Deviation of output from expected, % of expected")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NO_DATA, db_index=True)
    notes = models.TextField(blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["lot", "segment"])]
