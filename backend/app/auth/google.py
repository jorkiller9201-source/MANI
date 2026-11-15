"""Verify Google Sign-In ID tokens (Google Identity Services)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str | None
    picture: str | None


def google_sign_in_configured() -> bool:
    return bool((settings.google_client_id or "").strip())


def verify_google_id_token(token: str) -> GoogleIdentity:
    """Validate a GIS credential JWT against GOOGLE_CLIENT_ID."""
    client_id = (settings.google_client_id or "").strip()
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured")

    try:
        info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        logger.info("Google ID token verification failed: %s", exc)
        raise ValueError("Invalid Google ID token") from exc

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid Google token issuer")

    sub = (info.get("sub") or "").strip()
    email = (info.get("email") or "").strip().lower()
    if not sub or not email:
        raise ValueError("Google token missing sub or email")

    return GoogleIdentity(
        sub=sub,
        email=email,
        email_verified=bool(info.get("email_verified")),
        name=(info.get("name") or None),
        picture=(info.get("picture") or None),
    )
