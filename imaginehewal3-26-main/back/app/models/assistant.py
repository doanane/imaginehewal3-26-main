from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base


class AssistantMessage(Base):
    """One turn of a user's conversation with the health assistant. Stored server-side so the
    client cannot tamper with history, and so the user can delete it (DELETE /assistant/history)."""
    __tablename__ = "assistant_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    role = Column(String, nullable=False)            # user | assistant
    content = Column(Text, nullable=False)
    emergency = Column(Boolean, default=False)       # emergency guidance was shown
    source = Column(String, default="model")         # model | offline | triage
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
