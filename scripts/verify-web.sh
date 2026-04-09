#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
OUTPUT_FORMAT="text"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/verify-web.sh
  ./scripts/verify-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/verify-web.sh --json
  ./scripts/verify-web.sh https://ai-projects-scout.tom-blogs.top

Options:
  --base-url URL     Override the base URL used for health checks and browser smoke.
  --json             Emit machine-readable JSON instead of text output.
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
    --json)
      OUTPUT_FORMAT="json"
      shift
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

DOCTOR_PAYLOAD="$(./scripts/doctor-web.sh --base-url "$BASE_URL" --json)"
LOCAL_REVISION="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("local_revision",""))')"
SERVICE_STATE="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("service_state",""))')"
HEALTH_PAYLOAD="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin).get("health_payload", {}), ensure_ascii=False))')"
LIVE_REVISION="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("live_revision",""))')"
DRIFT_STATUS="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("drift",""))')"
VALIDATE_OUTPUT="$(node scripts/validate-projects.mjs)"
SMOKE_OUTPUT="$(npm run smoke:web -- "$BASE_URL")"

if [ "$OUTPUT_FORMAT" = "json" ]; then
  export BASE_URL HEALTH_URL DOCTOR_PAYLOAD VALIDATE_OUTPUT SMOKE_OUTPUT
  python3 - <<'PY'
import json
import os

doctor = json.loads(os.environ["DOCTOR_PAYLOAD"])
validate_output = os.environ["VALIDATE_OUTPUT"].strip()
smoke_output = os.environ["SMOKE_OUTPUT"].strip()

print(json.dumps({
    "base_url": os.environ["BASE_URL"],
    "health_url": os.environ["HEALTH_URL"],
    "validate": {
        "status": "ok",
        "summary": validate_output,
    },
    "runtime": doctor,
    "smoke": {
        "status": "ok" if "SMOKE_OK" in smoke_output else "unknown",
        "summary": smoke_output.splitlines()[-1] if smoke_output else "",
        "raw": smoke_output,
    },
}, ensure_ascii=False, indent=2))
PY
  exit 0
fi

echo "[verify:web] validate project data"
printf '%s\n' "$VALIDATE_OUTPUT"
echo "[verify:web] check runtime state via doctor:web"
echo "[verify:web] local revision: $LOCAL_REVISION"
echo "[verify:web] service state: ${SERVICE_STATE:-unknown}"
echo "[verify:web] check service health: $HEALTH_URL"
echo "[verify:web] health payload: $HEALTH_PAYLOAD"
if [ "$DRIFT_STATUS" = "drift" ] && [ -n "$LIVE_REVISION" ] && [ -n "$LOCAL_REVISION" ]; then
  echo "[verify:web] warning: live revision ($LIVE_REVISION) differs from local HEAD ($LOCAL_REVISION)"
fi
echo "[verify:web] run browser smoke"
printf '%s\n' "$SMOKE_OUTPUT"
