"""Amount-based approval hierarchy for purchase vouchers (Phase 4 P1).

Levels (ETB):  <= 50,000        Station Supervisor
               <= 500,000       Finance Manager
               >  500,000       Admin
Admins/superusers may approve any level. The approver may not be the user
who created the voucher (separation of duties).
"""
from decimal import Decimal

from core.models import UserStationRole

from .models import PurchaseVoucher

LEVELS = [(Decimal("50000"), "station_supervisor"),
          (Decimal("500000"), "finance_manager"),
          (None, "admin")]


class ApprovalError(Exception):
    pass


def required_role(amount) -> str:
    amount = Decimal(amount or 0)
    for cap, role in LEVELS:
        if cap is None or amount <= cap:
            return role
    return "admin"


def user_roles(user) -> set:
    if user is None:
        return set()
    if user.is_superuser:
        return {"admin"}
    return set(UserStationRole.objects.filter(user=user).values_list("role__code", flat=True))


def approve_voucher(voucher: PurchaseVoucher, *, approved_by, when=None) -> PurchaseVoucher:
    from django.utils import timezone
    if voucher.status not in (PurchaseVoucher.Status.DRAFT, PurchaseVoucher.Status.PENDING):
        raise ApprovalError(f"Voucher {voucher.voucher_number} is {voucher.status} and cannot be approved.")
    need = required_role(voucher.total_amount)
    roles = user_roles(approved_by)
    if "admin" not in roles and need not in roles:
        raise ApprovalError(
            f"Voucher of {voucher.total_amount} ETB requires a {need} approver "
            f"(amount-based hierarchy); approver roles: {sorted(roles) or 'none'}.")
    if voucher.created_by_id and voucher.created_by_id == approved_by.id:
        raise ApprovalError("Separation of duties: the voucher creator cannot approve it.")
    voucher.status = PurchaseVoucher.Status.APPROVED
    voucher.approved_by = approved_by
    voucher.approved_at = when or timezone.now()
    voucher.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    return voucher


def reject_voucher(voucher: PurchaseVoucher, *, rejected_by) -> PurchaseVoucher:
    if voucher.status in (PurchaseVoucher.Status.APPROVED, PurchaseVoucher.Status.PAID):
        raise ApprovalError(f"Voucher {voucher.voucher_number} is {voucher.status} and cannot be rejected.")
    voucher.status = PurchaseVoucher.Status.REJECTED
    voucher.approved_by = rejected_by
    voucher.save(update_fields=["status", "approved_by", "updated_at"])
    return voucher
