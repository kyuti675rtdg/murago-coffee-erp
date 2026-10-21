"""Murago Coffee ERP (Bean Power ERP) — settings.

Stack decision: Django 5.2 + DRF + PostgreSQL/PostGIS (GeoDjango).
DATABASE_URL aware:
  * postgis://...  -> django.contrib.gis.db.backends.postgis (production)
  * postgres://... -> django.contrib.gis.db.backends.postgis (production)
  * unset          -> SQLite fallback for local check/test ONLY (documented in README).
GIS (GDAL/GEOS) is auto-detected; when the native libraries are absent the
farmers app stores GeoJSON in JSONFields locally, while sql/phase1_schema.sql
carries the true production geometry(Polygon,4326) DDL.
"""
import os
from ctypes.util import find_library
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def _gis_available() -> bool:
    pref = os.environ.get("MURAGO_USE_GIS", "auto").lower()
    if pref in ("0", "false", "no"):
        return False
    if pref in ("1", "true", "yes"):
        return True
    # Prefer Django's own GDAL/GEOS detection (it searches more library paths
    # than a bare find_library — the first Render deploy proved the difference).
    try:
        from django.contrib.gis.gdal import HAS_GDAL
        from django.contrib.gis.geos import HAS_GEOS
        return bool(HAS_GDAL and HAS_GEOS)
    except Exception:
        return bool(find_library("gdal") or find_library("GDAL")) and bool(find_library("geos_c"))

GIS_AVAILABLE = _gis_available()

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# Phase 4 production hardening — all behind env flags so local dev is unchanged.
# Production (Render) sets MURAGO_HARDEN=1.
HARDEN = os.environ.get("MURAGO_HARDEN", "0") == "1"
SECURE_SSL_REDIRECT = HARDEN
SESSION_COOKIE_SECURE = HARDEN
CSRF_COOKIE_SECURE = HARDEN
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # SPA reads CSRF cookie if session auth is used; token auth is primary
SECURE_HSTS_SECONDS = 31536000 if HARDEN else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = HARDEN
SECURE_HSTS_PRELOAD = HARDEN
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if HARDEN else None
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
CSRF_TRUSTED_ORIGINS = [o for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o]
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h]

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "rest_framework.authtoken", "django_filters", "drf_spectacular",
    "api",
    "core", "farmers", "collection", "procurement", "processing", "drymill",
    "traceability", "quality", "warehouse", "resources", "hr", "payroll",
    "buyers", "exports", "logistics", "finance", "payments", "inventory",
    "bi", "sync", "sysconf",
]
if GIS_AVAILABLE:
    INSTALLED_APPS.insert(6, "django.contrib.gis")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "murago.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True,
              "OPTIONS": {"context_processors": ["django.template.context_processors.request",
                                                 "django.contrib.auth.context_processors.auth",
                                                 "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "murago.wsgi.application"

_db_url = os.environ.get("DATABASE_URL", "").strip()
if _db_url:
    import dj_database_url
    DATABASES = {"default": dj_database_url.parse(_db_url)}
    if _db_url.startswith(("postgres", "postgis")):
        DATABASES["default"]["ENGINE"] = (
            "django.contrib.gis.db.backends.postgis" if GIS_AVAILABLE else "django.db.backends.postgresql"
        )
else:
    # Local fallback ONLY (check / test / demo). Production must set a PostGIS DATABASE_URL.
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Addis_Ababa"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
_frontend_dist = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [_frontend_dist] if _frontend_dist.exists() else []
STORAGES = {"staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
            "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}}
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
# Auth choice (Phase 2): DRF TokenAuthentication — one revocable token per
# field device/user; documented in api/permissions.py and README.
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}
SPECTACULAR_SETTINGS = {"TITLE": "Murago Coffee ERP API", "VERSION": "2.0.0",
                        "DESCRIPTION": "Farm-to-export coffee ERP — Phase 2 REST API (23 modules)"}
