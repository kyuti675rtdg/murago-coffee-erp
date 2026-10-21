"""Seed the Site Monitoring camera wall: 8 demo cameras across the three
sites (Murago washing station, Bensa Daye washing station, Addis Ababa
warehouse & dry mill). Idempotent: cameras are keyed by name per station.
All feeds are DEMO (clearly labelled in the UI) until real NVR/HLS stream
URLs are registered on a camera record."""
from django.core.management.base import BaseCommand

from core.models import SiteCamera, Station

CAMERAS = [
    # station code, name, area, sort order
    ("MUR", "CAM 01 — Reception & Weighbridge", "Cherry reception, scale house and farmer queue", 1),
    ("MUR", "CAM 02 — Pulping Floor", "Eco-pulper line and cherry hopper", 2),
    ("MUR", "CAM 03 — Fermentation Tanks", "Fermentation tanks and washing channels", 3),
    ("MUR", "CAM 04 — Drying Beds", "Raised drying beds and parchment turning", 4),
    ("BEN", "CAM 05 — Bensa Reception", "Bensa Daye cherry reception and sorting", 5),
    ("BEN", "CAM 06 — Bensa Drying Beds", "Bensa Daye drying beds and store entrance", 6),
    ("ADD", "CAM 07 — Warehouse & Bagging", "Addis Ababa warehouse, bagging and stacking", 7),
    ("ADD", "CAM 08 — Dispatch Gate", "Container loading bay and dispatch gate", 8),
]


class Command(BaseCommand):
    help = "Seed 8 demo site-monitoring cameras (idempotent)."

    def handle(self, *args, **options):
        created = 0
        for code, name, area, order in CAMERAS:
            station = Station.objects.filter(code=code).first()
            if not station:
                continue
            _, was_created = SiteCamera.objects.get_or_create(
                station=station, name=name,
                defaults={"area": area, "stream_type": "demo", "status": "demo",
                          "sort_order": order, "is_active": True})
            created += int(was_created)
        self.stdout.write(self.style.SUCCESS(
            f"Site cameras seeded: {created} new · total {SiteCamera.objects.count()}"))
