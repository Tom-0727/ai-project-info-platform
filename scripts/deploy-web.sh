#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-https://ai-projects-scout.tom-blogs.top}"
PUSH_TARGET="${1:-origin HEAD:main}"

cd "$ROOT_DIR"

if [ -n "$(git status --short)" ]; then
  echo "[deploy:web] abort: working tree is not clean" >&2
  git status --short
  exit 1
fi

echo "[deploy:web] push target: $PUSH_TARGET"
git push ${PUSH_TARGET}
echo "[deploy:web] restart service"
./scripts/restart-web.sh
echo "[deploy:web] verify live site"
npm run verify:web -- "$BASE_URL"
