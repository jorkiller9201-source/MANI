from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from database.models.activity import ActivityEvent

logger = logging.getLogger("mani.activity")


def log_activity(
    db: Session,
    *,
    action: str,
    user_id: int | None = None,
    is_guest: bool = False,
    detail: dict[str, Any] | None = None,
) -> None:
    """Persist an activity row; never raise into the request path."""
    try:
        detail_json = json.dumps(detail, ensure_ascii=False, default=str) if detail else None
        db.add(
            ActivityEvent(
                user_id=user_id,
                is_guest=is_guest,
                action=action,
                detail_json=detail_json,
            )
        )
        db.commit()
    except Exception:
        logger.warning("activity log failed action=%s", action, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
