"""RBAC permission matrix (Module 23.1) + station scoping helpers.

Security model (hardened 2026-10-21):
- Default DENY. Every app must appear in READ_MATRIX and WRITE_MATRIX;
  anything unlisted is admin-only in practice (no non-admin role matches).
- Reads are role-gated per module, not just writes: contracts, payroll,
  journals, HR records and system configuration are NOT readable by
  operational roles.
- Sensitive models get per-model overrides (MODEL_OVERRIDES) that narrow
  the app-level rule — e.g. a Site Manager may edit their station profile
  (core app) but can never touch Role / UserStationRole /
  SignatureCredential records, which are admin-only. That closes the
  privilege-escalation path through app-level core writes.
- Station scoping (user_station_ids + queryset filtering in views) is a
  second, independent layer: role decides the MODULE, scope decides the
  ROWS. Create/update payloads are validated against scope in the viewset
  so permissions cannot be bypassed by posting another station's ids.
- Admin = the `admin` role or a Django superuser: full access.

Roles: Machine Operator, Station Supervisor, Industry Professional,
Q-Grader, Dry Mill Manager, Export Officer, Finance Manager, Purchaser,
Admin, plus the site roles — Site Manager, Procurement Officer, Weighing
Clerk, Quality Controller, Warehouse Officer, Field Officer, Finance
Officer.  Auth: DRF TokenAuthentication (single-token field devices,
revocable server-side).
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from core.models import UserStationRole

ALL_ROLES = {
    "machine_operator", "station_supervisor", "industry_professional",
    "q_grader", "dry_mill_manager", "export_officer", "finance_manager",
    "purchaser", "site_manager", "procurement_officer", "weighing_clerk",
    "quality_controller", "warehouse_officer", "field_officer", "finance_officer",
    "hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer", "employee",
}

# app_label -> roles allowed to READ (admin always allowed, handled separately)
READ_MATRIX = {
    "core": ALL_ROLES,  # station directory etc.; sensitive models narrowed by overrides
    "farmers": {"station_supervisor", "purchaser", "site_manager", "procurement_officer",
                "weighing_clerk", "field_officer", "quality_controller",
                "finance_manager", "finance_officer", "export_officer"},
    "collection": {"station_supervisor", "purchaser", "site_manager", "procurement_officer",
                   "weighing_clerk", "field_officer", "quality_controller", "q_grader",
                   "finance_manager", "finance_officer", "warehouse_officer"},
    "procurement": {"station_supervisor", "purchaser", "site_manager",
                    "procurement_officer", "finance_manager", "finance_officer"},
    "processing": {"station_supervisor", "industry_professional", "dry_mill_manager",
                   "machine_operator", "site_manager", "quality_controller",
                   "q_grader", "warehouse_officer"},
    "drymill": {"dry_mill_manager", "industry_professional", "site_manager",
                "export_officer", "warehouse_officer", "quality_controller"},
    "traceability": {"station_supervisor", "industry_professional", "dry_mill_manager",
                     "site_manager", "quality_controller", "q_grader", "export_officer"},
    "quality": {"q_grader", "industry_professional", "quality_controller",
                "site_manager", "station_supervisor", "export_officer", "dry_mill_manager"},
    "warehouse": {"station_supervisor", "industry_professional", "dry_mill_manager",
                  "site_manager", "warehouse_officer", "export_officer"},
    "resources": {"station_supervisor", "machine_operator", "industry_professional",
                  "site_manager", "weighing_clerk", "finance_manager", "finance_officer"},
    "hr": {"station_supervisor", "site_manager", "finance_manager", "finance_officer"},
    "payroll": {"finance_manager", "finance_officer"},
    "buyers": {"export_officer", "finance_manager"},
    "exports": {"export_officer", "finance_manager", "warehouse_officer"},
    "logistics": {"export_officer", "station_supervisor", "site_manager",
                  "warehouse_officer", "dry_mill_manager"},
    "finance": {"finance_manager", "finance_officer"},
    "payments": {"finance_manager", "finance_officer", "procurement_officer",
                 "site_manager", "station_supervisor", "export_officer"},
    "inventory": {"station_supervisor", "dry_mill_manager", "site_manager",
                  "warehouse_officer", "industry_professional", "finance_manager"},
    "bi": {"finance_manager", "station_supervisor", "site_manager",
           "finance_officer", "export_officer"},
    "sync": {"station_supervisor", "site_manager"},
    "sysconf": ALL_ROLES,  # reference data (grades/units/tanks/benchmarks); thresholds admin-only via override
    "hrm": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
            "finance_manager", "finance_officer", "station_supervisor", "site_manager", "employee"},
}

# app_label -> roles allowed to WRITE
WRITE_MATRIX = {
    "farmers": {"station_supervisor", "purchaser", "site_manager",
                "procurement_officer", "field_officer"},
    "collection": {"station_supervisor", "purchaser", "site_manager",
                   "procurement_officer", "weighing_clerk", "field_officer"},
    "procurement": {"station_supervisor", "purchaser", "finance_manager", "site_manager",
                    "procurement_officer", "finance_officer"},
    "processing": {"station_supervisor", "industry_professional", "dry_mill_manager",
                   "machine_operator", "site_manager"},
    "drymill": {"dry_mill_manager", "industry_professional", "site_manager"},
    "traceability": {"station_supervisor", "industry_professional", "dry_mill_manager",
                     "site_manager", "quality_controller"},
    "quality": {"q_grader", "industry_professional", "quality_controller", "site_manager"},
    "warehouse": {"station_supervisor", "industry_professional", "dry_mill_manager",
                  "site_manager", "warehouse_officer"},
    "resources": {"station_supervisor", "machine_operator", "industry_professional",
                  "site_manager", "weighing_clerk"},
    "hr": {"station_supervisor", "finance_manager", "site_manager"},
    "payroll": {"finance_manager"},
    "buyers": {"export_officer", "finance_manager"},
    "exports": {"export_officer"},
    "logistics": {"export_officer", "station_supervisor", "site_manager", "warehouse_officer"},
    "finance": {"finance_manager"},
    "payments": {"finance_manager", "finance_officer"},
    "inventory": {"station_supervisor", "dry_mill_manager", "site_manager", "warehouse_officer"},
    "bi": {"finance_manager", "station_supervisor", "site_manager", "finance_officer"},
    "sync": {"station_supervisor", "machine_operator", "site_manager",
             "weighing_clerk", "field_officer"},
    "sysconf": set(),  # admin only
    "hrm": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
            "finance_manager"},
    "core": {"site_manager"},  # station profile/equipment/cameras; identity models admin-only below
}

# (app_label, model_name) -> {"read": set, "write": set} — narrows the app rule.
# "read": ALL_ROLES means any authenticated role holder (reference data).
MODEL_OVERRIDES = {
    # Identity & access-control records: ADMIN ONLY (privilege-escalation guard)
    ("core", "role"): {"read": set(), "write": set()},
    ("core", "userstationrole"): {"read": set(), "write": set()},
    ("core", "signaturecredential"): {"read": set(), "write": set()},
    ("core", "organization"): {"read": set(), "write": set()},
    ("core", "auditlog"): {"read": set(), "write": set()},
    ("core", "dualsignoff"): {
        "read": {"finance_manager", "finance_officer", "site_manager", "station_supervisor"},
        "write": set()},
    # Bonus money rules are finance-owned for WRITES; reads follow the
    # farmers module (every farmer-facing role sees the scheme it works under)
    ("farmers", "bonusscheme"): {
        "read": {"station_supervisor", "purchaser", "site_manager", "procurement_officer",
                 "weighing_clerk", "field_officer", "quality_controller",
                 "finance_manager", "finance_officer", "export_officer"},
        "write": {"finance_manager"}},
    ("farmers", "bonustier"): {
        "read": {"station_supervisor", "purchaser", "site_manager", "procurement_officer",
                 "weighing_clerk", "field_officer", "quality_controller",
                 "finance_manager", "finance_officer", "export_officer"},
        "write": {"finance_manager"}},
    # Alert thresholds are configuration, not reference data
    ("sysconf", "thresholdconfig"): {"read": set(), "write": set()},
    # BI report definitions are finance/admin; generated reports stay generatable by managers
    ("bi", "reportdefinition"): {"read": {"finance_manager", "finance_officer"}, "write": {"finance_manager"}},
    # Sync conflict resolution is a supervisor/admin task
    ("sync", "syncconflict"): {
        "read": {"station_supervisor", "site_manager"}, "write": set()},
    # HRM payroll/salary records are NOT readable by the `employee` role:
    # an employee sees only their own record via /hr-employees/me/ and
    # their own payslip is delivered outside this API surface. Payroll
    # runs/lines and salary structures stay HR + finance + site management.
    ("hrm", "hrpayrollrun"): {
        "read": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
                 "finance_manager", "finance_officer", "station_supervisor", "site_manager"}},
    ("hrm", "hrpayrollline"): {
        "read": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
                 "finance_manager", "finance_officer", "station_supervisor", "site_manager"}},
    ("hrm", "payslip"): {
        "read": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
                 "finance_manager", "finance_officer", "station_supervisor", "site_manager"}},
    ("hrm", "salarystructure"): {
        "read": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
                 "finance_manager", "finance_officer", "station_supervisor", "site_manager"}},
    ("hrm", "benefit"): {
        "read": {"hr_administrator", "recruitment_officer", "hr_manager", "payroll_officer",
                 "finance_manager", "finance_officer", "station_supervisor", "site_manager"}},
}


def user_role_codes(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return {"admin"}
    return set(UserStationRole.objects.filter(user=user).values_list("role__code", flat=True))


def user_station_ids(user):
    """Station ids the user is scoped to; None means all stations (admin / global role)."""
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser or "admin" in user_role_codes(user):
        return None
    rows = list(UserStationRole.objects.filter(user=user).values_list("station_id", flat=True))
    if any(r is None for r in rows):
        return None
    return set(rows)


def is_admin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or "admin" in user_role_codes(user)))


def default_grants_for(role_code):
    """Effective app grants from the built-in matrices: {app: [actions]}.

    These are the factory defaults. An admin can replace a role's grants
    from the Roles & Permissions settings page; the saved map is stored on
    the Role row (``permissions``) and then takes precedence.
    """
    grants = {}
    for app, roles_ in READ_MATRIX.items():
        if role_code in roles_:
            grants.setdefault(app, []).append("read")
    for app, roles_ in WRITE_MATRIX.items():
        if role_code in roles_:
            grants.setdefault(app, [])
            if "write" not in grants[app]:
                grants[app].append("write")
    return grants


def role_grants(role):
    """A role's grants: the admin-saved map when present, else the defaults.
    (Seed-era codename lists in `permissions` are display metadata, not a
    grant map — only a dict counts.)"""
    perms = getattr(role, "permissions", None)
    if isinstance(perms, dict) and perms:
        return {app: list(actions) for app, actions in perms.items()}
    return default_grants_for(role.code)


def _user_grants(user):
    """Merged (read_apps, write_apps) across the user's roles, request-cached."""
    cached = getattr(user, "_grants_cache", None)
    if cached is not None:
        return cached
    reads, writes = set(), set()
    for usr in UserStationRole.objects.filter(user=user).select_related("role"):
        for app, actions in role_grants(usr.role).items():
            if "read" in actions:
                reads.add(app)
            if "write" in actions:
                writes.add(app)
    user._grants_cache = (reads, writes)
    return reads, writes


def _allowed(user, model, write):
    """Single source of truth: may `user` read (write=False) or write this model?

    Order: admin → per-model overrides (identity records stay admin-only no
    matter what the editable grant map says) → the role's grant map.
    """
    if not user or not user.is_authenticated:
        return False
    roles = user_role_codes(user)
    if "admin" in roles:
        return True
    app = model._meta.app_label
    override = MODEL_OVERRIDES.get((app, model._meta.model_name), {})
    kind = "write" if write else "read"
    if kind in override:
        return bool(roles & override[kind])
    reads, writes = _user_grants(user)
    return app in (writes if write else reads)


def can_read(user, model):
    return _allowed(user, model, write=False)


def can_write(user, model):
    return _allowed(user, model, write=True)


class RolePermission(BasePermission):
    message = "Your role does not permit this operation on this resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        model = getattr(view, "model", None)
        if model is None:
            return True
        return _allowed(request.user, model, write=request.method not in SAFE_METHODS)
