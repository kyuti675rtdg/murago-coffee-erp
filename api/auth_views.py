"""Auth endpoints — DRF TokenAuthentication (chosen over JWT: field devices
hold one revocable token; server-side revocation is trivial)."""
from django.contrib.auth import authenticate, get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import UserStationRole
from .permissions import user_role_codes, user_station_ids

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
    created, skipped, deactivated = [], [], []
    for spec in request.data.get("accounts", []):
        username = (spec.get("username") or "").strip()
        role = roles.get(spec.get("role") or "")
        if not username or role is None or not spec.get("password"):
            skipped.append({"username": username, "reason": "missing username/password or unknown role"})
            continue
        if User.objects.filter(username=username).exists():
            skipped.append({"username": username, "reason": "already exists — untouched"})
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
    return Response({"created": created, "skipped": skipped, "deactivated": deactivated})
