"""Notification dispatch helpers (Phase 4, Module 24)."""
from .models import Notification, UserStationRole


def notify_user(user, *, category, title, body="", severity="info", station=None, link=""):
    if user is None:
        return None
    return Notification.objects.create(user=user, station=station, category=category,
                                       severity=severity, title=title, body=body, link=link)


def notify_station_roles(station, role_codes, *, category, title, body="", severity="info", link=""):
    """Notify every user holding one of role_codes at the station (or globally),
    plus all superusers. Returns the created notifications."""
    qs = UserStationRole.objects.filter(role__code__in=role_codes)
    if station is not None:
        from django.db.models import Q
        qs = qs.filter(Q(station=station) | Q(station__isnull=True))
    user_ids = set(qs.values_list("user_id", flat=True))
    from django.contrib.auth import get_user_model
    user_ids |= set(get_user_model().objects.filter(is_superuser=True).values_list("id", flat=True))
    out = []
    for uid in user_ids:
        out.append(Notification.objects.create(
            user_id=uid, station=station, category=category, severity=severity,
            title=title, body=body, link=link))
    return out
