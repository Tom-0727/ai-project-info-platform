#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
PUSH_TARGET="origin HEAD:main"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-publish-cases}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy-web.sh
  ./scripts/deploy-web.sh --base-url https://ai-projects-scout.tom-blogs.top
  ./scripts/deploy-web.sh --push-target "origin HEAD:main"
  ./scripts/deploy-web.sh https://ai-projects-scout.tom-blogs.top

Options:
  --base-url URL       Override the site base URL used for verify and health checks.
  --push-target SPEC   Override the git push target.
  --help               Show this help message.

Compatibility:
  If the first positional argument starts with http:// or https://, it is treated
  as the base URL. Otherwise the first positional argument is treated as the push
  target, matching the older script behavior.
EOF
}

POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      if [ "${2:-}" = "" ]; then
        echo "[deploy:web] abort: --base-url requires a value" >&2
        exit 1
      fi
      BASE_URL="$2"
      shift 2
      ;;
    --push-target)
      if [ "${2:-}" = "" ]; then
        echo "[deploy:web] abort: --push-target requires a value" >&2
        exit 1
      fi
      PUSH_TARGET="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    --*)
      echo "[deploy:web] abort: unknown option $1" >&2
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
  if [[ "${POSITIONAL[0]}" =~ ^https?:// ]]; then
    BASE_URL="${POSITIONAL[0]}"
    if [ "${#POSITIONAL[@]}" -gt 1 ]; then
      PUSH_TARGET="${POSITIONAL[1]}"
    fi
  else
    PUSH_TARGET="${POSITIONAL[0]}"
  fi
fi

cd "$ROOT_DIR"

if [ -n "$(git status --short)" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "[deploy:web] dry run warning: working tree is not clean" >&2
    git status --short
  else
    echo "[deploy:web] abort: working tree is not clean" >&2
    git status --short
    exit 1
  fi
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ -n "$EXPECTED_BRANCH" ] && [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "[deploy:web] dry run warning: expected branch $EXPECTED_BRANCH, got $CURRENT_BRANCH" >&2
  else
    echo "[deploy:web] abort: expected branch $EXPECTED_BRANCH, got $CURRENT_BRANCH" >&2
    exit 1
  fi
fi

PREFLIGHT_DOCTOR_PAYLOAD="$(./scripts/doctor-web.sh --base-url "$BASE_URL" --json)"
PREFLIGHT_LOCAL_REVISION="$(printf '%s' "$PREFLIGHT_DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("local_revision",""))')"
PREFLIGHT_REMOTE_REVISION="$(printf '%s' "$PREFLIGHT_DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("remote_revision",""))')"
PREFLIGHT_LIVE_REVISION="$(printf '%s' "$PREFLIGHT_DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("live_revision",""))')"
PREFLIGHT_RECOMMENDED_ACTION="$(printf '%s' "$PREFLIGHT_DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("recommended_action",""))')"

echo "[deploy:web] base url: $BASE_URL"
echo "[deploy:web] push target: $PUSH_TARGET"
echo "[deploy:web] preflight local revision: ${PREFLIGHT_LOCAL_REVISION:-unknown}"
echo "[deploy:web] preflight remote revision: ${PREFLIGHT_REMOTE_REVISION:-unknown}"
echo "[deploy:web] preflight live revision: ${PREFLIGHT_LIVE_REVISION:-unknown}"
echo "[deploy:web] preflight recommended action: ${PREFLIGHT_RECOMMENDED_ACTION:-none}"
if [ "$DRY_RUN" = "1" ]; then
  echo "[deploy:web] dry run: git push ${PUSH_TARGET}"
else
  git push ${PUSH_TARGET}
fi
echo "[deploy:web] restart service"
if [ "$DRY_RUN" = "1" ]; then
  echo "[deploy:web] dry run: ./scripts/restart-web.sh"
else
  ./scripts/restart-web.sh
fi
echo "[deploy:web] verify live site"
if [ "$DRY_RUN" = "1" ]; then
  echo "[deploy:web] dry run: npm run verify:web -- $BASE_URL"
else
  npm run verify:web -- "$BASE_URL"
  DOCTOR_PAYLOAD="$(./scripts/doctor-web.sh --base-url "$BASE_URL" --json)"
  LIVE_REVISION="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("live_revision",""))')"
  LOCAL_REVISION="$(printf '%s' "$DOCTOR_PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("local_revision",""))')"
  if [ -n "$LIVE_REVISION" ] && [ "$LIVE_REVISION" != "$LOCAL_REVISION" ]; then
    echo "[deploy:web] abort: live revision ($LIVE_REVISION) differs from local HEAD ($LOCAL_REVISION)" >&2
    exit 1
  fi
  echo "[deploy:web] live revision aligned: ${LIVE_REVISION:-unknown}"
fi
