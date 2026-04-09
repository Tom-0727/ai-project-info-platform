#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://ai-projects-scout.tom-blogs.top}"
HEALTH_URL="${BASE_URL%/}/api/health"

echo "[verify:web] validate project data"
node scripts/validate-projects.mjs
echo "[verify:web] check service health: $HEALTH_URL"
HEALTH_PAYLOAD="$(curl --fail --silent --show-error "$HEALTH_URL")"
echo "[verify:web] health payload: $HEALTH_PAYLOAD"
echo "[verify:web] run browser smoke"
npm run smoke:web -- "$BASE_URL"
