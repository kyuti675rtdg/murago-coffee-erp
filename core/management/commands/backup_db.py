"""Database backup (Phase 4, Module 25 — Backup & Data Management).

Usage: python manage.py backup_db [--out DIR]
- PostgreSQL + pg_dump available: native `pg_dump` .sql.gz (password passed
  via PGPASSWORD env to the child process only, never on the command line).
- Otherwise (SQLite/local, or pg_dump missing): Django dumpdata JSON .gz —
  a complete logical backup restorable with `loaddata`.
Writes backups/murago-backup-<UTC timestamp>.<ext> and prints the path + size.
"""
import gzip
import json
import os
import shutil
import subprocess
import urllib.parse
from datetime import datetime, timezone
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Produce a database backup file under backups/ (or --out DIR)"

    def add_arguments(self, parser):
        parser.add_argument("--out", default=str(settings.BASE_DIR / "backups"))

    def handle(self, *args, **opts):
        out_dir = opts["out"]
        os.makedirs(out_dir, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        db = settings.DATABASES["default"]
        engine = db.get("ENGINE", "")
        url = os.environ.get("DATABASE_URL", "")

        if "postgresql" in engine and url and shutil.which("pg_dump"):
            path = os.path.join(out_dir, f"murago-backup-{stamp}.sql.gz")
            u = urllib.parse.urlparse(url)
            env = dict(os.environ)
            if u.password:
                env["PGPASSWORD"] = urllib.parse.unquote(u.password)
            cmd = ["pg_dump", "-h", u.hostname or "", "-p", str(u.port or 5432),
                   "-U", u.username or "", "-d", u.path.lstrip("/"), "--no-owner"]
            proc = subprocess.run(cmd, capture_output=True, env=env)
            if proc.returncode != 0:
                raise SystemExit(f"pg_dump failed: {proc.stderr.decode()[:400]}")
            with gzip.open(path, "wb") as fh:
                fh.write(proc.stdout)
            kind = "pg_dump SQL"
        else:
            path = os.path.join(out_dir, f"murago-backup-{stamp}.json.gz")
            buf = StringIO()
            call_command("dumpdata", "--natural-foreign", "--natural-primary",
                         exclude=["contenttypes", "auth.permission", "sessions", "authtoken"],
                         stdout=buf)
            data = buf.getvalue()
            json.loads(data)  # prove it is valid, restorable JSON
            with gzip.open(path, "wt", encoding="utf-8") as fh:
                fh.write(data)
            kind = "dumpdata JSON (pg_dump unavailable or non-Postgres DB)"
        size = os.path.getsize(path)
        self.stdout.write(self.style.SUCCESS(f"Backup written: {path} ({size} bytes, {kind})"))
