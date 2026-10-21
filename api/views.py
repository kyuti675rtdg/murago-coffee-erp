from pathlib import Path
"""Phase 2 REST API — viewsets for all 23 modules + engine-wired actions."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models as dj_models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.models import AuditLog
from core.signoff import SignOffError, record_dual_signoff
from .permissions import RolePermission, user_station_ids
from .serializers import serializer_for

User = get_user_model()

# ---------------------------------------------------------------- registry
from core import models as core_m
from farmers import models as farmers_m
from collection import models as collection_m
from procurement import models as procurement_m
from processing import models as processing_m
from drymill import models as drymill_m
from traceability import models as trace_m
from quality import models as quality_m
from warehouse import models as warehouse_m
from resources import models as resources_m
from hr import models as hr_m
from payroll import models as payroll_m
from buyers import models as buyers_m
from exports import models as exports_m
from logistics import models as logistics_m
from finance import models as finance_m
from payments import models as payments_m
from inventory import models as inventory_m
from bi import models as bi_m
from sync import models as sync_m
from sysconf import models as sysconf_m

REGISTRY = [
    ("organizations", core_m.Organization), ("stations", core_m.Station),
    ("station-equipment", core_m.StationEquipment), ("site-cameras", core_m.SiteCamera),
    ("roles", core_m.Role), ("user-station-roles", core_m.UserStationRole),
    ("signature-credentials", core_m.SignatureCredential), ("dual-signoffs", core_m.DualSignOff),
    ("audit-logs", core_m.AuditLog), ("dashboard-snapshots", core_m.DashboardSnapshot),
    ("notifications", core_m.Notification),
    ("farmers", farmers_m.Farmer), ("farmer-documents", farmers_m.FarmerDocument),
    ("farm-plots", farmers_m.FarmPlot), ("certifications", farmers_m.Certification),
    ("eudr-statements", farmers_m.EUDRDueDiligenceStatement),
    ("bonus-schemes", farmers_m.BonusScheme), ("bonus-tiers", farmers_m.BonusTier),
    ("farmer-season-plans", farmers_m.FarmerSeasonPlan),
    ("bonus-calculations", farmers_m.BonusCalculation),
    ("collection-centers", collection_m.CollectionCenter), ("agent-assignments", collection_m.AgentAssignment),
    ("cash-floats", collection_m.CashFloat), ("cherry-intakes", collection_m.CherryIntake),
    ("suppliers", procurement_m.Supplier), ("daily-prices", procurement_m.DailyPrice),
    ("purchase-vouchers", procurement_m.PurchaseVoucher), ("grns", procurement_m.GoodsReceivedNote),
    ("lots", processing_m.Lot), ("lot-stage-events", processing_m.LotStageEvent),
    ("drying-beds", processing_m.DryingBed), ("bed-assignments", processing_m.BedAssignment),
    ("moisture-readings", processing_m.MoistureReading), ("drying-handovers", processing_m.DryingHandover),
    ("lot-labels", processing_m.LotLabel),
    ("milling-work-orders", drymill_m.MillingWorkOrder), ("milling-outputs", drymill_m.MillingOutput),
    ("grading-records", drymill_m.GradingRecord), ("screen-distributions", drymill_m.ScreenDistribution),
    ("lot-lineage", trace_m.LotLineageEdge), ("commingling-checks", trace_m.ComminglingCheck),
    ("mass-balance-checks", trace_m.MassBalanceCheck),
    ("physical-analyses", quality_m.PhysicalAnalysis), ("cupping-scores", quality_m.CuppingScore),
    ("quality-approvals", quality_m.QualityApproval),
    ("stores", warehouse_m.Store), ("bins", warehouse_m.Bin),
    ("stock-receipts", warehouse_m.StockReceipt), ("stock-transfers", warehouse_m.StockTransfer),
    ("gate-passes", warehouse_m.GatePass), ("stock-ledger", warehouse_m.StockLedgerEntry),
    ("fuel-entries", resources_m.FuelRegisterEntry), ("water-entries", resources_m.WaterRegisterEntry),
    ("workers", hr_m.Worker), ("attendance-sheets", hr_m.AttendanceSheet),
    ("attendance-entries", hr_m.AttendanceEntry), ("worker-advances", hr_m.WorkerAdvance),
    ("payroll-periods", payroll_m.PayrollPeriod), ("payroll-lines", payroll_m.PayrollLine),
    ("buyers", buyers_m.Buyer), ("sample-feedback", buyers_m.SampleFeedback),
    ("sales-contracts", buyers_m.SalesContract), ("contract-allocations", buyers_m.ContractLotAllocation),
    ("bag-markings", exports_m.BagMarking), ("packing-records", exports_m.PackingRecord),
    ("containers", exports_m.ContainerLoading), ("container-lots", exports_m.ContainerLot),
    ("export-documents", exports_m.ExportDocument),
    ("transporters", logistics_m.Transporter), ("vehicles", logistics_m.Vehicle),
    ("waybills", logistics_m.Waybill), ("transit-checkpoints", logistics_m.TransitCheckpoint),
    ("accounts", finance_m.Account), ("journal-entries", finance_m.JournalEntry),
    ("journal-lines", finance_m.JournalLine), ("receivables-payables", finance_m.ReceivablePayable),
    ("lot-cost-allocations", finance_m.LotCostAllocation),
    ("disbursements", payments_m.Disbursement), ("export-proceeds", payments_m.ExportProceeds),
    ("forex-retentions", payments_m.ForexRetention),
    ("inventory-items", inventory_m.InventoryItem), ("stock-movements", inventory_m.StockMovement),
    ("stock-audits", inventory_m.StockAudit), ("stock-adjustments", inventory_m.StockAdjustment),
    ("report-definitions", bi_m.ReportDefinition), ("generated-reports", bi_m.GeneratedReport),
    ("sync-queue", sync_m.SyncQueueItem), ("sync-conflicts", sync_m.SyncConflict),
    ("grade-definitions", sysconf_m.GradeDefinition), ("measurement-units", sysconf_m.MeasurementUnit),
    ("fermentation-tanks", sysconf_m.FermentationTank), ("yield-benchmarks", sysconf_m.YieldBenchmark),
    ("threshold-configs", sysconf_m.ThresholdConfig),
]
MODEL_BY_LABEL = {m._meta.label_lower: m for _, m in REGISTRY}

STATION_PATHS = ["station", "mill_station", "store__station", "center__station",
                 "sheet__station", "lot__station", "period__station", "from_station"]


def _station_filter(qs, model, station_ids):
    if station_ids is None:
        return qs
    field_names = {f.name for f in model._meta.get_fields() if hasattr(f, "name")}
    for path in STATION_PATHS:
        head = path.split("__")[0]
        if head in field_names:
            return qs.filter(**{f"{path}__in": station_ids})
    return qs


class StationScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    model = None

    def get_serializer_class(self):
        return serializer_for(self.model)

    def get_queryset(self):
        qs = self.model.objects.all()
        # AuditLog is append-only: no station column filter issue (it has station FK -> filtered)
        return _station_filter(qs, self.model, user_station_ids(self.request.user))

    def _audit(self, action_name, obj):
        try:
            station_id = getattr(obj, "station_id", None)
            AuditLog.objects.create(actor=self.request.user, action=action_name,
                                    model_label=self.model._meta.label_lower,
                                    object_id=str(obj.pk),
                                    station_id=station_id,
                                    after={"via": "api"})
        except Exception:
            pass

    def perform_create(self, serializer):
        obj = serializer.save()
        if hasattr(obj, "created_by") and not obj.created_by_id:
            obj.created_by = self.request.user
            obj.save(update_fields=["created_by"])
        self._audit("create", obj)

    def perform_update(self, serializer):
        obj = serializer.save()
        self._audit("update", obj)

    def perform_destroy(self, instance):
        self._audit("delete", instance)
        instance.delete()


def _user_from(data, key, default=None):
    uid = data.get(key)
    if uid:
        return get_object_or_404(User, pk=uid)
    return default


def _err(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": msg}, status=code)


# ---------------------------------------------------------------- lots / FSM
from processing import fsm
from traceability import dag


class LotViewSet(StationScopedViewSet):
    model = processing_m.Lot

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        lot = self.get_object()
        to_stage = request.data.get("to_stage")
        if not to_stage:
            return _err("to_stage is required.")
        try:
            event = fsm.transition(
                lot, to_stage, actor=request.user,
                issued_by=_user_from(request.data, "issued_by"),
                received_by=_user_from(request.data, "received_by"),
                weight_kg=request.data.get("weight_kg"),
                notes=request.data.get("notes", ""))
        except fsm.InvalidTransition as exc:
            return _err(str(exc))
        except SignOffError as exc:
            return _err(str(exc))
        lot.refresh_from_db()
        return Response({"lot": serializer_for(self.model)(lot).data,
                         "event_id": str(event.id), "from_stage": event.from_stage,
                         "to_stage": event.to_stage})

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        lot = self.get_object()
        try:
            event = fsm.advance(lot, actor=request.user, weight_kg=request.data.get("weight_kg"))
        except fsm.InvalidTransition as exc:
            return _err(str(exc))
        lot.refresh_from_db()
        return Response({"lot": serializer_for(self.model)(lot).data, "to_stage": event.to_stage})

    @action(detail=True, methods=["post"])
    def split(self, request, pk=None):
        parent = self.get_object()
        splits_in = request.data.get("splits") or []
        if not splits_in:
            return _err("splits: [{lot_code, weight_kg}] is required.")
        children = []
        try:
            for s in splits_in:
                child = processing_m.Lot.objects.create(
                    lot_code=s["lot_code"], station=parent.station,
                    process_type=s.get("process_type", parent.process_type),
                    current_stage=parent.current_stage, current_weight_kg=0,
                    cherry_kg=0, variety=parent.variety, altitude_m=parent.altitude_m)
                children.append((child, Decimal(str(s["weight_kg"]))))
            edges = dag.split_lot(parent, children, actor=request.user)
        except (dag.DAGError, KeyError, ValueError) as exc:
            return _err(str(exc))
        return Response({"parent": parent.lot_code,
                         "edges": [{"child": e.child_lot.lot_code, "weight_kg": str(e.weight_kg),
                                    "ratio": str(e.ratio)} for e in edges]}, status=201)

    @action(detail=False, methods=["post"])
    def blend(self, request):
        child_in = request.data.get("child") or {}
        contribs_in = request.data.get("contributions") or []
        if not child_in.get("lot_code") or not contribs_in:
            return _err("child {lot_code, station} and contributions [{lot_id, weight_kg}] are required.")
        try:
            first = get_object_or_404(processing_m.Lot, pk=contribs_in[0]["lot_id"])
            child = processing_m.Lot.objects.create(
                lot_code=child_in["lot_code"],
                station_id=child_in.get("station") or first.station_id,
                process_type=child_in.get("process_type", first.process_type),
                current_stage=first.current_stage, current_weight_kg=0)
            contribs = [(get_object_or_404(processing_m.Lot, pk=c["lot_id"]), Decimal(str(c["weight_kg"])))
                        for c in contribs_in]
            edges = dag.blend_lots(contribs, child, actor=request.user)
        except (dag.DAGError, KeyError, ValueError) as exc:
            return _err(str(exc))
        return Response({"child": child.lot_code, "weight_kg": str(child.current_weight_kg),
                         "edges": [{"parent": e.parent_lot.lot_code, "weight_kg": str(e.weight_kg),
                                    "ratio": str(e.ratio)} for e in edges]}, status=201)

    @action(detail=True, methods=["get", "post"], url_path="mass-balance")
    def mass_balance(self, request, pk=None):
        """Phase 4: run + persist the end-to-end mass-balance reconciliation."""
        from traceability.mass_balance import run_mass_balance, worst_status
        lot = self.get_object()
        checks = run_mass_balance(lot, actor=request.user)
        return Response({"lot": lot.lot_code, "worst_status": worst_status(checks),
                         "checks": serializer_for(trace_m.MassBalanceCheck)(checks, many=True).data})

    @action(detail=True, methods=["get"])
    def traceability(self, request, pk=None):
        lot = self.get_object()
        ancestors = dag.trace_back(lot)
        descendants = dag.trace_forward(lot)
        lots = processing_m.Lot.objects.filter(id__in=ancestors | descendants | {lot.id})
        edges = trace_m.LotLineageEdge.objects.filter(
            dj_models.Q(parent_lot__in=lots) | dj_models.Q(child_lot__in=lots))
        return Response({
            "lot": serializer_for(self.model)(lot).data,
            "nodes": serializer_for(self.model)(lots, many=True).data,
            "edges": serializer_for(trace_m.LotLineageEdge)(edges, many=True).data,
            "ancestor_ids": [str(x) for x in ancestors], "descendant_ids": [str(x) for x in descendants]})


# ---------------------------------------------------------------- handovers
class DryingHandoverViewSet(StationScopedViewSet):
    model = processing_m.DryingHandover

    def get_serializer(self, *a, **kw):
        s = super().get_serializer(*a, **kw)
        return s

    @action(detail=True, methods=["post"], url_path="dual-sign")
    def dual_sign(self, request, pk=None):
        obj = self.get_object()
        try:
            signoff = record_dual_signoff(
                document_type="processing.DryingHandover", document_id=obj.id,
                first_label="Issued By", first_user=obj.issued_by, first_pin=request.data.get("issued_pin"),
                second_label="Received By", second_user=obj.received_by, second_pin=request.data.get("received_pin"))
        except SignOffError as exc:
            return _err(str(exc))
        obj.signoff = signoff
        obj.save(update_fields=["signoff", "updated_at"])
        return Response({"signoff_id": str(signoff.id), "status": "complete"})


class StockReceiptViewSet(StationScopedViewSet):
    model = warehouse_m.StockReceipt

    @action(detail=True, methods=["post"], url_path="dual-sign")
    def dual_sign(self, request, pk=None):
        obj = self.get_object()
        try:
            signoff = record_dual_signoff(
                document_type="warehouse.StockReceipt", document_id=obj.id,
                first_label="Issued By", first_user=obj.issued_by, first_pin=request.data.get("issued_pin"),
                second_label="Received By", second_user=obj.received_by, second_pin=request.data.get("received_pin"))
        except SignOffError as exc:
            return _err(str(exc))
        obj.signoff = signoff
        obj.save(update_fields=["signoff", "updated_at"])
        return Response({"signoff_id": str(signoff.id), "status": "complete"})


class StockTransferViewSet(StationScopedViewSet):
    model = warehouse_m.StockTransfer

    @action(detail=True, methods=["post"], url_path="dual-sign")
    def dual_sign(self, request, pk=None):
        obj = self.get_object()
        issued = _user_from(request.data, "issued_by")
        received = _user_from(request.data, "received_by")
        try:
            signoff = record_dual_signoff(
                document_type="warehouse.StockTransfer", document_id=obj.id,
                first_label="Issued By", first_user=issued, first_pin=request.data.get("issued_pin"),
                second_label="Received By", second_user=received, second_pin=request.data.get("received_pin"))
        except SignOffError as exc:
            return _err(str(exc))
        if request.data.get("received_kg") is not None:
            obj.received_kg = request.data["received_kg"]
            obj.received_date = timezone.now().date()
            obj.status = warehouse_m.StockTransfer.Status.RECEIVED
            obj.save(update_fields=["received_kg", "received_date", "status", "updated_at"])
        return Response({"signoff_id": str(signoff.id), "status": obj.status,
                         "shrinkage_kg": str(obj.shrinkage_kg) if hasattr(obj, "shrinkage_kg") else None})


# ---------------------------------------------------------------- resources
from resources import calculators
from sysconf.models import ThresholdConfig


def _thresholds(station_id):
    cfg = ThresholdConfig.objects.filter(station_id=station_id).first()
    if not cfg:
        return None, None
    return cfg.max_fuel_ratio_l_per_kg, cfg.max_water_ratio_l_per_kg


def _notify_anomaly(entry, kind, ratio):
    from core.notify import notify_station_roles
    notify_station_roles(entry.station, ["station_supervisor", "admin"], category="anomaly",
                         severity="warning", link="resources",
                         title=f"{kind} ratio anomaly at {entry.station} on {entry.entry_date}",
                         body=f"{kind} ratio {ratio} exceeds the configured threshold.")


class FuelEntryViewSet(StationScopedViewSet):
    model = resources_m.FuelRegisterEntry

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        entry = self.model.objects.get(pk=resp.data["id"])
        max_fuel, _ = _thresholds(entry.station_id)
        result = calculators.apply_fuel_entry(entry, max_ratio=max_fuel)
        resp.data["fuel_ratio"] = str(result.ratio) if result.ratio is not None else None
        resp.data["is_anomaly"] = result.is_anomaly
        resp.data["note"] = result.note
        if result.is_anomaly:
            _notify_anomaly(entry, "Fuel", result.ratio)
        return resp


class WaterEntryViewSet(StationScopedViewSet):
    model = resources_m.WaterRegisterEntry

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        entry = self.model.objects.get(pk=resp.data["id"])
        _, max_water = _thresholds(entry.station_id)
        try:
            result = calculators.apply_water_entry(entry, max_ratio=max_water)
        except calculators.CalculationError as exc:
            return _err(str(exc))
        resp.data["consumption_litres"] = str(entry.consumption_litres)
        resp.data["water_ratio"] = str(result.ratio) if result.ratio is not None else None
        resp.data["is_anomaly"] = result.is_anomaly
        resp.data["note"] = result.note
        if result.is_anomaly:
            _notify_anomaly(entry, "Water", result.ratio)
        return resp


# ---------------------------------------------------------------- HR / payroll
from hr_payroll import engine as payroll_engine


class AttendanceSheetViewSet(StationScopedViewSet):
    model = hr_m.AttendanceSheet

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        sheet = self.get_object()
        controlled = _user_from(request.data, "controlled_by")
        verified = _user_from(request.data, "verified_by")
        try:
            payroll_engine.verify_attendance_sheet(
                sheet, controlled_by=controlled, verified_by=verified,
                controlled_pin=request.data.get("controlled_pin"),
                verified_pin=request.data.get("verified_pin"))
        except Exception as exc:
            return _err(str(exc))
        sheet.refresh_from_db()
        return Response(serializer_for(self.model)(sheet).data)

    @action(detail=True, methods=["post"], url_path="generate-payroll")
    def generate_payroll(self, request, pk=None):
        sheet = self.get_object()
        prepared = _user_from(request.data, "prepared_by", default=request.user)
        try:
            period = payroll_engine.generate_payroll(sheet, prepared_by=prepared)
        except payroll_engine.PayrollError as exc:
            return _err(str(exc))
        from core.notify import notify_station_roles
        notify_station_roles(sheet.station, ["finance_manager", "admin"], category="payroll",
                             severity="info", link="payroll",
                             title=f"Payroll generated for {sheet.ethiopian_month}/{sheet.ethiopian_year}",
                             body=f"Gross {period.total_gross} · Net {period.total_net} ETB — approval pending.")
        return Response(serializer_for(payroll_m.PayrollPeriod)(period).data, status=201)


class AttendanceEntryViewSet(StationScopedViewSet):
    """Grid cells are upserted by (sheet, worker, day) — re-saving the 30-day
    grid updates cells instead of failing on the unique constraint (Phase 4 fix)."""
    model = hr_m.AttendanceEntry

    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            obj, created = self.model.objects.update_or_create(
                sheet_id=data.get("sheet"), worker_id=data.get("worker"), day=data.get("day"),
                defaults={"mark": data.get("mark", "present"), "hours": data.get("hours", 0),
                          "pieces": data.get("pieces", 0)})
        except Exception as exc:
            return _err(str(exc))
        return Response(serializer_for(self.model)(obj).data, status=201 if created else 200)


class PayrollPeriodViewSet(StationScopedViewSet):
    model = payroll_m.PayrollPeriod

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        period = self.get_object()
        approver = _user_from(request.data, "approved_by", default=request.user)
        try:
            payroll_engine.approve_payroll(
                period, approved_by=approver,
                prepared_pin=request.data.get("prepared_pin"),
                approved_pin=request.data.get("approved_pin"))
        except payroll_engine.PayrollError as exc:
            return _err(str(exc))
        period.refresh_from_db()
        return Response(serializer_for(self.model)(period).data)


class PayrollLineViewSet(StationScopedViewSet):
    model = payroll_m.PayrollLine

    @action(detail=True, methods=["post"], url_path="sign-recipient")
    def sign_recipient(self, request, pk=None):
        line = self.get_object()
        import hashlib
        sig = request.data.get("signature", "")
        line.recipient_signed = True
        line.recipient_signature_sha256 = hashlib.sha256(sig.encode()).hexdigest() if sig else "signed"
        line.paid_at = timezone.now()
        line.save(update_fields=["recipient_signed", "recipient_signature_sha256", "paid_at", "updated_at"])
        return Response(serializer_for(self.model)(line).data)


# ---------------------------------------------------------------- quality
class CuppingScoreViewSet(StationScopedViewSet):
    model = quality_m.CuppingScore

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        """Q-Grader approval/rejection workflow for export release (9.2)."""
        cupping = self.get_object()
        decision = request.data.get("decision")
        grade = request.data.get("grade")
        if decision not in ("approved", "rejected", "conditional") or not grade:
            return _err("decision (approved|rejected|conditional) and grade (1-5|UG) are required.")
        approval = quality_m.QualityApproval.objects.create(
            lot=cupping.lot, cupping=cupping, grade=grade, decision=decision,
            decided_by=request.user, remarks=request.data.get("remarks", ""))
        return Response(serializer_for(quality_m.QualityApproval)(approval).data, status=201)


# ---------------------------------------------------------------- Phase 4 viewsets
class NotificationViewSet(viewsets.ModelViewSet):
    """Module 24 — users see and manage ONLY their own notifications."""
    permission_classes = [IsAuthenticated]
    model = core_m.Notification

    def get_serializer_class(self):
        return serializer_for(self.model)

    def get_queryset(self):
        return self.model.objects.filter(user=self.request.user).order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        n = self.get_object()
        n.is_read = True
        n.read_at = timezone.now()
        n.save(update_fields=["is_read", "read_at", "updated_at"])
        return Response(serializer_for(self.model)(n).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"marked_read": updated})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread": self.get_queryset().filter(is_read=False).count()})


class JournalEntryViewSet(StationScopedViewSet):
    model = finance_m.JournalEntry

    @action(detail=True, methods=["post"], url_path="post-entry")
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        if entry.status == finance_m.JournalEntry.Status.POSTED:
            return _err("Journal is already posted.")
        if not entry.is_balanced():
            totals = {c: {"debit": str(t["debit"]), "credit": str(t["credit"])}
                      for c, t in entry.totals_by_currency().items()}
            return _err(f"Journal cannot be posted: debits != credits per currency: {totals}")
        entry.status = finance_m.JournalEntry.Status.POSTED
        try:
            entry.save(update_fields=["status", "updated_at"])
        except Exception as exc:
            return _err(str(exc))
        return Response(serializer_for(self.model)(entry).data)


class JournalLineViewSet(StationScopedViewSet):
    model = finance_m.JournalLine

    def _check_unposted(self, entry_id):
        entry = finance_m.JournalEntry.objects.filter(pk=entry_id).first()
        if entry and entry.status == finance_m.JournalEntry.Status.POSTED:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError("Lines of a POSTED journal cannot be modified; void it instead.")

    def perform_create(self, serializer):
        self._check_unposted(serializer.validated_data.get("entry").id if serializer.validated_data.get("entry") else None)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_unposted(serializer.instance.entry_id)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._check_unposted(instance.entry_id)
        super().perform_destroy(instance)


class CherryIntakeViewSet(StationScopedViewSet):
    """Weighbridge intake: the operator's form sends only what is typed at
    the scale (farmer, center, station, date, weights, price). The server
    computes net kg and auto-generates the unique intake number and QR
    receipt code, so recording an intake can never 400 on computed fields."""

    model = collection_m.CherryIntake

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        gross = Decimal(str(data.get("gross_kg") or 0))
        tare = Decimal(str(data.get("tare_kg") or 0))
        if data.get("net_kg") in (None, ""):
            data["net_kg"] = str(gross - tare)
        if data.get("payable_kg") in (None, ""):
            data["payable_kg"] = "0"
        if data.get("total_amount") in (None, ""):
            data["total_amount"] = "0"
        if not data.get("intake_number"):
            year = str(data.get("intake_date") or "")[:4] or "2026"
            prefix = f"INT-{year}-"
            n = collection_m.CherryIntake.objects.filter(
                intake_number__startswith=prefix).count() + 1
            candidate = f"{prefix}{n:04d}"
            while collection_m.CherryIntake.objects.filter(intake_number=candidate).exists():
                n += 1
                candidate = f"{prefix}{n:04d}"
            data["intake_number"] = candidate
        if not data.get("qr_receipt_code"):
            data["qr_receipt_code"] = f"QR-{data['intake_number']}"
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class PurchaseVoucherViewSet(StationScopedViewSet):
    model = procurement_m.PurchaseVoucher

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from procurement.approvals import ApprovalError, approve_voucher
        voucher = self.get_object()
        try:
            approve_voucher(voucher, approved_by=request.user)
        except ApprovalError as exc:
            return _err(str(exc), status.HTTP_403_FORBIDDEN)
        from core.notify import notify_user
        if voucher.created_by_id:
            notify_user(voucher.created_by, category="approval", link="procurement",
                        title=f"Voucher {voucher.voucher_number} approved",
                        body=f"{voucher.total_amount} ETB approved by {request.user.username}.")
        return Response(serializer_for(self.model)(voucher).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        from procurement.approvals import ApprovalError, reject_voucher
        voucher = self.get_object()
        try:
            reject_voucher(voucher, rejected_by=request.user)
        except ApprovalError as exc:
            return _err(str(exc))
        return Response(serializer_for(self.model)(voucher).data)


class StockAuditViewSet(StationScopedViewSet):
    model = inventory_m.StockAudit

    @action(detail=True, methods=["post"])
    def reconcile(self, request, pk=None):
        from inventory.reconcile import ReconcileError, reconcile_audit
        audit = self.get_object()
        try:
            summary = reconcile_audit(audit, reconciled_by=request.user)
        except ReconcileError as exc:
            return _err(str(exc))
        return Response(summary)


class ContainerViewSet(StationScopedViewSet):
    model = exports_m.ContainerLoading

    @action(detail=True, methods=["get"])
    def checklist(self, request, pk=None):
        from exports.checklist import document_checklist
        return Response(document_checklist(self.get_object()))

    @action(detail=True, methods=["post"], url_path="mark-ready")
    def mark_ready(self, request, pk=None):
        from exports.checklist import ChecklistError, mark_container_ready
        container = self.get_object()
        try:
            mark_container_ready(container)
        except ChecklistError as exc:
            return _err(str(exc))
        return Response(serializer_for(self.model)(container).data)


# ---------------------------------------------------------------- dashboard / BI
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def site_performance(request):
    """Admin Site Performance: per-station KPI comparison (optional ?from=&to=)."""
    from core.siteperf import parse_range, station_metrics

    date_from, date_to = parse_range(request)
    ids = user_station_ids(request.user)
    stations = core_m.Station.objects.filter(is_active=True).order_by("code")
    if ids is not None:
        stations = stations.filter(id__in=ids)
    rows = [station_metrics(s, date_from, date_to) for s in stations]
    totals = {
        "stations": len(rows),
        "collected_kg": str(sum((Decimal(r["collected_kg"]) for r in rows), Decimal("0"))),
        "procurement_cost_etb": str(sum((Decimal(r["procurement_cost_etb"]) for r in rows), Decimal("0"))),
        "farmers": sum(r["farmers"] for r in rows),
        "alerts": sum(len(r["alerts"]) for r in rows),
    }
    return Response({"stations": rows, "totals": totals,
                     "range": {"from": str(date_from) if date_from else None,
                               "to": str(date_to) if date_to else None}})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def site_performance_detail(request, station_id):
    """Drill-down for one station: series, top farmers, staff, recent lots."""
    from core.siteperf import parse_range, station_detail

    station = get_object_or_404(core_m.Station, pk=station_id)
    ids = user_station_ids(request.user)
    if ids is not None and station.id not in ids:
        return _err("This station is outside your assigned scope.", status.HTTP_403_FORBIDDEN)
    date_from, date_to = parse_range(request)
    data = station_detail(station, date_from, date_to)
    data["profile"] = serializer_for(core_m.Station)(station).data
    data["equipment"] = serializer_for(core_m.StationEquipment)(
        station.equipment.all().order_by("equipment_type", "name"), many=True).data
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    station_id = request.query_params.get("station")
    ids = user_station_ids(request.user)
    lots = processing_m.Lot.objects.all()
    lots = _station_filter(lots, processing_m.Lot, ids)
    if station_id:
        lots = lots.filter(station_id=station_id)
    by_stage = {}
    for stage, _label in processing_m.LotStage.choices:
        by_stage[stage] = lots.filter(current_stage=stage).count()
    fuel = resources_m.FuelRegisterEntry.objects.all()
    fuel = _station_filter(fuel, resources_m.FuelRegisterEntry, ids)
    water = resources_m.WaterRegisterEntry.objects.all()
    water = _station_filter(water, resources_m.WaterRegisterEntry, ids)
    contracts = buyers_m.SalesContract.objects.exclude(status="cancelled")
    committed_kg = sum((a.allocated_kg for a in buyers_m.ContractLotAllocation.objects.all()), Decimal("0"))
    stock_kg = warehouse_m.StockLedgerEntry.objects.all()
    latest_stock = sum((e.balance_kg for e in stock_kg), Decimal("0"))
    return Response({
        "lots_total": lots.count(), "lots_by_stage": by_stage,
        "cherry_procured_kg": str(sum((i.payable_kg for i in collection_m.CherryIntake.objects.all()), Decimal("0"))),
        "warehouse_stock_kg": str(latest_stock),
        "open_contracts": contracts.count(), "committed_kg": str(committed_kg),
        "fuel_entries": fuel.count(), "fuel_anomalies": fuel.filter(is_anomaly=True).count(),
        "water_entries": water.count(), "water_anomalies": water.filter(is_anomaly=True).count(),
        "avg_fuel_ratio": str(fuel.exclude(fuel_ratio=None).aggregate(a=dj_models.Avg("fuel_ratio"))["a"] or ""),
        "avg_water_ratio": str(water.exclude(water_ratio=None).aggregate(a=dj_models.Avg("water_ratio"))["a"] or ""),
        "farmers": farmers_m.Farmer.objects.count(),
        "containers_open": exports_m.ContainerLoading.objects.exclude(status="shipped").count(),
        **_management_insights(ids),
        **_dashboard_analytics(ids),
    })


def _dashboard_analytics(ids):
    """Chart-ready analytics for the executive dashboard."""
    from django.utils import timezone as _tz

    intakes = collection_m.CherryIntake.objects.all()
    intakes = _station_filter(intakes, collection_m.CherryIntake, ids)
    today = _tz.localdate()
    trend = []
    for offset in range(13, -1, -1):
        day = today - timedelta(days=offset)
        agg = intakes.filter(intake_date=day).aggregate(
            kg=dj_models.Sum("payable_kg"), amount=dj_models.Sum("total_amount"))
        trend.append({"date": str(day), "kg": str(agg["kg"] or Decimal("0")),
                      "amount": str(agg["amount"] or Decimal("0"))})
    components = ["fragrance_aroma", "flavour", "aftertaste", "acidity", "body",
                  "balance", "uniformity", "clean_cup", "sweetness", "overall"]
    scores = quality_m.CuppingScore.objects.all()
    quality_avg = None
    if scores.exists():
        avgs = scores.aggregate(**{f"a_{c}": dj_models.Avg(c) for c in components})
        quality_avg = str(sum((avgs[f"a_{c}"] or Decimal("0")) for c in components).quantize(Decimal("0.01")))
    return {"collection_trend": trend, "quality_avg": quality_avg,
            "cupping_sessions": scores.count()}


def _management_insights(ids):
    """Extra decision KPIs for management (all computed live)."""
    intakes = collection_m.CherryIntake.objects.all()
    intakes = _station_filter(intakes, collection_m.CherryIntake, ids)
    agg = intakes.aggregate(kg=dj_models.Sum("payable_kg"), cost=dj_models.Sum("total_amount"))
    kg = agg["kg"] or Decimal("0"); cost = agg["cost"] or Decimal("0")
    farmers_qs = farmers_m.Farmer.objects.all()
    farmers_qs = _station_filter(farmers_qs, farmers_m.Farmer, ids)
    total_farmers = farmers_qs.count()
    active_ids = set(intakes.values_list("farmer_id", flat=True))
    active_pct = (Decimal(len(active_ids)) / total_farmers * 100).quantize(Decimal("0.1")) if total_farmers else Decimal("0")
    vouchers = procurement_m.PurchaseVoucher.objects.all()
    vouchers = _station_filter(vouchers, procurement_m.PurchaseVoucher, ids)
    bonuses = farmers_m.BonusCalculation.objects.all()
    bonuses = _station_filter(bonuses, farmers_m.BonusCalculation, ids)
    liability = bonuses.filter(status="approved").aggregate(v=dj_models.Sum("gross_bonus_etb"))["v"] or Decimal("0")
    by_station = (intakes.values("station__code").annotate(kg=dj_models.Sum("payable_kg"))
                  .order_by("-kg").first())
    return {
        "procurement_cost_etb": str(cost),
        "avg_price_per_kg": str((cost / kg).quantize(Decimal("0.01"))) if kg else "0",
        "active_farmers": len(active_ids), "active_farmer_pct": str(active_pct),
        "pending_vouchers": vouchers.filter(status="pending").count(),
        "pending_bonuses": bonuses.filter(status="pending_approval").count(),
        "bonus_liability_etb": str(liability),
        "top_station_code": (by_station or {}).get("station__code"),
        "top_station_kg": str((by_station or {}).get("kg") or 0),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_report(request):
    """BI report runner (Module 20): computes real aggregates by kind."""
    kind = request.data.get("kind", "procurement")
    station_id = request.data.get("station")
    qs_map = {
        "procurement": lambda: {"intakes": collection_m.CherryIntake.objects.count(),
                                "payable_kg": str(sum((i.payable_kg for i in collection_m.CherryIntake.objects.all()), Decimal("0")))},
        "yields": lambda: {"lots": processing_m.Lot.objects.count(),
                           "cherry_kg": str(sum((l.cherry_kg for l in processing_m.Lot.objects.all()), Decimal("0"))),
                           "green_kg": str(sum((l.green_kg for l in processing_m.Lot.objects.all()), Decimal("0")))},
        "efficiency": lambda: {"fuel_anomalies": resources_m.FuelRegisterEntry.objects.filter(is_anomaly=True).count(),
                               "water_anomalies": resources_m.WaterRegisterEntry.objects.filter(is_anomaly=True).count()},
        "quality": lambda: {"cuppings": quality_m.CuppingScore.objects.count(),
                            "approvals": quality_m.QualityApproval.objects.filter(decision="approved").count()},
        "stock": lambda: {"stores": warehouse_m.Store.objects.count(),
                          "ledger_entries": warehouse_m.StockLedgerEntry.objects.count()},
    }
    fn = qs_map.get(kind)
    if not fn:
        return _err(f"Unknown report kind {kind!r}. Available: {sorted(qs_map)}")
    return Response({"kind": kind, "station": station_id, "generated_at": timezone.now().isoformat(),
                     "data": fn()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lot_costing(request, lot_id):
    from finance.models import lot_landed_cost_per_kg
    lot = get_object_or_404(processing_m.Lot, pk=lot_id)
    per_kg = lot_landed_cost_per_kg(lot)
    allocs = finance_m.LotCostAllocation.objects.filter(lot=lot)
    return Response({"lot": lot.lot_code, "landed_cost_per_kg": str(per_kg) if per_kg is not None else None,
                     "allocations": serializer_for(finance_m.LotCostAllocation)(allocs, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def postgis_status(request):
    """Live PostGIS verification: CREATE EXTENSION IF NOT EXISTS + postgis_version()."""
    from django.db import connection
    try:
        with connection.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
            cur.execute("SELECT postgis_version()")
            version = cur.fetchone()[0]
            cur.execute("SELECT ST_AsText(ST_GeomFromText('POINT(38.4167 6.6)', 4326))")
            point = cur.fetchone()[0]
        return Response({"postgis": True, "postgis_version": version, "geometry_smoke": point,
                         "engine": connection.settings_dict.get("ENGINE", "")})
    except Exception as exc:
        return Response({"postgis": False, "error": f"{type(exc).__name__}: {exc}"}, status=503)


# ---------------------------------------------------------------- sync (Module 21)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_push(request):
    """Offline sync push: idempotent upsert by client_uuid; conflicts surfaced."""
    records = request.data.get("records") or []
    acks = []
    for rec in records:
        client_uuid = rec.get("client_uuid")
        if not client_uuid:
            acks.append({"client_uuid": None, "status": "error", "detail": "client_uuid required"})
            continue
        item, created = sync_m.SyncQueueItem.objects.get_or_create(
            client_uuid=client_uuid,
            defaults={"device_id": rec.get("device_id", ""), "user": request.user,
                      "entity_type": rec.get("entity_type", ""), "entity_uuid": rec.get("entity_uuid"),
                      "payload": rec.get("payload", {}),
                      "client_created_at": rec.get("client_created_at") or timezone.now(),
                      "status": sync_m.SyncQueueItem.Status.PENDING,
                      "server_received_at": timezone.now()})
        if not created:
            acks.append({"client_uuid": str(client_uuid), "status": "duplicate", "queue_id": str(item.id)})
            continue
        # Attempt domain upsert for known entity types.
        model = MODEL_BY_LABEL.get((rec.get("entity_type") or "").lower())
        outcome = "queued"
        if model is not None and rec.get("entity_uuid"):
            existing = model.objects.filter(pk=rec["entity_uuid"]).first()
            payload = {k: v for k, v in (rec.get("payload") or {}).items()
                       if k in {f.name for f in model._meta.get_fields() if hasattr(f, "name")}}
            if existing is not None and rec.get("client_created_at"):
                from django.utils.dateparse import parse_datetime
                cdt = parse_datetime(str(rec["client_created_at"]))
                if cdt and existing.updated_at and existing.updated_at > cdt:
                    sync_m.SyncConflict.objects.create(
                        queue_item=item, field_name="*", client_value=rec.get("payload", {}),
                        server_value={"updated_at": existing.updated_at.isoformat()})
                    item.status = sync_m.SyncQueueItem.Status.CONFLICT
                    item.save(update_fields=["status"])
                    outcome = "conflict"
            if outcome != "conflict":
                try:
                    model.objects.update_or_create(pk=rec["entity_uuid"], defaults=payload)
                    item.status = sync_m.SyncQueueItem.Status.SYNCED
                    item.save(update_fields=["status"])
                    outcome = "applied"
                except Exception as exc:  # payload FK/format issues stay queued for manager review
                    outcome = f"queued ({type(exc).__name__})"
        acks.append({"client_uuid": str(client_uuid), "status": outcome, "queue_id": str(item.id)})
    return Response({"acks": acks, "received": len(acks)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_pull(request):
    from django.utils.dateparse import parse_datetime
    since_raw = request.query_params.get("since")
    since = parse_datetime(since_raw) if since_raw else None
    items = sync_m.SyncQueueItem.objects.all()
    if since:
        items = items.filter(server_received_at__gt=since)
    changes = {}
    for _route, model in REGISTRY:
        if not hasattr(model, "updated_at"):
            continue
        qs = model.objects.all()
        if since:
            qs = qs.filter(updated_at__gt=since)
        rows = list(qs.order_by("updated_at")[:200])
        if rows:
            changes[model._meta.label_lower] = serializer_for(model)(rows, many=True).data
    return Response({"since": since_raw, "queue_items": serializer_for(sync_m.SyncQueueItem)(items[:500], many=True).data,
                     "changes": changes,
                     "conflicts": serializer_for(sync_m.SyncConflict)(
                         sync_m.SyncConflict.objects.filter(resolution="unresolved")[:200], many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def backups_list(request):
    """Module 25 — read-only inventory of server backup artefacts (admin only).

    Additive endpoint for the System > Backups page; backups themselves are
    produced on the server by `manage.py backup_db`, never via the API.
    """
    from .permissions import is_admin
    if not is_admin(request.user):
        return Response({"detail": "Admin role required."}, status=403)
    import datetime
    from django.conf import settings as dj_settings
    bdir = Path(dj_settings.BASE_DIR) / "backups"
    files = []
    if bdir.is_dir():
        for p in sorted(bdir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file():
                st = p.stat()
                files.append({"name": p.name, "size_bytes": st.st_size,
                              "modified_at": datetime.datetime.fromtimestamp(st.st_mtime, tz=datetime.timezone.utc).isoformat()})
    return Response({"files": files, "directory": "backups/", "command": "python manage.py backup_db"})


# ------------------------------------------------------- farmers / bonus

class FarmerViewSet(StationScopedViewSet):
    model = farmers_m.Farmer

    def list(self, request, *args, **kwargs):
        """Directory list enriched with each farmer's lifetime production."""
        response = super().list(request, *args, **kwargs)
        rows = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        totals = {
            str(farmer_id): total
            for farmer_id, total in (
                collection_m.CherryIntake.objects
                .values("farmer_id")
                .annotate(t=dj_models.Sum("payable_kg"))
                .values_list("farmer_id", "t")
            )
        }
        for row in rows:
            row["total_production_kg"] = str(totals.get(str(row["id"]), Decimal("0")))
        return response

    def destroy(self, request, *args, **kwargs):
        """Safe delete: a farmer with delivery/payment history is deactivated,
        never hard-deleted (their records are legal history)."""
        farmer = self.get_object()
        has_history = (farmer.intakes.exists() or farmer.vouchers.exists()
                       or farmer.season_plans.exists() or farmer.bonus_calculations.exists())
        if has_history:
            farmer.is_active = False
            farmer.save(update_fields=["is_active", "updated_at"])
            return Response({"detail": "Farmer has delivery/payment history and was deactivated instead of deleted.",
                             "deactivated": True, "id": str(farmer.id)})
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def profile(self, request, pk=None):
        """Full farmer profile: performance, procurement history, quality, payments."""
        from django.db.models import Count, Sum

        farmer = self.get_object()
        intakes = collection_m.CherryIntake.objects.filter(farmer=farmer).order_by("-intake_date")
        vouchers = procurement_m.PurchaseVoucher.objects.filter(farmer=farmer).order_by("-voucher_date")
        payments = payments_m.Disbursement.objects.filter(farmer=farmer).order_by("-paid_on", "-created_at")
        by_year = list(intakes.values("intake_date__year")
                       .annotate(kg=Sum("payable_kg"), amount=Sum("total_amount"), deliveries=Count("id"))
                       .order_by("intake_date__year"))
        total_kg = intakes.aggregate(kg=Sum("payable_kg"))["kg"] or Decimal("0")
        total_value = intakes.aggregate(v=Sum("total_amount"))["v"] or Decimal("0")
        total_paid = payments.filter(status="paid").aggregate(v=Sum("amount"))["v"] or Decimal("0")
        lot_ids = intakes.exclude(lot__isnull=True).values_list("lot_id", flat=True).distinct()
        quality_rows = []
        scores = []
        for cs in quality_m.CuppingScore.objects.filter(lot_id__in=list(lot_ids)).select_related("lot"):
            total = cs.total_score
            scores.append(total)
            quality_rows.append({"lot_code": cs.lot.lot_code, "cupped_on": cs.cupped_on, "total_score": str(total)})
        cap = farmer.annual_cherry_cap_kg or Decimal("0")
        stats = {
            "total_delivered_kg": str(total_kg),
            "total_deliveries": intakes.count(),
            "total_procurement_value_etb": str(total_value),
            "total_paid_etb": str(total_paid),
            "avg_quality_score": str((sum(scores) / len(scores)).quantize(Decimal("0.01"))) if scores else None,
            "cap_utilization_pct": str((total_kg / cap * 100).quantize(Decimal("0.1"))) if cap else None,
            "by_year": [{"year": r["intake_date__year"], "kg": str(r["kg"] or 0),
                         "amount_etb": str(r["amount"] or 0), "deliveries": r["deliveries"]} for r in by_year],
        }
        ser = serializer_for
        return Response({
            "farmer": ser(farmers_m.Farmer)(farmer).data,
            "stats": stats,
            "plots": ser(farmers_m.FarmPlot)(farmer.plots.all(), many=True).data,
            "certifications": ser(farmers_m.Certification)(farmer.certifications.all(), many=True).data,
            "procurement_history": ser(collection_m.CherryIntake)(intakes[:100], many=True).data,
            "vouchers": ser(procurement_m.PurchaseVoucher)(vouchers[:100], many=True).data,
            "quality": quality_rows,
            "payments": ser(payments_m.Disbursement)(payments[:100], many=True).data,
            "plans": ser(farmers_m.FarmerSeasonPlan)(farmer.season_plans.all(), many=True).data,
            "bonuses": ser(farmers_m.BonusCalculation)(farmer.bonus_calculations.all(), many=True).data,
        })


class BonusCalculationViewSet(StationScopedViewSet):
    model = farmers_m.BonusCalculation

    @action(detail=False, methods=["post"])
    def run(self, request):
        """(Re)compute bonuses for every delivering farmer under one scheme."""
        from farmers.bonus import run_scheme

        scheme_id = request.data.get("scheme")
        if not scheme_id:
            return _err("scheme is required.")
        scheme = get_object_or_404(farmers_m.BonusScheme, pk=scheme_id)
        calcs = run_scheme(scheme)
        return Response({"scheme": str(scheme.id), "season_year": scheme.season_year,
                         "calculated": len(calcs),
                         "total_bonus_etb": str(sum((c.gross_bonus_etb for c in calcs), Decimal("0")))})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        calc = self.get_object()
        if calc.status not in (calc.Status.CALCULATED, calc.Status.PENDING):
            return _err(f"Only a calculated/pending bonus can be approved (current: {calc.status}).")
        calc.status = calc.Status.APPROVED
        calc.approved_by = request.user
        calc.approved_at = timezone.now()
        calc.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        self._audit("approve", calc)
        return Response(serializer_for(self.model)(calc).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        calc = self.get_object()
        if calc.status in (calc.Status.APPROVED, calc.Status.PAID, calc.Status.REJECTED):
            return _err(f"A {calc.status} bonus cannot be rejected.")
        calc.status = calc.Status.REJECTED
        calc.rejection_reason = request.data.get("reason", "")
        calc.save(update_fields=["status", "rejection_reason", "updated_at"])
        self._audit("reject", calc)
        return Response(serializer_for(self.model)(calc).data)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Pay an approved bonus: creates a farmer Disbursement and links it."""
        calc = self.get_object()
        if calc.status != calc.Status.APPROVED:
            return _err(f"Only an approved bonus can be paid (current: {calc.status}).")
        if calc.gross_bonus_etb <= 0:
            return _err("Bonus amount is zero — nothing to pay.")
        disb = payments_m.Disbursement.objects.create(
            reference=f"BONUS-{calc.season_year}-{calc.farmer.farmer_code}-{str(calc.id)[:8]}",
            payee_type="farmer", farmer=calc.farmer, amount=calc.gross_bonus_etb,
            method=request.data.get("method", "bank"), paid_on=timezone.now().date(),
            status="paid", paid_by=request.user)
        calc.disbursement = disb
        calc.status = calc.Status.PAID
        calc.save(update_fields=["disbursement", "status", "updated_at"])
        self._audit("pay", calc)
        return Response(serializer_for(self.model)(calc).data)


# ---------------------------------------------------------------- viewset factory
CUSTOM_VIEWSETS = {
    "lots": LotViewSet, "drying-handovers": DryingHandoverViewSet,
    "stock-receipts": StockReceiptViewSet, "stock-transfers": StockTransferViewSet,
    "fuel-entries": FuelEntryViewSet, "water-entries": WaterEntryViewSet,
    "attendance-sheets": AttendanceSheetViewSet, "attendance-entries": AttendanceEntryViewSet,
    "payroll-periods": PayrollPeriodViewSet,
    "payroll-lines": PayrollLineViewSet, "cupping-scores": CuppingScoreViewSet,
    "notifications": NotificationViewSet, "journal-entries": JournalEntryViewSet,
    "journal-lines": JournalLineViewSet, "purchase-vouchers": PurchaseVoucherViewSet,
    "stock-audits": StockAuditViewSet, "containers": ContainerViewSet,
    "farmers": FarmerViewSet, "bonus-calculations": BonusCalculationViewSet,
    "cherry-intakes": CherryIntakeViewSet,
}


def build_viewsets():
    out = {}
    for route, model in REGISTRY:
        if route in CUSTOM_VIEWSETS:
            out[route] = CUSTOM_VIEWSETS[route]
        else:
            out[route] = type(f"{model.__name__}ViewSet", (StationScopedViewSet,), {"model": model})
    return out
