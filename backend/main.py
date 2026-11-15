from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.auth.router import router as auth_router
from app.compare.router import router as compare_router
from app.core.config import cors_origins_list, settings
from app.core.rate_limit import limiter
from app.reports.router import router as reports_router
from app.sites.router import router as sites_router
from app.sky.router import router as sky_router
from database.models import SavedReport  # noqa: F401 — register table
from database.session import Base, engine

# Ensure data dir exists for SQLite
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

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
