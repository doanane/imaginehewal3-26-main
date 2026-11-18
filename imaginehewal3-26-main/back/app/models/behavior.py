from sqlalchemy import (
    Column, Integer, String, DateTime, Date, ForeignKey, Boolean, Float, Text, JSON
)
from sqlalchemy.sql import func
from app.database import Base


class BehaviorPlan(Base):
    """One behaviour a user chose to work on (movement, activity, nutrition, sleep)."""
    __tablename__ = "behavior_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    behavior = Column(String, nullable=False)       # movement|activity|nutrition|sleep
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
    reengage_channel = Column(String, default="push")        # push | in_app | none: how we may reach out after a lapse
    max_nudges_per_week = Column(Integer, default=2)         # a hard cap the person controls
    share_with_doctor = Column(Boolean, default=False)       # the linked doctor sees behaviour progress only if this is on
    reminder_mode = Column(String, default="auto")           # auto (learns the time) | off | fixed (the person's own hour)
    reminder_hour = Column(Integer, nullable=True)           # only used when the mode is fixed
    reminder_stage = Column(Integer, default=0)              # 0 daily, 1 moved to the usual time, 2 every other day, 3 paused (it was not helping)
    reminder_stage_on = Column(Date, nullable=True)          # when the stage last changed


class BehaviorContext(Base):
    """The person's circumstances, in their own words. Used only to fit the plan to their life; editable and deletable at any time."""
    __tablename__ = "behavior_contexts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    preferred_time = Column(String, default="any")           # morning | midday | evening | any
    work_pattern = Column(String, default="regular")         # regular | desk | shift | irregular | not_working
    segment = Column(String, nullable=True)                  # chronic | sedentary | young_adult | adult | older_adult (empty: suggested from profile)
    region = Column(String, default="gh")                    # gh | ae: the week, Ramadan, prayer and heat rules, emergency numbers
    respect_prayer = Column(Boolean, default=True)           # UAE region: no messages at prayer time or in fasting hours during Ramadan
    mobility = Column(String, default="full")                # full | limited | wheelchair
    support = Column(String, default="alone")                # alone | family | friend | workplace
    readiness = Column(Integer, default=3)                   # 1 thinking about it ... 5 already doing it
    literacy = Column(String, default="standard")            # standard | simple (shorter, plainer wording)
    motivation_text = Column(String, nullable=True)          # "my reason", shown back on hard days
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BehaviorNudge(Base):
    """One re-engagement message that was sent, and whether the person came back after it. This is how the system learns what helps."""
    __tablename__ = "behavior_nudges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id"), index=True)
    kind = Column(String, nullable=False)                    # reengage_1 | reengage_2 | supporter | paused
    channel = Column(String, nullable=False)                 # push | in_app | supporter
    lapse_start = Column(Date, nullable=False)               # the first missed day of the lapse this belongs to
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    hour = Column(Integer, nullable=True)
    responded = Column(Boolean, default=False)               # checked in within 48 hours
    responded_at = Column(DateTime(timezone=True), nullable=True)


class BehaviorShare(Base):
    """The person chose to let one caregiver or family member follow a plan and encourage them. Only the owner can create or remove it."""
    __tablename__ = "behavior_shares"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    supporter_id = Column(Integer, ForeignKey("users.id"), index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id"), index=True)
    level = Column(String, default="cheers")                 # cheers: supporter learns only that encouragement would help | progress: plus weekly engagement
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BehaviorCheer(Base):
    """A preset kind message from a supporter. Presets only: no free text, so it cannot be used to pressure or shame."""
    __tablename__ = "behavior_cheers"

    id = Column(Integer, primary_key=True, index=True)
    from_id = Column(Integer, ForeignKey("users.id"), index=True)
    to_id = Column(Integer, ForeignKey("users.id"), index=True)
    kind = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BehaviorGroup(Base):
    """A workplace, community or family group. Members see group totals only; nobody (including whoever created it) sees individuals."""
    __tablename__ = "behavior_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    kind = Column(String, default="community")               # workplace | community | family
    join_code = Column(String, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BehaviorGroupMember(Base):
    __tablename__ = "behavior_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("behavior_groups.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentRun(Base):
    """One recorded pass of the care agent for one person: what it sensed, decided and did, and whether a clinician needs to look.
    The trace is stored so the person, and a doctor they allowed, can see exactly why a message went out. Never used to train anything."""
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id"), nullable=True)
    lapse_start = Column(Date, nullable=True)
    kind = Column(String, nullable=False)                    # nudge | review
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    trace = Column(JSON, nullable=False)
    handoff_needed = Column(Boolean, default=False, index=True)
    review_status = Column(String, default="none")           # none | pending | approved | overridden | dismissed
    reviewed_by = Column(Integer, nullable=True)             # doctors.id
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    returned = Column(Boolean, default=False)                # the person checked in within 48 hours of the message
    returned_at = Column(DateTime(timezone=True), nullable=True)


class ComebackSession(Base):
    """One time a person used the comeback coach: what got in the way, which way back they chose, and whether they checked in again within 72 hours.
    Used only to show, anonymously and in groups of 5 or more, which options bring people back."""
    __tablename__ = "comeback_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id"), nullable=True)
    barrier = Column(String, nullable=False)
    option = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    returned = Column(Boolean, default=False)
    returned_at = Column(DateTime(timezone=True), nullable=True)
