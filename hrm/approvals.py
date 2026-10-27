"""Generic approval helpers for HRM workflows.

record_approval() writes one ApprovalRecord per approval action (the audit
trail); require_not_creator() enforces separation of duties — the person
who created/requested/prepared a record may not approve it.
"""
from django.utils import timezone

from api.permissions import user_role_codes
from .models import ApprovalRecord


class ApprovalError(Exception):
    pass


def record_approval(workflow_type, obj, *, actor, decision, comment="", step_order=1,
                    role_code=None, object_type=None):
    """Persist an ApprovalRecord for `obj` (any model with a UUID PK)."""
    if role_code is None:
        roles = sorted(user_role_codes(actor)) if actor is not None else []
        role_code = roles[0] if roles else ""
    return ApprovalRecord.objects.create(
        workflow_type=workflow_type,
        object_type=object_type or f"{obj._meta.app_label}.{obj._meta.model_name}",
        object_id=obj.pk,
        step_order=step_order,
        role_code=role_code,
        actor=actor,
        decision=decision,
        comment=comment or "",
        decided_at=timezone.now(),
    )


def require_not_creator(obj, actor, creator_attr="created_by"):
    """Raise ApprovalError when `actor` is the record's creator/requester."""
    if actor is None:
        raise ApprovalError("An approver is required.")
    creator = getattr(obj, creator_attr, None)
    creator_id = getattr(creator, "pk", creator)
    if creator_id is not None and creator_id == actor.pk:
        raise ApprovalError("Self-approval is not allowed: the creator/requester cannot approve this record.")
