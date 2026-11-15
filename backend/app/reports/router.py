from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.dependencies import AuthPrincipal, get_current_user
from app.core.principal import is_guest
from database.models.report import SavedReport
from database.models.user import User
from database.session import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


def _reject_guest(principal: AuthPrincipal) -> User:
    """Guest data stays in the browser — never write/read account history."""
    if is_guest(principal):
        raise HTTPException(
            status_code=403,
            detail="Guest sessions store reports only in the browser, not on the server",
        )
    return principal  # type: ignore[return-value]


class SaveReportBody(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    winner_name: str | None = None
    window_start: str
    window_end: str
    queried_at: str | None = None  # ISO UTC of the compare run
    payload: dict


class PatchReportBody(BaseModel):
    """Partial update — e.g. repair Annex A map_image on older saves."""
    map_image: str | None = None


class ReportSummary(BaseModel):
    id: int
    title: str
    winner_name: str | None
    window_start: str
    window_end: str
    queried_at: str
    created_at: str
    printed_at: str | None = None


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("")
def list_reports(
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if is_guest(principal):
        return {"reports": []}
    _user = principal  # type: ignore[assignment]
    rows = (
        db.query(SavedReport)
        .filter(SavedReport.user_id == _user.id)
        .order_by(SavedReport.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "reports": [
            {
                "id": r.id,
                "title": r.title,
                "winner_name": r.winner_name,
                "window_start": r.window_start,
                "window_end": r.window_end,
                "queried_at": _iso(r.queried_at),
                "created_at": _iso(r.created_at),
            }
            for r in rows
        ]
    }


@router.post("")
def save_report(
    body: SaveReportBody,
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _user = _reject_guest(principal)
    queried = datetime.now(timezone.utc)
    if body.queried_at:
        try:
            queried = datetime.fromisoformat(body.queried_at.replace("Z", "+00:00"))
        except ValueError:
            pass
    printed = datetime.now(timezone.utc)
    payload = dict(body.payload)
    payload["_meta"] = {
        **(payload.get("_meta") or {}),
        "queried_at": queried.isoformat().replace("+00:00", "Z"),
        "printed_at": printed.isoformat().replace("+00:00", "Z"),
        "saved_by": _user.email,
    }
    row = SavedReport(
        user_id=_user.id,
        title=body.title.strip()[:255],
        winner_name=body.winner_name,
        window_start=body.window_start,
        window_end=body.window_end,
        queried_at=queried,
        payload_json=json.dumps(payload, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_activity(
        db,
        action="report_save",
        user_id=_user.id,
        detail={
            "report_id": row.id,
            "winner_name": row.winner_name,
            "window_start": row.window_start,
            "window_end": row.window_end,
        },
    )
    return {
        "id": row.id,
        "title": row.title,
        "winner_name": row.winner_name,
        "window_start": row.window_start,
        "window_end": row.window_end,
        "queried_at": _iso(row.queried_at),
        "created_at": _iso(row.created_at),
        "printed_at": printed.isoformat().replace("+00:00", "Z"),
        "payload": payload,
    }


@router.get("/{report_id}")
def get_report(
    report_id: int,
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _user = _reject_guest(principal)
    row = (
        db.query(SavedReport)
        .filter(SavedReport.id == report_id, SavedReport.user_id == _user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    payload = json.loads(row.payload_json)
    return {
        "id": row.id,
        "title": row.title,
        "winner_name": row.winner_name,
        "window_start": row.window_start,
        "window_end": row.window_end,
        "queried_at": _iso(row.queried_at),
        "created_at": _iso(row.created_at),
        "payload": payload,
    }


@router.patch("/{report_id}")
def patch_report(
    report_id: int,
    body: PatchReportBody,
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _user = _reject_guest(principal)
    row = (
        db.query(SavedReport)
        .filter(SavedReport.id == report_id, SavedReport.user_id == _user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    payload = json.loads(row.payload_json)
    meta = dict(payload.get("_meta") or {})
    if body.map_image is not None:
        meta["map_image"] = body.map_image
    payload["_meta"] = meta
    row.payload_json = json.dumps(payload, ensure_ascii=False)
    db.commit()
    return {"ok": True}


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    principal: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _user = _reject_guest(principal)
    row = (
        db.query(SavedReport)
        .filter(SavedReport.id == report_id, SavedReport.user_id == _user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
