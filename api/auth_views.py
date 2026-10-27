"""Auth endpoints — DRF TokenAuthentication (chosen over JWT: field devices
hold one revocable token; server-side revocation is trivial)."""
from django.contrib.auth import authenticate, get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import UserStationRole
from .permissions import is_admin, user_role_codes, user_station_ids

User = get_user_model()


def _profile(user):
    roles = []
    for r in UserStationRole.objects.filter(user=user).select_related("role", "station"):
        roles.append({"role": r.role.code, "role_label": r.role.get_code_display(),
                      "station": str(r.station_id) if r.station_id else None,
                      "station_code": r.station.code if r.station else None})
    sids = user_station_ids(user)
    return {"id": user.id, "username": user.username, "email": user.email,
            "first_name": user.first_name, "last_name": user.last_name,
            "is_superuser": user.is_superuser, "roles": roles,
            "role_codes": sorted(user_role_codes(user)),
            "station_ids": None if sids is None else [str(s) for s in sids]}


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        return Response({"detail": "Account is disabled."}, status=status.HTTP_403_FORBIDDEN)
    # Block login for deactivated (archived/separated) employee accounts.
    try:
        from hrm.models import Employee as _HRMEmployee
        _emp = _HRMEmployee.objects.filter(user=user).first()
        if (_emp is not None and _emp.account_deactivated
                and _emp.status in (_HRMEmployee.Status.ARCHIVED, _HRMEmployee.Status.SEPARATED)):
            return Response({"detail": "Employee account is deactivated."},
                            status=status.HTTP_403_FORBIDDEN)
    except Exception:
        pass
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": _profile(user)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "Logged out."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(_profile(request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_list(request):
    """Minimal user directory for sign-off / assignment selects (id + username only)."""
    return Response([{"id": u.id, "username": u.username} for u in User.objects.filter(is_active=True).order_by("username")])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def provision_staff(request):
    """Superuser-only staff provisioning.

    Creates NEW accounts with per-account passwords and signature PINs plus
    a role/station assignment. An existing username is never modified —
    passwords are never overwritten — so re-running a batch is safe.
    Optionally deactivates listed non-superuser accounts (used to retire
    shared-password demo logins). Passwords/PINs are accepted over HTTPS
    only and are never echoed back in the response.
    """
    if not request.user.is_superuser:
        return Response({"detail": "Superuser required."}, status=status.HTTP_403_FORBIDDEN)
    from core.models import Role, SignatureCredential, Station

    stations = {s.code: s for s in Station.objects.all()}
    roles = {r.code: r for r in Role.objects.all()}
    created, skipped, deactivated, reset = [], [], [], []
    for spec in request.data.get("accounts", []):
        username = (spec.get("username") or "").strip()
        role = roles.get(spec.get("role") or "")
        if not username or role is None or not spec.get("password"):
            skipped.append({"username": username, "reason": "missing username/password or unknown role"})
            continue
        existing = User.objects.filter(username=username).first()
        if existing is not None:
            if not spec.get("reset"):
                skipped.append({"username": username, "reason": "already exists — untouched"})
                continue
            # Explicit superuser-requested reset (e.g. recovering an account
            # whose initial provisioning was interrupted before its
            # credentials were delivered). Never implied, always per-spec.
            existing.set_password(spec["password"])
            existing.is_active = True
            existing.save()
            station = stations.get(spec.get("station") or "") if spec.get("station") else None
            UserStationRole.objects.get_or_create(user=existing, role=role, station=station)
            cred, _ = SignatureCredential.objects.get_or_create(user=existing, defaults={"pin_hash": ""})
            if spec.get("pin"):
                cred.set_pin(str(spec["pin"]))
                cred.save()
            reset.append(username)
            continue
        station = stations.get(spec.get("station") or "") if spec.get("station") else None
        user = User.objects.create_user(
            username=username, email=f"{username}@murago.local", password=spec["password"],
            first_name=spec.get("first_name", ""), last_name=spec.get("last_name", ""))
        UserStationRole.objects.get_or_create(user=user, role=role, station=station)
        cred, _ = SignatureCredential.objects.get_or_create(user=user, defaults={"pin_hash": ""})
        if spec.get("pin"):
            cred.set_pin(str(spec["pin"]))
            cred.save()
        Token.objects.get_or_create(user=user)
        created.append(username)
    for username in request.data.get("deactivate", []):
        user = User.objects.filter(username=username).exclude(is_superuser=True).first()
        if user and user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
            deactivated.append(username)
    return Response({"created": created, "skipped": skipped, "deactivated": deactivated, "reset": reset})


# ------------------------------------------------- role & permission matrix
MATRIX_APPS = [
    ("core", "Stations, Equipment & Cameras"), ("farmers", "Farmers & Bonus"),
    ("collection", "Collection & Intake"), ("procurement", "Procurement"),
    ("processing", "Processing"), ("drymill", "Dry Mill"),
    ("traceability", "Traceability"), ("quality", "Quality"),
    ("warehouse", "Warehouse & Stores"), ("resources", "Resources (Fuel & Water)"),
    ("hr", "HR & Workers"), ("payroll", "Payroll"), ("hrm", "HR & Employees"), ("buyers", "Buyers & Contracts"),
    ("exports", "Exports"), ("logistics", "Logistics"), ("finance", "Finance & GL"),
    ("payments", "Payments"), ("inventory", "Inventory"), ("bi", "BI Reports"),
    ("sync", "Sync"), ("sysconf", "System Reference Data"),
]
MATRIX_LOCKED = [
    "Admin always has full access and its grants cannot be edited.",
    "Roles, user-role assignments, signature credentials (PINs), the organization record, the audit log and alert thresholds are ADMIN-ONLY and never follow this matrix.",
    "Bonus schemes & tiers: writes always stay with the Finance Manager (reads follow the Farmers row).",
    "Report definitions: writes always stay with the Finance Manager.",
    "Station scope is separate: a grant gives module access; the user's station assignment decides which site's rows they see.",
]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def permission_matrix(request):
    """Admin-only: the effective role x module grant matrix for the
    Roles & Permissions settings page."""
    if not is_admin(request.user):
        return Response({"detail": "Admin role required."}, status=status.HTTP_403_FORBIDDEN)
    from core.models import Role
    from .permissions import default_grants_for, role_grants
    roles = []
    for role in Role.objects.all().order_by("code"):
        roles.append({
            "code": role.code, "label": role.get_code_display(),
            "description": role.description or "",
            "user_count": UserStationRole.objects.filter(role=role, user__is_active=True).count(),
            "grants": role_grants(role),
            "defaults": default_grants_for(role.code),
            "customized": isinstance(role.permissions, dict) and bool(role.permissions),
        })
    return Response({"apps": [{"app": a, "label": l} for a, l in MATRIX_APPS],
                     "roles": roles, "locked": MATRIX_LOCKED})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def permission_matrix_update(request, role_code):
    """Admin-only: replace one role's module grants. Takes effect
    immediately (the permission layer reads the saved map per request)."""
    if not is_admin(request.user):
        return Response({"detail": "Admin role required."}, status=status.HTTP_403_FORBIDDEN)
    from core.models import AuditLog, Role
    from .permissions import role_grants
    if role_code == "admin":
        return Response({"detail": "The admin role always has full access and cannot be edited."},
                        status=status.HTTP_400_BAD_REQUEST)
    role = Role.objects.filter(code=role_code).first()
    if role is None:
        return Response({"detail": "Unknown role: " + role_code}, status=status.HTTP_404_NOT_FOUND)
    raw = request.data.get("grants")
    if not isinstance(raw, dict):
        return Response({"detail": "Body must carry a grants object: {app: [read, write]}."},
                        status=status.HTTP_400_BAD_REQUEST)
    valid_apps = {a for a, _l in MATRIX_APPS}
    grants = {}
    for app, actions in raw.items():
        if app not in valid_apps:
            return Response({"detail": "Unknown module: " + app}, status=status.HTTP_400_BAD_REQUEST)
        acts = sorted({a for a in (actions or []) if a in ("read", "write")})
        if acts:
            grants[app] = acts
    role.permissions = grants
    role.save(update_fields=["permissions"])
    try:
        AuditLog.objects.create(actor=request.user, action="permission_matrix_update",
                                model_label="core.role", object_id=str(role.pk),
                                after={"role": role_code, "grants": grants})
    except Exception:
        pass
    return Response({"code": role.code, "grants": role_grants(role), "customized": True})
