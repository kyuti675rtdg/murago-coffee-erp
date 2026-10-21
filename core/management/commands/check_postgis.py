"""Verify PostGIS on the configured database: SELECT postgis_version()."""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Run SELECT postgis_version() and CREATE EXTENSION check"

    def handle(self, *args, **opts):
        with connection.cursor() as cur:
            cur.execute("SELECT version()")
            self.stdout.write(f"server: {cur.fetchone()[0]}")
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
                cur.execute("SELECT postgis_version()")
                self.stdout.write(self.style.SUCCESS(f"postgis_version(): {cur.fetchone()[0]}"))
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"PostGIS NOT available: {exc}"))
                raise SystemExit(1)
            # Geometry smoke test
            cur.execute("SELECT ST_AsText(ST_GeomFromText('POINT(38.4167 6.6)', 4326))")
            self.stdout.write(f"geometry smoke: {cur.fetchone()[0]}")
