#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://ai-projects-scout.tom-blogs.top}"
HEALTH_URL="${BASE_URL%/}/api/health"

node scripts/validate-projects.mjs
curl --fail --silent --show-error "$HEALTH_URL" >/dev/null
npm run smoke:web -- "$BASE_URL"
