"""Stock reconciliation workflow (Phase 4 P0, Module 19.2).

Rules: every adjustment line with a non-zero variance must carry an approver
who is NOT the person who conducted the audit; reconciling posts an
ADJUSTMENT StockMovement per item line (counted - book) so the ledger agrees
with the physical count, then the audit moves to APPROVED (reconciled).
Coffee-lot lines (no item) are variance-reported but do not post movements.
"""
from django.db import transaction
from django.utils import timezone

from .models import StockAdjustment, StockAudit, StockMovement


class ReconcileError(Exception):
    pass


@transaction.atomic
def reconcile_audit(audit: StockAudit, *, reconciled_by) -> dict:
    if audit.status == StockAudit.Status.APPROVED:
        raise ReconcileError(f"Audit {audit.audit_number} is already reconciled (approved).")
    lines = list(StockAdjustment.objects.filter(audit=audit).select_related("item"))
    if not lines:
        raise ReconcileError("Audit has no adjustment lines to reconcile.")
    problems = []
    for line in lines:
        if line.variance != 0:
            if not line.approved_by_id:
                problems.append(f"line {line.id}: variance {line.variance} has no approver")
            elif audit.conducted_by_id and line.approved_by_id == audit.conducted_by_id:
                problems.append(f"line {line.id}: approver must differ from the audit conductor")
            if not line.variance_reason:
                problems.append(f"line {line.id}: variance {line.variance} has no variance_reason")
    if problems:
        raise ReconcileError("Reconciliation blocked: " + "; ".join(problems))
    movements = 0
    total_variance = 0
    for line in lines:
        total_variance += line.variance
        if line.item_id and line.variance != 0:
            StockMovement.objects.create(
                item=line.item, station=audit.station, movement_type=StockMovement.MovementType.ADJUSTMENT,
                delta_qty=line.variance, movement_date=audit.audit_date,
                reference=f"AUDIT-{audit.audit_number}", issued_to=reconciled_by)
            movements += 1
    audit.status = StockAudit.Status.APPROVED
    audit.save(update_fields=["status", "updated_at"])
    return {"audit": audit.audit_number, "lines": len(lines), "movements_posted": movements,
            "total_variance": str(total_variance), "status": audit.status}
