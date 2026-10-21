"""RBAC permission matrix (Module 23.1) + station scoping helpers.

Roles from the brief: Machine Operator, Station Supervisor, Industry
Professional, Q-Grader, Dry Mill Manager, Export Officer, Finance
Manager, Purchaser, Admin.  Auth: DRF TokenAuthentication (documented
choice over JWT — single-token field devices, revocable server-side).
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from core.models import UserStationRole

# app_label -> roles allowed to WRITE
# Site roles (2026-10-21): site_manager runs a whole site; procurement_officer
# buys; weighing_clerk weighs/records intakes; quality_controller owns the lab;
# warehouse_officer owns stores/stock; field_officer owns farmer field data;
# finance_officer is the site-level finance hand (payments + vouchers).
WRITE_MATRIX = {
    "farmers": {"admin", "station_supervisor", "purchaser", "site_manager", "procurement_officer", "field_officer"},
    "collection": {"admin", "station_supervisor", "purchaser", "site_manager", "procurement_officer", "weighing_clerk", "field_officer"},
    "procurement": {"admin", "station_supervisor", "purchaser", "finance_manager", "site_manager", "procurement_officer", "finance_officer"},
    "processing": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager", "machine_operator", "site_manager"},
    "drymill": {"admin", "dry_mill_manager", "industry_professional", "site_manager"},
    "traceability": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager", "site_manager", "quality_controller"},
    "quality": {"admin", "q_grader", "industry_professional", "quality_controller", "site_manager"},
    "warehouse": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager", "site_manager", "warehouse_officer"},
    "resources": {"admin", "station_supervisor", "machine_operator", "industry_professional", "site_manager", "weighing_clerk"},
    "hr": {"admin", "station_supervisor", "finance_manager", "machine_operator", "site_manager"},
    "payroll": {"admin", "finance_manager"},
    "buyers": {"admin", "export_officer", "finance_manager", "site_manager"},
    "exports": {"admin", "export_officer", "site_manager"},
    "logistics": {"admin", "export_officer", "station_supervisor", "site_manager", "warehouse_officer"},
    "finance": {"admin", "finance_manager"},
    "payments": {"admin", "finance_manager", "export_officer", "finance_officer"},
    "inventory": {"admin", "station_supervisor", "dry_mill_manager", "site_manager", "warehouse_officer"},
    "bi": {"admin", "finance_manager", "station_supervisor", "site_manager", "finance_officer"},
    "sync": {"admin", "station_supervisor", "machine_operator", "site_manager", "weighing_clerk", "field_officer"},
    "sysconf": {"admin"},
    "core": {"admin", "site_manager"},
}
# apps whose READS are restricted (financially sensitive)
READ_RESTRICTED = {
    "payroll": {"admin", "finance_manager", "station_supervisor", "site_manager", "finance_officer"},
    "finance": {"admin", "finance_manager", "station_supervisor", "site_manager", "finance_officer"},
    "payments": {"admin", "finance_manager", "export_officer", "station_supervisor", "site_manager", "finance_officer", "procurement_officer"},
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

class RolePermission(BasePermission):
    message = "Your role does not permit this operation on this resource."
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        model = getattr(view, "model", None)
        if model is None:
            return True
        app = model._meta.app_label
        roles = user_role_codes(request.user)
        if "admin" in roles:
            return True
        if request.method in SAFE_METHODS:
            allowed = READ_RESTRICTED.get(app)
            return True if allowed is None else bool(roles & allowed)
        allowed = WRITE_MATRIX.get(app, {"admin"})
        return bool(roles & allowed)
