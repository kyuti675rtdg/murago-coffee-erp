#!/usr/bin/env python
"""Ensure the logical `murago` database exists on the shared Postgres instance.

Render free tier allows ONE free Postgres per workspace (verified 2026-10-21:
'cannot have more than one active free tier database'), so Murago follows the
Orbit pattern: a logical database `murago` on the shared hms-db instance.
Connects with MURAGO_BASE_DATABASE_URL (the instance's default DB) and
CREATEs DATABASE murago if missing. Runs on the Render service at start,
where the internal connection string is reachable. Idempotent.
"""
import os
import sys

TARGET_DB = os.environ.get("MURAGO_DB_NAME", "murago")


def main() -> int:
    base = os.environ.get("MURAGO_BASE_DATABASE_URL", "").strip()
    if not base:
        print("ensure_db: MURAGO_BASE_DATABASE_URL not set — skipping (single-DB setup).")
        return 0
    import psycopg
    from psycopg import sql
    with psycopg.connect(base, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TARGET_DB,))
            if cur.fetchone():
                print(f"ensure_db: database '{TARGET_DB}' already exists.")
                return 0
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(TARGET_DB)))
            print(f"ensure_db: created database '{TARGET_DB}'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
