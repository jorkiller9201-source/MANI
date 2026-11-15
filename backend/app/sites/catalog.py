"""Curated CLPS south-pole candidate sites for MANI."""

from __future__ import annotations

from typing import Any

# Approximate selenographic coordinates (degrees) used for Horizons SITE_COORD and map markers.
# Sources: published Artemis / CLPS south-pole region literature; cite Moon Trek / LROC for terrain context.
SITES: list[dict[str, Any]] = [
    {
        "id": "shackleton_rim",
        "name": "Shackleton Rim",
        "lat": -89.9,
        "lon": 0.0,
        "elev_km": 0.0,
        "notes": "Near-permanent illumination candidate on crater rim.",
    },
    {
        "id": "malapert",
        "name": "Malapert Massif",
        "lat": -86.0,
        "lon": -2.0,
        "elev_km": 0.0,
        "notes": "Elevated massif with Earth-view potential.",
    },
    {
        "id": "de_gerlache",
        "name": "de Gerlache Rim",
        "lat": -88.5,
        "lon": -87.0,
        "elev_km": 0.0,
        "notes": "Rim site near polar illumination ridges.",
    },
    {
        "id": "connecting_ridge",
        "name": "Connecting Ridge",
        "lat": -89.45,
        "lon": -137.0,
        "elev_km": 0.0,
        "notes": "Ridge between Shackleton and de Gerlache.",
    },
    {
        "id": "nobile",
        "name": "Nobile Rim",
        "lat": -85.3,
        "lon": 35.0,
        "elev_km": 0.0,
        "notes": "CLPS-relevant crater rim region.",
    },
    {
        "id": "haworth",
        "name": "Haworth",
        "lat": -86.8,
        "lon": -4.0,
        "elev_km": 0.0,
        "notes": "South-pole crater region candidate.",
    },
]


def get_site(site_id: str) -> dict[str, Any] | None:
    for s in SITES:
        if s["id"] == site_id:
            return s
    return None
