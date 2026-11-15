from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.sky.service import sky_at_epoch
from database.models.user import User

router = APIRouter(prefix="/sky", tags=["sky"])


@router.get("")
def sky(
    time: str = Query(..., description="UTC ISO epoch, e.g. 2026-11-15T00:00:00Z"),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    elev_km: float = Query(0.0),
    site_id: str | None = Query(None),
    _user: User = Depends(get_current_user),
):
    try:
        return sky_at_epoch(time, lat, lon, elev_km=elev_km, site_id=site_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
