"""Module 9 — Quality Management: physical analysis + cupping + approvals."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class PhysicalAnalysis(TimeStampedUUIDModel):
    """Sub-Module 9.1 — Lab Physical Inspection Worksheet."""

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="physical_analyses")
    analysed_on = models.DateField(db_index=True)
    moisture_pct = models.DecimalField(max_digits=5, decimal_places=2)
    water_activity = models.DecimalField(max_digits=4, decimal_places=3, null=True, blank=True, help_text="a_w")
    bean_density = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    colour = models.CharField(max_length=64, blank=True)
    odour = models.CharField(max_length=64, blank=True)
    primary_defects = models.PositiveIntegerField(default=0, help_text="SCAA/ECX category-1 defect count")
    secondary_defects = models.PositiveIntegerField(default=0, help_text="SCAA/ECX category-2 defect count")
    analyst = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="physical_analyses")
    notes = models.TextField(blank=True)


class CuppingScore(TimeStampedUUIDModel):
    """Sub-Module 9.2 — Q-Grader Cupping Scorecard (spider-chart source data)."""

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="cupping_scores")
    cupped_on = models.DateField(db_index=True)
    q_grader = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="cupping_scores")
    fragrance_aroma = models.DecimalField(max_digits=4, decimal_places=2)
    flavour = models.DecimalField(max_digits=4, decimal_places=2)
    aftertaste = models.DecimalField(max_digits=4, decimal_places=2)
    acidity = models.DecimalField(max_digits=4, decimal_places=2)
    body = models.DecimalField(max_digits=4, decimal_places=2)
    balance = models.DecimalField(max_digits=4, decimal_places=2)
    uniformity = models.DecimalField(max_digits=4, decimal_places=2)
    clean_cup = models.DecimalField(max_digits=4, decimal_places=2)
    sweetness = models.DecimalField(max_digits=4, decimal_places=2)
    overall = models.DecimalField(max_digits=4, decimal_places=2, default=0)

    SCORE_FIELDS = ["fragrance_aroma", "flavour", "aftertaste", "acidity", "body",
                    "balance", "uniformity", "clean_cup", "sweetness", "overall"]

    @property
    def total_score(self):
        from decimal import Decimal
        return sum((getattr(self, f) or Decimal("0") for f in self.SCORE_FIELDS), Decimal("0"))


class QualityApproval(TimeStampedUUIDModel):
    """Sub-Module 9.2 — official grade assignment + export release decision."""

    class Grade(models.TextChoices):
        G1 = "1", "Grade 1"
        G2 = "2", "Grade 2"
        G3 = "3", "Grade 3"
        G4 = "4", "Grade 4"
        G5 = "5", "Grade 5"
        UG = "UG", "Under Grade (UG)"

    class Decision(models.TextChoices):
        APPROVED = "approved", "Approved for export"
        REJECTED = "rejected", "Rejected"
        CONDITIONAL = "conditional", "Conditional"

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="quality_approvals")
    cupping = models.ForeignKey(CuppingScore, null=True, blank=True, on_delete=models.SET_NULL, related_name="approvals")
    grade = models.CharField(max_length=4, choices=Grade.choices, db_index=True)
    decision = models.CharField(max_length=16, choices=Decision.choices, db_index=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="quality_decisions")
    decided_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)
