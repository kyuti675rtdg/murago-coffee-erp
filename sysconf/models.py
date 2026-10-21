"""Module 22 — System Configuration: master data, benchmarks, thresholds."""
from django.db import models

from core.base import TimeStampedUUIDModel


class GradeDefinition(TimeStampedUUIDModel):
    """Sub-Module 22.1 — coffee grades + measurement master data."""

    code = models.CharField(max_length=16, unique=True, help_text="G1..G5, UG, local grades")
    name = models.CharField(max_length=120)
    min_cup_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    max_defects = models.PositiveIntegerField(null=True, blank=True)


class MeasurementUnit(TimeStampedUUIDModel):
    code = models.CharField(max_length=16, unique=True, help_text="kg, L, bag60, MT, pcs")
    name = models.CharField(max_length=64)
    to_base_factor = models.DecimalField(max_digits=14, decimal_places=6, default=1,
                                         help_text="Multiply by this to get the base unit (kg / L)")


class FermentationTank(TimeStampedUUIDModel):
    """Sub-Module 22.1 — fermentation tank topology per station."""

    station = models.ForeignKey("core.Station", on_delete=models.CASCADE, related_name="fermentation_tanks")
    tank_no = models.CharField(max_length=24)
    capacity_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "tank_no"], name="uniq_tank_per_station")]


class YieldBenchmark(TimeStampedUUIDModel):
    """Sub-Module 22.2 — Conversion & Threshold Rules: standard yield benchmarks."""

    class Conversion(models.TextChoices):
        CHERRY_PARCHMENT = "cherry_parchment", "Cherry -> Parchment"
        PARCHMENT_GREEN = "parchment_green", "Parchment -> Green"
        CHERRY_GREEN = "cherry_green", "Cherry -> Green"

    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.CASCADE,
                                related_name="yield_benchmarks", help_text="Null = global benchmark")
    conversion = models.CharField(max_length=24, choices=Conversion.choices, db_index=True)
    expected_ratio = models.DecimalField(max_digits=6, decimal_places=4, help_text="Expected output/input, e.g. 0.2000")
    min_ratio = models.DecimalField(max_digits=6, decimal_places=4)
    max_ratio = models.DecimalField(max_digits=6, decimal_places=4)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "conversion"], name="uniq_yield_benchmark")]


class ThresholdConfig(TimeStampedUUIDModel):
    """Sub-Module 22.2 — moisture targets + fuel/water anomaly thresholds (per station or global)."""

    station = models.OneToOneField("core.Station", null=True, blank=True, on_delete=models.CASCADE,
                                   related_name="thresholds", help_text="Null row = global defaults")
    moisture_min_pct = models.DecimalField(max_digits=5, decimal_places=2, default="10.50")
    moisture_max_pct = models.DecimalField(max_digits=5, decimal_places=2, default="11.50")
    max_fuel_ratio_l_per_kg = models.DecimalField(max_digits=8, decimal_places=5, default="0.02000",
                                                  help_text="Anomaly threshold: fuel litres per kg pulped cherry")
    max_water_ratio_l_per_kg = models.DecimalField(max_digits=8, decimal_places=3, default="6.000",
                                                   help_text="Anomaly threshold: water litres per previous-day kg pulped")
    max_transit_shrinkage_pct = models.DecimalField(max_digits=5, decimal_places=2, default="1.00")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(
            condition=models.Q(moisture_min_pct__lt=models.F("moisture_max_pct")), name="moisture_min_lt_max")]
