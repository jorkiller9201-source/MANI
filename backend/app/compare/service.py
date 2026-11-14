from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime
from typing import Any

from app.compare.horizons_live import load_series_for_point
from app.compare.lola_mask import horizon_payload_for_point
from app.sites.catalog import get_site

SOURCE_HORIZONS = "NASA/JPL Horizons System (https://ssd.jpl.nasa.gov/horizons/)"
SOURCE_TREK = "NASA Moon Trek (https://trek.nasa.gov/moon/)"
SOURCE_LOLA = (
    "LRO LOLA GDR LDEM_75S_240M "
    "(https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG)"
)


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _mask_elev(horizon_elev_deg: list[float], azimuth_deg: float) -> float:
    n = len(horizon_elev_deg)
    if n == 0:
        return 0.0
    az = azimuth_deg % 360.0
    i0 = int(math.floor(az)) % n
    i1 = (i0 + 1) % n
    frac = az - math.floor(az)
    return float(horizon_elev_deg[i0]) * (1.0 - frac) + float(horizon_elev_deg[i1]) * frac


def summarize_body(
    points: list[dict[str, Any]],
    start: datetime,
    end: datetime,
    useful_elev_deg: float = 0.0,
    horizon_elev_deg: list[float] | None = None,
) -> dict[str, Any]:
    window = [p for p in points if start <= _parse_iso(p["time"]) <= end]
    empty = {
        "samples": 0,
        "hours_above_horizon": 0.0,
        "hours_above_topo_horizon": 0.0,
        "mean_elevation_deg": None,
        "min_elevation_deg": None,
        "max_elevation_deg": None,
        "hours_until_set": None,
        "hours_until_topo_set": None,
        "currently_above": None,
        "currently_above_topo": None,
        "topo_applied": bool(horizon_elev_deg),
    }
    if not window:
        return empty

    dt_h = 1.0
    if len(window) >= 2:
        dt_h = (_parse_iso(window[1]["time"]) - _parse_iso(window[0]["time"])).total_seconds() / 3600.0
        if dt_h <= 0:
            dt_h = 1.0

    elevs = [float(p["elevation_deg"]) for p in window]
    azis = [float(p.get("azimuth_deg") or 0.0) for p in window]
    above = [e for e in elevs if e > useful_elev_deg]
    hours_above = len(above) * dt_h

    topo_flags: list[bool] = []
    if horizon_elev_deg is not None:
        for e, az in zip(elevs, azis):
            topo_flags.append(e > _mask_elev(horizon_elev_deg, az))
        hours_topo = sum(1 for f in topo_flags if f) * dt_h
    else:
        hours_topo = hours_above

    def hours_until(predicate_above: list[bool]) -> float | None:
        if not predicate_above[0]:
            return None
        for i, ok in enumerate(predicate_above):
            if not ok:
                return i * dt_h
        return len(predicate_above) * dt_h

    geom_above = [e > useful_elev_deg for e in elevs]
    hours_until_set = hours_until(geom_above)
    hours_until_topo = hours_until(topo_flags) if horizon_elev_deg is not None else hours_until_set

    return {
        "samples": len(window),
        "step_hours": round(dt_h, 4),
        "hours_above_horizon": round(hours_above, 2),
        "hours_above_topo_horizon": round(hours_topo, 2),
        "mean_elevation_deg": round(sum(elevs) / len(elevs), 3),
        "min_elevation_deg": round(min(elevs), 3),
        "max_elevation_deg": round(max(elevs), 3),
        "hours_until_set": None if hours_until_set is None else round(hours_until_set, 2),
        "hours_until_topo_set": None if hours_until_topo is None else round(hours_until_topo, 2),
        "currently_above": elevs[0] > useful_elev_deg,
        "currently_above_topo": topo_flags[0] if topo_flags else elevs[0] > useful_elev_deg,
        "topo_applied": horizon_elev_deg is not None,
        "series": window,
    }


def aggregate_daily_timeline(
    sun_points: list[dict[str, Any]],
    earth_points: list[dict[str, Any]],
    horizon_elev_deg: list[float] | None,
    start: datetime,
    end: datetime,
    useful_elev_deg: float = 0.0,
) -> list[dict[str, Any]]:
    """Per UTC calendar day: hours Sun/Earth clear the LOLA topo horizon (same rule as scoring)."""
    sun_window = [p for p in sun_points if start <= _parse_iso(p["time"]) <= end]
    if not sun_window:
        return []

    earth_by_time = {p["time"]: p for p in earth_points if start <= _parse_iso(p["time"]) <= end}
    dt_h = 1.0
    if len(sun_window) >= 2:
        dt_h = (_parse_iso(sun_window[1]["time"]) - _parse_iso(sun_window[0]["time"])).total_seconds() / 3600.0
        if dt_h <= 0:
            dt_h = 1.0

    def clears_topo(elev: float, az: float) -> bool:
        if horizon_elev_deg is not None:
            return elev > _mask_elev(horizon_elev_deg, az)
        return elev > useful_elev_deg

    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"sun_hours": 0.0, "earth_hours": 0.0})
    for sp in sun_window:
        day = _parse_iso(sp["time"]).strftime("%Y-%m-%d")
        if clears_topo(float(sp["elevation_deg"]), float(sp.get("azimuth_deg") or 0.0)):
            buckets[day]["sun_hours"] += dt_h
        ep = earth_by_time.get(sp["time"])
        if ep and clears_topo(float(ep["elevation_deg"]), float(ep.get("azimuth_deg") or 0.0)):
            buckets[day]["earth_hours"] += dt_h

    return [
        {
            "day": day,
            "sun_hours": round(buckets[day]["sun_hours"], 2),
            "earth_hours": round(buckets[day]["earth_hours"], 2),
        }
        for day in sorted(buckets.keys())
    ]


def score_site(sun: dict[str, Any], earth: dict[str, Any], *, use_topo: bool = True) -> float:
    if use_topo and sun.get("topo_applied"):
        sun_h = float(sun.get("hours_above_topo_horizon") or 0)
        earth_h = float(earth.get("hours_above_topo_horizon") or 0)
    else:
        sun_h = float(sun.get("hours_above_horizon") or 0)
        earth_h = float(earth.get("hours_above_horizon") or 0)
    sun_n = min(sun_h / 336.0, 1.0)
    earth_n = min(earth_h / 336.0, 1.0)
    sun_elev = float(sun.get("mean_elevation_deg") or 0)
    elev_bonus = max(0.0, min(sun_elev / 5.0, 1.0)) * 0.15
    return round(100.0 * (0.45 * sun_n + 0.40 * earth_n + elev_bonus), 1)


def resolve_point(
    *,
    site_id: str | None,
    lat: float | None,
    lon: float | None,
    name: str | None,
) -> dict[str, Any]:
    """Build a site dict from catalog id or arbitrary lat/lon."""
    if lat is not None and lon is not None:
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            raise ValueError("lat/lon out of range")
        label = name or f"Custom ({lat:.3f}°, {lon:.3f}°)"
        return {
            "id": f"custom_{lat:.4f}_{lon:.4f}",
            "name": label,
            "lat": float(lat),
            "lon": float(lon),
            "elev_km": 0.0,
            "notes": "Arbitrary map point",
            "custom": True,
        }
    if not site_id:
        raise ValueError("Provide site_id or lat/lon for each point")
    site = get_site(site_id)
    if not site:
        raise ValueError(f"Unknown site id: {site_id}")
    return {**site, "custom": False}


def _location_block(site: dict[str, Any], series: dict[str, Any]) -> dict[str, Any]:
    cached = series.get("site") or {}
    lat = float(site["lat"])
    lon = float(site["lon"])
    elev_km = float(site.get("elev_km") or 0.0)
    c_lat = cached.get("lat")
    c_lon = cached.get("lon")
    c_elev = cached.get("elev_km")
    match = (
        c_lat is not None
        and c_lon is not None
        and abs(float(c_lat) - lat) < 1e-4
        and abs(float(c_lon) - lon) < 1e-4
    )
    return {
        "lat": lat,
        "lon": lon,
        "elev_km": elev_km,
        "frame": "selenographic (Moon geodetic, Horizons CENTER=coord@301)",
        "horizons_site_coord": f"{lon},{lat},{elev_km}",
        "cache_lat": None if c_lat is None else float(c_lat),
        "cache_lon": None if c_lon is None else float(c_lon),
        "cache_elev_km": None if c_elev is None else float(c_elev),
        "location_matches_cache": match,
        "custom": bool(site.get("custom")),
    }


def _build_block(site: dict[str, Any], start: datetime, end: datetime, start_iso: str, end_iso: str) -> dict[str, Any]:
    series = load_series_for_point(
        float(site["lat"]),
        float(site["lon"]),
        float(site.get("elev_km") or 0.0),
        start_iso,
        end_iso,
        site_id=None if site.get("custom") else site["id"],
        site=site,
    )
    lola = horizon_payload_for_point(
        float(site["lat"]),
        float(site["lon"]),
        site_id=None if site.get("custom") else site["id"],
        site=site,
    )
    mask = [float(x) for x in lola["horizon_elev_deg"]]
    sun = summarize_body(series["sun"], start, end, horizon_elev_deg=mask)
    earth = summarize_body(series["earth"], start, end, horizon_elev_deg=mask)
    daily_timeline = aggregate_daily_timeline(series["sun"], series["earth"], mask, start, end)
    location = _location_block(site, series)
    dem_h = lola.get("dem_height_m")
    if dem_h is not None:
        location["dem_height_m"] = float(dem_h)
        location["dem_height_km"] = round(float(dem_h) / 1000.0, 4)
    return {
        "site": {k: v for k, v in site.items()},
        "location": location,
        "lola_horizon": {
            "source": lola.get("source", SOURCE_LOLA),
            "source_url": lola.get("source_url"),
            "citation": lola.get("citation"),
            "dem_resolution_m": lola.get("dem_resolution_m"),
            "observer_height_m": lola.get("observer_height_m"),
            "dem_height_m": dem_h,
            "dem_height_km": None if dem_h is None else round(float(dem_h) / 1000.0, 4),
            "max_range_km": lola.get("max_range_km"),
            "horizon_elev_min_deg": min(mask),
            "horizon_elev_max_deg": max(mask),
            "computed_on_the_fly": bool(lola.get("computed_on_the_fly") or site.get("custom")),
        },
        "sun": {k: v for k, v in sun.items() if k != "series"},
        "earth": {k: v for k, v in earth.items() if k != "series"},
        "daily_timeline": daily_timeline,
        "score": score_site(sun, earth, use_topo=True),
        "score_geometric": score_site(sun, earth, use_topo=False),
        "meta": {
            "source": series.get("source", SOURCE_HORIZONS),
            "generated_at": series.get("generated_at"),
            "step": series.get("step"),
            "horizon_mode": "lola_topographic",
            "live_horizons": bool(series.get("live")),
        },
    }


def compare_sites(
    site_a: str | None,
    site_b: str | None,
    start_iso: str,
    end_iso: str,
    *,
    lat_a: float | None = None,
    lon_a: float | None = None,
    lat_b: float | None = None,
    lon_b: float | None = None,
    name_a: str | None = None,
    name_b: str | None = None,
) -> dict[str, Any]:
    a = resolve_point(site_id=site_a, lat=lat_a, lon=lon_a, name=name_a)
    b = resolve_point(site_id=site_b, lat=lat_b, lon=lon_b, name=name_b)
    if abs(a["lat"] - b["lat"]) < 1e-6 and abs(a["lon"] - b["lon"]) < 1e-6:
        raise ValueError("Points A and B must be different locations")

    start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    if end <= start:
        raise ValueError("end must be after start")

    left = _build_block(a, start, end, start_iso, end_iso)
    right = _build_block(b, start, end, start_iso, end_iso)
    winner_id = left["site"]["id"] if left["score"] >= right["score"] else right["site"]["id"]
    winner_name = left["site"]["name"] if winner_id == left["site"]["id"] else right["site"]["name"]

    report_en = _report_en(left, right, winner_name, start_iso, end_iso)
    return {
        "a": left,
        "b": right,
        "winner_id": winner_id,
        "winner_name": winner_name,
        "window": {"start": start_iso, "end": end_iso},
        "geo_cross": {
            "a": left["location"],
            "b": right["location"],
            "note": (
                "Sun/Earth from Horizons at each point’s lat/lon; hours clear the LOLA "
                "topographic horizon when elevation exceeds the 360° terrain mask. "
                "Catalog sites use cached series/masks; map clicks use live Horizons + on-the-fly LOLA."
            ),
        },
        "sources": {
            "ephemeris": SOURCE_HORIZONS,
            "terrain_context": SOURCE_TREK,
            "topographic_horizon": SOURCE_LOLA,
        },
        "report_en": report_en,
    }


def _report_en(left: dict, right: dict, winner: str, start: str, end: str) -> str:
    def line(label: str, block: dict) -> str:
        s, e = block["sun"], block["earth"]
        loc = block.get("location") or block["site"]
        return (
            f"{label} ({block['site']['name']} @ lat {loc['lat']}°, lon {loc['lon']}°): "
            f"Sun geometric {s['hours_above_horizon']} h / topo {s['hours_above_topo_horizon']} h; "
            f"Earth geometric {e['hours_above_horizon']} h / topo {e['hours_above_topo_horizon']} h; "
            f"score (topo) {block['score']}/100 (geometric {block.get('score_geometric', '—')}/100)."
        )

    return (
        f"MANI landing-site comparison\n"
        f"Window: {start} → {end} (UTC)\n\n"
        f"{line('Site A', left)}\n"
        f"{line('Site B', right)}\n\n"
        f"Recommendation: {winner} ranks higher for combined solar power potential "
        f"and direct-to-Earth communication windows under the LOLA topographic horizon.\n\n"
        f"Data sources:\n"
        f"- Ephemeris: {SOURCE_HORIZONS}\n"
        f"- Topographic horizon: {SOURCE_LOLA}\n"
        f"- Terrain context: {SOURCE_TREK}\n"
        f"Note: Elevations from JPL Horizons (QUANTITIES=4). "
        f"Topographic clearing uses LDEM_75S_240M (ray-cast; coverage ~75°S–90°S)."
    )
