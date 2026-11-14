"""Wellbeing hub tables: weekly challenge entries, interest-group membership, article reads and saves."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class ChallengeEntry(Base):
    """A person joined a challenge for one calendar week. Progress is never stored: it is worked out from their real data."""
    __tablename__ = "challenge_entries"
    __table_args__ = (UniqueConstraint("user_id", "challenge_key", "week_start", name="uq_challenge_user_week"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    challenge_key = Column(String, nullable=False, index=True)
    week_start = Column(Date, nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("user_id", "group_key", name="uq_group_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    group_key = Column(String, nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class ArticleRead(Base):
    __tablename__ = "article_reads"
    __table_args__ = (UniqueConstraint("user_id", "article_key", name="uq_read_user_article"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    article_key = Column(String, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now())


class ArticleSave(Base):
    __tablename__ = "article_saves"
    __table_args__ = (UniqueConstraint("user_id", "article_key", name="uq_save_user_article"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    article_key = Column(String, nullable=False, index=True)
    saved_at = Column(DateTime(timezone=True), server_default=func.now())
