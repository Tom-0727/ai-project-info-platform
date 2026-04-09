#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/verify-web.sh
  ./scripts/verify-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/verify-web.sh https://ai-projects-scout.tom-blogs.top

Options:
  --base-url URL     Override the base URL used for health checks and browser smoke.
  --help             Show this help message.

Compatibility:
  If the first positional argument is present, it is treated as the base URL,
  matching the older script behavior.
EOF
}

POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      if [ "${2:-}" = "" ]; then
        echo "[verify:web] abort: --base-url requires a value" >&2
        exit 1
      fi
      BASE_URL="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    --*)
      echo "[verify:web] abort: unknown option $1" >&2
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
  BASE_URL="${POSITIONAL[0]}"
fi

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
