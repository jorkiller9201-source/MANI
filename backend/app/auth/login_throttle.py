from __future__ import annotations

import threading
import time

from app.core.config import settings

_lock = threading.Lock()
_failures_by_user: dict[str, list[float]] = {}
_failures_by_ip: dict[str, list[float]] = {}


def _normalize_username(username: str) -> str:
    return (username or "").strip().lower() or "<empty>"


def _window_seconds() -> float:
    return float(settings.login_fail_window_minutes) * 60.0


def _prune(store: dict[str, list[float]], key: str, now: float, window_sec: float) -> list[float]:
    return [t for t in store.get(key, []) if now - t < window_sec]


def is_login_locked_out(username: str) -> bool:
    max_att = int(settings.login_fail_max_attempts)
    window_sec = _window_seconds()
    now = time.time()
    key = _normalize_username(username)
    with _lock:
        ts = _prune(_failures_by_user, key, now, window_sec)
        _failures_by_user[key] = ts
        return len(ts) >= max_att


def is_ip_login_locked_out(client_ip: str) -> bool:
    max_ip = int(settings.login_fail_max_attempts_per_ip)
    if max_ip <= 0:
        return False
    window_sec = _window_seconds()
    now = time.time()
    key = (client_ip or "").strip() or "0.0.0.0"
    with _lock:
        ts = _prune(_failures_by_ip, key, now, window_sec)
        _failures_by_ip[key] = ts
        return len(ts) >= max_ip


def record_failed_login(username: str) -> None:
    window_sec = _window_seconds()
    now = time.time()
    key = _normalize_username(username)
    with _lock:
        ts = _prune(_failures_by_user, key, now, window_sec)
        ts.append(now)
        _failures_by_user[key] = ts


def record_failed_login_ip(client_ip: str) -> None:
    if int(settings.login_fail_max_attempts_per_ip) <= 0:
        return
    window_sec = _window_seconds()
    now = time.time()
    key = (client_ip or "").strip() or "0.0.0.0"
    with _lock:
        ts = _prune(_failures_by_ip, key, now, window_sec)
        ts.append(now)
        _failures_by_ip[key] = ts


def clear_login_failures(username: str) -> None:
    key = _normalize_username(username)
    with _lock:
        _failures_by_user.pop(key, None)


def lockout_message_account() -> str:
    return "Too many failed login attempts for this account. Try again later."


def lockout_message_ip() -> str:
    return "Too many failed login attempts from this network. Try again later."
