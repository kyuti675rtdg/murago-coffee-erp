"""Finite State Machine for coffee lots (brief §2 constraint 1, Module 5.1).

Rules enforced here AND at DB level (CHECK + trigger in sql/phase1_schema.sql):
  * stages advance strictly one step at a time in STAGE_ORDER — no skipping;
  * no backwards transitions; EXPORTING is terminal;
  * every legal transition writes an immutable LotStageEvent with timestamp,
    actor and (when supplied) dual sign-off parties, who must differ;
  * entering PULPING stamps lot.pulping_date, entering DRYING stamps
    lot.laid_date for natural lots, entering WASHING stamps lot.washing_date.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from core.signoff import require_different_users

from .models import STAGE_ORDER, Lot, LotStage, LotStageEvent


class InvalidTransition(Exception):
    """Raised when a lot stage transition violates the FSM."""


def _build_allowed() -> dict[str, list[str]]:
    allowed: dict[str, list[str]] = {}
    for i, stage in enumerate(STAGE_ORDER):
        allowed[stage] = [STAGE_ORDER[i + 1]] if i + 1 < len(STAGE_ORDER) else []
    return allowed


ALLOWED_TRANSITIONS: dict[str, list[str]] = _build_allowed()


def can_transition(from_stage: str, to_stage: str) -> bool:
    return to_stage in ALLOWED_TRANSITIONS.get(from_stage, [])


def next_stage(stage: str) -> str | None:
    nxt = ALLOWED_TRANSITIONS.get(stage, [])
    return nxt[0] if nxt else None


@transaction.atomic
def transition(lot: Lot, to_stage: str, *, actor=None, issued_by=None, received_by=None,
               weight_kg=None, notes: str = "", when=None) -> LotStageEvent:
    """Advance `lot` exactly one FSM step to `to_stage`. Raises InvalidTransition
    on any skip, reversal, unknown stage, or move out of the terminal stage."""
    lot = Lot.objects.select_for_update().get(pk=lot.pk)
    if to_stage not in STAGE_ORDER:
        raise InvalidTransition(f"Unknown lot stage: {to_stage!r}")
    from_stage = lot.current_stage
    if not can_transition(from_stage, to_stage):
        allowed = ALLOWED_TRANSITIONS.get(from_stage, [])
        raise InvalidTransition(
            f"Illegal lot transition {from_stage} -> {to_stage}: stages must advance "
            f"one step at a time; next allowed stage is {allowed[0] if allowed else 'NONE (terminal)'}."
        )
    if issued_by is not None or received_by is not None:
        require_different_users(issued_by, received_by)
    when = when or timezone.now()
    event = LotStageEvent.objects.create(
        lot=lot, from_stage=from_stage, to_stage=to_stage, occurred_at=when,
        actor=actor, issued_by=issued_by, received_by=received_by,
        weight_kg=weight_kg, notes=notes,
    )
    lot.current_stage = to_stage
    if to_stage == LotStage.PULPING and lot.pulping_date is None:
        lot.pulping_date = when
    if to_stage == LotStage.DRYING and lot.process_type == Lot.ProcessType.NATURAL and lot.laid_date is None:
        lot.laid_date = when
    if to_stage == LotStage.WASHING and lot.washing_date is None:
        lot.washing_date = when
    if weight_kg is not None:
        lot.current_weight_kg = weight_kg
    lot.save(update_fields=["current_stage", "pulping_date", "laid_date", "washing_date",
                            "current_weight_kg", "updated_at"])
    return event


def advance(lot: Lot, **kwargs) -> LotStageEvent:
    """Advance to the single next allowed stage (convenience for kanban 'move forward')."""
    nxt = next_stage(lot.current_stage)
    if nxt is None:
        raise InvalidTransition(f"Lot {lot.lot_code} is in terminal stage {lot.current_stage}; no next stage.")
    return transition(lot, nxt, **kwargs)
