#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
SERVICE_NAME="${SERVICE_NAME:-ai-project-scout-web.service}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/doctor-web.sh
  ./scripts/doctor-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/doctor-web.sh --service ai-project-scout-web.service

Options:
  --base-url URL     Override the base URL used for the live health check.
  --service NAME     Override the systemd service name.
  --help             Show this help message.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      if [ "${2:-}" = "" ]; then
        echo "[doctor:web] abort: --base-url requires a value" >&2
        exit 1
      fi
      BASE_URL="$2"
      shift 2
      ;;
    --service)
      if [ "${2:-}" = "" ]; then
        echo "[doctor:web] abort: --service requires a value" >&2
        exit 1
      fi
      SERVICE_NAME="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    --*)
      echo "[doctor:web] abort: unknown option $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      echo "[doctor:web] abort: unexpected positional argument $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

HEALTH_URL="${BASE_URL%/}/api/health"
LOCAL_REVISION="$(git rev-parse --short HEAD)"
CURRENT_BRANCH="$(git branch --show-current)"
TREE_STATUS="$(git status --short)"
if [ -z "$TREE_STATUS" ]; then
  TREE_STATUS="clean"
fi
SERVICE_STATE="$(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)"
if [ -z "$SERVICE_STATE" ]; then
  SERVICE_STATE="unknown"
fi

echo "[doctor:web] branch: $CURRENT_BRANCH"
echo "[doctor:web] local revision: $LOCAL_REVISION"
echo "[doctor:web] working tree:"
printf '%s\n' "$TREE_STATUS"
echo "[doctor:web] service: $SERVICE_NAME"
echo "[doctor:web] service state: $SERVICE_STATE"
echo "[doctor:web] health url: $HEALTH_URL"

if HEALTH_PAYLOAD="$(curl --fail --silent --show-error "$HEALTH_URL" 2>/dev/null)"; then
  LIVE_REVISION="$(printf '%s' "$HEALTH_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("revision",""))')"
  echo "[doctor:web] health payload: $HEALTH_PAYLOAD"
  if [ -n "$LIVE_REVISION" ] && [ "$LIVE_REVISION" != "$LOCAL_REVISION" ]; then
    echo "[doctor:web] drift: live revision ($LIVE_REVISION) differs from local HEAD ($LOCAL_REVISION)"
  else
    echo "[doctor:web] drift: aligned"
  fi
else
  echo "[doctor:web] health payload: unavailable" >&2
  exit 1
fi
