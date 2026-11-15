"""Auth principals: registered User vs ephemeral guest (no DB row)."""

from __future__ import annotations

from dataclasses import dataclass


GUEST_SUB = "guest"
GUEST_EMAIL = "guest@local"
GUEST_ROLE = "guest"


@dataclass(frozen=True)
class GuestPrincipal:
    """In-memory stand-in for JWT guest sessions — never persisted."""

    id: int = 0
    email: str = GUEST_EMAIL
    full_name: str = "Guest"
    role_name: str = GUEST_ROLE
    must_change_password: bool = False
    is_guest: bool = True


def is_guest(principal: object) -> bool:
    return bool(getattr(principal, "is_guest", False))
