from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.sql import func
from app.database import Base


class HealthGoals(Base):
    __tablename__ = "health_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    steps = Column(Integer, default=8000)
    calories = Column(Integer, default=400)          # active calories per day
    active_minutes = Column(Integer, default=30)
    target_weight_kg = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Workout(Base):
    """A run, walk or ride. `flagged` means the numbers looked implausible, so it never counts on leaderboards."""
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    kind = Column(String, nullable=False)             # run | walk | cycle
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_s = Column(Integer, nullable=False)
    distance_m = Column(Float, nullable=False)
    steps = Column(Integer, nullable=True)
    calories = Column(Integer, default=0)
    avg_pace_s_km = Column(Integer, nullable=True)
    fastest_pace_s_km = Column(Integer, nullable=True)
    avg_hr = Column(Integer, nullable=True)
    max_hr = Column(Integer, nullable=True)
    route = Column(JSON, nullable=True)               # [[lat, lng, seconds_from_start], ...]
    splits = Column(JSON, nullable=True)              # [{"km": 1, "pace_s": 410, "partial": false}, ...]
    source = Column(String, default="phone")
    flagged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    kg = Column(Float, nullable=False)
    at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class SleepSession(Base):
    __tablename__ = "sleep_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    start = Column(DateTime(timezone=True), nullable=False)
    end = Column(DateTime(timezone=True), nullable=False, index=True)
    stages = Column(JSON, nullable=True)              # [{"stage": "deep", "start": iso, "end": iso}, ...] or null
    total_min = Column(Integer, nullable=False)
    awake_min = Column(Integer, default=0)
    light_min = Column(Integer, default=0)
    deep_min = Column(Integer, default=0)
    rem_min = Column(Integer, default=0)
    score = Column(Integer, nullable=True)
    source = Column(String, default="manual")         # manual | apple_health | watch


class Participant(Base):
    """A person's public identity in the community and on leaderboards. Opt-in, with a display name that is never an email."""
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    display_name = Column(String, unique=True, index=True, nullable=False)
    accepted_rules_at = Column(DateTime(timezone=True), server_default=func.now())
    leaderboard_opt_in = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_achievement_user_key"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    key = Column(String, nullable=False)
    earned_at = Column(DateTime(timezone=True), server_default=func.now())


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    category = Column(String, nullable=False, index=True)    # discussion | tip | marketplace
    title = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    product_category = Column(String, nullable=True)          # marketplace only
    price = Column(Float, nullable=True)
    currency = Column(String, default="GHS")
    contact_phone = Column(String, nullable=True)             # shown only if the seller chose to add it
    status = Column(String, default="visible", index=True)    # visible | hidden | removed
    report_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_like_post_user"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)


class PostReport(Base):
    __tablename__ = "post_reports"
    __table_args__ = (UniqueConstraint("post_id", "reporter_id", name="uq_report_post_reporter"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), index=True, nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
