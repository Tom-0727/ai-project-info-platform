from __future__ import annotations

import json
import subprocess
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "projects.json"

app = FastAPI(title="AI Project Info Platform")


def load_projects_payload() -> dict:
    return json.loads(DATA_FILE.read_text())


@lru_cache(maxsize=1)
def current_revision() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=BASE_DIR, text=True).strip() or "unknown"
        )
    except Exception:
        return "unknown"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "revision": current_revision()}


@app.get("/api/projects")
def get_projects() -> JSONResponse:
    return JSONResponse(load_projects_payload())


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/static/{asset_name}")
def static_asset(asset_name: str) -> FileResponse:
    if asset_name not in {"app.js", "app-vue.js", "styles.css"}:
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(BASE_DIR / asset_name)
