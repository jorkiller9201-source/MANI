from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.admin.schemas import (
    AdminActivityResponse,
    AdminActivityRow,
    AdminSiteMetrics,
    AdminSummary,
    AdminUserRow,
    AdminUsersResponse,
    DayCount,
    SiteCompareStat,
    SiteScoreStat,
    WindowScore,
    WinnerStat,
)
from app.core.dependencies import require_admin
from database.models.activity import ActivityEvent
from database.models.report import SavedReport
from database.models.user import User
from database.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _parse_detail(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _site_key(site_id: str | None, name: str | None) -> tuple[str, str]:
    sid = (site_id or "").strip()
    label = (name or sid or "unknown").strip() or "unknown"
    if sid:
        return sid, label if name else sid
    if name:
        return f"custom:{name}", name
    return "unknown", "unknown"


@router.get("/summary", response_model=AdminSummary)
def admin_summary(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    users_total = db.query(func.count(User.id)).scalar() or 0
    users_active = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0

    providers: dict[str, int] = {"local": 0, "google": 0, "local+google": 0}
    for row in db.query(User.auth_provider, func.count(User.id)).group_by(User.auth_provider).all():
        key = (row[0] or "local").strip() or "local"
        providers[key] = int(row[1])

    login_actions = ("login", "login_google")
    logins_7d = (
        db.query(func.count(ActivityEvent.id))
        .filter(ActivityEvent.action.in_(login_actions), ActivityEvent.created_at >= d7)
        .scalar()
        or 0
    )
    compares_7d = (
        db.query(func.count(ActivityEvent.id))
        .filter(ActivityEvent.action == "compare", ActivityEvent.created_at >= d7)
        .scalar()
        or 0
    )
    compares_30d = (
        db.query(func.count(ActivityEvent.id))
        .filter(ActivityEvent.action == "compare", ActivityEvent.created_at >= d30)
        .scalar()
        or 0
    )
    guest_compares_7d = (
        db.query(func.count(ActivityEvent.id))
        .filter(
            ActivityEvent.action == "compare",
            ActivityEvent.is_guest.is_(True),
            ActivityEvent.created_at >= d7,
        )
        .scalar()
        or 0
    )
    reports_total = db.query(func.count(SavedReport.id)).scalar() or 0
    reports_7d = (
        db.query(func.count(SavedReport.id)).filter(SavedReport.created_at >= d7).scalar() or 0
    )
    unique_active = (
        db.query(func.count(func.distinct(ActivityEvent.user_id)))
        .filter(
            ActivityEvent.user_id.isnot(None),
            ActivityEvent.created_at >= d7,
        )
        .scalar()
        or 0
    )

    return AdminSummary(
        users_total=int(users_total),
        users_active=int(users_active),
        users_by_provider=providers,
        logins_7d=int(logins_7d),
        compares_7d=int(compares_7d),
        compares_30d=int(compares_30d),
        reports_total=int(reports_total),
        reports_7d=int(reports_7d),
        guest_compares_7d=int(guest_compares_7d),
        unique_active_users_7d=int(unique_active),
    )


@router.get("/users", response_model=AdminUsersResponse)
def admin_users(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(User.id)).scalar() or 0
    rows = (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    out: list[AdminUserRow] = []
    for u in rows:
        reports_count = (
            db.query(func.count(SavedReport.id)).filter(SavedReport.user_id == u.id).scalar() or 0
        )
        compare_count = (
            db.query(func.count(ActivityEvent.id))
            .filter(ActivityEvent.user_id == u.id, ActivityEvent.action == "compare")
            .scalar()
            or 0
        )
        out.append(
            AdminUserRow(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                auth_provider=getattr(u, "auth_provider", None) or "local",
                role=u.role_name,
                is_active=bool(u.is_active),
                must_change_password=bool(getattr(u, "must_change_password", False)),
                created_at=_iso(u.created_at) or "",
                last_login=_iso(u.last_login),
                reports_count=int(reports_count),
                compare_count=int(compare_count),
            )
        )
    return AdminUsersResponse(users=out, total=int(total))


@router.get("/activity", response_model=AdminActivityResponse)
def admin_activity(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
    user_id: int | None = Query(None),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(ActivityEvent)
    if action:
        q = q.filter(ActivityEvent.action == action.strip())
    if user_id is not None:
        q = q.filter(ActivityEvent.user_id == user_id)
    total = q.count()
    rows = q.order_by(ActivityEvent.created_at.desc()).offset(offset).limit(limit).all()

    user_ids = {r.user_id for r in rows if r.user_id}
    emails: dict[int, str] = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            emails[u.id] = u.email

    events = [
        AdminActivityRow(
            id=r.id,
            created_at=_iso(r.created_at) or "",
            action=r.action,
            user_id=r.user_id,
            user_email=emails.get(r.user_id) if r.user_id else None,
            is_guest=bool(r.is_guest),
            detail=_parse_detail(r.detail_json),
        )
        for r in rows
    ]
    return AdminActivityResponse(events=events, total=int(total))


@router.get("/metrics/sites", response_model=AdminSiteMetrics)
def admin_site_metrics(
    days: int = Query(30, ge=1, le=365),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    since = _since(days)
    compares = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.action == "compare", ActivityEvent.created_at >= since)
        .all()
    )

    site_compares: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"label": "", "compare_count": 0, "win_count": 0}
    )
    winners: dict[str, int] = defaultdict(int)
    by_day: dict[str, int] = defaultdict(int)

    for ev in compares:
        detail = _parse_detail(ev.detail_json) or {}
        created = ev.created_at
        if created:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            by_day[created.astimezone(timezone.utc).strftime("%Y-%m-%d")] += 1

        for side, site_f, name_f in (
            ("a", "site_a", "name_a"),
            ("b", "site_b", "name_b"),
        ):
            key, label = _site_key(detail.get(site_f), detail.get(name_f))
            site_compares[key]["label"] = label
            site_compares[key]["compare_count"] += 1

        winner_id = detail.get("winner_id")
        winner_name = detail.get("winner_name")
        if winner_id or winner_name:
            wkey, wlabel = _site_key(
                str(winner_id) if winner_id else None,
                str(winner_name) if winner_name else None,
            )
            site_compares[wkey]["label"] = site_compares[wkey]["label"] or wlabel
            site_compares[wkey]["win_count"] += 1
            winners[wlabel] += 1

    top_sites_by_compares = sorted(
        [
            SiteCompareStat(
                site_key=k,
                label=v["label"] or k,
                compare_count=int(v["compare_count"]),
                win_count=int(v["win_count"]),
            )
            for k, v in site_compares.items()
        ],
        key=lambda x: (-x.compare_count, -x.win_count, x.label),
    )[:20]

    top_winners = sorted(
        [WinnerStat(name=n, wins=c) for n, c in winners.items()],
        key=lambda x: (-x.wins, x.name),
    )[:15]

    compares_by_day = [
        DayCount(day=d, count=c) for d, c in sorted(by_day.items(), key=lambda x: x[0])
    ]

    # Scores from saved reports in window
    score_acc: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"label": "", "sum": 0.0, "max": 0.0, "n": 0}
    )
    score_by_window: list[WindowScore] = []
    reports = (
        db.query(SavedReport).filter(SavedReport.created_at >= since).order_by(SavedReport.created_at.desc()).limit(500).all()
    )
    for rep in reports:
        try:
            payload = json.loads(rep.payload_json)
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        a = payload.get("a") or {}
        b = payload.get("b") or {}
        score_a = a.get("score")
        score_b = b.get("score")
        try:
            sa = float(score_a) if score_a is not None else None
            sb = float(score_b) if score_b is not None else None
        except (TypeError, ValueError):
            sa, sb = None, None

        for block, sc in ((a, sa), (b, sb)):
            if sc is None:
                continue
            site = block.get("site") if isinstance(block.get("site"), dict) else {}
            key, label = _site_key(
                site.get("id") or block.get("id") or block.get("site_id"),
                site.get("name") or block.get("name"),
            )
            score_acc[key]["label"] = label
            score_acc[key]["sum"] += sc
            score_acc[key]["max"] = max(float(score_acc[key]["max"]), sc)
            score_acc[key]["n"] += 1

        score_by_window.append(
            WindowScore(
                window_start=rep.window_start,
                window_end=rep.window_end,
                winner_name=rep.winner_name or payload.get("winner_name"),
                score_a=sa,
                score_b=sb,
                n=1,
            )
        )

    # Collapse identical windows
    window_merge: dict[tuple[str, str, str | None], WindowScore] = {}
    for w in score_by_window:
        key = (w.window_start, w.window_end, w.winner_name)
        if key in window_merge:
            prev = window_merge[key]
            window_merge[key] = WindowScore(
                window_start=prev.window_start,
                window_end=prev.window_end,
                winner_name=prev.winner_name,
                score_a=prev.score_a,
                score_b=prev.score_b,
                n=prev.n + 1,
            )
        else:
            window_merge[key] = w
    score_by_window_out = sorted(
        window_merge.values(),
        key=lambda x: (x.window_start, x.window_end),
        reverse=True,
    )[:40]

    top_sites_by_avg_score = sorted(
        [
            SiteScoreStat(
                site_key=k,
                label=v["label"] or k,
                avg_score=round(v["sum"] / v["n"], 4) if v["n"] else 0.0,
                max_score=round(float(v["max"]), 4),
                sample_n=int(v["n"]),
            )
            for k, v in score_acc.items()
            if v["n"] > 0
        ],
        key=lambda x: (-x.avg_score, -x.max_score, x.label),
    )[:20]

    return AdminSiteMetrics(
        window_days=days,
        top_sites_by_compares=top_sites_by_compares,
        top_sites_by_avg_score=top_sites_by_avg_score,
        top_winners=top_winners,
        compares_by_day=compares_by_day,
        score_by_window=score_by_window_out,
    )
