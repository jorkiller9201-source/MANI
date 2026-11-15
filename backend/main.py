from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.compare.router import router as compare_router
from app.core.config import cors_origins_list, settings
from app.core.rate_limit import limiter
from app.reports.router import router as reports_router
from app.sites.router import router as sites_router
from app.sky.router import router as sky_router
from database.models import ActivityEvent, SavedReport  # noqa: F401 — register tables
from database.session import Base, engine

# Ensure data dir exists for SQLite
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)


def _ensure_sqlite_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()}
        if "must_change_password" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0"
                )
            )
        if "google_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
        if "auth_provider" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) NOT NULL DEFAULT 'local'"
                )
            )
        # Unique index for google_id (ignore if already present).
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"
                )
            )
        except Exception:
            pass


_ensure_sqlite_columns()

app = FastAPI(title=settings.app_name, version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(sites_router)
app.include_router(compare_router)
app.include_router(reports_router)
app.include_router(sky_router)


@app.get("/health")
def health():
    return {
        "ok": True,
        "app": settings.app_name,
        "public_url": settings.public_url,
        "si_note": "Super Intelligence (SI) used as development support; team verified NASA data.",
    }


@app.get("/")
def root():
    return {
        "name": "MANI",
        "team": "Nova 3",
        "challenge": "Lunar Landing Site Navigator",
        "docs": "/docs",
    }
