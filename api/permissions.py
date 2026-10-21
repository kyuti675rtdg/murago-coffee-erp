"""RBAC permission matrix (Module 23.1) + station scoping helpers.

Roles from the brief: Machine Operator, Station Supervisor, Industry
Professional, Q-Grader, Dry Mill Manager, Export Officer, Finance
Manager, Purchaser, Admin.  Auth: DRF TokenAuthentication (documented
choice over JWT — single-token field devices, revocable server-side).
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from core.models import UserStationRole

# app_label -> roles allowed to WRITE
WRITE_MATRIX = {
    "farmers": {"admin", "station_supervisor", "purchaser"},
    "collection": {"admin", "station_supervisor", "purchaser"},
    "procurement": {"admin", "station_supervisor", "purchaser", "finance_manager"},
    "processing": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager", "machine_operator"},
    "drymill": {"admin", "dry_mill_manager", "industry_professional"},
    "traceability": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager"},
    "quality": {"admin", "q_grader", "industry_professional"},
    "warehouse": {"admin", "station_supervisor", "industry_professional", "dry_mill_manager"},
    "resources": {"admin", "station_supervisor", "machine_operator", "industry_professional"},
    "hr": {"admin", "station_supervisor", "finance_manager", "machine_operator"},
    "payroll": {"admin", "finance_manager"},
    "buyers": {"admin", "export_officer", "finance_manager"},
    "exports": {"admin", "export_officer"},
    "logistics": {"admin", "export_officer", "station_supervisor"},
    "finance": {"admin", "finance_manager"},
    "payments": {"admin", "finance_manager", "export_officer"},
    "inventory": {"admin", "station_supervisor", "dry_mill_manager"},
    "bi": {"admin", "finance_manager", "station_supervisor"},
    "sync": {"admin", "station_supervisor", "machine_operator"},
    "sysconf": {"admin"},
    "core": {"admin"},
}
# apps whose READS are restricted (financially sensitive)
READ_RESTRICTED = {
    "payroll": {"admin", "finance_manager", "station_supervisor"},
    "finance": {"admin", "finance_manager", "station_supervisor"},
    "payments": {"admin", "finance_manager", "export_officer", "station_supervisor"},
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
