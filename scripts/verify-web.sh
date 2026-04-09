#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://ai-projects-scout.tom-blogs.top}"

node scripts/validate-projects.mjs
npm run smoke:web -- "$BASE_URL"
