"""Directed Acyclic Graph traceability engine (brief §2 constraint 2, Module 7/8).

split_lot(): one parent -> N children; child weights must sum to <= parent
weight and every edge stores ratio = child_weight / parent_weight (ratios of a
full split sum to exactly 1.0 within tolerance).
blend_lots(): N parents -> one child; one edge per parent with its ratio.
Cycle prevention: before any edge is written, a reachability walk proves the
child cannot already reach the parent (which would close a cycle).
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from processing.models import Lot

from .models import LotLineageEdge

RATIO_TOLERANCE = Decimal("0.0001")


class DAGError(Exception):
    """Raised on lineage violations (bad weights/ratios, cycles, over-draw)."""


def _descendants(lot_id) -> set:
    """All lots reachable downstream from lot_id (children, grandchildren, ...)."""
    seen: set = set()
    frontier = [lot_id]
    while frontier:
        current = frontier.pop()
        for child_id in LotLineageEdge.objects.filter(parent_lot_id=current).values_list("child_lot_id", flat=True):
            if child_id not in seen:
                seen.add(child_id)
                frontier.append(child_id)
    return seen


def _ancestors(lot_id) -> set:
    seen: set = set()
    frontier = [lot_id]
    while frontier:
        current = frontier.pop()
        for parent_id in LotLineageEdge.objects.filter(child_lot_id=current).values_list("parent_lot_id", flat=True):
            if parent_id not in seen:
                seen.add(parent_id)
                frontier.append(parent_id)
    return seen


def would_create_cycle(parent_lot: Lot, child_lot: Lot) -> bool:
    """Adding parent->child creates a cycle iff child can already reach parent."""
    if parent_lot.pk == child_lot.pk:
        return True
    return parent_lot.pk in _descendants(child_lot.pk)


def assert_no_cycle(parent_lot: Lot, child_lot: Lot) -> None:
    if would_create_cycle(parent_lot, child_lot):
        raise DAGError(
            f"Lineage edge {parent_lot.lot_code} -> {child_lot.lot_code} would create a cycle; "
            "lot lineage must remain a DAG."
        )


def _ratio(part: Decimal, whole: Decimal) -> Decimal:
    if not whole or whole <= 0:
        raise DAGError("Parent lot weight must be positive to compute a lineage ratio.")
    return (Decimal(part) / Decimal(whole)).quantize(Decimal("0.0001"))


@transaction.atomic
def split_lot(parent: Lot, splits: list[tuple[Lot, Decimal]], *, actor=None, when=None) -> list[LotLineageEdge]:
    """Split `parent` into [(child_lot, weight_kg), ...]. Weights must be > 0 and
    sum to <= the parent's current weight; a full split's ratios sum to ~1.0."""
    when = when or timezone.now()
    parent_weight = Decimal(parent.current_weight_kg or 0)
    if parent_weight <= 0:
        raise DAGError(f"Cannot split lot {parent.lot_code}: current weight is {parent_weight} kg.")
    total = sum((Decimal(w) for _, w in splits), Decimal("0"))
    if total <= 0:
        raise DAGError("Split weights must total more than 0 kg.")
    if total > parent_weight:
        raise DAGError(f"Split total {total} kg exceeds parent weight {parent_weight} kg (over-draw).")
    edges = []
    for child, weight in splits:
        weight = Decimal(weight)
        if weight <= 0:
            raise DAGError("Each split child weight must be positive.")
        assert_no_cycle(parent, child)
        edges.append(LotLineageEdge.objects.create(
            parent_lot=parent, child_lot=child, edge_type=LotLineageEdge.EdgeType.SPLIT,
            weight_kg=weight, ratio=_ratio(weight, parent_weight), occurred_at=when, performed_by=actor,
        ))
        child.current_weight_kg = weight
        child.save(update_fields=["current_weight_kg", "updated_at"])
    ratio_sum = sum((e.ratio for e in edges), Decimal("0"))
    if total == parent_weight and abs(ratio_sum - Decimal("1")) > RATIO_TOLERANCE:
        raise DAGError(f"Full-split ratios must sum to 1.0, got {ratio_sum}.")
    return edges


@transaction.atomic
def blend_lots(contributions: list[tuple[Lot, Decimal]], child: Lot, *, actor=None, when=None) -> list[LotLineageEdge]:
    """Blend [(parent_lot, weight_kg), ...] into `child`. Each contribution must
    not exceed its parent's current weight; ratios are per-parent."""
    when = when or timezone.now()
    if not contributions:
        raise DAGError("A blend needs at least one parent contribution.")
    total = Decimal("0")
    edges = []
    for parent, weight in contributions:
        weight = Decimal(weight)
        if weight <= 0:
            raise DAGError("Each blend contribution must be positive.")
        parent_weight = Decimal(parent.current_weight_kg or 0)
        if weight > parent_weight:
            raise DAGError(f"Blend contribution {weight} kg exceeds parent {parent.lot_code} weight {parent_weight} kg.")
        assert_no_cycle(parent, child)
        edges.append(LotLineageEdge.objects.create(
            parent_lot=parent, child_lot=child, edge_type=LotLineageEdge.EdgeType.BLEND,
            weight_kg=weight, ratio=_ratio(weight, parent_weight), occurred_at=when, performed_by=actor,
        ))
        total += weight
    child.current_weight_kg = total
    child.save(update_fields=["current_weight_kg", "updated_at"])
    return edges


def trace_back(lot: Lot) -> set:
    """All origin ancestors of a lot (farm-side lineage)."""
    return _ancestors(lot.pk)


def trace_forward(lot: Lot) -> set:
    """All descendants of a lot (towards export)."""
    return _descendants(lot.pk)
