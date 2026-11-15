# -*- coding: utf-8 -*-
"""On-the-fly and offline LOLA topographic horizon masks (LDEM_75S_240M)."""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings

R_M = 1_737_400.0
MAP_SCALE = 240.0
N = 3812
SAMPLE_OFF = 1905.5
LINE_OFF = 1905.5
SCALING = 0.5
OBSERVER_HEIGHT_M = 2.0
MAX_RANGE_M = 120_000.0
STEP_M = 240.0
N_AZ = 360
MIN_LAT = -90.0
MAX_LAT = -75.0  # LDEM_75S coverage

SOURCE = "LRO LOLA GDR LDEM_75S_240M (PDS LRO-L-LOLA-4-GDR-V1.0)"
SOURCE_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG"
CITATION = (
    "Smith et al., LRO LOLA Gridded Data Record; polar stereographic south DEM 240 m/pix. "
    "See also Barker et al. 2021, Planet. Space Sci. 203, 105119 "
    "(https://doi.org/10.1016/j.pss.2020.105119)."
)


def _dem_path() -> Path:
    return Path(settings.data_dir) / "lola_dem" / "LDEM_75S_240M.IMG"


def _cache_dir() -> Path:
    return Path(settings.data_dir) / "lola_horizon"


def dem_available() -> bool:
    return _dem_path().exists()


def in_dem_coverage(lat: float) -> bool:
    return MIN_LAT <= lat <= MAX_LAT


def latlon_to_xy(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    rho = 2.0 * R_M * math.tan(math.pi / 4.0 + lat / 2.0)
    x = rho * math.sin(lon)
    y = -rho * math.cos(lon)
    return x, y


def xy_to_sample_line(x: float, y: float) -> tuple[float, float]:
    sample = SAMPLE_OFF + x / MAP_SCALE
    line = LINE_OFF - y / MAP_SCALE
    return sample, line


@lru_cache(maxsize=1)
def load_dem() -> np.ndarray:
    path = _dem_path()
    if not path.exists():
        raise FileNotFoundError(
            f"Missing LOLA DEM at {path}. Download LDEM_75S_240M.IMG from {SOURCE_URL}"
        )
    raw = np.fromfile(path, dtype="<i2")
    if raw.size != N * N:
        raise ValueError(f"Unexpected DEM size {raw.size}, expected {N * N}")
    return raw.reshape((N, N)).astype(np.float64) * SCALING


def sample_height(dem: np.ndarray, x: float, y: float) -> float | None:
    sample, line = xy_to_sample_line(x, y)
    col = sample - 1.0
    row = line - 1.0
    if col < 0 or row < 0 or col >= N - 1 or row >= N - 1:
        return None
    c0 = int(math.floor(col))
    r0 = int(math.floor(row))
    dc = col - c0
    dr = row - r0
    z00 = dem[r0, c0]
    z01 = dem[r0, c0 + 1]
    z10 = dem[r0 + 1, c0]
    z11 = dem[r0 + 1, c0 + 1]
    return (1 - dr) * ((1 - dc) * z00 + dc * z01) + dr * ((1 - dc) * z10 + dc * z11)


def north_east_unit(x0: float, y0: float) -> tuple[tuple[float, float], tuple[float, float]]:
    rho = math.hypot(x0, y0)
    if rho < 1.0:
        return (0.0, -1.0), (1.0, 0.0)
    nx, ny = x0 / rho, y0 / rho
    return (nx, ny), (-ny, nx)


def compute_horizon_elevs(lat: float, lon: float) -> tuple[list[float], float | None]:
    if not in_dem_coverage(lat):
        raise ValueError(
            f"Latitude {lat}° is outside LDEM_75S coverage ({MIN_LAT}° to {MAX_LAT}°). "
            "Pick a point nearer the lunar south pole."
        )
    dem = load_dem()
    x0, y0 = latlon_to_xy(lat, lon)
    h0 = sample_height(dem, x0, y0)
    if h0 is None:
        raise ValueError(f"Point lat={lat} lon={lon} is outside the LOLA DEM grid")
    h_obs = h0 + OBSERVER_HEIGHT_M
    north, east = north_east_unit(x0, y0)
    mask: list[float] = []
    n_steps = int(MAX_RANGE_M / STEP_M)
    for az in range(N_AZ):
        a = math.radians(az)
        dx = math.cos(a) * north[0] + math.sin(a) * east[0]
        dy = math.cos(a) * north[1] + math.sin(a) * east[1]
        max_elev = -90.0
        for i in range(1, n_steps + 1):
            d = i * STEP_M
            h = sample_height(dem, x0 + dx * d, y0 + dy * d)
            if h is None:
                break
            drop = (d * d) / (2.0 * R_M)
            elev = math.degrees(math.atan2(h - h_obs - drop, d))
            if elev > max_elev:
                max_elev = elev
        mask.append(round(max_elev, 4))
    return mask, float(h0)


def load_cached_horizon(site_id: str) -> dict[str, Any] | None:
    path = _cache_dir() / f"{site_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def horizon_payload_for_point(
    lat: float,
    lon: float,
    *,
    site_id: str | None = None,
    site: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return mask dict: use precomputed JSON for catalog ids when present, else compute."""
    if site_id:
        cached = load_cached_horizon(site_id)
        if cached:
            return {**cached, "computed_on_the_fly": False}
    elevs, dem_h = compute_horizon_elevs(lat, lon)
    return {
        "site_id": site_id or f"custom_{lat:.4f}_{lon:.4f}",
        "site": site
        or {
            "id": site_id or "custom",
            "name": f"Custom ({lat:.3f}°, {lon:.3f}°)",
            "lat": lat,
            "lon": lon,
            "elev_km": 0.0,
            "notes": "Arbitrary map point",
        },
        "observer_height_m": OBSERVER_HEIGHT_M,
        "dem_height_m": None if dem_h is None else round(dem_h, 3),
        "azimuth_deg": list(range(N_AZ)),
        "horizon_elev_deg": elevs,
        "max_range_km": MAX_RANGE_M / 1000.0,
        "step_m": STEP_M,
        "dem_resolution_m": MAP_SCALE,
        "moon_radius_m": R_M,
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "citation": CITATION,
        "computed_on_the_fly": True,
    }
