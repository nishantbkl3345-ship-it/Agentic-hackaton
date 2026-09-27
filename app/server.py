"""Production entrypoint: one process serves the API and the built frontend.

- The API (app.main:app) is mounted under /api, so it never collides with a
  frontend route of the same name (e.g. /leaderboard is both).
- Everything else serves frontend/dist, falling back to index.html so client
  routes like /mindgrid/duel work on a hard refresh.
- schema.sql is applied on startup; every statement is IF NOT EXISTS, so it
  is safe on every boot and makes a fresh database usable with no manual step.

Run: uvicorn app.server:root --host 0.0.0.0 --port $PORT
Local dev keeps using app.main:app on :8000 with the Vite dev server.
"""

from dotenv import load_dotenv

load_dotenv()  # local runs; on Render the variables are real env vars

from contextlib import asynccontextmanager  # noqa: E402
from pathlib import Path  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.db import get_conn  # noqa: E402
from app.main import app as api  # noqa: E402

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST = ROOT_DIR / "frontend" / "dist"
SCHEMA = ROOT_DIR / "schema.sql"


@asynccontextmanager
async def lifespan(_app):
    with get_conn() as conn:
        conn.execute(SCHEMA.read_text())
    yield


root = FastAPI(title="SentinelLLM", lifespan=lifespan, docs_url=None, redoc_url=None)
root.mount("/api", api)

if (DIST / "assets").is_dir():
    root.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@root.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    candidate = (DIST / full_path).resolve()
    if full_path and candidate.is_file() and DIST in candidate.parents:
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")
