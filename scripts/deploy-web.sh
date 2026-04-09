#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
PUSH_TARGET="${1:-origin HEAD:main}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-publish-cases}"
DRY_RUN="${DRY_RUN:-0}"

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

echo "[deploy:web] push target: $PUSH_TARGET"
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
fi
