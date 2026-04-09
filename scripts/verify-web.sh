#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://ai-projects-scout.tom-blogs.top}"
HEALTH_URL="${BASE_URL%/}/api/health"
LOCAL_REVISION="$(git rev-parse --short HEAD)"

echo "[verify:web] validate project data"
node scripts/validate-projects.mjs
echo "[verify:web] local revision: $LOCAL_REVISION"
echo "[verify:web] check service health: $HEALTH_URL"
HEALTH_PAYLOAD="$(curl --fail --silent --show-error "$HEALTH_URL")"
echo "[verify:web] health payload: $HEALTH_PAYLOAD"
LIVE_REVISION="$(printf '%s' "$HEALTH_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("revision",""))')"
if [ -n "$LIVE_REVISION" ] && [ "$LIVE_REVISION" != "$LOCAL_REVISION" ]; then
  echo "[verify:web] warning: live revision ($LIVE_REVISION) differs from local HEAD ($LOCAL_REVISION)"
fi
echo "[verify:web] run browser smoke"
npm run smoke:web -- "$BASE_URL"
