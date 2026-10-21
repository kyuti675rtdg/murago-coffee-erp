"""Module 1 (Executive Dashboard snapshots), Module 22/23 support:
organisation, stations, RBAC, signature credentials, dual sign-offs, audit log."""
import hashlib

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models

from .base import TimeStampedUUIDModel


class Organization(TimeStampedUUIDModel):
    name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=240, blank=True)
    tin = models.CharField("TIN", max_length=32, blank=True)
    country = models.CharField(max_length=80, default="Ethiopia")
    base_currency = models.CharField(max_length=3, default="ETB")

    def __str__(self):
        return self.name


class Station(TimeStampedUUIDModel):
    """A washing station, dry mill, collection hub or central warehouse site."""

    class StationType(models.TextChoices):
        WASHING = "washing", "Washing Station"
        DRY_MILL = "dry_mill", "Dry Mill"
        COLLECTION_HUB = "collection_hub", "Collection Hub"
        CENTRAL_WAREHOUSE = "central_warehouse", "Central Warehouse (Addis)"
        HQ = "hq", "Head Office"

    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="stations")
    code = models.CharField(max_length=24, unique=True, help_text="Short code used inside Lot IDs, e.g. MUR")
    name = models.CharField(max_length=200)
    station_type = models.CharField(max_length=24, choices=StationType.choices, db_index=True)
    region = models.CharField(max_length=120, blank=True)
    woreda = models.CharField(max_length=120, blank=True)
    altitude_m = models.PositiveIntegerField(null=True, blank=True, help_text="Site altitude (m a.s.l.)")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["station_type", "is_active"])]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Role(TimeStampedUUIDModel):
    """Module 23.1 — granular ERP roles from the brief."""

    class RoleCode(models.TextChoices):
        MACHINE_OPERATOR = "machine_operator", "Machine Operator"
        STATION_SUPERVISOR = "station_supervisor", "Station Supervisor"
        INDUSTRY_PROFESSIONAL = "industry_professional", "Industry Professional"
        Q_GRADER = "q_grader", "Q-Grader"
        DRY_MILL_MANAGER = "dry_mill_manager", "Dry Mill Manager"
        EXPORT_OFFICER = "export_officer", "Export Officer"
        FINANCE_MANAGER = "finance_manager", "Finance Manager"
        PURCHASER = "purchaser", "Purchaser / Station Officer"
        ADMIN = "admin", "Admin"

    code = models.CharField(max_length=32, choices=RoleCode.choices, unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, blank=True, help_text="Permission codenames granted by this role")

    def __str__(self):
        return self.get_code_display()


class UserStationRole(TimeStampedUUIDModel):
    """Module 23.1 — a user holds a role scoped to specific station(s)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="station_roles")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="assignments")
    station = models.ForeignKey(Station, null=True, blank=True, on_delete=models.CASCADE,
                                related_name="user_roles", help_text="Null = all stations")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["user", "role", "station"], name="uniq_user_role_station")]
        indexes = [models.Index(fields=["user", "station"])]

    def __str__(self):
        return f"{self.user} · {self.role.code} · {self.station or 'ALL'}"


class SignatureCredential(TimeStampedUUIDModel):
    """Module 23.2 — PIN + signature credential used for cryptographic sign-offs.

    Only the *storage* of the credential is here; verification logic is real
    (Django password hashers). The drawn signature image itself is stored by
    hash so a sign-off can be bound to the exact signature artefact presented.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="signature_credential")
    pin_hash = models.CharField(max_length=256)
    signature_sha256 = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    def set_pin(self, raw_pin: str) -> None:
        if not raw_pin or len(raw_pin) < 4:
            raise ValueError("PIN must be at least 4 characters")
        self.pin_hash = make_password(raw_pin)

    def check_pin(self, raw_pin: str) -> bool:
        return bool(self.is_active and self.pin_hash and check_password(raw_pin or "", self.pin_hash))

    def bind_signature(self, signature_bytes: bytes) -> str:
        self.signature_sha256 = hashlib.sha256(signature_bytes).hexdigest()
        return self.signature_sha256


class DualSignOff(TimeStampedUUIDModel):
    """Module 23.2 / brief §2.3 — an immutable dual-verification record.

    Generic by (document_type, document_id) so warehouse handovers, attendance
    verification and payroll approvals all share one enforced mechanism.
    """

    class Status(models.TextChoices):
        COMPLETE = "complete", "Complete (both signatures)"
        VOID = "void", "Void"

    document_type = models.CharField(max_length=64, db_index=True)
    document_id = models.UUIDField(db_index=True)
    first_role_label = models.CharField(max_length=64, help_text="e.g. Issued By / Prepared By / Controlled By")
    first_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="signoffs_first")
    first_signed_at = models.DateTimeField(auto_now_add=True)
    first_signature_sha256 = models.CharField(max_length=64, blank=True)
    second_role_label = models.CharField(max_length=64, help_text="e.g. Received By / Approved By / Verified By")
    second_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="signoffs_second")
    second_signed_at = models.DateTimeField(auto_now_add=True)
    second_signature_sha256 = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETE)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [
            models.CheckConstraint(condition=~models.Q(first_by=models.F("second_by")),
                                   name="signoff_two_different_users"),
        ]
        indexes = [models.Index(fields=["document_type", "document_id"])]

    def __str__(self):
        return f"SignOff {self.document_type}:{self.document_id} {self.first_by}->{self.second_by}"


class AuditLog(models.Model):
    """Module 23.2 — append-only audit trail with a hash chain (tamper-evident)."""

    id = models.BigAutoField(primary_key=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="audit_entries")
    action = models.CharField(max_length=32, db_index=True, help_text="create|update|transition|signoff|delete|sync")
    model_label = models.CharField(max_length=128, db_index=True)
    object_id = models.CharField(max_length=64, db_index=True)
    station = models.ForeignKey(Station, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_entries")
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    prev_hash = models.CharField(max_length=64, blank=True)
    entry_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["model_label", "object_id"])]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("AuditLog is append-only and cannot be modified")
        last = AuditLog.objects.order_by("-id").first()
        self.prev_hash = last.entry_hash if last else ""
        payload = f"{self.prev_hash}|{self.actor_id}|{self.action}|{self.model_label}|{self.object_id}|{self.after}"
        self.entry_hash = hashlib.sha256(payload.encode()).hexdigest()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditLog is append-only and cannot be deleted")


class DashboardSnapshot(TimeStampedUUIDModel):
    """Module 1 — persisted KPI snapshot (command-center telemetry at a point in time)."""

    station = models.ForeignKey(Station, null=True, blank=True, on_delete=models.CASCADE, related_name="dashboard_snapshots")
    snapshot_date = models.DateField(db_index=True)
    cherry_procured_kg = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    active_fermentation_tanks = models.PositiveIntegerField(default=0)
    drying_bed_occupancy_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    warehouse_stock_kg = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    export_containers_open = models.PositiveIntegerField(default=0)
    cash_float_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    landed_cost_per_kg = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    payload = models.JSONField(default=dict, blank=True, help_text="Full KPI payload for charts")

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.UniqueConstraint(fields=["station", "snapshot_date"], name="uniq_snapshot_station_date")]


class Notification(TimeStampedUUIDModel):
    """Phase 4 (Module 24) — in-app notification centre.

    Created by anomaly/approval/payroll/export services; delivered via
    /api/notifications/ and the frontend bell. user=None means broadcast to
    the station's role holders (resolved at creation time by core.notify).
    """

    class Category(models.TextChoices):
        ANOMALY = "anomaly", "Anomaly alert"
        APPROVAL = "approval", "Approval"
        PAYROLL = "payroll", "Payroll"
        EXPORT = "export", "Export"
        SYSTEM = "system", "System"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    station = models.ForeignKey(Station, null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications")
    category = models.CharField(max_length=16, choices=Category.choices, db_index=True)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.INFO, db_index=True)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=200, blank=True, help_text="Frontend page id, e.g. resources / payroll / export")
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]
