"""Module 11 — Resource & Utility Management: fuel + water daily registers."""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel


class FuelRegisterEntry(TimeStampedUUIDModel):
    """Sub-Module 11.1 — Daily Fuel Consumption Register (የነዳጅ ፍጆታ መከታተያ ቅጽ)."""

    station = models.ForeignKey("core.Station", on_delete=models.CASCADE, related_name="fuel_entries")
    entry_date = models.DateField(db_index=True)
    machine_label = models.CharField(max_length=120, help_text="Generator / pulper identifier")
    fuel_purchased_litres = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fuel_added_litres = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                            help_text="Fuel added to the generator/pulper that day")
    cherry_pulped_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                           help_text="Total red cherry pulped that day (kg)")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="fuel_entries")
    fuel_ratio = models.DecimalField(max_digits=10, decimal_places=5, null=True, blank=True,
                                     help_text="Computed: litres / kg pulped cherry (calculators.fuel_ratio)")
    is_anomaly = models.BooleanField(default=False)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "entry_date", "machine_label"],
                                               name="uniq_fuel_entry")]
        indexes = [models.Index(fields=["station", "entry_date"])]


class WaterRegisterEntry(TimeStampedUUIDModel):
    """Sub-Module 11.2 — Daily Water Consumption Register (የውሃ ፍጆታ መከታተያ ቅጽ).

    Midday (12:00 PM / 6:00 local) meter reading; consumption is measured
    against the PREVIOUS day's pulped cherry weight (calculators.water_ratio).
    """

    station = models.ForeignKey("core.Station", on_delete=models.CASCADE, related_name="water_entries")
    entry_date = models.DateField(db_index=True)
    meter_reading_litres = models.DecimalField(max_digits=14, decimal_places=2,
                                               help_text="Cumulative meter reading at midday")
    previous_reading_litres = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    consumption_litres = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                             help_text="Computed: reading - previous reading")
    previous_day_pulped_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                                 help_text="Previous day's total pulped cherry (kg)")
    recycled_litres = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                          help_text="Eco-pulper recycled water")
    lagoon_level_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True,
                                           help_text="Wastewater lagoon level %")
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="water_entries")
    water_ratio = models.DecimalField(max_digits=10, decimal_places=5, null=True, blank=True,
                                      help_text="Computed: litres consumed / previous-day kg pulped")
    is_anomaly = models.BooleanField(default=False)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "entry_date"], name="uniq_water_entry")]
        indexes = [models.Index(fields=["station", "entry_date"])]

    def compute_consumption(self):
        self.consumption_litres = (self.meter_reading_litres or 0) - (self.previous_reading_litres or 0)
        return self.consumption_litres

    def save(self, *args, **kwargs):
        self.compute_consumption()
        super().save(*args, **kwargs)
