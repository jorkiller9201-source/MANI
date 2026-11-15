# -*- coding: utf-8 -*-
"""Fetch Sun and Earth elevations from JPL Horizons for each curated site."""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.sites.catalog import SITES  # noqa: E402

OUT = ROOT / "data" / "horizons"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Default window: ~14 days around hackathon / near-term CLPS planning
START = "2026-11-15"
STOP = "2026-11-29"
STEP = "1h"


def horizons_table(command: str, lon: float, lat: float, elev_km: float) -> list[dict]:
    # SITE_COORD = lon, lat, elev(km) geodetic on Moon (301)
    params = {
        "format": "text",
        "COMMAND": command,
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"{lon},{lat},{elev_km}",
        "START_TIME": START,
        "STOP_TIME": STOP,
        "STEP_SIZE": STEP,
        "QUANTITIES": "4",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MANI-Nova3/1.0"})
    text = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError(f"Horizons response missing SOE/EOE for {command} @ {lon},{lat}\n{text[:500]}")
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip().splitlines()
    rows = []
    # 2026-Nov-15 00:00 *   114.436125   1.473626
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
        raise RuntimeError(f"No rows parsed for {command}\n{block[:5]}")
    return rows


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for site in SITES:
        print("Fetching", site["id"], "...", flush=True)
        sun = horizons_table("10", site["lon"], site["lat"], site["elev_km"])
        earth = horizons_table("399", site["lon"], site["lat"], site["elev_km"])
        payload = {
            "site_id": site["id"],
            "site": site,
            "start": START,
            "stop": STOP,
            "step": STEP,
            "generated_at": generated,
            "source": "NASA/JPL Horizons System API",
            "quantities": "4 (airless azimuth/elevation)",
            "sun": sun,
            "earth": earth,
        }
        path = OUT / f"{site['id']}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  wrote", path, "sun", len(sun), "earth", len(earth))
    print("Done.")


if __name__ == "__main__":
    main()
