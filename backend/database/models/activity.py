from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.session import Base


class ActivityEvent(Base):
    """Audit log of logins, compares, and report saves for admin analytics."""

    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_guest = Column(Boolean, default=False, nullable=False)
    action = Column(String(64), nullable=False, index=True)
    detail_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", backref="activity_events")
