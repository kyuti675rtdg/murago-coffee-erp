"""Serializers — generic factory for all 85 models + hand-written validators
for the forms where the brief demands real validation."""
from decimal import Decimal

from rest_framework import serializers

from collection.models import CherryIntake
from processing.models import MoistureReading
from quality.models import CuppingScore, PhysicalAnalysis
from buyers.models import ContractLotAllocation
from farmers.models import FarmPlot

_cache = {}


def generic_serializer(model):
    if model in _cache:
        return _cache[model]
    meta = type("Meta", (), {"model": model, "fields": "__all__",
                             "read_only_fields": ["id", "created_at", "updated_at"]})
    cls = type(f"{model.__name__}Serializer", (serializers.ModelSerializer,), {"Meta": meta})
    _cache[model] = cls
    return cls


class CherryIntakeSerializer(serializers.ModelSerializer):
    """net = gross - tare; payable = net x (1 - deduction%); total = payable x price."""

    class Meta:
        model = CherryIntake
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "net_kg", "payable_kg", "total_amount"]

    def validate(self, attrs):
        gross = attrs.get("gross_kg", getattr(self.instance, "gross_kg", None))
        tare = attrs.get("tare_kg", getattr(self.instance, "tare_kg", 0) if self.instance else 0)
        ded = attrs.get("floater_deduction_pct", 0)
        if gross is not None and tare is not None and Decimal(gross) < Decimal(tare or 0):
            raise serializers.ValidationError("gross_kg must be >= tare_kg (net weight = gross - tare).")
        if ded is not None and not (Decimal("0") <= Decimal(ded) <= Decimal("100")):
            raise serializers.ValidationError("floater_deduction_pct must be between 0 and 100.")
        return attrs


def _moisture_warning(value):
    return bool(value is not None and not (Decimal("10.5") <= Decimal(value) <= Decimal("11.5")))


class MoistureReadingSerializer(serializers.ModelSerializer):
    moisture_warning = serializers.SerializerMethodField()

    class Meta:
        model = MoistureReading
        fields = "__all__"

    def get_moisture_warning(self, obj):
        return _moisture_warning(obj.moisture_pct)

    def validate_moisture_pct(self, v):
        if not (Decimal("0") <= Decimal(v) <= Decimal("100")):
            raise serializers.ValidationError("moisture_pct must be 0-100.")
        return v


class PhysicalAnalysisSerializer(serializers.ModelSerializer):
    moisture_warning = serializers.SerializerMethodField()

    class Meta:
        model = PhysicalAnalysis
        fields = "__all__"

    def get_moisture_warning(self, obj):
        return _moisture_warning(obj.moisture_pct)

    def validate(self, attrs):
        for f in ("moisture_pct", "water_activity"):
            v = attrs.get(f)
            if v is not None and Decimal(v) < 0:
                raise serializers.ValidationError(f"{f} cannot be negative.")
        return attrs


class CuppingScoreSerializer(serializers.ModelSerializer):
    total_score = serializers.SerializerMethodField()

    class Meta:
        model = CuppingScore
        fields = "__all__"

    def get_total_score(self, obj):
        return str(obj.total_score)

    def validate(self, attrs):
        for f in CuppingScore.SCORE_FIELDS:
            v = attrs.get(f)
            if v is not None and not (Decimal("0") <= Decimal(v) <= Decimal("10")):
                raise serializers.ValidationError(f"{f} must be between 0 and 10.")
        return attrs


class ContractLotAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractLotAllocation
        fields = "__all__"

    def validate(self, attrs):
        # Allocation lock: a locked allocation cannot be changed.
        if self.instance and self.instance.is_locked:
            raise serializers.ValidationError("This lot allocation is LOCKED and cannot be modified.")
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        lot = attrs.get("lot", getattr(self.instance, "lot", None))
        kg = attrs.get("allocated_kg", getattr(self.instance, "allocated_kg", None))
        if contract is not None and kg is not None:
            others = ContractLotAllocation.objects.filter(contract=contract)
            if self.instance:
                others = others.exclude(pk=self.instance.pk)
            already = sum((a.allocated_kg for a in others), Decimal("0"))
            capacity = Decimal(contract.quantity_mt or 0) * Decimal("1000")
            if capacity and already + Decimal(kg) > capacity:
                raise serializers.ValidationError(
                    f"Allocation exceeds contract capacity: {already}+{kg} kg > {capacity} kg.")
        if lot is not None and lot.is_closed:
            raise serializers.ValidationError("Cannot allocate a closed lot to a contract.")
        return attrs


class FarmPlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmPlot
        fields = "__all__"

    def validate_boundary_geojson(self, v):
        if v and v.get("type") not in ("Polygon", "MultiPolygon", "Feature", "FeatureCollection", None):
            raise serializers.ValidationError("boundary_geojson must be a GeoJSON Polygon.")
        return v


CUSTOM_SERIALIZERS = {
    CherryIntake: CherryIntakeSerializer,
    MoistureReading: MoistureReadingSerializer,
    PhysicalAnalysis: PhysicalAnalysisSerializer,
    CuppingScore: CuppingScoreSerializer,
    ContractLotAllocation: ContractLotAllocationSerializer,
    FarmPlot: FarmPlotSerializer,
}


def serializer_for(model):
    return CUSTOM_SERIALIZERS.get(model) or generic_serializer(model)
