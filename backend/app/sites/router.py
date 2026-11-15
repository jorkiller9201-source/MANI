from fastapi import APIRouter, Depends

from app.compare.horizons_live import catalog_cache_bounds
from app.core.dependencies import get_current_user
from app.sites.catalog import SITES
from database.models.user import User

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("")
def list_sites(_user: User = Depends(get_current_user)):
    horizons_window = None
    for site in SITES:
        bounds = catalog_cache_bounds(site["id"])
        if bounds:
            lo, hi = bounds
            horizons_window = {
                "start": lo.isoformat().replace("+00:00", "Z"),
                "end": hi.isoformat().replace("+00:00", "Z"),
            }
            break
    return {
        "sites": SITES,
        "horizons_window": horizons_window,
        "source": "Curated CLPS south-pole candidates; terrain context: NASA Moon Trek / LROC Quickmap",
    }
