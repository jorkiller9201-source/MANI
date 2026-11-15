# -*- coding: utf-8 -*-
"""Build 360° topographic horizon masks from LOLA LDEM_75S_240M (PDS).

Source: LRO LOLA GDR polar stereographic DEM (240 m/pix, 75°S–90°S).
https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG

For each curated MANI site, walk rays in the DEM plane (with lunar curvature)
and store the maximum terrain elevation angle vs Horizons-style azimuth
(0° = north, 90° = east). Output: data/lola_horizon/{site_id}.json
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.sites.catalog import SITES  # noqa: E402

DEM_DIR = ROOT / "data" / "lola_dem"
DEM_IMG = DEM_DIR / "LDEM_75S_240M.IMG"
OUT_DIR = ROOT / "data" / "lola_horizon"

# From LDEM_75S_240M.LBL
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

SOURCE = "LRO LOLA GDR LDEM_75S_240M (PDS LRO-L-LOLA-4-GDR-V1.0)"
SOURCE_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG"
CITATION = (
    "Smith et al., LRO LOLA Gridded Data Record; polar stereographic south DEM 240 m/pix. "
    "See also Barker et al. 2021, Planet. Space Sci. 203, 105119 "
    "(https://doi.org/10.1016/j.pss.2020.105119) for refined south-pole LOLA DEMs."
)


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


def load_dem() -> np.ndarray:
    if not DEM_IMG.exists():
        raise FileNotFoundError(
            f"Missing {DEM_IMG}. Download LDEM_75S_240M.IMG (+ .LBL) from {SOURCE_URL}"
        )
    raw = np.fromfile(DEM_IMG, dtype="<i2")
    if raw.size != N * N:
        raise ValueError(f"Unexpected DEM size {raw.size}, expected {N*N}")
    # HEIGHT (m relative to sphere) = DN * 0.5
    return raw.reshape((N, N)).astype(np.float64) * SCALING


def sample_height(dem: np.ndarray, x: float, y: float) -> float | None:
    sample, line = xy_to_sample_line(x, y)
    # bilinear in pixel-center coordinates (PDS pixel registration: centers at 1..N)
    # convert to 0-based array index: pixel center i corresponds to coordinate i+1? 
    # LINE_FIRST_PIXEL=1 → array row 0 is line 1.
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
        # At the pole: lon=0 → north = -Y, east = +X
        return (0.0, -1.0), (1.0, 0.0)
    # Geographic north = away from south pole (outward in stereo)
    nx, ny = x0 / rho, y0 / rho
    # East = 90° toward increasing east longitude
    ex, ey = -ny, nx
    return (nx, ny), (ex, ey)


def horizon_for_site(dem: np.ndarray, lat: float, lon: float) -> list[float]:
    x0, y0 = latlon_to_xy(lat, lon)
    h0 = sample_height(dem, x0, y0)
    if h0 is None:
        raise ValueError(f"Site lat={lat} lon={lon} outside LDEM_75S_240M coverage")
    h_obs = h0 + OBSERVER_HEIGHT_M
    north, east = north_east_unit(x0, y0)
    mask = []
    n_steps = int(MAX_RANGE_M / STEP_M)
    for az in range(N_AZ):
        a = math.radians(az)
        dx = math.cos(a) * north[0] + math.sin(a) * east[0]
        dy = math.cos(a) * north[1] + math.sin(a) * east[1]
        max_elev = -90.0
        for i in range(1, n_steps + 1):
            d = i * STEP_M
            x = x0 + dx * d
            y = y0 + dy * d
            h = sample_height(dem, x, y)
            if h is None:
                break
            # Curvature drop on sphere (m): d^2 / (2R)
            drop = (d * d) / (2.0 * R_M)
            elev = math.degrees(math.atan2(h - h_obs - drop, d))
            if elev > max_elev:
                max_elev = elev
        mask.append(round(max_elev, 4))
    return mask


def main() -> None:
    print("Loading", DEM_IMG, flush=True)
    dem = load_dem()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for site in SITES:
        print("Horizon", site["id"], "...", flush=True)
        elevs = horizon_for_site(dem, float(site["lat"]), float(site["lon"]))
        x0, y0 = latlon_to_xy(float(site["lat"]), float(site["lon"]))
        h0 = sample_height(dem, x0, y0)
        payload = {
            "site_id": site["id"],
            "site": site,
            "observer_height_m": OBSERVER_HEIGHT_M,
            "dem_height_m": None if h0 is None else round(float(h0), 3),
            "azimuth_deg": list(range(N_AZ)),
            "horizon_elev_deg": elevs,
            "max_range_km": MAX_RANGE_M / 1000.0,
            "step_m": STEP_M,
            "dem_resolution_m": MAP_SCALE,
            "moon_radius_m": R_M,
            "source": SOURCE,
            "source_url": SOURCE_URL,
            "citation": CITATION,
            "generated_at": generated,
            "method": (
                "Ray-cast on LOLA polar stereographic DEM; "
                "visible if Horizons elevation > mask[azimuth]; "
                "curvature drop d^2/(2R); azimuth 0=N, 90=E (Horizons observer convention)."
            ),
        }
        path = OUT_DIR / f"{site['id']}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            "  wrote",
            path.name,
            "min/max horizon",
            min(elevs),
            max(elevs),
            "dem_h",
            h0,
        )
    print("Done.")


if __name__ == "__main__":
    main()
