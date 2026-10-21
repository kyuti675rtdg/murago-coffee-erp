"""Module 21 — Mobile Field Application: offline sync queue + conflicts.

Every field record carries a client-generated UUIDv7 (see core.ids) so records
created with zero connectivity sort and dedupe deterministically on sync.
"""
from django.conf import settings
from django.db import models

from core.base import TimeStampedUUIDModel
from core.ids import uuid7


class SyncQueueItem(TimeStampedUUIDModel):
    """Sub-Module 21.2 — one offline-captured record awaiting / completing sync."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending upload"
        SYNCED = "synced", "Synced"
        CONFLICT = "conflict", "Conflict"
        REJECTED = "rejected", "Rejected"

    client_uuid = models.UUIDField(default=uuid7, unique=True, db_index=True,
                                   help_text="UUIDv7 generated on the device at capture time")
    device_id = models.CharField(max_length=64, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="sync_items")
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.SET_NULL, related_name="sync_items")
    entity_type = models.CharField(max_length=64, db_index=True,
                                   help_text="e.g. farmers.Farmer, collection.CherryIntake, resources.FuelRegisterEntry")
    entity_uuid = models.UUIDField(null=True, blank=True, db_index=True)
    payload = models.JSONField(default=dict)
    client_created_at = models.DateTimeField(db_index=True, help_text="Capture time on device (UUIDv7-ordered)")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    server_received_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["device_id", "status"]), models.Index(fields=["entity_type", "entity_uuid"])]


class SyncConflict(TimeStampedUUIDModel):
    """Sub-Module 21.2 — visual conflict-resolution record for the sync manager."""

    class Resolution(models.TextChoices):
        UNRESOLVED = "unresolved", "Unresolved"
        KEPT_CLIENT = "kept_client", "Kept client version"
        KEPT_SERVER = "kept_server", "Kept server version"
        MERGED = "merged", "Merged manually"

    queue_item = models.ForeignKey(SyncQueueItem, on_delete=models.CASCADE, related_name="conflicts")
    field_name = models.CharField(max_length=120)
    client_value = models.JSONField(default=dict, blank=True)
    server_value = models.JSONField(default=dict, blank=True)
    resolution = models.CharField(max_length=16, choices=Resolution.choices, default=Resolution.UNRESOLVED, db_index=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="sync_conflicts_resolved")
    resolved_at = models.DateTimeField(null=True, blank=True)
