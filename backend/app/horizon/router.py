from fastapi import APIRouter, Depends, HTTPException, Query

from app.compare.lola_mask import horizon_payload_for_point, in_dem_coverage
from app.core.dependencies import get_current_user
from database.models.user import User

router = APIRouter(prefix="/horizon", tags=["horizon"])


@router.get("")
def horizon(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    site_id: str | None = Query(None),
    _user: User = Depends(get_current_user),
):
    """360° LOLA topographic horizon from a surface observer (catalog cache or on-the-fly)."""
    try:
        if site_id:
            payload = horizon_payload_for_point(lat, lon, site_id=site_id)
        elif not in_dem_coverage(lat):
            raise ValueError(
                "LOLA south-pole DEM covers ~75°S–90°S only. Pick a point farther south."
            )
        else:
            payload = horizon_payload_for_point(lat, lon)
        return payload
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
