from sqlalchemy import (
    Column, Integer, String, DateTime, Date, ForeignKey, Boolean, Float, Text
)
from sqlalchemy.sql import func
from app.database import Base


class BehaviorPlan(Base):
    """One behaviour a user chose to work on (movement, nutrition, sleep, smoking)."""
    __tablename__ = "behavior_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    behavior = Column(String, nullable=False)       # movement|nutrition|sleep|smoking
    goal_text = Column(String, nullable=True)       # the user's own words
    baseline_value = Column(Float, nullable=False)  # where the user is today
    goal_value = Column(Float, nullable=False)      # where the user wants to get to
    unit = Column(String, nullable=False)
    level = Column(Integer, default=1)              # 1..5, share of the gap asked per day
    last_level_change = Column(Date, nullable=True)
    active = Column(Boolean, default=True)
    start_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BehaviorAction(Base):
    """A single small action for a single day, plus how it went."""
    __tablename__ = "behavior_actions"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    action_date = Column(Date, nullable=False, index=True)
    title = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    technique = Column(String, nullable=True)       # behaviour-change technique used
    rationale = Column(Text, nullable=True)         # why we suggested it (shown to user)
    target_value = Column(Float, nullable=False)
    level = Column(Integer, default=1)
    is_comeback = Column(Boolean, default=False)    # reduced "welcome back" step
    status = Column(String, default="pending")      # pending|done|partial|skipped
    value_done = Column(Float, nullable=True)
    barrier = Column(String, nullable=True)         # time|tired|forgot|...
    source = Column(String, default="manual")       # manual|wearable|demo
    completed_at = Column(DateTime(timezone=True), nullable=True)


class BehaviorSettings(Base):
    """User-controlled consent and preferences. Everything here is enforced server-side."""
    __tablename__ = "behavior_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    language = Column(String, default="en")          # en|ar|fr
    notifications_enabled = Column(Boolean, default=True)
    quiet_hours_start = Column(Integer, default=21)  # hour 0-23
    quiet_hours_end = Column(Integer, default=7)
    wearable_data_enabled = Column(Boolean, default=False)
    gamification_enabled = Column(Boolean, default=True)
    gentle_tone = Column(Boolean, default=True)
