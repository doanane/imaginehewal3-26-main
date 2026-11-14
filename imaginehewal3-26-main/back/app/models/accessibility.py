from sqlalchemy import Column, ForeignKey, Integer, JSON, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class AccessibilityPreference(Base):
    __tablename__ = "accessibility_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_accessibility_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    settings = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
