#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
SERVICE_NAME="${SERVICE_NAME:-ai-project-scout-web.service}"
OUTPUT_FORMAT="text"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/doctor-web.sh
  ./scripts/doctor-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/doctor-web.sh --service ai-project-scout-web.service
  ./scripts/doctor-web.sh --json

Options:
  --base-url URL     Override the base URL used for the live health check.
  --service NAME     Override the systemd service name.
  --json             Emit machine-readable JSON instead of text output.
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
    --json)
      OUTPUT_FORMAT="json"
      shift
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

if HEALTH_PAYLOAD="$(curl --fail --silent --show-error "$HEALTH_URL" 2>/dev/null)"; then
  LIVE_REVISION="$(printf '%s' "$HEALTH_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("revision",""))')"
else
  echo "[doctor:web] health payload: unavailable" >&2
  exit 1
fi

if [ -n "$LIVE_REVISION" ] && [ "$LIVE_REVISION" != "$LOCAL_REVISION" ]; then
  DRIFT_STATUS="drift"
else
  DRIFT_STATUS="aligned"
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
  export CURRENT_BRANCH LOCAL_REVISION TREE_STATUS SERVICE_NAME SERVICE_STATE HEALTH_URL HEALTH_PAYLOAD LIVE_REVISION DRIFT_STATUS
  python3 - <<'PY'
import json
import os

tree_status = os.environ["TREE_STATUS"]
working_tree = ["clean"] if tree_status == "clean" else [line for line in tree_status.splitlines() if line.strip()]

payload = json.loads(os.environ["HEALTH_PAYLOAD"])

print(json.dumps({
    "branch": os.environ["CURRENT_BRANCH"],
    "local_revision": os.environ["LOCAL_REVISION"],
    "working_tree": working_tree,
    "service": os.environ["SERVICE_NAME"],
    "service_state": os.environ["SERVICE_STATE"],
    "health_url": os.environ["HEALTH_URL"],
    "health_payload": payload,
    "live_revision": os.environ["LIVE_REVISION"],
    "drift": os.environ["DRIFT_STATUS"],
}, ensure_ascii=False, indent=2))
PY
  exit 0
fi

echo "[doctor:web] branch: $CURRENT_BRANCH"
echo "[doctor:web] local revision: $LOCAL_REVISION"
echo "[doctor:web] working tree:"
printf '%s\n' "$TREE_STATUS"
echo "[doctor:web] service: $SERVICE_NAME"
echo "[doctor:web] service state: $SERVICE_STATE"
echo "[doctor:web] health url: $HEALTH_URL"
echo "[doctor:web] health payload: $HEALTH_PAYLOAD"
if [ "$DRIFT_STATUS" = "drift" ]; then
  echo "[doctor:web] drift: live revision ($LIVE_REVISION) differs from local HEAD ($LOCAL_REVISION)"
else
  echo "[doctor:web] drift: aligned"
fi
