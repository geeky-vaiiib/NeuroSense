#!/bin/bash
# Local end-to-end backend: in-memory MongoDB (mongomock), throw-away secrets, real OpenFace via Docker if available.
# NOT for production. Usage: scripts/dev_e2e_backend.sh [port]
cd "$(dirname "$0")/.."
export MONGODB_URI="mongomock://e2e" MONGODB_DB_NAME="neurosense_e2e"
export JWT_SECRET="e2e-only-secret-$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
export COOKIE_SECURE=false CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
export GAZE_LAB_ENABLED=1 OPENFACE_DOCKER_IMAGE="${OPENFACE_DOCKER_IMAGE:-algebr/openface}" GAZE_WARMUP=0
exec python3 -m uvicorn backend.main:app --host 127.0.0.1 --port "${1:-8000}"
