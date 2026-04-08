#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8790}"

cd "$ROOT_DIR"
exec /home/ubuntu/.local/bin/uv run --with fastapi --with uvicorn uvicorn server:app --host "$HOST" --port "$PORT"
