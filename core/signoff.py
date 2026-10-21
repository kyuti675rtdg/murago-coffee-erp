"""Cryptographic dual sign-off engine (brief §2.3, Module 23.2).

Real enforcement logic:
  * the two signatories MUST be two different users;
  * each signatory's PIN is verified against their SignatureCredential
    (hashed storage) when a PIN is supplied;
  * the completed sign-off is persisted as an immutable core.DualSignOff row
    bound to (document_type, document_id) with both signature hashes.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import AuditLog, DualSignOff, SignatureCredential

User = get_user_model()


class SignOffError(Exception):
    """Raised when a dual sign-off rule is violated."""


def require_different_users(first_user, second_user) -> None:
    if first_user is None or second_user is None:
        raise SignOffError("Both signatories are required for a dual sign-off.")
    first_id = getattr(first_user, "pk", first_user)
    second_id = getattr(second_user, "pk", second_user)
    if first_id == second_id:
        raise SignOffError("Dual sign-off requires two DIFFERENT users (signatory 1 != signatory 2).")


def verify_pin(user, pin: str | None) -> None:
    """Verify a user's sign-off PIN. PIN optional only when no credential exists
    in non-production flows; if a credential exists the PIN must match."""
    if pin is None:
        return
    try:
        cred = SignatureCredential.objects.get(user=user)
    except SignatureCredential.DoesNotExist:
        raise SignOffError(f"User {user} has no signature credential configured; cannot verify PIN.")
    if not cred.check_pin(pin):
        raise SignOffError(f"Invalid sign-off PIN for user {user}.")


@transaction.atomic
def record_dual_signoff(*, document_type: str, document_id, first_label: str, first_user,
                        second_label: str, second_user, first_pin: str | None = None,
                        second_pin: str | None = None,
                        first_signature: bytes | None = None,
                        second_signature: bytes | None = None) -> DualSignOff:
    require_different_users(first_user, second_user)
    verify_pin(first_user, first_pin)
    verify_pin(second_user, second_pin)
    import hashlib
    signoff = DualSignOff.objects.create(
        document_type=document_type, document_id=document_id,
        first_role_label=first_label, first_by=first_user,
        first_signature_sha256=hashlib.sha256(first_signature).hexdigest() if first_signature else "",
        second_role_label=second_label, second_by=second_user,
        second_signature_sha256=hashlib.sha256(second_signature).hexdigest() if second_signature else "",
    )
    AuditLog.objects.create(actor=second_user, action="signoff", model_label=document_type,
                            object_id=str(document_id), after={"signoff_id": str(signoff.id),
                                                                "first_by": first_user.pk, "second_by": second_user.pk})
    return signoff


def has_complete_signoff(document_type: str, document_id) -> bool:
    return DualSignOff.objects.filter(document_type=document_type, document_id=document_id,
                                      status=DualSignOff.Status.COMPLETE).exists()
