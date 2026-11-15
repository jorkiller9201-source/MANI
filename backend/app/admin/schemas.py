from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AdminSummary(BaseModel):
    users_total: int
    users_active: int
    users_by_provider: dict[str, int]
    logins_7d: int
    compares_7d: int
    compares_30d: int
    reports_total: int
    reports_7d: int
    guest_compares_7d: int
    unique_active_users_7d: int


class AdminUserRow(BaseModel):
    id: int
    email: str
    full_name: str | None
    auth_provider: str
    role: str | None
    is_active: bool
    must_change_password: bool
    created_at: str
    last_login: str | None
    reports_count: int
    compare_count: int


class AdminUsersResponse(BaseModel):
    users: list[AdminUserRow]
    total: int


class AdminActivityRow(BaseModel):
    id: int
    created_at: str
    action: str
    user_id: int | None
    user_email: str | None
    is_guest: bool
    detail: dict[str, Any] | None = None


class AdminActivityResponse(BaseModel):
    events: list[AdminActivityRow]
    total: int


class SiteCompareStat(BaseModel):
    site_key: str
    label: str
    compare_count: int
    win_count: int


class SiteScoreStat(BaseModel):
    site_key: str
    label: str
    avg_score: float
    max_score: float
    sample_n: int


class WinnerStat(BaseModel):
    name: str
    wins: int


class DayCount(BaseModel):
    day: str
    count: int


class WindowScore(BaseModel):
    window_start: str
    window_end: str
    winner_name: str | None = None
    score_a: float | None = None
    score_b: float | None = None
    n: int = 1


class AdminSiteMetrics(BaseModel):
    window_days: int = Field(default=30)
    top_sites_by_compares: list[SiteCompareStat]
    top_sites_by_avg_score: list[SiteScoreStat]
    top_winners: list[WinnerStat]
    compares_by_day: list[DayCount]
    score_by_window: list[WindowScore]
