"""Module 17 — Finance & Accounting: multi-currency GL, journals, AR/AP, lot costing."""
from decimal import Decimal

from django.db import models

from core.base import TimeStampedUUIDModel


class Account(TimeStampedUUIDModel):
    """Sub-Module 17.1 — Chart of Accounts."""

    class AccountType(models.TextChoices):
        ASSET = "asset", "Asset"
        LIABILITY = "liability", "Liability"
        EQUITY = "equity", "Equity"
        REVENUE = "revenue", "Revenue"
        EXPENSE = "expense", "Expense"

    code = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=16, choices=AccountType.choices, db_index=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    currency = models.CharField(max_length=3, default="ETB", help_text="ETB / USD / EUR")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} {self.name}"


class JournalEntry(TimeStampedUUIDModel):
    """Sub-Module 17.1 — double-entry journal header (must balance per currency)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Posted"
        VOID = "void", "Void"

    entry_number = models.CharField(max_length=40, unique=True)
    entry_date = models.DateField(db_index=True)
    station = models.ForeignKey("core.Station", null=True, blank=True, on_delete=models.PROTECT, related_name="journal_entries")
    description = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)

    def totals_by_currency(self) -> dict:
        totals: dict[str, dict[str, Decimal]] = {}
        for line in self.lines.all():
            bucket = totals.setdefault(line.currency, {"debit": Decimal("0"), "credit": Decimal("0")})
            bucket["debit"] += line.debit or Decimal("0")
            bucket["credit"] += line.credit or Decimal("0")
        return totals

    def is_balanced(self) -> bool:
        return all(t["debit"] == t["credit"] and t["debit"] > 0 for t in self.totals_by_currency().values()) \
            and self.lines.exists()

    def save(self, *args, **kwargs):
        # Phase 4 P0: double-entry balance enforced at MODEL level — an entry
        # may only be saved as POSTED when debits == credits per currency.
        if self.status == self.Status.POSTED and self.pk is not None and not self.is_balanced():
            from django.core.exceptions import ValidationError
            totals = {c: (str(t["debit"]), str(t["credit"])) for c, t in self.totals_by_currency().items()}
            raise ValidationError(
                f"Journal {self.entry_number} cannot be POSTED: debits != credits per currency {totals}.")
        super().save(*args, **kwargs)


class JournalLine(TimeStampedUUIDModel):
    """One debit/credit line of a journal entry (multi-currency)."""

    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines")
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="ETB")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    lot = models.ForeignKey("processing.Lot", null=True, blank=True, on_delete=models.SET_NULL, related_name="journal_lines")
    memo = models.CharField(max_length=300, blank=True)

    class Meta(TimeStampedUUIDModel.Meta):
        constraints = [models.CheckConstraint(
            condition=(models.Q(debit__gt=0, credit=0) | models.Q(credit__gt=0, debit=0)),
            name="journal_line_one_side_only")]


class ReceivablePayable(TimeStampedUUIDModel):
    """Sub-Module 17.1 — AR/AP ledger items (export invoices, supplier bills)."""

    class Kind(models.TextChoices):
        AR = "ar", "Accounts Receivable"
        AP = "ap", "Accounts Payable"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PARTIAL = "partial", "Partially settled"
        SETTLED = "settled", "Settled"
        OVERDUE = "overdue", "Overdue"

    kind = models.CharField(max_length=4, choices=Kind.choices, db_index=True)
    reference = models.CharField(max_length=64, unique=True, help_text="Invoice / bill number")
    buyer = models.ForeignKey("buyers.Buyer", null=True, blank=True, on_delete=models.PROTECT, related_name="receivables")
    supplier = models.ForeignKey("procurement.Supplier", null=True, blank=True, on_delete=models.PROTECT, related_name="payables")
    contract = models.ForeignKey("buyers.SalesContract", null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger_items")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    amount_settled = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="ETB")
    issued_on = models.DateField(db_index=True)
    due_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True)

    @property
    def balance(self) -> Decimal:
        return self.amount - self.amount_settled


class LotCostAllocation(TimeStampedUUIDModel):
    """Sub-Module 17.2 — Activity-Based Lot Costing (landed cost per Lot ID)."""

    class CostComponent(models.TextChoices):
        CHERRY_PURCHASE = "cherry_purchase", "Cherry purchase"
        LABOUR = "labour", "Seasonal labour payroll"
        FUEL = "fuel", "Generator / pulper fuel"
        WATER = "water", "Water usage"
        TRANSPORT = "transport", "Transport"
        MILLING = "milling", "Dry milling fee"
        PACKING = "packing", "Packing materials"
        OTHER = "other", "Other"

    lot = models.ForeignKey("processing.Lot", on_delete=models.CASCADE, related_name="cost_allocations")
    component = models.CharField(max_length=24, choices=CostComponent.choices, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="ETB")
    allocated_on = models.DateField(db_index=True)
    source_reference = models.CharField(max_length=120, blank=True, help_text="Voucher / payroll / waybill reference")
    journal_line = models.ForeignKey(JournalLine, null=True, blank=True, on_delete=models.SET_NULL, related_name="cost_allocations")

    class Meta(TimeStampedUUIDModel.Meta):
        indexes = [models.Index(fields=["lot", "component"])]


def lot_landed_cost_per_kg(lot) -> Decimal | None:
    """Sub-Module 17.2 — exact landed cost per kg for a lot (None if no green weight)."""
    from django.db.models import Sum
    total = LotCostAllocation.objects.filter(lot=lot).aggregate(s=Sum("amount"))["s"] or Decimal("0")
    weight = lot.green_kg or lot.current_weight_kg or Decimal("0")
    if not weight:
        return None
    return (total / Decimal(weight)).quantize(Decimal("0.0001"))
