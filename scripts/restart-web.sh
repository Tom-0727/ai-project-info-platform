#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
SERVICE_NAME="ai-project-scout-web.service"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/restart-web.sh
  ./scripts/restart-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/restart-web.sh --service ai-project-scout-web.service

Options:
  --base-url URL     Override the base URL used for the post-restart health check.
  --service NAME     Override the systemd service name.
  --help             Show this help message.

Compatibility:
  If the first positional argument is present, it is treated as the service name,
  matching the older script behavior.
EOF
}

POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      if [ "${2:-}" = "" ]; then
        echo "[restart:web] abort: --base-url requires a value" >&2
        exit 1
      fi
      BASE_URL="$2"
      shift 2
      ;;
    --service)
      if [ "${2:-}" = "" ]; then
        echo "[restart:web] abort: --service requires a value" >&2
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
      echo "[restart:web] abort: unknown option $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [ "${#POSITIONAL[@]}" -gt 0 ]; then
  SERVICE_NAME="${POSITIONAL[0]}"
fi

HEALTH_URL="${HEALTH_URL:-${BASE_URL%/}/api/health}"

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
