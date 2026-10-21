import os
"""Print model/table counts per app from the live Django registry."""
import sys; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "murago.settings")
django.setup()
from django.apps import apps
total = 0
for cfg in apps.get_app_configs():
    if cfg.name.startswith("django.") or cfg.name in ("rest_framework", "django_filters"):
        continue
    models = list(cfg.get_models())
    if models:
        print(f"{cfg.label:14s} {len(models):3d}  " + ", ".join(m.__name__ for m in models))
        total += len(models)
print(f"TOTAL_MODELS {total}")
