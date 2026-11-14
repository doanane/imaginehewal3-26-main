from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class HuaweiLink(Base):
    """A person's link to their own HUAWEI Health account (Health Kit). One per user.
    The tokens are stored encrypted (see app/services/secret_box.py), never in clear text."""
    __tablename__ = "huawei_links"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    access_token_enc = Column(Text, nullable=False)
    refresh_token_enc = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String, nullable=True)
