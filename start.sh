#!/usr/bin/env bash
# Murago Coffee ERP — local start (SQLite fallback when DATABASE_URL unset)
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
. .venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate --noinput
python manage.py runserver 127.0.0.1:8910
