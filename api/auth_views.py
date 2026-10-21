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
