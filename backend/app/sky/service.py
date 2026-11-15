# -*- coding: utf-8 -*-
"""Sun/Earth sky directions at one UTC epoch (Horizons Q=4 or catalog cache)."""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.compare.horizons_live import horizons_table, load_catalog_series
from app.core.config import settings
from app.sites.catalog import SITES

SOURCE = "NASA/JPL Horizons System (https://ssd.jpl.nasa.gov/horizons/)"


def _parse_iso(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)


def _nearest(rows: list[dict], t: datetime) -> dict | None:
    if not rows:
        return None
    best = None
    best_dt = None
    for row in rows:
        rt = _parse_iso(row["time"])
        if best is None or abs((rt - t).total_seconds()) < abs((best_dt - t).total_seconds()):
            best = row
            best_dt = rt
    return best


def _pack(body: str, row: dict | None, sample_time: str | None) -> dict[str, Any]:
    if not row:
        return {
            "body": body,
            "azimuth_deg": None,
            "elevation_deg": None,
            "above_horizon": None,
            "sample_time": sample_time,
        }
    elev = float(row["elevation_deg"])
    return {
        "body": body,
        "azimuth_deg": round(float(row["azimuth_deg"]), 4),
        "elevation_deg": round(elev, 4),
        "above_horizon": elev > 0.0,
        "sample_time": row.get("time") or sample_time,
    }


def _match_catalog_site(lat: float, lon: float, site_id: str | None) -> str | None:
    if site_id and site_id in {s["id"] for s in SITES}:
        return site_id
    best_id = None
    best_d = 1e9
    for s in SITES:
        d = (s["lat"] - lat) ** 2 + (s["lon"] - lon) ** 2
        if d < best_d:
            best_d = d
            best_id = s["id"]
    # ~0.05° ≈ catalog pin match
    return best_id if best_d < (0.05**2) else None


def _live_epoch(lat: float, lon: float, elev_km: float, t: datetime) -> dict[str, Any]:
    start = t.strftime("%Y-%m-%d %H:%M")
    stop_dt = t + timedelta(hours=1)
    stop = stop_dt.strftime("%Y-%m-%d %H:%M")
    sun_rows = horizons_table("10", lon, lat, elev_km, start, stop, step="1h")
    earth_rows = horizons_table("399", lon, lat, elev_km, start, stop, step="1h")
    sun = _nearest(sun_rows, t) or (sun_rows[0] if sun_rows else None)
    earth = _nearest(earth_rows, t) or (earth_rows[0] if earth_rows else None)
    return {
        "sun": sun,
        "earth": earth,
        "source": SOURCE + " API (live epoch)",
        "mode": "live",
    }


def sky_at_epoch(
    time_iso: str,
    lat: float,
    lon: float,
    *,
    elev_km: float = 0.0,
    site_id: str | None = None,
) -> dict[str, Any]:
    t = _parse_iso(time_iso)
    matched = _match_catalog_site(lat, lon, site_id)
    sun_row = earth_row = None
    source = SOURCE
    mode = "none"

    if matched:
        series = load_catalog_series(matched)
        if series:
            sun_row = _nearest(series.get("sun") or [], t)
            earth_row = _nearest(series.get("earth") or [], t)
            source = series.get("source") or SOURCE
            mode = "catalog"
            # Outside catalog window → try live
            if sun_row is None or earth_row is None:
                mode = "catalog_miss"

    if mode in ("none", "catalog_miss") or sun_row is None or earth_row is None:
        try:
            live = _live_epoch(lat, lon, elev_km, t)
            sun_row = live["sun"]
            earth_row = live["earth"]
            source = live["source"]
            mode = "live"
        except Exception as exc:
            if sun_row is None and earth_row is None:
                raise RuntimeError(f"Could not resolve sky ephemeris: {exc}") from exc

    sample = (sun_row or earth_row or {}).get("time")
    # Unit directions in local ENU (east, north, up) for clients that want vectors
    def enu_dir(row: dict | None) -> list[float] | None:
        if not row:
            return None
        az = math.radians(float(row["azimuth_deg"]))
        el = math.radians(float(row["elevation_deg"]))
        east = math.cos(el) * math.sin(az)
        north = math.cos(el) * math.cos(az)
        up = math.sin(el)
        return [round(east, 6), round(north, 6), round(up, 6)]

    return {
        "time": t.isoformat().replace("+00:00", "Z"),
        "observer": {
            "lat": lat,
            "lon": lon,
            "elev_km": elev_km,
            "site_id": matched,
        },
        "sun": {**_pack("sun", sun_row, sample), "enu_unit": enu_dir(sun_row)},
        "earth": {**_pack("earth", earth_row, sample), "enu_unit": enu_dir(earth_row)},
        "source": source,
        "mode": mode,
        "quantities": "4 (airless azimuth/elevation from lunar surface)",
        "note": (
            "Azimuth/elevation are topocentric on the Moon (Horizons CENTER=coord@301). "
            "Positive elevation = above the geometric horizon at the observer."
        ),
    }


def cache_sky_dir() -> Path:
    d = Path(settings.data_dir) / "sky_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d
