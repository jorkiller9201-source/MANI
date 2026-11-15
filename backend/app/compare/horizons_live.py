# -*- coding: utf-8 -*-
"""Fetch or load Horizons Sun/Earth series for a lunar surface point."""
from __future__ import annotations

import json
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
DEFAULT_STEP = "1h"
_PROBE_AT: float = 0.0
_PROBE_OK: bool = False
_PROBE_TTL_SEC = 45.0

OFFLINE_NEED_INTERNET = (
    "Connect to the Internet to fetch new Horizons ephemeris for the requested dates. "
    "Embedded cache does not cover this UTC window. / "
    "Conéctate a Internet para obtener nuevos datos de Horizons para las fechas solicitadas. "
    "La caché embebida no cubre esta ventana UTC."
)


def _horizons_dir() -> Path:
    return Path(settings.data_dir) / "horizons"


def _custom_cache_dir() -> Path:
    d = Path(settings.data_dir) / "horizons_custom"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _parse_window_date(iso: str, *, end: bool = False) -> str:
    """Horizons accepts YYYY-MM-DD; bump end date if time is past midnight."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if end and (dt.hour or dt.minute or dt.second):
        # STOP exclusive-ish: add one day so last hour is included
        from datetime import timedelta

        dt = dt + timedelta(days=1)
    return dt.strftime("%Y-%m-%d")


def _cache_key(lat: float, lon: float, start: str, stop: str) -> str:
    return f"{lat:.4f}_{lon:.4f}_{start}_{stop}".replace("-", "")


def horizons_table(
    command: str,
    lon: float,
    lat: float,
    elev_km: float,
    start: str,
    stop: str,
    step: str = DEFAULT_STEP,
) -> list[dict]:
    params = {
        "format": "text",
        "COMMAND": command,
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"{lon},{lat},{elev_km}",
        "START_TIME": start,
        "STOP_TIME": stop,
        "STEP_SIZE": step,
        "QUANTITIES": "4",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MANI-Nova3/1.0"})
    text = urllib.request.urlopen(req, timeout=180).read().decode("utf-8", "replace")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError(
            f"Horizons response missing SOE/EOE for {command} @ {lon},{lat}\n{text[:500]}"
        )
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip().splitlines()
    rows = []
    pat = re.compile(
        r"^(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2})\s+\S*\s+([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)"
    )
    for line in block:
        line = line.strip()
        if not line:
            continue
        m = pat.match(line)
        if not m:
            continue
        t_raw, azi, elev = m.group(1), float(m.group(2)), float(m.group(3))
        dt = datetime.strptime(t_raw, "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        rows.append(
            {
                "time": dt.isoformat().replace("+00:00", "Z"),
                "azimuth_deg": azi,
                "elevation_deg": elev,
            }
        )
    if not rows:
        raise RuntimeError(f"No Horizons rows parsed for {command} @ {lon},{lat}")
    return rows


def load_catalog_series(site_id: str) -> dict[str, Any] | None:
    path = _horizons_dir() / f"{site_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def series_time_bounds(series: dict[str, Any]) -> tuple[datetime, datetime]:
    sun = series.get("sun") or []
    if sun:
        return _parse_iso(sun[0]["time"]), _parse_iso(sun[-1]["time"])
    start_s = series.get("start")
    stop_s = series.get("stop")
    if start_s and stop_s:
        lo = datetime.fromisoformat(f"{start_s}T00:00:00+00:00")
        hi = datetime.fromisoformat(f"{stop_s}T00:00:00+00:00")
        return lo, hi
    raise ValueError("Horizons cache has no time bounds")


def series_covers_window(series: dict[str, Any], start_iso: str, end_iso: str) -> bool:
    """True if cached ephemeris spans the full requested UTC window."""
    lo, hi = series_time_bounds(series)
    start = _parse_iso(start_iso)
    end = _parse_iso(end_iso)
    return lo <= start and hi >= end


def horizons_live_available() -> bool:
    """Whether JPL Horizons may be called (not forced offline and network reachable)."""
    global _PROBE_AT, _PROBE_OK
    if settings.horizons_force_offline:
        return False
    now = time.monotonic()
    if now - _PROBE_AT < _PROBE_TTL_SEC:
        return _PROBE_OK
    try:
        socket.create_connection(("ssd.jpl.nasa.gov", 443), timeout=6.0).close()
        _PROBE_OK = True
    except OSError:
        _PROBE_OK = False
    _PROBE_AT = now
    return _PROBE_OK


def custom_disk_cache(
    lat: float, lon: float, elev_km: float, start_iso: str, end_iso: str
) -> dict[str, Any] | None:
    start = _parse_window_date(start_iso, end=False)
    stop = _parse_window_date(end_iso, end=True)
    key = _cache_key(lat, lon, start, stop)
    cache_path = _custom_cache_dir() / f"{key}.json"
    if not cache_path.exists():
        return None
    data = json.loads(cache_path.read_text(encoding="utf-8"))
    if series_covers_window(data, start_iso, end_iso):
        return data
    return None


def embedded_series_for_point(
    lat: float,
    lon: float,
    elev_km: float,
    start_iso: str,
    end_iso: str,
    *,
    site_id: str | None = None,
) -> dict[str, Any] | None:
    """Catalog JSON or exact custom disk cache that fully covers the window."""
    if site_id:
        cached = load_catalog_series(site_id)
        if cached and series_covers_window(cached, start_iso, end_iso):
            return cached
    return custom_disk_cache(lat, lon, elev_km, start_iso, end_iso)


def catalog_cache_bounds(site_id: str) -> tuple[datetime, datetime] | None:
    cached = load_catalog_series(site_id)
    if not cached:
        return None
    try:
        return series_time_bounds(cached)
    except ValueError:
        return None


def curated_catalog_intersection(sites: list[dict[str, Any]]) -> tuple[datetime, datetime] | None:
    """Intersection of embedded Horizons caches for non-custom catalog sites."""
    bounds: list[tuple[datetime, datetime]] = []
    for site in sites:
        if site.get("custom"):
            continue
        span = catalog_cache_bounds(site["id"])
        if span:
            bounds.append(span)
    if not bounds:
        return None
    lo = max(b[0] for b in bounds)
    hi = min(b[1] for b in bounds)
    if hi < lo:
        return None
    return lo, hi


def load_series_for_point(
    lat: float,
    lon: float,
    elev_km: float,
    start_iso: str,
    end_iso: str,
    *,
    site_id: str | None = None,
    site: dict[str, Any] | None = None,
    offline_only: bool = False,
) -> dict[str, Any]:
    """Embedded cache when it covers the window; otherwise live Horizons (+ disk cache)."""
    embedded = embedded_series_for_point(
        lat, lon, elev_km, start_iso, end_iso, site_id=site_id
    )
    if embedded is not None:
        return embedded

    if offline_only:
        extra = ""
        if site_id:
            span = catalog_cache_bounds(site_id)
            if span:
                extra = (
                    f" Embedded range / Rango embebido: {_to_bounds_iso(span[0])} → "
                    f"{_to_bounds_iso(span[1])}."
                )
        raise ValueError(OFFLINE_NEED_INTERNET + extra)

    if not horizons_live_available():
        raise ValueError(OFFLINE_NEED_INTERNET)

    start = _parse_window_date(start_iso, end=False)
    stop = _parse_window_date(end_iso, end=True)
    key = _cache_key(lat, lon, start, stop)
    cache_path = _custom_cache_dir() / f"{key}.json"

    try:
        sun = horizons_table("10", lon, lat, elev_km, start, stop)
        earth = horizons_table("399", lon, lat, elev_km, start, stop)
    except (OSError, TimeoutError, urllib.error.URLError) as e:
        raise ValueError(
            "Horizons API is unreachable. Check your Internet connection. / "
            "La API de Horizons no responde. Comprueba tu conexión a Internet."
        ) from e
    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload: dict[str, Any] = {
        "site_id": site_id or f"custom_{lat:.4f}_{lon:.4f}",
        "site": site
        or {
            "id": "custom",
            "name": f"Custom ({lat:.3f}°, {lon:.3f}°)",
            "lat": lat,
            "lon": lon,
            "elev_km": elev_km,
            "notes": "Arbitrary map point (live Horizons)",
        },
        "start": start,
        "stop": stop,
        "step": DEFAULT_STEP,
        "generated_at": generated,
        "source": "NASA/JPL Horizons System API (live)",
        "quantities": "4 (airless azimuth/elevation)",
        "sun": sun,
        "earth": earth,
        "live": True,
    }
    cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def _to_bounds_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
