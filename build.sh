#!/usr/bin/env bash
# Render build: Python deps + frontend build + collectstatic.
# DB steps (ensure logical DB, migrate, PostGIS check, seed) run in the
# start command — the internal DB connection is a runtime concern.
set -o errexit
pip install -r requirements.txt
cd frontend
npm ci --no-audit --no-fund
npm run build
cd ..
python manage.py collectstatic --noinput
