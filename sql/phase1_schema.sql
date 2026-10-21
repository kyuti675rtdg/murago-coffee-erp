-- ============================================================================
-- Murago Coffee ERP (Bean Power ERP) — Phase 1 PostgreSQL / PostGIS schema
-- Generated FROM the Django models/migrations by scripts/dump_schema_sql.py
-- (Django sqlmigrate output, migration dependency order).
-- Local generation ran on the SQLite fallback dialect; on production the same
-- migrations run against django.contrib.gis.db.backends.postgis and produce
-- native Postgres types. Production-only sections are at the END of this file:
--   1. CREATE EXTENSION postgis
--   2. FarmPlot production geometry columns + GiST indexes (EUDR, SRID 4326)
--   3. FSM trigger blocking illegal lot stage skips at DB level
-- Verified counts: 85 Murago domain tables == 85 domain models, plus 9 Django
-- built-in tables (auth/contenttypes/session/admin) = 94 real tables.
-- "new__*" CREATE TABLE lines are SQLite table-rebuild artefacts emitted by
-- sqlmigrate for constraint-adding migrations; they are not extra tables.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== migration contenttypes.0001_initial =====
BEGIN;
--
-- Create model ContentType
--
CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(100) NOT NULL, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);
--
-- Alter unique_together for contenttype (1 constraint(s))
--
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");
COMMIT;

-- ===== migration auth.0001_initial =====
BEGIN;
--
-- Create model Permission
--
CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(50) NOT NULL, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL);
--
-- Create model Group
--
CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(80) NOT NULL UNIQUE);
CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model User
--
CREATE TABLE "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NOT NULL, "is_superuser" bool NOT NULL, "username" varchar(30) NOT NULL UNIQUE, "first_name" varchar(30) NOT NULL, "last_name" varchar(30) NOT NULL, "email" varchar(75) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
CREATE TABLE "auth_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE "auth_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");
CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");
CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions" ("group_id", "permission_id");
CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions" ("group_id");
CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions" ("permission_id");
CREATE UNIQUE INDEX "auth_user_groups_user_id_group_id_94350c0c_uniq" ON "auth_user_groups" ("user_id", "group_id");
CREATE INDEX "auth_user_groups_user_id_6a12ed8b" ON "auth_user_groups" ("user_id");
CREATE INDEX "auth_user_groups_group_id_97559544" ON "auth_user_groups" ("group_id");
CREATE UNIQUE INDEX "auth_user_user_permissions_user_id_permission_id_14a6b632_uniq" ON "auth_user_user_permissions" ("user_id", "permission_id");
CREATE INDEX "auth_user_user_permissions_user_id_a95ead1b" ON "auth_user_user_permissions" ("user_id");
CREATE INDEX "auth_user_user_permissions_permission_id_1fbb5f2c" ON "auth_user_user_permissions" ("permission_id");
COMMIT;

-- ===== migration admin.0001_initial =====
BEGIN;
--
-- Create model LogEntry
--
CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "action_time" datetime NOT NULL, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");
CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");
COMMIT;

-- ===== migration admin.0002_logentry_remove_auto_add =====
BEGIN;
--
-- Alter field action_time on logentry
--
CREATE TABLE "new__django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "action_time" datetime NOT NULL, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
INSERT INTO "new__django_admin_log" ("id", "object_id", "object_repr", "action_flag", "change_message", "content_type_id", "user_id", "action_time") SELECT "id", "object_id", "object_repr", "action_flag", "change_message", "content_type_id", "user_id", "action_time" FROM "django_admin_log";
DROP TABLE "django_admin_log";
ALTER TABLE "new__django_admin_log" RENAME TO "django_admin_log";
CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");
CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");
COMMIT;

-- ===== migration admin.0003_logentry_add_action_flag_choices =====
BEGIN;
--
-- Alter field action_flag on logentry
--
-- (no-op)
COMMIT;

-- ===== migration contenttypes.0002_remove_content_type_name =====
BEGIN;
--
-- Change Meta options on contenttype
--
-- (no-op)
--
-- Alter field name on contenttype
--
CREATE TABLE "new__django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(100) NULL, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);
INSERT INTO "new__django_content_type" ("id", "app_label", "model", "name") SELECT "id", "app_label", "model", "name" FROM "django_content_type";
DROP TABLE "django_content_type";
ALTER TABLE "new__django_content_type" RENAME TO "django_content_type";
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");
--
-- Raw Python operation
--
-- THIS OPERATION CANNOT BE WRITTEN AS SQL
--
-- Remove field name from contenttype
--
ALTER TABLE "django_content_type" DROP COLUMN "name";
COMMIT;

-- ===== migration auth.0002_alter_permission_name_max_length =====
BEGIN;
--
-- Alter field name on permission
--
CREATE TABLE "new__auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(255) NOT NULL, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL);
INSERT INTO "new__auth_permission" ("id", "content_type_id", "codename", "name") SELECT "id", "content_type_id", "codename", "name" FROM "auth_permission";
DROP TABLE "auth_permission";
ALTER TABLE "new__auth_permission" RENAME TO "auth_permission";
CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");
CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");
COMMIT;

-- ===== migration auth.0003_alter_user_email_max_length =====
BEGIN;
--
-- Alter field email on user
--
CREATE TABLE "new__auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "email" varchar(254) NOT NULL, "password" varchar(128) NOT NULL, "last_login" datetime NOT NULL, "is_superuser" bool NOT NULL, "username" varchar(30) NOT NULL UNIQUE, "first_name" varchar(30) NOT NULL, "last_name" varchar(30) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
INSERT INTO "new__auth_user" ("id", "password", "last_login", "is_superuser", "username", "first_name", "last_name", "is_staff", "is_active", "date_joined", "email") SELECT "id", "password", "last_login", "is_superuser", "username", "first_name", "last_name", "is_staff", "is_active", "date_joined", "email" FROM "auth_user";
DROP TABLE "auth_user";
ALTER TABLE "new__auth_user" RENAME TO "auth_user";
COMMIT;

-- ===== migration auth.0004_alter_user_username_opts =====
BEGIN;
--
-- Alter field username on user
--
-- (no-op)
COMMIT;

-- ===== migration auth.0005_alter_user_last_login_null =====
BEGIN;
--
-- Alter field last_login on user
--
CREATE TABLE "new__auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "last_login" datetime NULL, "password" varchar(128) NOT NULL, "is_superuser" bool NOT NULL, "username" varchar(30) NOT NULL UNIQUE, "first_name" varchar(30) NOT NULL, "last_name" varchar(30) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
INSERT INTO "new__auth_user" ("id", "password", "is_superuser", "username", "first_name", "last_name", "email", "is_staff", "is_active", "date_joined", "last_login") SELECT "id", "password", "is_superuser", "username", "first_name", "last_name", "email", "is_staff", "is_active", "date_joined", "last_login" FROM "auth_user";
DROP TABLE "auth_user";
ALTER TABLE "new__auth_user" RENAME TO "auth_user";
COMMIT;

-- ===== migration auth.0006_require_contenttypes_0002 =====

-- ===== migration auth.0007_alter_validators_add_error_messages =====
BEGIN;
--
-- Alter field username on user
--
-- (no-op)
COMMIT;

-- ===== migration auth.0008_alter_user_username_max_length =====
BEGIN;
--
-- Alter field username on user
--
CREATE TABLE "new__auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "username" varchar(150) NOT NULL UNIQUE, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "first_name" varchar(30) NOT NULL, "last_name" varchar(30) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
INSERT INTO "new__auth_user" ("id", "password", "last_login", "is_superuser", "first_name", "last_name", "email", "is_staff", "is_active", "date_joined", "username") SELECT "id", "password", "last_login", "is_superuser", "first_name", "last_name", "email", "is_staff", "is_active", "date_joined", "username" FROM "auth_user";
DROP TABLE "auth_user";
ALTER TABLE "new__auth_user" RENAME TO "auth_user";
COMMIT;

-- ===== migration auth.0009_alter_user_last_name_max_length =====
BEGIN;
--
-- Alter field last_name on user
--
CREATE TABLE "new__auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "last_name" varchar(150) NOT NULL, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE, "first_name" varchar(30) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
INSERT INTO "new__auth_user" ("id", "password", "last_login", "is_superuser", "username", "first_name", "email", "is_staff", "is_active", "date_joined", "last_name") SELECT "id", "password", "last_login", "is_superuser", "username", "first_name", "email", "is_staff", "is_active", "date_joined", "last_name" FROM "auth_user";
DROP TABLE "auth_user";
ALTER TABLE "new__auth_user" RENAME TO "auth_user";
COMMIT;

-- ===== migration auth.0010_alter_group_name_max_length =====
BEGIN;
--
-- Alter field name on group
--
CREATE TABLE "new__auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);
INSERT INTO "new__auth_group" ("id", "name") SELECT "id", "name" FROM "auth_group";
DROP TABLE "auth_group";
ALTER TABLE "new__auth_group" RENAME TO "auth_group";
COMMIT;

-- ===== migration auth.0011_update_proxy_permissions =====
BEGIN;
--
-- Raw Python operation
--
-- THIS OPERATION CANNOT BE WRITTEN AS SQL
COMMIT;

-- ===== migration auth.0012_alter_user_first_name_max_length =====
BEGIN;
--
-- Alter field first_name on user
--
CREATE TABLE "new__auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "first_name" varchar(150) NOT NULL, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE, "last_name" varchar(150) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL);
INSERT INTO "new__auth_user" ("id", "password", "last_login", "is_superuser", "username", "last_name", "email", "is_staff", "is_active", "date_joined", "first_name") SELECT "id", "password", "last_login", "is_superuser", "username", "last_name", "email", "is_staff", "is_active", "date_joined", "first_name" FROM "auth_user";
DROP TABLE "auth_user";
ALTER TABLE "new__auth_user" RENAME TO "auth_user";
COMMIT;

-- ===== migration core.0001_initial =====
BEGIN;
--
-- Create model Organization
--
CREATE TABLE "core_organization" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "name" varchar(200) NOT NULL, "legal_name" varchar(240) NOT NULL, "tin" varchar(32) NOT NULL, "country" varchar(80) NOT NULL, "base_currency" varchar(3) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Role
--
CREATE TABLE "core_role" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(32) NOT NULL UNIQUE, "description" text NOT NULL, "permissions" text NOT NULL CHECK ((JSON_VALID("permissions") OR "permissions" IS NULL)), "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model SignatureCredential
--
CREATE TABLE "core_signaturecredential" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "pin_hash" varchar(256) NOT NULL, "signature_sha256" varchar(64) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Station
--
CREATE TABLE "core_station" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "station_type" varchar(24) NOT NULL, "region" varchar(120) NOT NULL, "woreda" varchar(120) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "latitude" decimal NULL, "longitude" decimal NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "organization_id" char(32) NOT NULL REFERENCES "core_organization" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model DashboardSnapshot
--
CREATE TABLE "core_dashboardsnapshot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "snapshot_date" date NOT NULL, "cherry_procured_kg" decimal NOT NULL, "active_fermentation_tanks" integer unsigned NOT NULL CHECK ("active_fermentation_tanks" >= 0), "drying_bed_occupancy_pct" decimal NOT NULL, "warehouse_stock_kg" decimal NOT NULL, "export_containers_open" integer unsigned NOT NULL CHECK ("export_containers_open" >= 0), "cash_float_balance" decimal NOT NULL, "landed_cost_per_kg" decimal NOT NULL, "payload" text NOT NULL CHECK ((JSON_VALID("payload") OR "payload" IS NULL)), "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model AuditLog
--
CREATE TABLE "core_auditlog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "occurred_at" datetime NOT NULL, "action" varchar(32) NOT NULL, "model_label" varchar(128) NOT NULL, "object_id" varchar(64) NOT NULL, "before" text NOT NULL CHECK ((JSON_VALID("before") OR "before" IS NULL)), "after" text NOT NULL CHECK ((JSON_VALID("after") OR "after" IS NULL)), "prev_hash" varchar(64) NOT NULL, "entry_hash" varchar(64) NOT NULL, "actor_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model UserStationRole
--
CREATE TABLE "core_userstationrole" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "role_id" char(32) NOT NULL REFERENCES "core_role" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model DualSignOff
--
CREATE TABLE "core_dualsignoff" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "document_type" varchar(64) NOT NULL, "document_id" char(32) NOT NULL, "first_role_label" varchar(64) NOT NULL, "first_signed_at" datetime NOT NULL, "first_signature_sha256" varchar(64) NOT NULL, "second_role_label" varchar(64) NOT NULL, "second_signed_at" datetime NOT NULL, "second_signature_sha256" varchar(64) NOT NULL, "status" varchar(16) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "first_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "second_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "signoff_two_different_users" CHECK (NOT ("first_by_id" = ("second_by_id"))));
--
-- Create index core_statio_station_25e096_idx on field(s) station_type, is_active of model station
--
CREATE INDEX "core_statio_station_25e096_idx" ON "core_station" ("station_type", "is_active");
--
-- Create constraint uniq_snapshot_station_date on model dashboardsnapshot
--
CREATE TABLE "new__core_dashboardsnapshot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "snapshot_date" date NOT NULL, "cherry_procured_kg" decimal NOT NULL, "active_fermentation_tanks" integer unsigned NOT NULL CHECK ("active_fermentation_tanks" >= 0), "drying_bed_occupancy_pct" decimal NOT NULL, "warehouse_stock_kg" decimal NOT NULL, "export_containers_open" integer unsigned NOT NULL CHECK ("export_containers_open" >= 0), "cash_float_balance" decimal NOT NULL, "landed_cost_per_kg" decimal NOT NULL, "payload" text NOT NULL CHECK ((JSON_VALID("payload") OR "payload" IS NULL)), "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_snapshot_station_date" UNIQUE ("station_id", "snapshot_date"));
INSERT INTO "new__core_dashboardsnapshot" ("id", "created_at", "updated_at", "snapshot_date", "cherry_procured_kg", "active_fermentation_tanks", "drying_bed_occupancy_pct", "warehouse_stock_kg", "export_containers_open", "cash_float_balance", "landed_cost_per_kg", "payload", "created_by_id", "updated_by_id", "station_id") SELECT "id", "created_at", "updated_at", "snapshot_date", "cherry_procured_kg", "active_fermentation_tanks", "drying_bed_occupancy_pct", "warehouse_stock_kg", "export_containers_open", "cash_float_balance", "landed_cost_per_kg", "payload", "created_by_id", "updated_by_id", "station_id" FROM "core_dashboardsnapshot";
DROP TABLE "core_dashboardsnapshot";
ALTER TABLE "new__core_dashboardsnapshot" RENAME TO "core_dashboardsnapshot";
CREATE INDEX "core_organization_created_at_aafbde52" ON "core_organization" ("created_at");
CREATE INDEX "core_organization_created_by_id_4f8c844e" ON "core_organization" ("created_by_id");
CREATE INDEX "core_organization_updated_by_id_2462c0ed" ON "core_organization" ("updated_by_id");
CREATE INDEX "core_role_created_at_de707bba" ON "core_role" ("created_at");
CREATE INDEX "core_role_created_by_id_80a3a9cb" ON "core_role" ("created_by_id");
CREATE INDEX "core_role_updated_by_id_f7ae2737" ON "core_role" ("updated_by_id");
CREATE INDEX "core_signaturecredential_created_at_104d2f40" ON "core_signaturecredential" ("created_at");
CREATE INDEX "core_signaturecredential_created_by_id_04f86219" ON "core_signaturecredential" ("created_by_id");
CREATE INDEX "core_signaturecredential_updated_by_id_1446556c" ON "core_signaturecredential" ("updated_by_id");
CREATE INDEX "core_station_created_at_951ced35" ON "core_station" ("created_at");
CREATE INDEX "core_station_station_type_b8b35f11" ON "core_station" ("station_type");
CREATE INDEX "core_station_created_by_id_1db3785f" ON "core_station" ("created_by_id");
CREATE INDEX "core_station_organization_id_d758dce3" ON "core_station" ("organization_id");
CREATE INDEX "core_station_updated_by_id_c584bf15" ON "core_station" ("updated_by_id");
CREATE INDEX "core_auditlog_occurred_at_5ebe71ef" ON "core_auditlog" ("occurred_at");
CREATE INDEX "core_auditlog_action_978477aa" ON "core_auditlog" ("action");
CREATE INDEX "core_auditlog_model_label_c4abfffa" ON "core_auditlog" ("model_label");
CREATE INDEX "core_auditlog_object_id_0c320e9b" ON "core_auditlog" ("object_id");
CREATE INDEX "core_auditlog_actor_id_ab091f3c" ON "core_auditlog" ("actor_id");
CREATE INDEX "core_auditlog_station_id_3fdd4d83" ON "core_auditlog" ("station_id");
CREATE INDEX "core_userstationrole_created_at_6742763a" ON "core_userstationrole" ("created_at");
CREATE INDEX "core_userstationrole_created_by_id_16a60d6b" ON "core_userstationrole" ("created_by_id");
CREATE INDEX "core_userstationrole_role_id_85c643ac" ON "core_userstationrole" ("role_id");
CREATE INDEX "core_userstationrole_station_id_6a71f061" ON "core_userstationrole" ("station_id");
CREATE INDEX "core_userstationrole_updated_by_id_b5d407a7" ON "core_userstationrole" ("updated_by_id");
CREATE INDEX "core_userstationrole_user_id_7e7f9494" ON "core_userstationrole" ("user_id");
CREATE INDEX "core_dualsignoff_created_at_b0a05aa4" ON "core_dualsignoff" ("created_at");
CREATE INDEX "core_dualsignoff_document_type_749b7991" ON "core_dualsignoff" ("document_type");
CREATE INDEX "core_dualsignoff_document_id_055a95e2" ON "core_dualsignoff" ("document_id");
CREATE INDEX "core_dualsignoff_created_by_id_759e8776" ON "core_dualsignoff" ("created_by_id");
CREATE INDEX "core_dualsignoff_first_by_id_acec123b" ON "core_dualsignoff" ("first_by_id");
CREATE INDEX "core_dualsignoff_second_by_id_9f3993f0" ON "core_dualsignoff" ("second_by_id");
CREATE INDEX "core_dualsignoff_updated_by_id_328260a8" ON "core_dualsignoff" ("updated_by_id");
CREATE INDEX "core_dualsi_documen_156570_idx" ON "core_dualsignoff" ("document_type", "document_id");
CREATE INDEX "core_dashboardsnapshot_created_at_0f9144c1" ON "core_dashboardsnapshot" ("created_at");
CREATE INDEX "core_dashboardsnapshot_snapshot_date_9714c3b2" ON "core_dashboardsnapshot" ("snapshot_date");
CREATE INDEX "core_dashboardsnapshot_created_by_id_da2c177e" ON "core_dashboardsnapshot" ("created_by_id");
CREATE INDEX "core_dashboardsnapshot_updated_by_id_393916a4" ON "core_dashboardsnapshot" ("updated_by_id");
CREATE INDEX "core_dashboardsnapshot_station_id_64d41a8a" ON "core_dashboardsnapshot" ("station_id");
--
-- Create index core_auditl_model_l_bd2fc4_idx on field(s) model_label, object_id of model auditlog
--
CREATE INDEX "core_auditl_model_l_bd2fc4_idx" ON "core_auditlog" ("model_label", "object_id");
--
-- Create index core_userst_user_id_4e9ffe_idx on field(s) user, station of model userstationrole
--
CREATE INDEX "core_userst_user_id_4e9ffe_idx" ON "core_userstationrole" ("user_id", "station_id");
--
-- Create constraint uniq_user_role_station on model userstationrole
--
CREATE TABLE "new__core_userstationrole" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "role_id" char(32) NOT NULL REFERENCES "core_role" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_user_role_station" UNIQUE ("user_id", "role_id", "station_id"));
INSERT INTO "new__core_userstationrole" ("id", "created_at", "updated_at", "created_by_id", "role_id", "station_id", "updated_by_id", "user_id") SELECT "id", "created_at", "updated_at", "created_by_id", "role_id", "station_id", "updated_by_id", "user_id" FROM "core_userstationrole";
DROP TABLE "core_userstationrole";
ALTER TABLE "new__core_userstationrole" RENAME TO "core_userstationrole";
CREATE INDEX "core_userstationrole_created_at_6742763a" ON "core_userstationrole" ("created_at");
CREATE INDEX "core_userstationrole_created_by_id_16a60d6b" ON "core_userstationrole" ("created_by_id");
CREATE INDEX "core_userstationrole_role_id_85c643ac" ON "core_userstationrole" ("role_id");
CREATE INDEX "core_userstationrole_station_id_6a71f061" ON "core_userstationrole" ("station_id");
CREATE INDEX "core_userstationrole_updated_by_id_b5d407a7" ON "core_userstationrole" ("updated_by_id");
CREATE INDEX "core_userstationrole_user_id_7e7f9494" ON "core_userstationrole" ("user_id");
CREATE INDEX "core_userst_user_id_4e9ffe_idx" ON "core_userstationrole" ("user_id", "station_id");
COMMIT;

-- ===== migration bi.0001_initial =====
BEGIN;
--
-- Create model ReportDefinition
--
CREATE TABLE "bi_reportdefinition" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(48) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "kind" varchar(16) NOT NULL, "query_spec" text NOT NULL CHECK ((JSON_VALID("query_spec") OR "query_spec" IS NULL)), "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model GeneratedReport
--
CREATE TABLE "bi_generatedreport" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "period_start" date NULL, "period_end" date NULL, "fmt" varchar(8) NOT NULL, "file_path" varchar(500) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "generated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "definition_id" char(32) NOT NULL REFERENCES "bi_reportdefinition" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "bi_reportdefinition_created_at_777f7d43" ON "bi_reportdefinition" ("created_at");
CREATE INDEX "bi_reportdefinition_kind_4030a950" ON "bi_reportdefinition" ("kind");
CREATE INDEX "bi_reportdefinition_created_by_id_46e6283b" ON "bi_reportdefinition" ("created_by_id");
CREATE INDEX "bi_reportdefinition_updated_by_id_ac1f8a1c" ON "bi_reportdefinition" ("updated_by_id");
CREATE INDEX "bi_generatedreport_created_at_a1f6c660" ON "bi_generatedreport" ("created_at");
CREATE INDEX "bi_generatedreport_created_by_id_99357235" ON "bi_generatedreport" ("created_by_id");
CREATE INDEX "bi_generatedreport_generated_by_id_a85a9cb1" ON "bi_generatedreport" ("generated_by_id");
CREATE INDEX "bi_generatedreport_station_id_0edcaed4" ON "bi_generatedreport" ("station_id");
CREATE INDEX "bi_generatedreport_updated_by_id_f6cdbc62" ON "bi_generatedreport" ("updated_by_id");
CREATE INDEX "bi_generatedreport_definition_id_ce2ad5ce" ON "bi_generatedreport" ("definition_id");
COMMIT;

-- ===== migration processing.0001_initial =====
BEGIN;
--
-- Create model DryingBed
--
CREATE TABLE "processing_dryingbed" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bed_no" varchar(24) NOT NULL, "capacity_kg" decimal NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Lot
--
CREATE TABLE "processing_lot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "lot_code" varchar(48) NOT NULL UNIQUE, "process_type" varchar(16) NOT NULL, "current_stage" varchar(24) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "variety" varchar(120) NOT NULL, "cherry_kg" decimal NOT NULL, "parchment_kg" decimal NOT NULL, "green_kg" decimal NOT NULL, "current_weight_kg" decimal NOT NULL, "pulping_date" datetime NULL, "laid_date" datetime NULL, "washing_date" datetime NULL, "is_micro_lot" bool NOT NULL, "certification_tags" text NOT NULL CHECK ((JSON_VALID("certification_tags") OR "certification_tags" IS NULL)), "is_closed" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model DryingHandover
--
CREATE TABLE "processing_dryinghandover" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "site_name" varchar(200) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "final_moisture_pct" decimal NOT NULL, "dried_coffee_kg" decimal NOT NULL, "storage_date" date NOT NULL, "bed_id" char(32) NOT NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "received_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model BedAssignment
--
CREATE TABLE "processing_bedassignment" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "laid_at" datetime NOT NULL, "removed_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "bed_id" char(32) NOT NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model LotLabel
--
CREATE TABLE "processing_lotlabel" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "qr_payload" varchar(200) NOT NULL UNIQUE, "net_weight_kg" decimal NOT NULL, "status" varchar(16) NOT NULL, "printed_at" datetime NULL, "bed_id" char(32) NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model LotStageEvent
--
CREATE TABLE "processing_lotstageevent" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "from_stage" varchar(24) NULL, "to_stage" varchar(24) NOT NULL, "occurred_at" datetime NOT NULL, "weight_kg" decimal NULL, "notes" text NOT NULL, "actor_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "received_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model MoistureReading
--
CREATE TABLE "processing_moisturereading" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "reading_date" date NOT NULL, "moisture_pct" decimal NOT NULL, "bed_id" char(32) NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "read_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint uniq_bed_per_station on model dryingbed
--
CREATE TABLE "new__processing_dryingbed" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bed_no" varchar(24) NOT NULL, "capacity_kg" decimal NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_bed_per_station" UNIQUE ("station_id", "bed_no"));
INSERT INTO "new__processing_dryingbed" ("id", "created_at", "updated_at", "bed_no", "capacity_kg", "is_active", "created_by_id", "station_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "bed_no", "capacity_kg", "is_active", "created_by_id", "station_id", "updated_by_id" FROM "processing_dryingbed";
DROP TABLE "processing_dryingbed";
ALTER TABLE "new__processing_dryingbed" RENAME TO "processing_dryingbed";
CREATE INDEX "processing_lot_created_at_15ffc6f6" ON "processing_lot" ("created_at");
CREATE INDEX "processing_lot_process_type_1b02609e" ON "processing_lot" ("process_type");
CREATE INDEX "processing_lot_current_stage_89e239db" ON "processing_lot" ("current_stage");
CREATE INDEX "processing_lot_created_by_id_0a1b795b" ON "processing_lot" ("created_by_id");
CREATE INDEX "processing_lot_station_id_a51e3ed8" ON "processing_lot" ("station_id");
CREATE INDEX "processing_lot_updated_by_id_703cae5e" ON "processing_lot" ("updated_by_id");
CREATE INDEX "processing_dryinghandover_created_at_41d76eed" ON "processing_dryinghandover" ("created_at");
CREATE INDEX "processing_dryinghandover_bed_id_999f3187" ON "processing_dryinghandover" ("bed_id");
CREATE INDEX "processing_dryinghandover_created_by_id_228d6dee" ON "processing_dryinghandover" ("created_by_id");
CREATE INDEX "processing_dryinghandover_issued_by_id_ccefb380" ON "processing_dryinghandover" ("issued_by_id");
CREATE INDEX "processing_dryinghandover_received_by_id_7ab5464a" ON "processing_dryinghandover" ("received_by_id");
CREATE INDEX "processing_dryinghandover_signoff_id_18ebbfa4" ON "processing_dryinghandover" ("signoff_id");
CREATE INDEX "processing_dryinghandover_station_id_3ca8fc18" ON "processing_dryinghandover" ("station_id");
CREATE INDEX "processing_dryinghandover_updated_by_id_6ab714de" ON "processing_dryinghandover" ("updated_by_id");
CREATE INDEX "processing_dryinghandover_lot_id_ec680607" ON "processing_dryinghandover" ("lot_id");
CREATE INDEX "processing_bedassignment_created_at_b017147b" ON "processing_bedassignment" ("created_at");
CREATE INDEX "processing_bedassignment_created_by_id_0833b6b7" ON "processing_bedassignment" ("created_by_id");
CREATE INDEX "processing_bedassignment_updated_by_id_fcad24ce" ON "processing_bedassignment" ("updated_by_id");
CREATE INDEX "processing_bedassignment_bed_id_0fcfeb49" ON "processing_bedassignment" ("bed_id");
CREATE INDEX "processing_bedassignment_lot_id_fbb1d9be" ON "processing_bedassignment" ("lot_id");
CREATE INDEX "processing_lotlabel_created_at_d006e792" ON "processing_lotlabel" ("created_at");
CREATE INDEX "processing_lotlabel_status_011150fb" ON "processing_lotlabel" ("status");
CREATE INDEX "processing_lotlabel_bed_id_9d89216e" ON "processing_lotlabel" ("bed_id");
CREATE INDEX "processing_lotlabel_created_by_id_5e69e64f" ON "processing_lotlabel" ("created_by_id");
CREATE INDEX "processing_lotlabel_lot_id_29c28a48" ON "processing_lotlabel" ("lot_id");
CREATE INDEX "processing_lotlabel_updated_by_id_d64170ca" ON "processing_lotlabel" ("updated_by_id");
CREATE INDEX "processing_lotstageevent_created_at_2ca53fa0" ON "processing_lotstageevent" ("created_at");
CREATE INDEX "processing_lotstageevent_occurred_at_a191113b" ON "processing_lotstageevent" ("occurred_at");
CREATE INDEX "processing_lotstageevent_actor_id_e92b544d" ON "processing_lotstageevent" ("actor_id");
CREATE INDEX "processing_lotstageevent_created_by_id_cb0f5e0b" ON "processing_lotstageevent" ("created_by_id");
CREATE INDEX "processing_lotstageevent_issued_by_id_ecdca024" ON "processing_lotstageevent" ("issued_by_id");
CREATE INDEX "processing_lotstageevent_lot_id_61b25b6b" ON "processing_lotstageevent" ("lot_id");
CREATE INDEX "processing_lotstageevent_received_by_id_c34ddd0f" ON "processing_lotstageevent" ("received_by_id");
CREATE INDEX "processing_lotstageevent_updated_by_id_e1e70f15" ON "processing_lotstageevent" ("updated_by_id");
CREATE INDEX "processing_moisturereading_created_at_1ede6c19" ON "processing_moisturereading" ("created_at");
CREATE INDEX "processing_moisturereading_reading_date_bf1d591d" ON "processing_moisturereading" ("reading_date");
CREATE INDEX "processing_moisturereading_bed_id_b7907864" ON "processing_moisturereading" ("bed_id");
CREATE INDEX "processing_moisturereading_created_by_id_681b298c" ON "processing_moisturereading" ("created_by_id");
CREATE INDEX "processing_moisturereading_lot_id_11235384" ON "processing_moisturereading" ("lot_id");
CREATE INDEX "processing_moisturereading_read_by_id_5cb27c0a" ON "processing_moisturereading" ("read_by_id");
CREATE INDEX "processing_moisturereading_updated_by_id_ed0c2e99" ON "processing_moisturereading" ("updated_by_id");
CREATE INDEX "processing_dryingbed_created_at_53ec08dc" ON "processing_dryingbed" ("created_at");
CREATE INDEX "processing_dryingbed_created_by_id_0be3e668" ON "processing_dryingbed" ("created_by_id");
CREATE INDEX "processing_dryingbed_station_id_5551881c" ON "processing_dryingbed" ("station_id");
CREATE INDEX "processing_dryingbed_updated_by_id_1bba6478" ON "processing_dryingbed" ("updated_by_id");
--
-- Create index processing__station_92a102_idx on field(s) station, current_stage of model lot
--
CREATE INDEX "processing__station_92a102_idx" ON "processing_lot" ("station_id", "current_stage");
--
-- Create index processing__station_1a3c23_idx on field(s) station, process_type of model lot
--
CREATE INDEX "processing__station_1a3c23_idx" ON "processing_lot" ("station_id", "process_type");
--
-- Create constraint lot_stage_valid on model lot
--
CREATE TABLE "new__processing_lot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "lot_code" varchar(48) NOT NULL UNIQUE, "process_type" varchar(16) NOT NULL, "current_stage" varchar(24) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "variety" varchar(120) NOT NULL, "cherry_kg" decimal NOT NULL, "parchment_kg" decimal NOT NULL, "green_kg" decimal NOT NULL, "current_weight_kg" decimal NOT NULL, "pulping_date" datetime NULL, "laid_date" datetime NULL, "washing_date" datetime NULL, "is_micro_lot" bool NOT NULL, "certification_tags" text NOT NULL CHECK ((JSON_VALID("certification_tags") OR "certification_tags" IS NULL)), "is_closed" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "lot_stage_valid" CHECK ("current_stage" IN ('harvesting_sorting', 'receiving', 'pulping', 'fermenting', 'washing', 'drying', 'conditioning', 'dry_milling', 'bag_marking', 'packing', 'storing', 'exporting')));
INSERT INTO "new__processing_lot" ("id", "created_at", "updated_at", "lot_code", "process_type", "current_stage", "altitude_m", "variety", "cherry_kg", "parchment_kg", "green_kg", "current_weight_kg", "pulping_date", "laid_date", "washing_date", "is_micro_lot", "certification_tags", "is_closed", "created_by_id", "station_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "lot_code", "process_type", "current_stage", "altitude_m", "variety", "cherry_kg", "parchment_kg", "green_kg", "current_weight_kg", "pulping_date", "laid_date", "washing_date", "is_micro_lot", "certification_tags", "is_closed", "created_by_id", "station_id", "updated_by_id" FROM "processing_lot";
DROP TABLE "processing_lot";
ALTER TABLE "new__processing_lot" RENAME TO "processing_lot";
CREATE INDEX "processing_lot_created_at_15ffc6f6" ON "processing_lot" ("created_at");
CREATE INDEX "processing_lot_process_type_1b02609e" ON "processing_lot" ("process_type");
CREATE INDEX "processing_lot_current_stage_89e239db" ON "processing_lot" ("current_stage");
CREATE INDEX "processing_lot_created_by_id_0a1b795b" ON "processing_lot" ("created_by_id");
CREATE INDEX "processing_lot_station_id_a51e3ed8" ON "processing_lot" ("station_id");
CREATE INDEX "processing_lot_updated_by_id_703cae5e" ON "processing_lot" ("updated_by_id");
CREATE INDEX "processing__station_92a102_idx" ON "processing_lot" ("station_id", "current_stage");
CREATE INDEX "processing__station_1a3c23_idx" ON "processing_lot" ("station_id", "process_type");
--
-- Create constraint handover_two_different_users on model dryinghandover
--
CREATE TABLE "new__processing_dryinghandover" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "site_name" varchar(200) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "final_moisture_pct" decimal NOT NULL, "dried_coffee_kg" decimal NOT NULL, "storage_date" date NOT NULL, "bed_id" char(32) NOT NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "received_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "handover_two_different_users" CHECK (NOT ("issued_by_id" = ("received_by_id"))));
INSERT INTO "new__processing_dryinghandover" ("id", "created_at", "updated_at", "site_name", "altitude_m", "final_moisture_pct", "dried_coffee_kg", "storage_date", "bed_id", "created_by_id", "issued_by_id", "received_by_id", "signoff_id", "station_id", "updated_by_id", "lot_id") SELECT "id", "created_at", "updated_at", "site_name", "altitude_m", "final_moisture_pct", "dried_coffee_kg", "storage_date", "bed_id", "created_by_id", "issued_by_id", "received_by_id", "signoff_id", "station_id", "updated_by_id", "lot_id" FROM "processing_dryinghandover";
DROP TABLE "processing_dryinghandover";
ALTER TABLE "new__processing_dryinghandover" RENAME TO "processing_dryinghandover";
CREATE INDEX "processing_dryinghandover_created_at_41d76eed" ON "processing_dryinghandover" ("created_at");
CREATE INDEX "processing_dryinghandover_bed_id_999f3187" ON "processing_dryinghandover" ("bed_id");
CREATE INDEX "processing_dryinghandover_created_by_id_228d6dee" ON "processing_dryinghandover" ("created_by_id");
CREATE INDEX "processing_dryinghandover_issued_by_id_ccefb380" ON "processing_dryinghandover" ("issued_by_id");
CREATE INDEX "processing_dryinghandover_received_by_id_7ab5464a" ON "processing_dryinghandover" ("received_by_id");
CREATE INDEX "processing_dryinghandover_signoff_id_18ebbfa4" ON "processing_dryinghandover" ("signoff_id");
CREATE INDEX "processing_dryinghandover_station_id_3ca8fc18" ON "processing_dryinghandover" ("station_id");
CREATE INDEX "processing_dryinghandover_updated_by_id_6ab714de" ON "processing_dryinghandover" ("updated_by_id");
CREATE INDEX "processing_dryinghandover_lot_id_ec680607" ON "processing_dryinghandover" ("lot_id");
--
-- Create index processing__bed_id_df550c_idx on field(s) bed, laid_at of model bedassignment
--
CREATE INDEX "processing__bed_id_df550c_idx" ON "processing_bedassignment" ("bed_id", "laid_at");
--
-- Create index processing__lot_id_5f9eec_idx on field(s) lot, occurred_at of model lotstageevent
--
CREATE INDEX "processing__lot_id_5f9eec_idx" ON "processing_lotstageevent" ("lot_id", "occurred_at");
--
-- Create index processing__lot_id_1c0be9_idx on field(s) lot, reading_date of model moisturereading
--
CREATE INDEX "processing__lot_id_1c0be9_idx" ON "processing_moisturereading" ("lot_id", "reading_date");
--
-- Create constraint moisture_pct_range on model moisturereading
--
CREATE TABLE "new__processing_moisturereading" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "reading_date" date NOT NULL, "moisture_pct" decimal NOT NULL, "bed_id" char(32) NULL REFERENCES "processing_dryingbed" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "read_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "moisture_pct_range" CHECK (("moisture_pct" >= '0' AND "moisture_pct" <= '100')));
INSERT INTO "new__processing_moisturereading" ("id", "created_at", "updated_at", "reading_date", "moisture_pct", "bed_id", "created_by_id", "lot_id", "read_by_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "reading_date", "moisture_pct", "bed_id", "created_by_id", "lot_id", "read_by_id", "updated_by_id" FROM "processing_moisturereading";
DROP TABLE "processing_moisturereading";
ALTER TABLE "new__processing_moisturereading" RENAME TO "processing_moisturereading";
CREATE INDEX "processing_moisturereading_created_at_1ede6c19" ON "processing_moisturereading" ("created_at");
CREATE INDEX "processing_moisturereading_reading_date_bf1d591d" ON "processing_moisturereading" ("reading_date");
CREATE INDEX "processing_moisturereading_bed_id_b7907864" ON "processing_moisturereading" ("bed_id");
CREATE INDEX "processing_moisturereading_created_by_id_681b298c" ON "processing_moisturereading" ("created_by_id");
CREATE INDEX "processing_moisturereading_lot_id_11235384" ON "processing_moisturereading" ("lot_id");
CREATE INDEX "processing_moisturereading_read_by_id_5cb27c0a" ON "processing_moisturereading" ("read_by_id");
CREATE INDEX "processing_moisturereading_updated_by_id_ed0c2e99" ON "processing_moisturereading" ("updated_by_id");
CREATE INDEX "processing__lot_id_1c0be9_idx" ON "processing_moisturereading" ("lot_id", "reading_date");
COMMIT;

-- ===== migration buyers.0001_initial =====
BEGIN;
--
-- Create model Buyer
--
CREATE TABLE "buyers_buyer" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "company_name" varchar(240) NOT NULL, "country" varchar(120) NOT NULL, "contact_name" varchar(200) NOT NULL, "email" varchar(254) NOT NULL, "consignee_details" text NOT NULL, "shipping_preferences" text NOT NULL, "preferred_incoterm" varchar(8) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model SalesContract
--
CREATE TABLE "buyers_salescontract" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "contract_number" varchar(48) NOT NULL UNIQUE, "grade" varchar(8) NOT NULL, "quantity_mt" decimal NOT NULL, "quantity_bags" integer unsigned NOT NULL CHECK ("quantity_bags" >= 0), "bag_weight_kg" decimal NOT NULL, "pricing_basis" varchar(16) NOT NULL, "outright_price" decimal NULL, "ice_differential" decimal NULL, "fixed_price" decimal NULL, "fixed_on" date NULL, "incoterm" varchar(8) NOT NULL, "currency" varchar(3) NOT NULL, "shipment_window_start" date NULL, "shipment_window_end" date NULL, "status" varchar(16) NOT NULL, "buyer_id" char(32) NOT NULL REFERENCES "buyers_buyer" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signed_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ContractLotAllocation
--
CREATE TABLE "buyers_contractlotallocation" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "allocated_kg" decimal NOT NULL, "allocated_bags" integer unsigned NOT NULL CHECK ("allocated_bags" >= 0), "is_locked" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "contract_id" char(32) NOT NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model SampleFeedback
--
CREATE TABLE "buyers_samplefeedback" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "sample_code" varchar(64) NOT NULL, "sent_on" date NULL, "status" varchar(16) NOT NULL, "feedback" text NOT NULL, "responded_on" date NULL, "buyer_id" char(32) NOT NULL REFERENCES "buyers_buyer" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create index buyers_sale_buyer_i_7c7786_idx on field(s) buyer, status of model salescontract
--
CREATE INDEX "buyers_sale_buyer_i_7c7786_idx" ON "buyers_salescontract" ("buyer_id", "status");
--
-- Create constraint uniq_contract_lot on model contractlotallocation
--
CREATE TABLE "new__buyers_contractlotallocation" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "allocated_kg" decimal NOT NULL, "allocated_bags" integer unsigned NOT NULL CHECK ("allocated_bags" >= 0), "is_locked" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "contract_id" char(32) NOT NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_contract_lot" UNIQUE ("contract_id", "lot_id"));
INSERT INTO "new__buyers_contractlotallocation" ("id", "created_at", "updated_at", "allocated_kg", "allocated_bags", "is_locked", "created_by_id", "lot_id", "updated_by_id", "contract_id") SELECT "id", "created_at", "updated_at", "allocated_kg", "allocated_bags", "is_locked", "created_by_id", "lot_id", "updated_by_id", "contract_id" FROM "buyers_contractlotallocation";
DROP TABLE "buyers_contractlotallocation";
ALTER TABLE "new__buyers_contractlotallocation" RENAME TO "buyers_contractlotallocation";
CREATE INDEX "buyers_buyer_created_at_51f11250" ON "buyers_buyer" ("created_at");
CREATE INDEX "buyers_buyer_created_by_id_8e8551f4" ON "buyers_buyer" ("created_by_id");
CREATE INDEX "buyers_buyer_updated_by_id_27163a05" ON "buyers_buyer" ("updated_by_id");
CREATE INDEX "buyers_salescontract_created_at_0800b1aa" ON "buyers_salescontract" ("created_at");
CREATE INDEX "buyers_salescontract_status_e9a2603f" ON "buyers_salescontract" ("status");
CREATE INDEX "buyers_salescontract_buyer_id_e16147df" ON "buyers_salescontract" ("buyer_id");
CREATE INDEX "buyers_salescontract_created_by_id_278da21c" ON "buyers_salescontract" ("created_by_id");
CREATE INDEX "buyers_salescontract_signed_by_id_ab6b8d38" ON "buyers_salescontract" ("signed_by_id");
CREATE INDEX "buyers_salescontract_updated_by_id_e42bb901" ON "buyers_salescontract" ("updated_by_id");
CREATE INDEX "buyers_samplefeedback_created_at_318bd373" ON "buyers_samplefeedback" ("created_at");
CREATE INDEX "buyers_samplefeedback_status_cea75b5a" ON "buyers_samplefeedback" ("status");
CREATE INDEX "buyers_samplefeedback_buyer_id_c01d5915" ON "buyers_samplefeedback" ("buyer_id");
CREATE INDEX "buyers_samplefeedback_created_by_id_7c0a21c3" ON "buyers_samplefeedback" ("created_by_id");
CREATE INDEX "buyers_samplefeedback_lot_id_ebdc4eb7" ON "buyers_samplefeedback" ("lot_id");
CREATE INDEX "buyers_samplefeedback_updated_by_id_fc3f008a" ON "buyers_samplefeedback" ("updated_by_id");
CREATE INDEX "buyers_contractlotallocation_created_at_5899b063" ON "buyers_contractlotallocation" ("created_at");
CREATE INDEX "buyers_contractlotallocation_created_by_id_c1124257" ON "buyers_contractlotallocation" ("created_by_id");
CREATE INDEX "buyers_contractlotallocation_lot_id_cb80a377" ON "buyers_contractlotallocation" ("lot_id");
CREATE INDEX "buyers_contractlotallocation_updated_by_id_e982b29a" ON "buyers_contractlotallocation" ("updated_by_id");
CREATE INDEX "buyers_contractlotallocation_contract_id_f59e8899" ON "buyers_contractlotallocation" ("contract_id");
COMMIT;

-- ===== migration farmers.0001_initial =====
BEGIN;
--
-- Create model Farmer
--
CREATE TABLE "farmers_farmer" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "farmer_code" varchar(32) NOT NULL UNIQUE, "full_name" varchar(200) NOT NULL, "gender" varchar(8) NOT NULL, "phone" varchar(32) NOT NULL, "national_id_number" varchar(64) NOT NULL, "kebele" varchar(120) NOT NULL, "family_size" integer unsigned NOT NULL CHECK ("family_size" >= 0), "coffee_tree_count" integer unsigned NOT NULL CHECK ("coffee_tree_count" >= 0), "total_plot_ha" decimal NOT NULL, "annual_cherry_cap_kg" decimal NOT NULL, "delivered_this_season_kg" decimal NOT NULL, "kyc_status" varchar(16) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model FarmerDocument
--
CREATE TABLE "farmers_farmerdocument" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "doc_type" varchar(24) NOT NULL, "file_path" varchar(500) NOT NULL, "sha256" varchar(64) NOT NULL, "verified_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NOT NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "verified_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model FarmPlot
--
CREATE TABLE "farmers_farmplot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "plot_name" varchar(120) NOT NULL, "area_ha" decimal NOT NULL, "elevation_m" integer unsigned NULL CHECK ("elevation_m" >= 0), "coffee_variety" varchar(120) NOT NULL, "tree_count" integer unsigned NOT NULL CHECK ("tree_count" >= 0), "boundary" text NULL CHECK ((JSON_VALID("boundary") OR "boundary" IS NULL)), "centroid" text NULL CHECK ((JSON_VALID("centroid") OR "centroid" IS NULL)), "boundary_geojson" text NOT NULL CHECK ((JSON_VALID("boundary_geojson") OR "boundary_geojson" IS NULL)), "deforestation_free" bool NOT NULL, "cutoff_checked_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NOT NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model EUDRDueDiligenceStatement
--
CREATE TABLE "farmers_eudrduediligencestatement" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "reference_number" varchar(64) NOT NULL UNIQUE, "geojson_dossier" text NOT NULL CHECK ((JSON_VALID("geojson_dossier") OR "geojson_dossier" IS NULL)), "risk_assessment" text NOT NULL, "status" varchar(16) NOT NULL, "submitted_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NOT NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "plot_id" char(32) NOT NULL REFERENCES "farmers_farmplot" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Certification
--
CREATE TABLE "farmers_certification" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "cert_type" varchar(24) NOT NULL, "certificate_number" varchar(120) NOT NULL, "issued_on" date NULL, "expires_on" date NULL, "document_path" varchar(500) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NOT NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "plot_id" char(32) NULL REFERENCES "farmers_farmplot" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create index farmers_far_station_923bc2_idx on field(s) station, kyc_status of model farmer
--
CREATE INDEX "farmers_far_station_923bc2_idx" ON "farmers_farmer" ("station_id", "kyc_status");
--
-- Create index farmers_far_farmer__8454f1_idx on field(s) farmer of model farmplot
--
CREATE INDEX "farmers_far_farmer__8454f1_idx" ON "farmers_farmplot" ("farmer_id");
CREATE INDEX "farmers_farmer_created_at_494b3c9d" ON "farmers_farmer" ("created_at");
CREATE INDEX "farmers_farmer_phone_e0fc4798" ON "farmers_farmer" ("phone");
CREATE INDEX "farmers_farmer_kyc_status_c96f610f" ON "farmers_farmer" ("kyc_status");
CREATE INDEX "farmers_farmer_created_by_id_264f0816" ON "farmers_farmer" ("created_by_id");
CREATE INDEX "farmers_farmer_station_id_0f4970e5" ON "farmers_farmer" ("station_id");
CREATE INDEX "farmers_farmer_updated_by_id_9df0bd0d" ON "farmers_farmer" ("updated_by_id");
CREATE INDEX "farmers_farmerdocument_created_at_4ce2e73c" ON "farmers_farmerdocument" ("created_at");
CREATE INDEX "farmers_farmerdocument_doc_type_eca9c96d" ON "farmers_farmerdocument" ("doc_type");
CREATE INDEX "farmers_farmerdocument_created_by_id_49d1f4e1" ON "farmers_farmerdocument" ("created_by_id");
CREATE INDEX "farmers_farmerdocument_farmer_id_c25c458a" ON "farmers_farmerdocument" ("farmer_id");
CREATE INDEX "farmers_farmerdocument_updated_by_id_ff5c2520" ON "farmers_farmerdocument" ("updated_by_id");
CREATE INDEX "farmers_farmerdocument_verified_by_id_e82c3a4c" ON "farmers_farmerdocument" ("verified_by_id");
CREATE INDEX "farmers_farmplot_created_at_8230be84" ON "farmers_farmplot" ("created_at");
CREATE INDEX "farmers_farmplot_created_by_id_a97ad256" ON "farmers_farmplot" ("created_by_id");
CREATE INDEX "farmers_farmplot_farmer_id_a0b71ec1" ON "farmers_farmplot" ("farmer_id");
CREATE INDEX "farmers_farmplot_updated_by_id_613f90de" ON "farmers_farmplot" ("updated_by_id");
CREATE INDEX "farmers_eudrduediligencestatement_created_at_fa168419" ON "farmers_eudrduediligencestatement" ("created_at");
CREATE INDEX "farmers_eudrduediligencestatement_status_178d2f39" ON "farmers_eudrduediligencestatement" ("status");
CREATE INDEX "farmers_eudrduediligencestatement_created_by_id_cb085fc9" ON "farmers_eudrduediligencestatement" ("created_by_id");
CREATE INDEX "farmers_eudrduediligencestatement_updated_by_id_ee635e09" ON "farmers_eudrduediligencestatement" ("updated_by_id");
CREATE INDEX "farmers_eudrduediligencestatement_farmer_id_4ff510d0" ON "farmers_eudrduediligencestatement" ("farmer_id");
CREATE INDEX "farmers_eudrduediligencestatement_plot_id_5dbf3e49" ON "farmers_eudrduediligencestatement" ("plot_id");
CREATE INDEX "farmers_certification_created_at_94f4feca" ON "farmers_certification" ("created_at");
CREATE INDEX "farmers_certification_cert_type_93512c3c" ON "farmers_certification" ("cert_type");
CREATE INDEX "farmers_certification_created_by_id_4ec559bf" ON "farmers_certification" ("created_by_id");
CREATE INDEX "farmers_certification_updated_by_id_c7fa4ac4" ON "farmers_certification" ("updated_by_id");
CREATE INDEX "farmers_certification_farmer_id_a63d7b3c" ON "farmers_certification" ("farmer_id");
CREATE INDEX "farmers_certification_plot_id_02ef575f" ON "farmers_certification" ("plot_id");
COMMIT;

-- ===== migration collection.0001_initial =====
BEGIN;
--
-- Create model CollectionCenter
--
CREATE TABLE "collection_collectioncenter" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "altitude_m" integer unsigned NULL CHECK ("altitude_m" >= 0), "latitude" decimal NULL, "longitude" decimal NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model CherryIntake
--
CREATE TABLE "collection_cherryintake" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "intake_number" varchar(40) NOT NULL UNIQUE, "intake_date" date NOT NULL, "coffee_variety" varchar(120) NOT NULL, "site_altitude_m" integer unsigned NULL CHECK ("site_altitude_m" >= 0), "gross_kg" decimal NOT NULL, "tare_kg" decimal NOT NULL, "net_kg" decimal NOT NULL, "floater_deduction_pct" decimal NOT NULL, "payable_kg" decimal NOT NULL, "unit_price" decimal NOT NULL, "total_amount" decimal NOT NULL, "weight_source" varchar(16) NOT NULL, "qr_receipt_code" varchar(64) NOT NULL UNIQUE, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NOT NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "center_id" char(32) NOT NULL REFERENCES "collection_collectioncenter" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "intake_gross_gte_tare" CHECK ("gross_kg" >= ("tare_kg")), CONSTRAINT "intake_deduction_pct_range" CHECK (("floater_deduction_pct" >= '0' AND "floater_deduction_pct" <= '100')));
--
-- Create model CashFloat
--
CREATE TABLE "collection_cashfloat" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "float_date" date NOT NULL, "amount_allocated" decimal NOT NULL, "amount_spent" decimal NOT NULL, "amount_returned" decimal NOT NULL, "status" varchar(16) NOT NULL, "agent_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "center_id" char(32) NOT NULL REFERENCES "collection_collectioncenter" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_float_center_agent_date" UNIQUE ("center_id", "agent_id", "float_date"));
--
-- Create model AgentAssignment
--
CREATE TABLE "collection_agentassignment" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "valid_from" date NOT NULL, "valid_to" date NULL, "agent_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "center_id" char(32) NOT NULL REFERENCES "collection_collectioncenter" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "collection_collectioncenter_created_at_628c1304" ON "collection_collectioncenter" ("created_at");
CREATE INDEX "collection_collectioncenter_created_by_id_5d5a5176" ON "collection_collectioncenter" ("created_by_id");
CREATE INDEX "collection_collectioncenter_station_id_bb0cf944" ON "collection_collectioncenter" ("station_id");
CREATE INDEX "collection_collectioncenter_updated_by_id_42f6f2b7" ON "collection_collectioncenter" ("updated_by_id");
CREATE INDEX "collection_cherryintake_created_at_402ba41a" ON "collection_cherryintake" ("created_at");
CREATE INDEX "collection_cherryintake_intake_date_62f43936" ON "collection_cherryintake" ("intake_date");
CREATE INDEX "collection_cherryintake_created_by_id_c3c40b47" ON "collection_cherryintake" ("created_by_id");
CREATE INDEX "collection_cherryintake_farmer_id_80e18075" ON "collection_cherryintake" ("farmer_id");
CREATE INDEX "collection_cherryintake_lot_id_bbb69dca" ON "collection_cherryintake" ("lot_id");
CREATE INDEX "collection_cherryintake_station_id_59600245" ON "collection_cherryintake" ("station_id");
CREATE INDEX "collection_cherryintake_updated_by_id_1e1d359b" ON "collection_cherryintake" ("updated_by_id");
CREATE INDEX "collection_cherryintake_center_id_e9c1cceb" ON "collection_cherryintake" ("center_id");
CREATE INDEX "collection__station_d6c9a1_idx" ON "collection_cherryintake" ("station_id", "intake_date");
CREATE INDEX "collection__farmer__14cf02_idx" ON "collection_cherryintake" ("farmer_id", "intake_date");
CREATE INDEX "collection_cashfloat_created_at_b1ec65f8" ON "collection_cashfloat" ("created_at");
CREATE INDEX "collection_cashfloat_float_date_229533c3" ON "collection_cashfloat" ("float_date");
CREATE INDEX "collection_cashfloat_status_85f63998" ON "collection_cashfloat" ("status");
CREATE INDEX "collection_cashfloat_agent_id_c7d3bfe9" ON "collection_cashfloat" ("agent_id");
CREATE INDEX "collection_cashfloat_created_by_id_83aefbfa" ON "collection_cashfloat" ("created_by_id");
CREATE INDEX "collection_cashfloat_updated_by_id_79625748" ON "collection_cashfloat" ("updated_by_id");
CREATE INDEX "collection_cashfloat_center_id_6e393672" ON "collection_cashfloat" ("center_id");
CREATE INDEX "collection_agentassignment_created_at_58fa815a" ON "collection_agentassignment" ("created_at");
CREATE INDEX "collection_agentassignment_agent_id_cc8fb323" ON "collection_agentassignment" ("agent_id");
CREATE INDEX "collection_agentassignment_created_by_id_8474230b" ON "collection_agentassignment" ("created_by_id");
CREATE INDEX "collection_agentassignment_updated_by_id_67d2ab1a" ON "collection_agentassignment" ("updated_by_id");
CREATE INDEX "collection_agentassignment_center_id_37352efd" ON "collection_agentassignment" ("center_id");
CREATE INDEX "collection__center__6dc6ae_idx" ON "collection_agentassignment" ("center_id", "valid_from");
COMMIT;

-- ===== migration drymill.0001_initial =====
BEGIN;
--
-- Create model MillingWorkOrder
--
CREATE TABLE "drymill_millingworkorder" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "order_number" varchar(40) NOT NULL UNIQUE, "status" varchar(16) NOT NULL, "scheduled_date" date NULL, "started_at" datetime NULL, "finished_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "input_lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "mill_station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "output_lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model GradingRecord
--
CREATE TABLE "drymill_gradingrecord" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "graded_on" date NOT NULL, "gravity_table_kg" decimal NOT NULL, "color_sorted_kg" decimal NOT NULL, "hand_picked_kg" decimal NOT NULL, "rejects_kg" decimal NOT NULL, "notes" text NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "work_order_id" char(32) NULL REFERENCES "drymill_millingworkorder" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model MillingOutput
--
CREATE TABLE "drymill_millingoutput" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "input_kg" decimal NOT NULL, "green_out_kg" decimal NOT NULL, "husk_kg" decimal NOT NULL, "loss_kg" decimal NOT NULL, "tolerance_kg" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "work_order_id" char(32) NOT NULL UNIQUE REFERENCES "drymill_millingworkorder" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "milling_weights_nonneg" CHECK (("green_out_kg" >= '0' AND "input_kg" >= '0')));
--
-- Create model ScreenDistribution
--
CREATE TABLE "drymill_screendistribution" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "screen_size" smallint unsigned NOT NULL CHECK ("screen_size" >= 0), "weight_kg" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "grading_id" char(32) NOT NULL REFERENCES "drymill_gradingrecord" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_screen_per_grading" UNIQUE ("grading_id", "screen_size"), CONSTRAINT "screen_size_14_18" CHECK (("screen_size" >= 14 AND "screen_size" <= 18)));
CREATE INDEX "drymill_millingworkorder_created_at_667a9acf" ON "drymill_millingworkorder" ("created_at");
CREATE INDEX "drymill_millingworkorder_status_2df65960" ON "drymill_millingworkorder" ("status");
CREATE INDEX "drymill_millingworkorder_created_by_id_fff3629d" ON "drymill_millingworkorder" ("created_by_id");
CREATE INDEX "drymill_millingworkorder_input_lot_id_7510fc29" ON "drymill_millingworkorder" ("input_lot_id");
CREATE INDEX "drymill_millingworkorder_mill_station_id_ac35ec3e" ON "drymill_millingworkorder" ("mill_station_id");
CREATE INDEX "drymill_millingworkorder_output_lot_id_112bb4db" ON "drymill_millingworkorder" ("output_lot_id");
CREATE INDEX "drymill_millingworkorder_updated_by_id_da027abb" ON "drymill_millingworkorder" ("updated_by_id");
CREATE INDEX "drymill_gradingrecord_created_at_433ab3fb" ON "drymill_gradingrecord" ("created_at");
CREATE INDEX "drymill_gradingrecord_graded_on_08c96efe" ON "drymill_gradingrecord" ("graded_on");
CREATE INDEX "drymill_gradingrecord_created_by_id_861bbcb6" ON "drymill_gradingrecord" ("created_by_id");
CREATE INDEX "drymill_gradingrecord_lot_id_df65ca8b" ON "drymill_gradingrecord" ("lot_id");
CREATE INDEX "drymill_gradingrecord_updated_by_id_21ecac93" ON "drymill_gradingrecord" ("updated_by_id");
CREATE INDEX "drymill_gradingrecord_work_order_id_da76bdea" ON "drymill_gradingrecord" ("work_order_id");
CREATE INDEX "drymill_millingoutput_created_at_6a7b3b46" ON "drymill_millingoutput" ("created_at");
CREATE INDEX "drymill_millingoutput_created_by_id_aab35c64" ON "drymill_millingoutput" ("created_by_id");
CREATE INDEX "drymill_millingoutput_updated_by_id_5cadfeb8" ON "drymill_millingoutput" ("updated_by_id");
CREATE INDEX "drymill_screendistribution_created_at_b8882de5" ON "drymill_screendistribution" ("created_at");
CREATE INDEX "drymill_screendistribution_created_by_id_041c718d" ON "drymill_screendistribution" ("created_by_id");
CREATE INDEX "drymill_screendistribution_grading_id_4a430987" ON "drymill_screendistribution" ("grading_id");
CREATE INDEX "drymill_screendistribution_updated_by_id_943ac83f" ON "drymill_screendistribution" ("updated_by_id");
COMMIT;

-- ===== migration exports.0001_initial =====
BEGIN;
--
-- Create model BagMarking
--
CREATE TABLE "exports_bagmarking" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ico_mark" varchar(64) NOT NULL, "buyer_stencil" varchar(200) NOT NULL, "bag_type" varchar(32) NOT NULL, "crop_year" varchar(16) NOT NULL, "contract_id" char(32) NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "generated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ContainerLoading
--
CREATE TABLE "exports_containerloading" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "container_number" varchar(32) NOT NULL UNIQUE, "seal_number" varchar(64) NOT NULL, "total_bags" integer unsigned NOT NULL CHECK ("total_bags" >= 0), "total_net_kg" decimal NOT NULL, "stuffed_on" date NULL, "status" varchar(16) NOT NULL, "contract_id" char(32) NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ContainerLot
--
CREATE TABLE "exports_containerlot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bags" integer unsigned NOT NULL CHECK ("bags" >= 0), "net_kg" decimal NOT NULL, "container_id" char(32) NOT NULL REFERENCES "exports_containerloading" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "marking_id" char(32) NOT NULL REFERENCES "exports_bagmarking" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ExportDocument
--
CREATE TABLE "exports_exportdocument" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "doc_type" varchar(24) NOT NULL, "document_number" varchar(64) NOT NULL, "payload" text NOT NULL CHECK ((JSON_VALID("payload") OR "payload" IS NULL)), "file_path" varchar(500) NOT NULL, "status" varchar(16) NOT NULL, "container_id" char(32) NULL REFERENCES "exports_containerloading" ("id") DEFERRABLE INITIALLY DEFERRED, "contract_id" char(32) NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model PackingRecord
--
CREATE TABLE "exports_packingrecord" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "packed_on" date NOT NULL, "bags_packed" integer unsigned NOT NULL CHECK ("bags_packed" >= 0), "gross_kg" decimal NOT NULL, "tare_kg" decimal NOT NULL, "net_kg" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "marking_id" char(32) NOT NULL REFERENCES "exports_bagmarking" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint uniq_ico_per_lot on model bagmarking
--
CREATE TABLE "new__exports_bagmarking" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ico_mark" varchar(64) NOT NULL, "buyer_stencil" varchar(200) NOT NULL, "bag_type" varchar(32) NOT NULL, "crop_year" varchar(16) NOT NULL, "contract_id" char(32) NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "generated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_ico_per_lot" UNIQUE ("lot_id", "ico_mark"));
INSERT INTO "new__exports_bagmarking" ("id", "created_at", "updated_at", "ico_mark", "buyer_stencil", "bag_type", "crop_year", "contract_id", "created_by_id", "generated_by_id", "lot_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "ico_mark", "buyer_stencil", "bag_type", "crop_year", "contract_id", "created_by_id", "generated_by_id", "lot_id", "updated_by_id" FROM "exports_bagmarking";
DROP TABLE "exports_bagmarking";
ALTER TABLE "new__exports_bagmarking" RENAME TO "exports_bagmarking";
CREATE INDEX "exports_containerloading_created_at_e2bfc8cd" ON "exports_containerloading" ("created_at");
CREATE INDEX "exports_containerloading_status_f3426d51" ON "exports_containerloading" ("status");
CREATE INDEX "exports_containerloading_contract_id_d6b79938" ON "exports_containerloading" ("contract_id");
CREATE INDEX "exports_containerloading_created_by_id_5a2b97e7" ON "exports_containerloading" ("created_by_id");
CREATE INDEX "exports_containerloading_station_id_f9bb443c" ON "exports_containerloading" ("station_id");
CREATE INDEX "exports_containerloading_updated_by_id_cc46bc35" ON "exports_containerloading" ("updated_by_id");
CREATE INDEX "exports_containerlot_created_at_a6032268" ON "exports_containerlot" ("created_at");
CREATE INDEX "exports_containerlot_container_id_3b30af76" ON "exports_containerlot" ("container_id");
CREATE INDEX "exports_containerlot_created_by_id_f5b6e23a" ON "exports_containerlot" ("created_by_id");
CREATE INDEX "exports_containerlot_marking_id_e6474e8d" ON "exports_containerlot" ("marking_id");
CREATE INDEX "exports_containerlot_updated_by_id_c79b331f" ON "exports_containerlot" ("updated_by_id");
CREATE INDEX "exports_exportdocument_created_at_0450639a" ON "exports_exportdocument" ("created_at");
CREATE INDEX "exports_exportdocument_doc_type_daced87f" ON "exports_exportdocument" ("doc_type");
CREATE INDEX "exports_exportdocument_container_id_f25e7342" ON "exports_exportdocument" ("container_id");
CREATE INDEX "exports_exportdocument_contract_id_454e0f9d" ON "exports_exportdocument" ("contract_id");
CREATE INDEX "exports_exportdocument_created_by_id_ce66f1fb" ON "exports_exportdocument" ("created_by_id");
CREATE INDEX "exports_exportdocument_updated_by_id_50f6a94a" ON "exports_exportdocument" ("updated_by_id");
CREATE INDEX "exports_packingrecord_created_at_7b95ab82" ON "exports_packingrecord" ("created_at");
CREATE INDEX "exports_packingrecord_packed_on_470d934c" ON "exports_packingrecord" ("packed_on");
CREATE INDEX "exports_packingrecord_created_by_id_02bbfb0d" ON "exports_packingrecord" ("created_by_id");
CREATE INDEX "exports_packingrecord_marking_id_b42b307b" ON "exports_packingrecord" ("marking_id");
CREATE INDEX "exports_packingrecord_updated_by_id_2abce7a7" ON "exports_packingrecord" ("updated_by_id");
CREATE INDEX "exports_bagmarking_created_at_87eef3c7" ON "exports_bagmarking" ("created_at");
CREATE INDEX "exports_bagmarking_contract_id_db6bad0d" ON "exports_bagmarking" ("contract_id");
CREATE INDEX "exports_bagmarking_created_by_id_2f4e4d65" ON "exports_bagmarking" ("created_by_id");
CREATE INDEX "exports_bagmarking_generated_by_id_a15d6ddc" ON "exports_bagmarking" ("generated_by_id");
CREATE INDEX "exports_bagmarking_lot_id_0c3e193e" ON "exports_bagmarking" ("lot_id");
CREATE INDEX "exports_bagmarking_updated_by_id_f4450e22" ON "exports_bagmarking" ("updated_by_id");
--
-- Create constraint uniq_container_marking on model containerlot
--
CREATE TABLE "new__exports_containerlot" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bags" integer unsigned NOT NULL CHECK ("bags" >= 0), "net_kg" decimal NOT NULL, "container_id" char(32) NOT NULL REFERENCES "exports_containerloading" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "marking_id" char(32) NOT NULL REFERENCES "exports_bagmarking" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_container_marking" UNIQUE ("container_id", "marking_id"));
INSERT INTO "new__exports_containerlot" ("id", "created_at", "updated_at", "bags", "net_kg", "container_id", "created_by_id", "marking_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "bags", "net_kg", "container_id", "created_by_id", "marking_id", "updated_by_id" FROM "exports_containerlot";
DROP TABLE "exports_containerlot";
ALTER TABLE "new__exports_containerlot" RENAME TO "exports_containerlot";
CREATE INDEX "exports_containerlot_created_at_a6032268" ON "exports_containerlot" ("created_at");
CREATE INDEX "exports_containerlot_container_id_3b30af76" ON "exports_containerlot" ("container_id");
CREATE INDEX "exports_containerlot_created_by_id_f5b6e23a" ON "exports_containerlot" ("created_by_id");
CREATE INDEX "exports_containerlot_marking_id_e6474e8d" ON "exports_containerlot" ("marking_id");
CREATE INDEX "exports_containerlot_updated_by_id_c79b331f" ON "exports_containerlot" ("updated_by_id");
COMMIT;

-- ===== migration procurement.0001_initial =====
BEGIN;
--
-- Create model PurchaseVoucher
--
CREATE TABLE "procurement_purchasevoucher" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "voucher_number" varchar(40) NOT NULL UNIQUE, "voucher_date" date NOT NULL, "quantity_kg" decimal NOT NULL, "unit_price" decimal NOT NULL, "total_amount" decimal NOT NULL, "status" varchar(16) NOT NULL, "approved_at" datetime NULL, "approved_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "intake_id" char(32) NULL REFERENCES "collection_cherryintake" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model GoodsReceivedNote
--
CREATE TABLE "procurement_goodsreceivednote" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "grn_number" varchar(40) NOT NULL UNIQUE, "received_date" date NOT NULL, "received_kg" decimal NOT NULL, "variance_kg" decimal NOT NULL, "notes" text NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "received_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "voucher_id" char(32) NOT NULL REFERENCES "procurement_purchasevoucher" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Supplier
--
CREATE TABLE "procurement_supplier" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "supplier_type" varchar(16) NOT NULL, "contact_name" varchar(200) NOT NULL, "phone" varchar(32) NOT NULL, "license_number" varchar(120) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Add field supplier to purchasevoucher
--
ALTER TABLE "procurement_purchasevoucher" ADD COLUMN "supplier_id" char(32) NULL REFERENCES "procurement_supplier" ("id") DEFERRABLE INITIALLY DEFERRED;
--
-- Create model DailyPrice
--
CREATE TABLE "procurement_dailyprice" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "price_date" date NOT NULL, "product" varchar(16) NOT NULL, "grade" varchar(32) NOT NULL, "price_per_kg" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "set_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_daily_price" UNIQUE ("station_id", "price_date", "product", "grade"));
--
-- Create index procurement_station_715b7c_idx on field(s) station, status, voucher_date of model purchasevoucher
--
CREATE INDEX "procurement_station_715b7c_idx" ON "procurement_purchasevoucher" ("station_id", "status", "voucher_date");
CREATE INDEX "procurement_purchasevoucher_created_at_d26431a5" ON "procurement_purchasevoucher" ("created_at");
CREATE INDEX "procurement_purchasevoucher_voucher_date_ec2a5d8a" ON "procurement_purchasevoucher" ("voucher_date");
CREATE INDEX "procurement_purchasevoucher_status_43efdc0a" ON "procurement_purchasevoucher" ("status");
CREATE INDEX "procurement_purchasevoucher_approved_by_id_0d812efa" ON "procurement_purchasevoucher" ("approved_by_id");
CREATE INDEX "procurement_purchasevoucher_created_by_id_381c84ae" ON "procurement_purchasevoucher" ("created_by_id");
CREATE INDEX "procurement_purchasevoucher_farmer_id_25c27cd8" ON "procurement_purchasevoucher" ("farmer_id");
CREATE INDEX "procurement_purchasevoucher_intake_id_e6821d5f" ON "procurement_purchasevoucher" ("intake_id");
CREATE INDEX "procurement_purchasevoucher_station_id_efd28cb8" ON "procurement_purchasevoucher" ("station_id");
CREATE INDEX "procurement_purchasevoucher_updated_by_id_7a4e060f" ON "procurement_purchasevoucher" ("updated_by_id");
CREATE INDEX "procurement_goodsreceivednote_created_at_d7fb05d4" ON "procurement_goodsreceivednote" ("created_at");
CREATE INDEX "procurement_goodsreceivednote_received_date_a7d588e4" ON "procurement_goodsreceivednote" ("received_date");
CREATE INDEX "procurement_goodsreceivednote_created_by_id_31d208e5" ON "procurement_goodsreceivednote" ("created_by_id");
CREATE INDEX "procurement_goodsreceivednote_received_by_id_7144b54e" ON "procurement_goodsreceivednote" ("received_by_id");
CREATE INDEX "procurement_goodsreceivednote_station_id_d3d43981" ON "procurement_goodsreceivednote" ("station_id");
CREATE INDEX "procurement_goodsreceivednote_updated_by_id_aa4d2e0b" ON "procurement_goodsreceivednote" ("updated_by_id");
CREATE INDEX "procurement_goodsreceivednote_voucher_id_f60534ef" ON "procurement_goodsreceivednote" ("voucher_id");
CREATE INDEX "procurement_supplier_created_at_878da180" ON "procurement_supplier" ("created_at");
CREATE INDEX "procurement_supplier_supplier_type_e423f67d" ON "procurement_supplier" ("supplier_type");
CREATE INDEX "procurement_supplier_created_by_id_eb5c155a" ON "procurement_supplier" ("created_by_id");
CREATE INDEX "procurement_supplier_updated_by_id_2b9a9eec" ON "procurement_supplier" ("updated_by_id");
CREATE INDEX "procurement_purchasevoucher_supplier_id_a2956ca4" ON "procurement_purchasevoucher" ("supplier_id");
CREATE INDEX "procurement_dailyprice_created_at_514015de" ON "procurement_dailyprice" ("created_at");
CREATE INDEX "procurement_dailyprice_price_date_0a509c72" ON "procurement_dailyprice" ("price_date");
CREATE INDEX "procurement_dailyprice_product_e3eb2b78" ON "procurement_dailyprice" ("product");
CREATE INDEX "procurement_dailyprice_created_by_id_e1438327" ON "procurement_dailyprice" ("created_by_id");
CREATE INDEX "procurement_dailyprice_set_by_id_ae00d26e" ON "procurement_dailyprice" ("set_by_id");
CREATE INDEX "procurement_dailyprice_station_id_2bfdc7cf" ON "procurement_dailyprice" ("station_id");
CREATE INDEX "procurement_dailyprice_updated_by_id_23ed8aa8" ON "procurement_dailyprice" ("updated_by_id");
COMMIT;

-- ===== migration finance.0001_initial =====
BEGIN;
--
-- Create model Account
--
CREATE TABLE "finance_account" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "account_type" varchar(16) NOT NULL, "currency" varchar(3) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "parent_id" char(32) NULL REFERENCES "finance_account" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model JournalEntry
--
CREATE TABLE "finance_journalentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "entry_number" varchar(40) NOT NULL UNIQUE, "entry_date" date NOT NULL, "description" varchar(300) NOT NULL, "status" varchar(12) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model JournalLine
--
CREATE TABLE "finance_journalline" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "debit" decimal NOT NULL, "credit" decimal NOT NULL, "currency" varchar(3) NOT NULL, "exchange_rate" decimal NOT NULL, "memo" varchar(300) NOT NULL, "account_id" char(32) NOT NULL REFERENCES "finance_account" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "entry_id" char(32) NOT NULL REFERENCES "finance_journalentry" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model LotCostAllocation
--
CREATE TABLE "finance_lotcostallocation" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "component" varchar(24) NOT NULL, "amount" decimal NOT NULL, "currency" varchar(3) NOT NULL, "allocated_on" date NOT NULL, "source_reference" varchar(120) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "journal_line_id" char(32) NULL REFERENCES "finance_journalline" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ReceivablePayable
--
CREATE TABLE "finance_receivablepayable" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "kind" varchar(4) NOT NULL, "reference" varchar(64) NOT NULL UNIQUE, "amount" decimal NOT NULL, "amount_settled" decimal NOT NULL, "currency" varchar(3) NOT NULL, "issued_on" date NOT NULL, "due_on" date NULL, "status" varchar(12) NOT NULL, "buyer_id" char(32) NULL REFERENCES "buyers_buyer" ("id") DEFERRABLE INITIALLY DEFERRED, "contract_id" char(32) NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "supplier_id" char(32) NULL REFERENCES "procurement_supplier" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint journal_line_one_side_only on model journalline
--
CREATE TABLE "new__finance_journalline" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "debit" decimal NOT NULL, "credit" decimal NOT NULL, "currency" varchar(3) NOT NULL, "exchange_rate" decimal NOT NULL, "memo" varchar(300) NOT NULL, "account_id" char(32) NOT NULL REFERENCES "finance_account" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "entry_id" char(32) NOT NULL REFERENCES "finance_journalentry" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "journal_line_one_side_only" CHECK ((("credit" = '0' AND "debit" > '0') OR ("credit" > '0' AND "debit" = '0'))));
INSERT INTO "new__finance_journalline" ("id", "created_at", "updated_at", "debit", "credit", "currency", "exchange_rate", "memo", "account_id", "created_by_id", "entry_id", "lot_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "debit", "credit", "currency", "exchange_rate", "memo", "account_id", "created_by_id", "entry_id", "lot_id", "updated_by_id" FROM "finance_journalline";
DROP TABLE "finance_journalline";
ALTER TABLE "new__finance_journalline" RENAME TO "finance_journalline";
CREATE INDEX "finance_account_created_at_ad12ddb0" ON "finance_account" ("created_at");
CREATE INDEX "finance_account_account_type_3f1a0700" ON "finance_account" ("account_type");
CREATE INDEX "finance_account_created_by_id_fe782144" ON "finance_account" ("created_by_id");
CREATE INDEX "finance_account_parent_id_974dc44d" ON "finance_account" ("parent_id");
CREATE INDEX "finance_account_updated_by_id_fa4b7308" ON "finance_account" ("updated_by_id");
CREATE INDEX "finance_journalentry_created_at_96a16d0a" ON "finance_journalentry" ("created_at");
CREATE INDEX "finance_journalentry_entry_date_5df554c8" ON "finance_journalentry" ("entry_date");
CREATE INDEX "finance_journalentry_status_cb420037" ON "finance_journalentry" ("status");
CREATE INDEX "finance_journalentry_created_by_id_e5c1de39" ON "finance_journalentry" ("created_by_id");
CREATE INDEX "finance_journalentry_station_id_fca27b3a" ON "finance_journalentry" ("station_id");
CREATE INDEX "finance_journalentry_updated_by_id_d9d923fe" ON "finance_journalentry" ("updated_by_id");
CREATE INDEX "finance_lotcostallocation_created_at_2e603eaf" ON "finance_lotcostallocation" ("created_at");
CREATE INDEX "finance_lotcostallocation_component_c651bddf" ON "finance_lotcostallocation" ("component");
CREATE INDEX "finance_lotcostallocation_allocated_on_7ef8f0ef" ON "finance_lotcostallocation" ("allocated_on");
CREATE INDEX "finance_lotcostallocation_created_by_id_d1a56b74" ON "finance_lotcostallocation" ("created_by_id");
CREATE INDEX "finance_lotcostallocation_journal_line_id_4d2f29dc" ON "finance_lotcostallocation" ("journal_line_id");
CREATE INDEX "finance_lotcostallocation_lot_id_b6c27704" ON "finance_lotcostallocation" ("lot_id");
CREATE INDEX "finance_lotcostallocation_updated_by_id_f0af88bf" ON "finance_lotcostallocation" ("updated_by_id");
CREATE INDEX "finance_receivablepayable_created_at_8e9a1112" ON "finance_receivablepayable" ("created_at");
CREATE INDEX "finance_receivablepayable_kind_f22105db" ON "finance_receivablepayable" ("kind");
CREATE INDEX "finance_receivablepayable_issued_on_3144d18a" ON "finance_receivablepayable" ("issued_on");
CREATE INDEX "finance_receivablepayable_status_f1eb9e84" ON "finance_receivablepayable" ("status");
CREATE INDEX "finance_receivablepayable_buyer_id_dc554f70" ON "finance_receivablepayable" ("buyer_id");
CREATE INDEX "finance_receivablepayable_contract_id_cbab5667" ON "finance_receivablepayable" ("contract_id");
CREATE INDEX "finance_receivablepayable_created_by_id_94d82674" ON "finance_receivablepayable" ("created_by_id");
CREATE INDEX "finance_receivablepayable_supplier_id_2c2f4b30" ON "finance_receivablepayable" ("supplier_id");
CREATE INDEX "finance_receivablepayable_updated_by_id_84f6b70b" ON "finance_receivablepayable" ("updated_by_id");
CREATE INDEX "finance_journalline_created_at_7e337554" ON "finance_journalline" ("created_at");
CREATE INDEX "finance_journalline_account_id_995b7444" ON "finance_journalline" ("account_id");
CREATE INDEX "finance_journalline_created_by_id_e5051a52" ON "finance_journalline" ("created_by_id");
CREATE INDEX "finance_journalline_entry_id_4b54dce0" ON "finance_journalline" ("entry_id");
CREATE INDEX "finance_journalline_lot_id_9da4fcdc" ON "finance_journalline" ("lot_id");
CREATE INDEX "finance_journalline_updated_by_id_15f03097" ON "finance_journalline" ("updated_by_id");
--
-- Create index finance_lot_lot_id_59932b_idx on field(s) lot, component of model lotcostallocation
--
CREATE INDEX "finance_lot_lot_id_59932b_idx" ON "finance_lotcostallocation" ("lot_id", "component");
COMMIT;

-- ===== migration hr.0001_initial =====
BEGIN;
--
-- Create model AttendanceSheet
--
CREATE TABLE "hr_attendancesheet" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ethiopian_month" smallint unsigned NOT NULL CHECK ("ethiopian_month" >= 0), "ethiopian_year" integer unsigned NOT NULL CHECK ("ethiopian_year" >= 0), "controlled_at" datetime NULL, "verified_at" datetime NULL, "status" varchar(16) NOT NULL, "controlled_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "verified_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Worker
--
CREATE TABLE "hr_worker" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "worker_code" varchar(24) NOT NULL UNIQUE, "full_name" varchar(200) NOT NULL, "kind" varchar(24) NOT NULL, "wage_type" varchar(12) NOT NULL, "wage_rate" decimal NOT NULL, "phone" varchar(32) NOT NULL, "hired_on" date NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model AttendanceEntry
--
CREATE TABLE "hr_attendanceentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "day" smallint unsigned NOT NULL CHECK ("day" >= 0), "mark" varchar(8) NOT NULL, "hours" decimal NOT NULL, "pieces" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NOT NULL REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model WorkerAdvance
--
CREATE TABLE "hr_workeradvance" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "advance_date" date NOT NULL, "amount" decimal NOT NULL, "reason" varchar(200) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NULL REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint uniq_attendance_sheet on model attendancesheet
--
CREATE TABLE "new__hr_attendancesheet" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ethiopian_month" smallint unsigned NOT NULL CHECK ("ethiopian_month" >= 0), "ethiopian_year" integer unsigned NOT NULL CHECK ("ethiopian_year" >= 0), "controlled_at" datetime NULL, "verified_at" datetime NULL, "status" varchar(16) NOT NULL, "controlled_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "verified_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_attendance_sheet" UNIQUE ("station_id", "ethiopian_month", "ethiopian_year"));
INSERT INTO "new__hr_attendancesheet" ("id", "created_at", "updated_at", "ethiopian_month", "ethiopian_year", "controlled_at", "verified_at", "status", "controlled_by_id", "created_by_id", "signoff_id", "station_id", "updated_by_id", "verified_by_id") SELECT "id", "created_at", "updated_at", "ethiopian_month", "ethiopian_year", "controlled_at", "verified_at", "status", "controlled_by_id", "created_by_id", "signoff_id", "station_id", "updated_by_id", "verified_by_id" FROM "hr_attendancesheet";
DROP TABLE "hr_attendancesheet";
ALTER TABLE "new__hr_attendancesheet" RENAME TO "hr_attendancesheet";
CREATE INDEX "hr_worker_created_at_24385792" ON "hr_worker" ("created_at");
CREATE INDEX "hr_worker_kind_c86da80f" ON "hr_worker" ("kind");
CREATE INDEX "hr_worker_created_by_id_1e15ef94" ON "hr_worker" ("created_by_id");
CREATE INDEX "hr_worker_station_id_89400e28" ON "hr_worker" ("station_id");
CREATE INDEX "hr_worker_updated_by_id_68ea5570" ON "hr_worker" ("updated_by_id");
CREATE INDEX "hr_attendanceentry_created_at_f26ec538" ON "hr_attendanceentry" ("created_at");
CREATE INDEX "hr_attendanceentry_created_by_id_6a36853f" ON "hr_attendanceentry" ("created_by_id");
CREATE INDEX "hr_attendanceentry_updated_by_id_0e8aee59" ON "hr_attendanceentry" ("updated_by_id");
CREATE INDEX "hr_attendanceentry_sheet_id_163b1c2b" ON "hr_attendanceentry" ("sheet_id");
CREATE INDEX "hr_attendanceentry_worker_id_e2bcea91" ON "hr_attendanceentry" ("worker_id");
CREATE INDEX "hr_workeradvance_created_at_0b5d384e" ON "hr_workeradvance" ("created_at");
CREATE INDEX "hr_workeradvance_advance_date_4d3c6d42" ON "hr_workeradvance" ("advance_date");
CREATE INDEX "hr_workeradvance_created_by_id_637379de" ON "hr_workeradvance" ("created_by_id");
CREATE INDEX "hr_workeradvance_sheet_id_f1b16b34" ON "hr_workeradvance" ("sheet_id");
CREATE INDEX "hr_workeradvance_updated_by_id_5f70eb4b" ON "hr_workeradvance" ("updated_by_id");
CREATE INDEX "hr_workeradvance_worker_id_851cde67" ON "hr_workeradvance" ("worker_id");
CREATE INDEX "hr_attendancesheet_created_at_2bdc1fc3" ON "hr_attendancesheet" ("created_at");
CREATE INDEX "hr_attendancesheet_status_5290bdfa" ON "hr_attendancesheet" ("status");
CREATE INDEX "hr_attendancesheet_controlled_by_id_f736c647" ON "hr_attendancesheet" ("controlled_by_id");
CREATE INDEX "hr_attendancesheet_created_by_id_9d897407" ON "hr_attendancesheet" ("created_by_id");
CREATE INDEX "hr_attendancesheet_signoff_id_ed5de5a1" ON "hr_attendancesheet" ("signoff_id");
CREATE INDEX "hr_attendancesheet_station_id_0c810230" ON "hr_attendancesheet" ("station_id");
CREATE INDEX "hr_attendancesheet_updated_by_id_ef3831ef" ON "hr_attendancesheet" ("updated_by_id");
CREATE INDEX "hr_attendancesheet_verified_by_id_bb4f08b2" ON "hr_attendancesheet" ("verified_by_id");
--
-- Create constraint eth_month_1_13 on model attendancesheet
--
CREATE TABLE "new__hr_attendancesheet" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ethiopian_month" smallint unsigned NOT NULL CHECK ("ethiopian_month" >= 0), "ethiopian_year" integer unsigned NOT NULL CHECK ("ethiopian_year" >= 0), "controlled_at" datetime NULL, "verified_at" datetime NULL, "status" varchar(16) NOT NULL, "controlled_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "verified_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_attendance_sheet" UNIQUE ("station_id", "ethiopian_month", "ethiopian_year"), CONSTRAINT "eth_month_1_13" CHECK (("ethiopian_month" >= 1 AND "ethiopian_month" <= 13)));
INSERT INTO "new__hr_attendancesheet" ("id", "created_at", "updated_at", "ethiopian_month", "ethiopian_year", "controlled_at", "verified_at", "status", "controlled_by_id", "created_by_id", "signoff_id", "station_id", "updated_by_id", "verified_by_id") SELECT "id", "created_at", "updated_at", "ethiopian_month", "ethiopian_year", "controlled_at", "verified_at", "status", "controlled_by_id", "created_by_id", "signoff_id", "station_id", "updated_by_id", "verified_by_id" FROM "hr_attendancesheet";
DROP TABLE "hr_attendancesheet";
ALTER TABLE "new__hr_attendancesheet" RENAME TO "hr_attendancesheet";
CREATE INDEX "hr_attendancesheet_created_at_2bdc1fc3" ON "hr_attendancesheet" ("created_at");
CREATE INDEX "hr_attendancesheet_status_5290bdfa" ON "hr_attendancesheet" ("status");
CREATE INDEX "hr_attendancesheet_controlled_by_id_f736c647" ON "hr_attendancesheet" ("controlled_by_id");
CREATE INDEX "hr_attendancesheet_created_by_id_9d897407" ON "hr_attendancesheet" ("created_by_id");
CREATE INDEX "hr_attendancesheet_signoff_id_ed5de5a1" ON "hr_attendancesheet" ("signoff_id");
CREATE INDEX "hr_attendancesheet_station_id_0c810230" ON "hr_attendancesheet" ("station_id");
CREATE INDEX "hr_attendancesheet_updated_by_id_ef3831ef" ON "hr_attendancesheet" ("updated_by_id");
CREATE INDEX "hr_attendancesheet_verified_by_id_bb4f08b2" ON "hr_attendancesheet" ("verified_by_id");
--
-- Create index hr_worker_station_f2d63a_idx on field(s) station, kind of model worker
--
CREATE INDEX "hr_worker_station_f2d63a_idx" ON "hr_worker" ("station_id", "kind");
--
-- Create index hr_attendan_sheet_i_fe073e_idx on field(s) sheet, worker of model attendanceentry
--
CREATE INDEX "hr_attendan_sheet_i_fe073e_idx" ON "hr_attendanceentry" ("sheet_id", "worker_id");
--
-- Create constraint uniq_attendance_cell on model attendanceentry
--
CREATE TABLE "new__hr_attendanceentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "day" smallint unsigned NOT NULL CHECK ("day" >= 0), "mark" varchar(8) NOT NULL, "hours" decimal NOT NULL, "pieces" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NOT NULL REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_attendance_cell" UNIQUE ("sheet_id", "worker_id", "day"));
INSERT INTO "new__hr_attendanceentry" ("id", "created_at", "updated_at", "day", "mark", "hours", "pieces", "created_by_id", "updated_by_id", "sheet_id", "worker_id") SELECT "id", "created_at", "updated_at", "day", "mark", "hours", "pieces", "created_by_id", "updated_by_id", "sheet_id", "worker_id" FROM "hr_attendanceentry";
DROP TABLE "hr_attendanceentry";
ALTER TABLE "new__hr_attendanceentry" RENAME TO "hr_attendanceentry";
CREATE INDEX "hr_attendanceentry_created_at_f26ec538" ON "hr_attendanceentry" ("created_at");
CREATE INDEX "hr_attendanceentry_created_by_id_6a36853f" ON "hr_attendanceentry" ("created_by_id");
CREATE INDEX "hr_attendanceentry_updated_by_id_0e8aee59" ON "hr_attendanceentry" ("updated_by_id");
CREATE INDEX "hr_attendanceentry_sheet_id_163b1c2b" ON "hr_attendanceentry" ("sheet_id");
CREATE INDEX "hr_attendanceentry_worker_id_e2bcea91" ON "hr_attendanceentry" ("worker_id");
CREATE INDEX "hr_attendan_sheet_i_fe073e_idx" ON "hr_attendanceentry" ("sheet_id", "worker_id");
--
-- Create constraint attendance_day_1_30 on model attendanceentry
--
CREATE TABLE "new__hr_attendanceentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "day" smallint unsigned NOT NULL CHECK ("day" >= 0), "mark" varchar(8) NOT NULL, "hours" decimal NOT NULL, "pieces" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NOT NULL REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_attendance_cell" UNIQUE ("sheet_id", "worker_id", "day"), CONSTRAINT "attendance_day_1_30" CHECK (("day" >= 1 AND "day" <= 30)));
INSERT INTO "new__hr_attendanceentry" ("id", "created_at", "updated_at", "day", "mark", "hours", "pieces", "created_by_id", "updated_by_id", "sheet_id", "worker_id") SELECT "id", "created_at", "updated_at", "day", "mark", "hours", "pieces", "created_by_id", "updated_by_id", "sheet_id", "worker_id" FROM "hr_attendanceentry";
DROP TABLE "hr_attendanceentry";
ALTER TABLE "new__hr_attendanceentry" RENAME TO "hr_attendanceentry";
CREATE INDEX "hr_attendanceentry_created_at_f26ec538" ON "hr_attendanceentry" ("created_at");
CREATE INDEX "hr_attendanceentry_created_by_id_6a36853f" ON "hr_attendanceentry" ("created_by_id");
CREATE INDEX "hr_attendanceentry_updated_by_id_0e8aee59" ON "hr_attendanceentry" ("updated_by_id");
CREATE INDEX "hr_attendanceentry_sheet_id_163b1c2b" ON "hr_attendanceentry" ("sheet_id");
CREATE INDEX "hr_attendanceentry_worker_id_e2bcea91" ON "hr_attendanceentry" ("worker_id");
CREATE INDEX "hr_attendan_sheet_i_fe073e_idx" ON "hr_attendanceentry" ("sheet_id", "worker_id");
COMMIT;

-- ===== migration warehouse.0001_initial =====
BEGIN;
--
-- Create model Store
--
CREATE TABLE "warehouse_store" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "coffee_form" varchar(16) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model StockTransfer
--
CREATE TABLE "warehouse_stocktransfer" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "transfer_number" varchar(40) NOT NULL UNIQUE, "dispatched_kg" decimal NOT NULL, "received_kg" decimal NULL, "dispatch_date" date NOT NULL, "received_date" date NULL, "status" varchar(16) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "from_store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED, "to_store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model GatePass
--
CREATE TABLE "warehouse_gatepass" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "pass_number" varchar(40) NOT NULL UNIQUE, "vehicle_plate" varchar(32) NOT NULL, "weight_kg" decimal NOT NULL, "issued_at" datetime NOT NULL, "exited_at" datetime NULL, "authorised_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Bin
--
CREATE TABLE "warehouse_bin" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bin_code" varchar(24) NOT NULL, "capacity_kg" decimal NOT NULL, "certified_only" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model StockReceipt
--
CREATE TABLE "warehouse_stockreceipt" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "receipt_number" varchar(40) NOT NULL UNIQUE, "received_date" date NOT NULL, "weight_kg" decimal NOT NULL, "bags" integer unsigned NOT NULL CHECK ("bags" >= 0), "bin_id" char(32) NULL REFERENCES "warehouse_bin" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "received_by_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "receipt_two_different_users" CHECK (NOT ("issued_by_id" = ("received_by_id"))));
--
-- Create model StockLedgerEntry
--
CREATE TABLE "warehouse_stockledgerentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "entry_date" date NOT NULL, "delta_kg" decimal NOT NULL, "balance_kg" decimal NOT NULL, "reference" varchar(120) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint uniq_bin_per_store on model bin
--
CREATE TABLE "new__warehouse_bin" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "bin_code" varchar(24) NOT NULL, "capacity_kg" decimal NOT NULL, "certified_only" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NOT NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_bin_per_store" UNIQUE ("store_id", "bin_code"));
INSERT INTO "new__warehouse_bin" ("id", "created_at", "updated_at", "bin_code", "capacity_kg", "certified_only", "created_by_id", "updated_by_id", "store_id") SELECT "id", "created_at", "updated_at", "bin_code", "capacity_kg", "certified_only", "created_by_id", "updated_by_id", "store_id" FROM "warehouse_bin";
DROP TABLE "warehouse_bin";
ALTER TABLE "new__warehouse_bin" RENAME TO "warehouse_bin";
CREATE INDEX "warehouse_store_created_at_b13b6900" ON "warehouse_store" ("created_at");
CREATE INDEX "warehouse_store_coffee_form_047ebb8b" ON "warehouse_store" ("coffee_form");
CREATE INDEX "warehouse_store_created_by_id_cde301c6" ON "warehouse_store" ("created_by_id");
CREATE INDEX "warehouse_store_station_id_fc9aed38" ON "warehouse_store" ("station_id");
CREATE INDEX "warehouse_store_updated_by_id_ca038e5f" ON "warehouse_store" ("updated_by_id");
CREATE INDEX "warehouse_stocktransfer_created_at_68170b3d" ON "warehouse_stocktransfer" ("created_at");
CREATE INDEX "warehouse_stocktransfer_dispatch_date_986d429b" ON "warehouse_stocktransfer" ("dispatch_date");
CREATE INDEX "warehouse_stocktransfer_status_ef93b065" ON "warehouse_stocktransfer" ("status");
CREATE INDEX "warehouse_stocktransfer_created_by_id_c50cdd48" ON "warehouse_stocktransfer" ("created_by_id");
CREATE INDEX "warehouse_stocktransfer_lot_id_a1bf6568" ON "warehouse_stocktransfer" ("lot_id");
CREATE INDEX "warehouse_stocktransfer_updated_by_id_93b329d9" ON "warehouse_stocktransfer" ("updated_by_id");
CREATE INDEX "warehouse_stocktransfer_from_store_id_878d74de" ON "warehouse_stocktransfer" ("from_store_id");
CREATE INDEX "warehouse_stocktransfer_to_store_id_7874e382" ON "warehouse_stocktransfer" ("to_store_id");
CREATE INDEX "warehouse_gatepass_created_at_9f2856c0" ON "warehouse_gatepass" ("created_at");
CREATE INDEX "warehouse_gatepass_authorised_by_id_81d4c1da" ON "warehouse_gatepass" ("authorised_by_id");
CREATE INDEX "warehouse_gatepass_created_by_id_1ac0fd37" ON "warehouse_gatepass" ("created_by_id");
CREATE INDEX "warehouse_gatepass_lot_id_6ebd4665" ON "warehouse_gatepass" ("lot_id");
CREATE INDEX "warehouse_gatepass_updated_by_id_4501819e" ON "warehouse_gatepass" ("updated_by_id");
CREATE INDEX "warehouse_gatepass_store_id_f89dc226" ON "warehouse_gatepass" ("store_id");
CREATE INDEX "warehouse_stockreceipt_created_at_4ec2839c" ON "warehouse_stockreceipt" ("created_at");
CREATE INDEX "warehouse_stockreceipt_received_date_2cf1e8c4" ON "warehouse_stockreceipt" ("received_date");
CREATE INDEX "warehouse_stockreceipt_bin_id_5023a956" ON "warehouse_stockreceipt" ("bin_id");
CREATE INDEX "warehouse_stockreceipt_created_by_id_dba6f614" ON "warehouse_stockreceipt" ("created_by_id");
CREATE INDEX "warehouse_stockreceipt_issued_by_id_85567561" ON "warehouse_stockreceipt" ("issued_by_id");
CREATE INDEX "warehouse_stockreceipt_lot_id_26f476c2" ON "warehouse_stockreceipt" ("lot_id");
CREATE INDEX "warehouse_stockreceipt_received_by_id_2058e4b1" ON "warehouse_stockreceipt" ("received_by_id");
CREATE INDEX "warehouse_stockreceipt_signoff_id_f74d8ef3" ON "warehouse_stockreceipt" ("signoff_id");
CREATE INDEX "warehouse_stockreceipt_updated_by_id_864ca7da" ON "warehouse_stockreceipt" ("updated_by_id");
CREATE INDEX "warehouse_stockreceipt_store_id_99c02c7e" ON "warehouse_stockreceipt" ("store_id");
CREATE INDEX "warehouse_s_store_i_7f49b4_idx" ON "warehouse_stockreceipt" ("store_id", "received_date");
CREATE INDEX "warehouse_stockledgerentry_created_at_8d7aa8f2" ON "warehouse_stockledgerentry" ("created_at");
CREATE INDEX "warehouse_stockledgerentry_entry_date_94281b95" ON "warehouse_stockledgerentry" ("entry_date");
CREATE INDEX "warehouse_stockledgerentry_created_by_id_5991dc86" ON "warehouse_stockledgerentry" ("created_by_id");
CREATE INDEX "warehouse_stockledgerentry_lot_id_43f5bcb9" ON "warehouse_stockledgerentry" ("lot_id");
CREATE INDEX "warehouse_stockledgerentry_updated_by_id_74e3572b" ON "warehouse_stockledgerentry" ("updated_by_id");
CREATE INDEX "warehouse_stockledgerentry_store_id_49786093" ON "warehouse_stockledgerentry" ("store_id");
CREATE INDEX "warehouse_s_store_i_f841f3_idx" ON "warehouse_stockledgerentry" ("store_id", "lot_id", "entry_date");
CREATE INDEX "warehouse_bin_created_at_38f081d5" ON "warehouse_bin" ("created_at");
CREATE INDEX "warehouse_bin_created_by_id_d001601e" ON "warehouse_bin" ("created_by_id");
CREATE INDEX "warehouse_bin_updated_by_id_7e16f03b" ON "warehouse_bin" ("updated_by_id");
CREATE INDEX "warehouse_bin_store_id_7e5b38f8" ON "warehouse_bin" ("store_id");
COMMIT;

-- ===== migration inventory.0001_initial =====
BEGIN;
--
-- Create model InventoryItem
--
CREATE TABLE "inventory_inventoryitem" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "sku" varchar(32) NOT NULL UNIQUE, "name" varchar(200) NOT NULL, "category" varchar(16) NOT NULL, "unit" varchar(16) NOT NULL, "reorder_level" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model StockAudit
--
CREATE TABLE "inventory_stockaudit" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "audit_number" varchar(40) NOT NULL UNIQUE, "audit_date" date NOT NULL, "status" varchar(12) NOT NULL, "conducted_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "store_id" char(32) NULL REFERENCES "warehouse_store" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model StockAdjustment
--
CREATE TABLE "inventory_stockadjustment" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "book_qty" decimal NOT NULL, "counted_qty" decimal NOT NULL, "variance_reason" varchar(300) NOT NULL, "approved_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "item_id" char(32) NULL REFERENCES "inventory_inventoryitem" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "audit_id" char(32) NOT NULL REFERENCES "inventory_stockaudit" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model StockMovement
--
CREATE TABLE "inventory_stockmovement" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "movement_type" varchar(12) NOT NULL, "delta_qty" decimal NOT NULL, "movement_date" date NOT NULL, "reference" varchar(120) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_to_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "item_id" char(32) NOT NULL REFERENCES "inventory_inventoryitem" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "inventory_inventoryitem_created_at_5aba1a64" ON "inventory_inventoryitem" ("created_at");
CREATE INDEX "inventory_inventoryitem_category_83244552" ON "inventory_inventoryitem" ("category");
CREATE INDEX "inventory_inventoryitem_created_by_id_ab96d248" ON "inventory_inventoryitem" ("created_by_id");
CREATE INDEX "inventory_inventoryitem_updated_by_id_a7c41836" ON "inventory_inventoryitem" ("updated_by_id");
CREATE INDEX "inventory_stockaudit_created_at_ca88c3d4" ON "inventory_stockaudit" ("created_at");
CREATE INDEX "inventory_stockaudit_audit_date_304edc33" ON "inventory_stockaudit" ("audit_date");
CREATE INDEX "inventory_stockaudit_conducted_by_id_82796368" ON "inventory_stockaudit" ("conducted_by_id");
CREATE INDEX "inventory_stockaudit_created_by_id_8a006190" ON "inventory_stockaudit" ("created_by_id");
CREATE INDEX "inventory_stockaudit_station_id_33e5c06c" ON "inventory_stockaudit" ("station_id");
CREATE INDEX "inventory_stockaudit_store_id_8f8e7568" ON "inventory_stockaudit" ("store_id");
CREATE INDEX "inventory_stockaudit_updated_by_id_e01b4744" ON "inventory_stockaudit" ("updated_by_id");
CREATE INDEX "inventory_stockadjustment_created_at_bc543d89" ON "inventory_stockadjustment" ("created_at");
CREATE INDEX "inventory_stockadjustment_approved_by_id_bc6c9592" ON "inventory_stockadjustment" ("approved_by_id");
CREATE INDEX "inventory_stockadjustment_created_by_id_d3ef1412" ON "inventory_stockadjustment" ("created_by_id");
CREATE INDEX "inventory_stockadjustment_item_id_38ddc47d" ON "inventory_stockadjustment" ("item_id");
CREATE INDEX "inventory_stockadjustment_lot_id_b6160436" ON "inventory_stockadjustment" ("lot_id");
CREATE INDEX "inventory_stockadjustment_updated_by_id_2ac866ac" ON "inventory_stockadjustment" ("updated_by_id");
CREATE INDEX "inventory_stockadjustment_audit_id_c8eab64f" ON "inventory_stockadjustment" ("audit_id");
CREATE INDEX "inventory_stockmovement_created_at_05b478ed" ON "inventory_stockmovement" ("created_at");
CREATE INDEX "inventory_stockmovement_movement_type_befd98d1" ON "inventory_stockmovement" ("movement_type");
CREATE INDEX "inventory_stockmovement_movement_date_d8ececeb" ON "inventory_stockmovement" ("movement_date");
CREATE INDEX "inventory_stockmovement_created_by_id_9a39cb99" ON "inventory_stockmovement" ("created_by_id");
CREATE INDEX "inventory_stockmovement_issued_to_id_0c27c833" ON "inventory_stockmovement" ("issued_to_id");
CREATE INDEX "inventory_stockmovement_item_id_dc9becf8" ON "inventory_stockmovement" ("item_id");
CREATE INDEX "inventory_stockmovement_station_id_bdb2f414" ON "inventory_stockmovement" ("station_id");
CREATE INDEX "inventory_stockmovement_updated_by_id_6a322bec" ON "inventory_stockmovement" ("updated_by_id");
CREATE INDEX "inventory_s_item_id_d69272_idx" ON "inventory_stockmovement" ("item_id", "station_id", "movement_date");
COMMIT;

-- ===== migration logistics.0001_initial =====
BEGIN;
--
-- Create model Transporter
--
CREATE TABLE "logistics_transporter" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(24) NOT NULL UNIQUE, "company_name" varchar(240) NOT NULL, "contact_name" varchar(200) NOT NULL, "phone" varchar(32) NOT NULL, "license_number" varchar(120) NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Vehicle
--
CREATE TABLE "logistics_vehicle" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "plate_number" varchar(32) NOT NULL UNIQUE, "vehicle_type" varchar(64) NOT NULL, "capacity_kg" decimal NOT NULL, "driver_name" varchar(200) NOT NULL, "driver_phone" varchar(32) NOT NULL, "driver_license" varchar(64) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "transporter_id" char(32) NOT NULL REFERENCES "logistics_transporter" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model Waybill
--
CREATE TABLE "logistics_waybill" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "waybill_number" varchar(40) NOT NULL UNIQUE, "dispatched_kg" decimal NOT NULL, "bags" integer unsigned NOT NULL CHECK ("bags" >= 0), "dispatched_at" datetime NOT NULL, "delivered_kg" decimal NULL, "delivered_at" datetime NULL, "status" varchar(16) NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "from_station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "issued_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "to_station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "vehicle_id" char(32) NOT NULL REFERENCES "logistics_vehicle" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model TransitCheckpoint
--
CREATE TABLE "logistics_transitcheckpoint" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "kind" varchar(16) NOT NULL, "location_label" varchar(200) NOT NULL, "arrived_at" datetime NOT NULL, "verified_weight_kg" decimal NULL, "notes" text NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "waybill_id" char(32) NOT NULL REFERENCES "logistics_waybill" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create index logistics_w_from_st_565de5_idx on field(s) from_station, status of model waybill
--
CREATE INDEX "logistics_w_from_st_565de5_idx" ON "logistics_waybill" ("from_station_id", "status");
CREATE INDEX "logistics_transporter_created_at_721b0199" ON "logistics_transporter" ("created_at");
CREATE INDEX "logistics_transporter_created_by_id_13c42c4c" ON "logistics_transporter" ("created_by_id");
CREATE INDEX "logistics_transporter_updated_by_id_395731f8" ON "logistics_transporter" ("updated_by_id");
CREATE INDEX "logistics_vehicle_created_at_2dd3b43c" ON "logistics_vehicle" ("created_at");
CREATE INDEX "logistics_vehicle_created_by_id_a511cee4" ON "logistics_vehicle" ("created_by_id");
CREATE INDEX "logistics_vehicle_transporter_id_a9b33abc" ON "logistics_vehicle" ("transporter_id");
CREATE INDEX "logistics_vehicle_updated_by_id_52f1f9b0" ON "logistics_vehicle" ("updated_by_id");
CREATE INDEX "logistics_waybill_created_at_8fe9fb1d" ON "logistics_waybill" ("created_at");
CREATE INDEX "logistics_waybill_dispatched_at_f96aac40" ON "logistics_waybill" ("dispatched_at");
CREATE INDEX "logistics_waybill_status_f8b9f0af" ON "logistics_waybill" ("status");
CREATE INDEX "logistics_waybill_created_by_id_1bd2ebac" ON "logistics_waybill" ("created_by_id");
CREATE INDEX "logistics_waybill_from_station_id_55b4ff73" ON "logistics_waybill" ("from_station_id");
CREATE INDEX "logistics_waybill_issued_by_id_3c738288" ON "logistics_waybill" ("issued_by_id");
CREATE INDEX "logistics_waybill_lot_id_cd86ef17" ON "logistics_waybill" ("lot_id");
CREATE INDEX "logistics_waybill_to_station_id_b51f84be" ON "logistics_waybill" ("to_station_id");
CREATE INDEX "logistics_waybill_updated_by_id_b800b211" ON "logistics_waybill" ("updated_by_id");
CREATE INDEX "logistics_waybill_vehicle_id_e59896b3" ON "logistics_waybill" ("vehicle_id");
CREATE INDEX "logistics_transitcheckpoint_created_at_49c679a4" ON "logistics_transitcheckpoint" ("created_at");
CREATE INDEX "logistics_transitcheckpoint_arrived_at_ecdca19e" ON "logistics_transitcheckpoint" ("arrived_at");
CREATE INDEX "logistics_transitcheckpoint_created_by_id_6ecd5ef9" ON "logistics_transitcheckpoint" ("created_by_id");
CREATE INDEX "logistics_transitcheckpoint_updated_by_id_29526ca6" ON "logistics_transitcheckpoint" ("updated_by_id");
CREATE INDEX "logistics_transitcheckpoint_waybill_id_d4546e3f" ON "logistics_transitcheckpoint" ("waybill_id");
COMMIT;

-- ===== migration payroll.0001_initial =====
BEGIN;
--
-- Create model PayrollPeriod
--
CREATE TABLE "payroll_payrollperiod" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "status" varchar(16) NOT NULL, "total_gross" decimal NOT NULL, "total_deductions" decimal NOT NULL, "total_net" decimal NOT NULL, "approved_at" datetime NULL, "approved_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "prepared_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NOT NULL UNIQUE REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model PayrollLine
--
CREATE TABLE "payroll_payrollline" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "row_no" integer unsigned NOT NULL CHECK ("row_no" >= 0), "total_days" decimal NOT NULL, "total_hours" decimal NOT NULL, "total_pieces" decimal NOT NULL, "wage_rate" decimal NOT NULL, "gross_pay" decimal NOT NULL, "deductions" decimal NOT NULL, "net_pay" decimal NOT NULL, "recipient_signed" bool NOT NULL, "recipient_signature_sha256" varchar(64) NOT NULL, "paid_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED, "period_id" char(32) NOT NULL REFERENCES "payroll_payrollperiod" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create constraint payroll_preparer_ne_approver on model payrollperiod
--
CREATE TABLE "new__payroll_payrollperiod" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "status" varchar(16) NOT NULL, "total_gross" decimal NOT NULL, "total_deductions" decimal NOT NULL, "total_net" decimal NOT NULL, "approved_at" datetime NULL, "approved_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "prepared_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "sheet_id" char(32) NOT NULL UNIQUE REFERENCES "hr_attendancesheet" ("id") DEFERRABLE INITIALLY DEFERRED, "signoff_id" char(32) NULL REFERENCES "core_dualsignoff" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "payroll_preparer_ne_approver" CHECK (("approved_by_id" IS NULL OR NOT ("prepared_by_id" = ("approved_by_id") AND "prepared_by_id" IS NOT NULL AND "approved_by_id" IS NOT NULL))));
INSERT INTO "new__payroll_payrollperiod" ("id", "created_at", "updated_at", "status", "total_gross", "total_deductions", "total_net", "approved_at", "approved_by_id", "created_by_id", "prepared_by_id", "sheet_id", "signoff_id", "station_id", "updated_by_id") SELECT "id", "created_at", "updated_at", "status", "total_gross", "total_deductions", "total_net", "approved_at", "approved_by_id", "created_by_id", "prepared_by_id", "sheet_id", "signoff_id", "station_id", "updated_by_id" FROM "payroll_payrollperiod";
DROP TABLE "payroll_payrollperiod";
ALTER TABLE "new__payroll_payrollperiod" RENAME TO "payroll_payrollperiod";
CREATE INDEX "payroll_payrollline_created_at_14cf9f66" ON "payroll_payrollline" ("created_at");
CREATE INDEX "payroll_payrollline_created_by_id_6bed303a" ON "payroll_payrollline" ("created_by_id");
CREATE INDEX "payroll_payrollline_updated_by_id_8fd668db" ON "payroll_payrollline" ("updated_by_id");
CREATE INDEX "payroll_payrollline_worker_id_06e10cbc" ON "payroll_payrollline" ("worker_id");
CREATE INDEX "payroll_payrollline_period_id_dd01a7d8" ON "payroll_payrollline" ("period_id");
CREATE INDEX "payroll_payrollperiod_created_at_de973d0b" ON "payroll_payrollperiod" ("created_at");
CREATE INDEX "payroll_payrollperiod_status_954a7b0b" ON "payroll_payrollperiod" ("status");
CREATE INDEX "payroll_payrollperiod_approved_by_id_49f512ca" ON "payroll_payrollperiod" ("approved_by_id");
CREATE INDEX "payroll_payrollperiod_created_by_id_199ff73f" ON "payroll_payrollperiod" ("created_by_id");
CREATE INDEX "payroll_payrollperiod_prepared_by_id_d77882cf" ON "payroll_payrollperiod" ("prepared_by_id");
CREATE INDEX "payroll_payrollperiod_signoff_id_b6040deb" ON "payroll_payrollperiod" ("signoff_id");
CREATE INDEX "payroll_payrollperiod_station_id_1bff6005" ON "payroll_payrollperiod" ("station_id");
CREATE INDEX "payroll_payrollperiod_updated_by_id_1a076f9e" ON "payroll_payrollperiod" ("updated_by_id");
--
-- Create constraint uniq_payroll_line on model payrollline
--
CREATE TABLE "new__payroll_payrollline" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "row_no" integer unsigned NOT NULL CHECK ("row_no" >= 0), "total_days" decimal NOT NULL, "total_hours" decimal NOT NULL, "total_pieces" decimal NOT NULL, "wage_rate" decimal NOT NULL, "gross_pay" decimal NOT NULL, "deductions" decimal NOT NULL, "net_pay" decimal NOT NULL, "recipient_signed" bool NOT NULL, "recipient_signature_sha256" varchar(64) NOT NULL, "paid_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED, "period_id" char(32) NOT NULL REFERENCES "payroll_payrollperiod" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_payroll_line" UNIQUE ("period_id", "worker_id"));
INSERT INTO "new__payroll_payrollline" ("id", "created_at", "updated_at", "row_no", "total_days", "total_hours", "total_pieces", "wage_rate", "gross_pay", "deductions", "net_pay", "recipient_signed", "recipient_signature_sha256", "paid_at", "created_by_id", "updated_by_id", "worker_id", "period_id") SELECT "id", "created_at", "updated_at", "row_no", "total_days", "total_hours", "total_pieces", "wage_rate", "gross_pay", "deductions", "net_pay", "recipient_signed", "recipient_signature_sha256", "paid_at", "created_by_id", "updated_by_id", "worker_id", "period_id" FROM "payroll_payrollline";
DROP TABLE "payroll_payrollline";
ALTER TABLE "new__payroll_payrollline" RENAME TO "payroll_payrollline";
CREATE INDEX "payroll_payrollline_created_at_14cf9f66" ON "payroll_payrollline" ("created_at");
CREATE INDEX "payroll_payrollline_created_by_id_6bed303a" ON "payroll_payrollline" ("created_by_id");
CREATE INDEX "payroll_payrollline_updated_by_id_8fd668db" ON "payroll_payrollline" ("updated_by_id");
CREATE INDEX "payroll_payrollline_worker_id_06e10cbc" ON "payroll_payrollline" ("worker_id");
CREATE INDEX "payroll_payrollline_period_id_dd01a7d8" ON "payroll_payrollline" ("period_id");
--
-- Create constraint uniq_payroll_row on model payrollline
--
CREATE TABLE "new__payroll_payrollline" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "row_no" integer unsigned NOT NULL CHECK ("row_no" >= 0), "total_days" decimal NOT NULL, "total_hours" decimal NOT NULL, "total_pieces" decimal NOT NULL, "wage_rate" decimal NOT NULL, "gross_pay" decimal NOT NULL, "deductions" decimal NOT NULL, "net_pay" decimal NOT NULL, "recipient_signed" bool NOT NULL, "recipient_signature_sha256" varchar(64) NOT NULL, "paid_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "worker_id" char(32) NOT NULL REFERENCES "hr_worker" ("id") DEFERRABLE INITIALLY DEFERRED, "period_id" char(32) NOT NULL REFERENCES "payroll_payrollperiod" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_payroll_line" UNIQUE ("period_id", "worker_id"), CONSTRAINT "uniq_payroll_row" UNIQUE ("period_id", "row_no"));
INSERT INTO "new__payroll_payrollline" ("id", "created_at", "updated_at", "row_no", "total_days", "total_hours", "total_pieces", "wage_rate", "gross_pay", "deductions", "net_pay", "recipient_signed", "recipient_signature_sha256", "paid_at", "created_by_id", "updated_by_id", "worker_id", "period_id") SELECT "id", "created_at", "updated_at", "row_no", "total_days", "total_hours", "total_pieces", "wage_rate", "gross_pay", "deductions", "net_pay", "recipient_signed", "recipient_signature_sha256", "paid_at", "created_by_id", "updated_by_id", "worker_id", "period_id" FROM "payroll_payrollline";
DROP TABLE "payroll_payrollline";
ALTER TABLE "new__payroll_payrollline" RENAME TO "payroll_payrollline";
CREATE INDEX "payroll_payrollline_created_at_14cf9f66" ON "payroll_payrollline" ("created_at");
CREATE INDEX "payroll_payrollline_created_by_id_6bed303a" ON "payroll_payrollline" ("created_by_id");
CREATE INDEX "payroll_payrollline_updated_by_id_8fd668db" ON "payroll_payrollline" ("updated_by_id");
CREATE INDEX "payroll_payrollline_worker_id_06e10cbc" ON "payroll_payrollline" ("worker_id");
CREATE INDEX "payroll_payrollline_period_id_dd01a7d8" ON "payroll_payrollline" ("period_id");
COMMIT;

-- ===== migration payments.0001_initial =====
BEGIN;
--
-- Create model Disbursement
--
CREATE TABLE "payments_disbursement" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "reference" varchar(48) NOT NULL UNIQUE, "payee_type" varchar(16) NOT NULL, "amount" decimal NOT NULL, "currency" varchar(3) NOT NULL, "method" varchar(8) NOT NULL, "paid_on" date NULL, "status" varchar(12) NOT NULL, "cash_float_id" char(32) NULL REFERENCES "collection_cashfloat" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "farmer_id" char(32) NULL REFERENCES "farmers_farmer" ("id") DEFERRABLE INITIALLY DEFERRED, "paid_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "payroll_period_id" char(32) NULL REFERENCES "payroll_payrollperiod" ("id") DEFERRABLE INITIALLY DEFERRED, "supplier_id" char(32) NULL REFERENCES "procurement_supplier" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "voucher_id" char(32) NULL REFERENCES "procurement_purchasevoucher" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ExportProceeds
--
CREATE TABLE "payments_exportproceeds" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "settlement_type" varchar(8) NOT NULL, "swift_reference" varchar(64) NOT NULL, "amount_usd" decimal NOT NULL, "received_on" date NULL, "bank_name" varchar(200) NOT NULL, "is_reconciled" bool NOT NULL, "contract_id" char(32) NOT NULL REFERENCES "buyers_salescontract" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model ForexRetention
--
CREATE TABLE "payments_forexretention" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "retention_pct" decimal NOT NULL, "retained_usd" decimal NOT NULL, "surrendered_usd" decimal NOT NULL, "etb_credited" decimal NOT NULL, "exchange_rate" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "proceeds_id" char(32) NOT NULL UNIQUE REFERENCES "payments_exportproceeds" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "payments_disbursement_created_at_ac738589" ON "payments_disbursement" ("created_at");
CREATE INDEX "payments_disbursement_payee_type_6f751f1c" ON "payments_disbursement" ("payee_type");
CREATE INDEX "payments_disbursement_paid_on_922fbdd3" ON "payments_disbursement" ("paid_on");
CREATE INDEX "payments_disbursement_status_bcb05851" ON "payments_disbursement" ("status");
CREATE INDEX "payments_disbursement_cash_float_id_e1d50d6e" ON "payments_disbursement" ("cash_float_id");
CREATE INDEX "payments_disbursement_created_by_id_9b7108a4" ON "payments_disbursement" ("created_by_id");
CREATE INDEX "payments_disbursement_farmer_id_14d2bbac" ON "payments_disbursement" ("farmer_id");
CREATE INDEX "payments_disbursement_paid_by_id_bfc5b298" ON "payments_disbursement" ("paid_by_id");
CREATE INDEX "payments_disbursement_payroll_period_id_b8b0d4b4" ON "payments_disbursement" ("payroll_period_id");
CREATE INDEX "payments_disbursement_supplier_id_374cbb82" ON "payments_disbursement" ("supplier_id");
CREATE INDEX "payments_disbursement_updated_by_id_4adeb1fa" ON "payments_disbursement" ("updated_by_id");
CREATE INDEX "payments_disbursement_voucher_id_dc19653f" ON "payments_disbursement" ("voucher_id");
CREATE INDEX "payments_exportproceeds_created_at_01b52c29" ON "payments_exportproceeds" ("created_at");
CREATE INDEX "payments_exportproceeds_settlement_type_f4fc9871" ON "payments_exportproceeds" ("settlement_type");
CREATE INDEX "payments_exportproceeds_received_on_b6b4720f" ON "payments_exportproceeds" ("received_on");
CREATE INDEX "payments_exportproceeds_contract_id_f3676817" ON "payments_exportproceeds" ("contract_id");
CREATE INDEX "payments_exportproceeds_created_by_id_c9540920" ON "payments_exportproceeds" ("created_by_id");
CREATE INDEX "payments_exportproceeds_updated_by_id_4c94ea5d" ON "payments_exportproceeds" ("updated_by_id");
CREATE INDEX "payments_forexretention_created_at_d076dcd7" ON "payments_forexretention" ("created_at");
CREATE INDEX "payments_forexretention_created_by_id_8730161b" ON "payments_forexretention" ("created_by_id");
CREATE INDEX "payments_forexretention_updated_by_id_92f0e0c5" ON "payments_forexretention" ("updated_by_id");
COMMIT;

-- ===== migration quality.0001_initial =====
BEGIN;
--
-- Create model CuppingScore
--
CREATE TABLE "quality_cuppingscore" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "cupped_on" date NOT NULL, "fragrance_aroma" decimal NOT NULL, "flavour" decimal NOT NULL, "aftertaste" decimal NOT NULL, "acidity" decimal NOT NULL, "body" decimal NOT NULL, "balance" decimal NOT NULL, "uniformity" decimal NOT NULL, "clean_cup" decimal NOT NULL, "sweetness" decimal NOT NULL, "overall" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "q_grader_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model PhysicalAnalysis
--
CREATE TABLE "quality_physicalanalysis" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "analysed_on" date NOT NULL, "moisture_pct" decimal NOT NULL, "water_activity" decimal NULL, "bean_density" decimal NULL, "colour" varchar(64) NOT NULL, "odour" varchar(64) NOT NULL, "primary_defects" integer unsigned NOT NULL CHECK ("primary_defects" >= 0), "secondary_defects" integer unsigned NOT NULL CHECK ("secondary_defects" >= 0), "notes" text NOT NULL, "analyst_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model QualityApproval
--
CREATE TABLE "quality_qualityapproval" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "grade" varchar(4) NOT NULL, "decision" varchar(16) NOT NULL, "decided_at" datetime NOT NULL, "remarks" text NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "cupping_id" char(32) NULL REFERENCES "quality_cuppingscore" ("id") DEFERRABLE INITIALLY DEFERRED, "decided_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "quality_cuppingscore_created_at_a369b8c0" ON "quality_cuppingscore" ("created_at");
CREATE INDEX "quality_cuppingscore_cupped_on_a2abd1a5" ON "quality_cuppingscore" ("cupped_on");
CREATE INDEX "quality_cuppingscore_created_by_id_d2337845" ON "quality_cuppingscore" ("created_by_id");
CREATE INDEX "quality_cuppingscore_lot_id_f3a5df3d" ON "quality_cuppingscore" ("lot_id");
CREATE INDEX "quality_cuppingscore_q_grader_id_0b936c8d" ON "quality_cuppingscore" ("q_grader_id");
CREATE INDEX "quality_cuppingscore_updated_by_id_8b97ec79" ON "quality_cuppingscore" ("updated_by_id");
CREATE INDEX "quality_physicalanalysis_created_at_d2520646" ON "quality_physicalanalysis" ("created_at");
CREATE INDEX "quality_physicalanalysis_analysed_on_52024252" ON "quality_physicalanalysis" ("analysed_on");
CREATE INDEX "quality_physicalanalysis_analyst_id_b8e3f05f" ON "quality_physicalanalysis" ("analyst_id");
CREATE INDEX "quality_physicalanalysis_created_by_id_308bfc0e" ON "quality_physicalanalysis" ("created_by_id");
CREATE INDEX "quality_physicalanalysis_lot_id_2e434596" ON "quality_physicalanalysis" ("lot_id");
CREATE INDEX "quality_physicalanalysis_updated_by_id_ba88ed1c" ON "quality_physicalanalysis" ("updated_by_id");
CREATE INDEX "quality_qualityapproval_created_at_c4f61c53" ON "quality_qualityapproval" ("created_at");
CREATE INDEX "quality_qualityapproval_grade_93530d5c" ON "quality_qualityapproval" ("grade");
CREATE INDEX "quality_qualityapproval_decision_96bd5d5c" ON "quality_qualityapproval" ("decision");
CREATE INDEX "quality_qualityapproval_created_by_id_bd6ca6b3" ON "quality_qualityapproval" ("created_by_id");
CREATE INDEX "quality_qualityapproval_cupping_id_20374797" ON "quality_qualityapproval" ("cupping_id");
CREATE INDEX "quality_qualityapproval_decided_by_id_56058dd0" ON "quality_qualityapproval" ("decided_by_id");
CREATE INDEX "quality_qualityapproval_lot_id_55cdd725" ON "quality_qualityapproval" ("lot_id");
CREATE INDEX "quality_qualityapproval_updated_by_id_f845e3f7" ON "quality_qualityapproval" ("updated_by_id");
COMMIT;

-- ===== migration resources.0001_initial =====
BEGIN;
--
-- Create model FuelRegisterEntry
--
CREATE TABLE "resources_fuelregisterentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "entry_date" date NOT NULL, "machine_label" varchar(120) NOT NULL, "fuel_purchased_litres" decimal NOT NULL, "fuel_added_litres" decimal NOT NULL, "cherry_pulped_kg" decimal NOT NULL, "fuel_ratio" decimal NULL, "is_anomaly" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "operator_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_fuel_entry" UNIQUE ("station_id", "entry_date", "machine_label"));
--
-- Create model WaterRegisterEntry
--
CREATE TABLE "resources_waterregisterentry" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "entry_date" date NOT NULL, "meter_reading_litres" decimal NOT NULL, "previous_reading_litres" decimal NOT NULL, "consumption_litres" decimal NOT NULL, "previous_day_pulped_kg" decimal NOT NULL, "recycled_litres" decimal NOT NULL, "lagoon_level_pct" decimal NULL, "water_ratio" decimal NULL, "is_anomaly" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "recorded_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_water_entry" UNIQUE ("station_id", "entry_date"));
CREATE INDEX "resources_fuelregisterentry_created_at_28bce3aa" ON "resources_fuelregisterentry" ("created_at");
CREATE INDEX "resources_fuelregisterentry_entry_date_0b2c6619" ON "resources_fuelregisterentry" ("entry_date");
CREATE INDEX "resources_fuelregisterentry_created_by_id_10e6cb08" ON "resources_fuelregisterentry" ("created_by_id");
CREATE INDEX "resources_fuelregisterentry_operator_id_80d26660" ON "resources_fuelregisterentry" ("operator_id");
CREATE INDEX "resources_fuelregisterentry_station_id_ceeb15fd" ON "resources_fuelregisterentry" ("station_id");
CREATE INDEX "resources_fuelregisterentry_updated_by_id_2414c69b" ON "resources_fuelregisterentry" ("updated_by_id");
CREATE INDEX "resources_f_station_b727c6_idx" ON "resources_fuelregisterentry" ("station_id", "entry_date");
CREATE INDEX "resources_waterregisterentry_created_at_8235a238" ON "resources_waterregisterentry" ("created_at");
CREATE INDEX "resources_waterregisterentry_entry_date_3c38c62e" ON "resources_waterregisterentry" ("entry_date");
CREATE INDEX "resources_waterregisterentry_created_by_id_94a4a031" ON "resources_waterregisterentry" ("created_by_id");
CREATE INDEX "resources_waterregisterentry_recorded_by_id_c22cf4f2" ON "resources_waterregisterentry" ("recorded_by_id");
CREATE INDEX "resources_waterregisterentry_station_id_b6baafa1" ON "resources_waterregisterentry" ("station_id");
CREATE INDEX "resources_waterregisterentry_updated_by_id_b1cd9ee6" ON "resources_waterregisterentry" ("updated_by_id");
CREATE INDEX "resources_w_station_d5636a_idx" ON "resources_waterregisterentry" ("station_id", "entry_date");
COMMIT;

-- ===== migration sessions.0001_initial =====
BEGIN;
--
-- Create model Session
--
CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);
CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session" ("expire_date");
COMMIT;

-- ===== migration sync.0001_initial =====
BEGIN;
--
-- Create model SyncQueueItem
--
CREATE TABLE "sync_syncqueueitem" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "client_uuid" char(32) NOT NULL UNIQUE, "device_id" varchar(64) NOT NULL, "entity_type" varchar(64) NOT NULL, "entity_uuid" char(32) NULL, "payload" text NOT NULL CHECK ((JSON_VALID("payload") OR "payload" IS NULL)), "client_created_at" datetime NOT NULL, "status" varchar(12) NOT NULL, "server_received_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model SyncConflict
--
CREATE TABLE "sync_syncconflict" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "field_name" varchar(120) NOT NULL, "client_value" text NOT NULL CHECK ((JSON_VALID("client_value") OR "client_value" IS NULL)), "server_value" text NOT NULL CHECK ((JSON_VALID("server_value") OR "server_value" IS NULL)), "resolution" varchar(16) NOT NULL, "resolved_at" datetime NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "resolved_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "queue_item_id" char(32) NOT NULL REFERENCES "sync_syncqueueitem" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create index sync_syncqu_device__8aaea7_idx on field(s) device_id, status of model syncqueueitem
--
CREATE INDEX "sync_syncqu_device__8aaea7_idx" ON "sync_syncqueueitem" ("device_id", "status");
--
-- Create index sync_syncqu_entity__db97e4_idx on field(s) entity_type, entity_uuid of model syncqueueitem
--
CREATE INDEX "sync_syncqu_entity__db97e4_idx" ON "sync_syncqueueitem" ("entity_type", "entity_uuid");
CREATE INDEX "sync_syncqueueitem_created_at_13732260" ON "sync_syncqueueitem" ("created_at");
CREATE INDEX "sync_syncqueueitem_device_id_a2ac213e" ON "sync_syncqueueitem" ("device_id");
CREATE INDEX "sync_syncqueueitem_entity_type_e3c24666" ON "sync_syncqueueitem" ("entity_type");
CREATE INDEX "sync_syncqueueitem_entity_uuid_f93c351f" ON "sync_syncqueueitem" ("entity_uuid");
CREATE INDEX "sync_syncqueueitem_client_created_at_9f31ca3d" ON "sync_syncqueueitem" ("client_created_at");
CREATE INDEX "sync_syncqueueitem_status_e7a2bcfa" ON "sync_syncqueueitem" ("status");
CREATE INDEX "sync_syncqueueitem_created_by_id_840ca404" ON "sync_syncqueueitem" ("created_by_id");
CREATE INDEX "sync_syncqueueitem_station_id_43ebd1c3" ON "sync_syncqueueitem" ("station_id");
CREATE INDEX "sync_syncqueueitem_updated_by_id_e98a69d6" ON "sync_syncqueueitem" ("updated_by_id");
CREATE INDEX "sync_syncqueueitem_user_id_f2159d8b" ON "sync_syncqueueitem" ("user_id");
CREATE INDEX "sync_syncconflict_created_at_37ebb4af" ON "sync_syncconflict" ("created_at");
CREATE INDEX "sync_syncconflict_resolution_0b0f8c50" ON "sync_syncconflict" ("resolution");
CREATE INDEX "sync_syncconflict_created_by_id_cd8e8d6f" ON "sync_syncconflict" ("created_by_id");
CREATE INDEX "sync_syncconflict_resolved_by_id_0fe7be33" ON "sync_syncconflict" ("resolved_by_id");
CREATE INDEX "sync_syncconflict_updated_by_id_e0ed22fe" ON "sync_syncconflict" ("updated_by_id");
CREATE INDEX "sync_syncconflict_queue_item_id_bc7dff2c" ON "sync_syncconflict" ("queue_item_id");
COMMIT;

-- ===== migration sysconf.0001_initial =====
BEGIN;
--
-- Create model GradeDefinition
--
CREATE TABLE "sysconf_gradedefinition" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(16) NOT NULL UNIQUE, "name" varchar(120) NOT NULL, "min_cup_score" decimal NULL, "max_defects" integer unsigned NULL CHECK ("max_defects" >= 0), "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model MeasurementUnit
--
CREATE TABLE "sysconf_measurementunit" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "code" varchar(16) NOT NULL UNIQUE, "name" varchar(64) NOT NULL, "to_base_factor" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model FermentationTank
--
CREATE TABLE "sysconf_fermentationtank" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "tank_no" varchar(24) NOT NULL, "capacity_kg" decimal NOT NULL, "is_active" bool NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NOT NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_tank_per_station" UNIQUE ("station_id", "tank_no"));
--
-- Create model ThresholdConfig
--
CREATE TABLE "sysconf_thresholdconfig" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "moisture_min_pct" decimal NOT NULL, "moisture_max_pct" decimal NOT NULL, "max_fuel_ratio_l_per_kg" decimal NOT NULL, "max_water_ratio_l_per_kg" decimal NOT NULL, "max_transit_shrinkage_pct" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL UNIQUE REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "moisture_min_lt_max" CHECK ("moisture_min_pct" < ("moisture_max_pct")));
--
-- Create model YieldBenchmark
--
CREATE TABLE "sysconf_yieldbenchmark" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "conversion" varchar(24) NOT NULL, "expected_ratio" decimal NOT NULL, "min_ratio" decimal NOT NULL, "max_ratio" decimal NOT NULL, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "station_id" char(32) NULL REFERENCES "core_station" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "uniq_yield_benchmark" UNIQUE ("station_id", "conversion"));
CREATE INDEX "sysconf_gradedefinition_created_at_973d9429" ON "sysconf_gradedefinition" ("created_at");
CREATE INDEX "sysconf_gradedefinition_created_by_id_bb344f5d" ON "sysconf_gradedefinition" ("created_by_id");
CREATE INDEX "sysconf_gradedefinition_updated_by_id_31f472ac" ON "sysconf_gradedefinition" ("updated_by_id");
CREATE INDEX "sysconf_measurementunit_created_at_7235752a" ON "sysconf_measurementunit" ("created_at");
CREATE INDEX "sysconf_measurementunit_created_by_id_29ebb3be" ON "sysconf_measurementunit" ("created_by_id");
CREATE INDEX "sysconf_measurementunit_updated_by_id_8c29db9e" ON "sysconf_measurementunit" ("updated_by_id");
CREATE INDEX "sysconf_fermentationtank_created_at_ec2bcdda" ON "sysconf_fermentationtank" ("created_at");
CREATE INDEX "sysconf_fermentationtank_created_by_id_485927ae" ON "sysconf_fermentationtank" ("created_by_id");
CREATE INDEX "sysconf_fermentationtank_station_id_0a2e2fab" ON "sysconf_fermentationtank" ("station_id");
CREATE INDEX "sysconf_fermentationtank_updated_by_id_3c35530e" ON "sysconf_fermentationtank" ("updated_by_id");
CREATE INDEX "sysconf_thresholdconfig_created_at_a817375f" ON "sysconf_thresholdconfig" ("created_at");
CREATE INDEX "sysconf_thresholdconfig_created_by_id_808617d5" ON "sysconf_thresholdconfig" ("created_by_id");
CREATE INDEX "sysconf_thresholdconfig_updated_by_id_68948c64" ON "sysconf_thresholdconfig" ("updated_by_id");
CREATE INDEX "sysconf_yieldbenchmark_created_at_344fa160" ON "sysconf_yieldbenchmark" ("created_at");
CREATE INDEX "sysconf_yieldbenchmark_conversion_a81d0e52" ON "sysconf_yieldbenchmark" ("conversion");
CREATE INDEX "sysconf_yieldbenchmark_created_by_id_8be75813" ON "sysconf_yieldbenchmark" ("created_by_id");
CREATE INDEX "sysconf_yieldbenchmark_station_id_cc82623d" ON "sysconf_yieldbenchmark" ("station_id");
CREATE INDEX "sysconf_yieldbenchmark_updated_by_id_cc864f97" ON "sysconf_yieldbenchmark" ("updated_by_id");
COMMIT;

-- ===== migration traceability.0001_initial =====
BEGIN;
--
-- Create model ComminglingCheck
--
CREATE TABLE "traceability_comminglingcheck" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "checked_at" datetime NOT NULL, "location_label" varchar(200) NOT NULL, "certified_separation_ok" bool NOT NULL, "result" varchar(16) NOT NULL, "notes" text NOT NULL, "checked_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
--
-- Create model LotLineageEdge
--
CREATE TABLE "traceability_lotlineageedge" ("id" char(32) NOT NULL PRIMARY KEY, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "edge_type" varchar(16) NOT NULL, "weight_kg" decimal NOT NULL, "ratio" decimal NOT NULL, "occurred_at" datetime NOT NULL, "child_lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "parent_lot_id" char(32) NOT NULL REFERENCES "processing_lot" ("id") DEFERRABLE INITIALLY DEFERRED, "performed_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "updated_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "lineage_no_self_edge" CHECK (NOT ("parent_lot_id" = ("child_lot_id"))), CONSTRAINT "lineage_ratio_0_1" CHECK (("ratio" >= '0' AND "ratio" <= '1')), CONSTRAINT "uniq_lineage_edge" UNIQUE ("parent_lot_id", "child_lot_id", "edge_type"));
CREATE INDEX "traceability_comminglingcheck_created_at_0f2d8ea6" ON "traceability_comminglingcheck" ("created_at");
CREATE INDEX "traceability_comminglingcheck_checked_at_7959c9df" ON "traceability_comminglingcheck" ("checked_at");
CREATE INDEX "traceability_comminglingcheck_result_82b78168" ON "traceability_comminglingcheck" ("result");
CREATE INDEX "traceability_comminglingcheck_checked_by_id_b926c003" ON "traceability_comminglingcheck" ("checked_by_id");
CREATE INDEX "traceability_comminglingcheck_created_by_id_4c9a54ed" ON "traceability_comminglingcheck" ("created_by_id");
CREATE INDEX "traceability_comminglingcheck_lot_id_7f1980b7" ON "traceability_comminglingcheck" ("lot_id");
CREATE INDEX "traceability_comminglingcheck_updated_by_id_4f2f8f85" ON "traceability_comminglingcheck" ("updated_by_id");
CREATE INDEX "traceability_lotlineageedge_created_at_9bb1d953" ON "traceability_lotlineageedge" ("created_at");
CREATE INDEX "traceability_lotlineageedge_edge_type_47a74965" ON "traceability_lotlineageedge" ("edge_type");
CREATE INDEX "traceability_lotlineageedge_occurred_at_94e30011" ON "traceability_lotlineageedge" ("occurred_at");
CREATE INDEX "traceability_lotlineageedge_child_lot_id_88cf1a67" ON "traceability_lotlineageedge" ("child_lot_id");
CREATE INDEX "traceability_lotlineageedge_created_by_id_58030767" ON "traceability_lotlineageedge" ("created_by_id");
CREATE INDEX "traceability_lotlineageedge_parent_lot_id_dea9bf2e" ON "traceability_lotlineageedge" ("parent_lot_id");
CREATE INDEX "traceability_lotlineageedge_performed_by_id_80fd9bc4" ON "traceability_lotlineageedge" ("performed_by_id");
CREATE INDEX "traceability_lotlineageedge_updated_by_id_9a26195c" ON "traceability_lotlineageedge" ("updated_by_id");
CREATE INDEX "traceabilit_child_l_bcc1e2_idx" ON "traceability_lotlineageedge" ("child_lot_id");
CREATE INDEX "traceabilit_parent__231ab6_idx" ON "traceability_lotlineageedge" ("parent_lot_id");
COMMIT;

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
