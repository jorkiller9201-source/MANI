from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.session import Base


class SavedReport(Base):
    """Per-user history of exported / generated comparison reports."""

    __tablename__ = "saved_reports"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    winner_name = Column(String(255), nullable=True)
    window_start = Column(String(64), nullable=False)
    window_end = Column(String(64), nullable=False)
    queried_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Full compare payload + localized snapshot for reprint
    payload_json = Column(Text, nullable=False)

    user = relationship("User", back_populates="reports")
