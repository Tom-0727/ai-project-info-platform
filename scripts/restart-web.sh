#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-ai-project-scout-web.service}"
HEALTH_URL="${HEALTH_URL:-https://ai-projects-scout.tom-blogs.top/api/health}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"

echo "[restart:web] restarting $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active "$SERVICE_NAME" >/dev/null

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if HEALTH_PAYLOAD="$(curl --fail --silent --show-error "$HEALTH_URL" 2>/dev/null)"; then
    echo "[restart:web] health payload: $HEALTH_PAYLOAD"
    exit 0
  fi
  echo "[restart:web] waiting for health ($attempt/$MAX_ATTEMPTS)"
  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

echo "[restart:web] health check failed after restart: $HEALTH_URL" >&2
exit 1
