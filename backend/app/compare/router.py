from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.compare.service import compare_sites
from app.core.dependencies import get_current_user
from database.models.user import User

router = APIRouter(prefix="/compare", tags=["compare"])


class CompareBody(BaseModel):
    site_a: str | None = None
    site_b: str | None = None
    lat_a: float | None = None
    lon_a: float | None = None
    lat_b: float | None = None
    lon_b: float | None = None
    name_a: str | None = None
    name_b: str | None = None
    start: str = Field(description="ISO UTC start, e.g. 2026-11-15T00:00:00Z")
    end: str = Field(description="ISO UTC end")


@router.post("")
def compare(body: CompareBody, _user: User = Depends(get_current_user)):
    try:
        return compare_sites(
            body.site_a,
            body.site_b,
            body.start,
            body.end,
            lat_a=body.lat_a,
            lon_a=body.lon_a,
            lat_b=body.lat_b,
            lon_b=body.lon_b,
            name_a=body.name_a,
            name_b=body.name_b,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("")
def compare_get(
    start: str = Query(...),
    end: str = Query(...),
    site_a: str | None = Query(None),
    site_b: str | None = Query(None),
    lat_a: float | None = Query(None),
    lon_a: float | None = Query(None),
    lat_b: float | None = Query(None),
    lon_b: float | None = Query(None),
    name_a: str | None = Query(None),
    name_b: str | None = Query(None),
    _user: User = Depends(get_current_user),
):
    try:
        return compare_sites(
            site_a,
            site_b,
            start,
            end,
            lat_a=lat_a,
            lon_a=lon_a,
            lat_b=lat_b,
            lon_b=lon_b,
            name_a=name_a,
            name_b=name_b,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
