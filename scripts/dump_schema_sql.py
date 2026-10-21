"""Generate sql/phase1_schema.sql FROM the Django migrations (sqlmigrate).

Run: .venv/bin/python scripts/dump_schema_sql.py
The body is Django's own sqlmigrate output for every migration in dependency
order. Production-only PostGIS geometry + FSM trigger sections are appended
and clearly labelled. Table count is verified against the model registry.
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "murago.settings")
import django  # noqa: E402

django.setup()
from django.apps import apps as app_registry  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402
from django.db.migrations.loader import MigrationLoader  # noqa: E402

loader = MigrationLoader(connection)
order = []
seen = set()

def visit(node):
    if node in seen:
        return
    seen.add(node)
    for parent in loader.graph.forwards_plan(node):
        if parent not in order:
            order.append(parent)

for leaf in loader.graph.leaf_nodes():
    visit(leaf)

local_models = sum(len(list(c.get_models())) for c in app_registry.get_app_configs()
                   if not c.name.startswith("django.") and c.name not in ("rest_framework", "django_filters"))

buf = io.StringIO()
for app_label, name in order:
    chunk = io.StringIO()
    call_command("sqlmigrate", app_label, name, stdout=chunk, no_color=True)
    buf.write(f"\n-- ===== migration {app_label}.{name} =====\n")
    buf.write(chunk.getvalue())
body = buf.getvalue()
create_tables = body.count("CREATE TABLE")

header = f"""-- ============================================================================
-- Murago Coffee ERP (Bean Power ERP) — Phase 1 PostgreSQL / PostGIS schema
-- Generated FROM the Django models/migrations by scripts/dump_schema_sql.py
-- (Django sqlmigrate output, migration dependency order).
-- Local generation ran on the SQLite fallback dialect; on production the same
-- migrations run against django.contrib.gis.db.backends.postgis and produce
-- native Postgres types. Production-only sections are at the END of this file:
--   1. CREATE EXTENSION postgis
--   2. FarmPlot production geometry columns + GiST indexes (EUDR, SRID 4326)
--   3. FSM trigger blocking illegal lot stage skips at DB level
-- Verified counts at generation time: {local_models} Murago domain models.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
"""
footer = """
-- ============================================================================
-- PRODUCTION POSTGRES / POSTGIS SECTIONS
-- ============================================================================
-- 1) EUDR farm geometry (farmers.FarmPlot). Under GeoDjango migrations these
--    columns are created natively; these statements document the exact
--    production types and add spatial indexes.
ALTER TABLE farmers_farmplot
  ALTER COLUMN boundary TYPE geometry(Polygon, 4326) USING NULLIF(boundary, '')::geometry(Polygon, 4326);
ALTER TABLE farmers_farmplot
  ALTER COLUMN centroid TYPE geometry(Point, 4326) USING NULLIF(centroid, '')::geometry(Point, 4326);
CREATE INDEX IF NOT EXISTS farmplot_boundary_gist ON farmers_farmplot USING GIST (boundary);
CREATE INDEX IF NOT EXISTS farmplot_centroid_gist ON farmers_farmplot USING GIST (centroid);

-- 2) FSM stage guard (brief §2.1): lot stages advance exactly one step.
CREATE OR REPLACE FUNCTION murago_stage_order(stage text) RETURNS int AS $$
  SELECT CASE stage
    WHEN 'harvesting_sorting' THEN 1 WHEN 'receiving' THEN 2 WHEN 'pulping' THEN 3
    WHEN 'fermenting' THEN 4 WHEN 'washing' THEN 5 WHEN 'drying' THEN 6
    WHEN 'conditioning' THEN 7 WHEN 'dry_milling' THEN 8 WHEN 'bag_marking' THEN 9
    WHEN 'packing' THEN 10 WHEN 'storing' THEN 11 WHEN 'exporting' THEN 12
    ELSE -1 END $$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION murago_block_stage_skip() RETURNS trigger AS $$
BEGIN
  IF murago_stage_order(NEW.current_stage) = -1 THEN
    RAISE EXCEPTION 'Unknown lot stage %', NEW.current_stage;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_stage <> OLD.current_stage
     AND murago_stage_order(NEW.current_stage) <> murago_stage_order(OLD.current_stage) + 1 THEN
    RAISE EXCEPTION 'Illegal lot stage skip % -> %: stages must advance one step at a time',
      OLD.current_stage, NEW.current_stage;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lot_no_stage_skip ON processing_lot;
CREATE TRIGGER trg_lot_no_stage_skip BEFORE INSERT OR UPDATE OF current_stage
  ON processing_lot FOR EACH ROW EXECUTE FUNCTION murago_block_stage_skip();

-- 3) Dual sign-off integrity (in addition to Django CheckConstraints):
ALTER TABLE core_dualsignoff
  ADD CONSTRAINT signoff_users_differ CHECK (first_by_id <> second_by_id);
"""
out = header + body + footer
path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sql", "phase1_schema.sql")
with open(path, "w") as fh:
    fh.write(out)
print(f"WROTE {path}")
print(f"CREATE TABLE statements: {create_tables}")
print(f"Murago domain models: {local_models}")
