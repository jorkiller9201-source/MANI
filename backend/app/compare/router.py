from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.compare.service import compare_sites
from app.core.activity import log_activity
from app.core.dependencies import AuthPrincipal, get_current_user
from app.core.principal import is_guest
from database.session import get_db

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


def _log_compare(
    db: Session,
    principal: AuthPrincipal,
    *,
    site_a: str | None,
    site_b: str | None,
    name_a: str | None,
    name_b: str | None,
    start: str,
    end: str,
    result: dict,
) -> None:
    guest = is_guest(principal)
    a = result.get("a") or {}
    b = result.get("b") or {}
    log_activity(
        db,
        action="compare",
        user_id=None if guest else getattr(principal, "id", None),
        is_guest=guest,
        detail={
            "site_a": site_a,
            "site_b": site_b,
            "name_a": name_a or a.get("name"),
            "name_b": name_b or b.get("name"),
            "start": start,
            "end": end,
            "winner_id": result.get("winner_id"),
            "winner_name": result.get("winner_name"),
            "score_a": a.get("score"),
            "score_b": b.get("score"),
        },
    )


@router.post("")
def compare(
    body: CompareBody,
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = compare_sites(
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
    _log_compare(
        db,
        principal,
        site_a=body.site_a,
        site_b=body.site_b,
        name_a=body.name_a,
        name_b=body.name_b,
        start=body.start,
        end=body.end,
        result=result if isinstance(result, dict) else {},
    )
    return result


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
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = compare_sites(
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
    _log_compare(
        db,
        principal,
        site_a=site_a,
        site_b=site_b,
        name_a=name_a,
        name_b=name_b,
        start=start,
        end=end,
        result=result if isinstance(result, dict) else {},
    )
    return result
