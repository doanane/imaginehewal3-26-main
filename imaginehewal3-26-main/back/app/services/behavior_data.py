"""The facts about a person that the behaviour loop may use, gathered in one place.

Everything here is read-only and comes from data the person already gave the app: their profile, readings and sleep. Wearable-derived values
(sleep, active minutes, steps) are only used when the person switched `wearable_data_enabled` on; health context for SAFETY (a very high blood
pressure reading) is always checked, because holding a step back protects the person.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.activity import SleepSession
from app.models.behavior import BehaviorContext
from app.models.health import HealthData
from app.models.iot_device import VitalReading
from app.models.safety import SosEvent
from app.models.user import User, UserProfile
from app.services.emergency_service import OPEN

CONTEXT_DEFAULTS = {"preferred_time": "any", "work_pattern": "regular", "mobility": "full", "support": "alone",
                    "readiness": 3, "literacy": "standard", "motivation_text": None,
                    "segment": None, "region": "gh", "respect_prayer": True, "preferred_clock": None}
CONTEXT_CHOICES = {
    "preferred_time": ("morning", "midday", "evening", "any"),
    "work_pattern": ("regular", "desk", "shift", "irregular", "not_working"),
    "segment": ("chronic", "sedentary", "young_adult", "adult", "older_adult"),
    "region": ("gh", "ae"),
    "mobility": ("full", "limited", "wheelchair"),
    "support": ("alone", "family", "friend", "workplace"),
    "literacy": ("standard", "simple"),
}


def context_for(db: Session, user_id: int) -> dict:
    row = db.query(BehaviorContext).filter_by(user_id=user_id).first()
    if not row:
        return dict(CONTEXT_DEFAULTS)
    return {k: (getattr(row, k) if getattr(row, k) is not None else CONTEXT_DEFAULTS[k]) for k in CONTEXT_DEFAULTS}


def resolved_segment(ctx: dict, health: dict) -> Optional[str]:
    from app.services import audience
    return audience.resolve(ctx.get("segment"), health.get("age"), health.get("conditions"), ctx.get("work_pattern"))


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def last_night_sleep_hours(db: Session, user_id: int) -> Optional[float]:
    """Hours actually asleep in the most recent night that ended in the last 36 hours, or None."""
    cut = datetime.now(timezone.utc) - timedelta(hours=36)
    row = (db.query(SleepSession).filter(SleepSession.user_id == user_id, SleepSession.end >= cut)
           .order_by(SleepSession.end.desc()).first())
    if not row:
        return None
    asleep = (row.light_min + row.deep_min + row.rem_min) if (row.stages or row.deep_min) else row.total_min
    return round(asleep / 60.0, 1) if asleep else None


def _bp_crisis(db: Session, user_id: int) -> bool:
    """A reading in the last 24 hours at or above 180/120 (the level at which guidance is to seek medical advice)."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    v = (db.query(VitalReading).filter(VitalReading.user_id == user_id, VitalReading.timestamp >= since,
                                       VitalReading.blood_pressure_systolic.isnot(None))
         .order_by(VitalReading.timestamp.desc()).first())
    return bool(v and ((v.blood_pressure_systolic or 0) >= 180 or (v.blood_pressure_diastolic or 0) >= 120))


def health_context(db: Session, user: User) -> dict:
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    sos = db.query(SosEvent).filter(SosEvent.user_id == user.id, SosEvent.status.in_(OPEN)).first() is not None
    return {
        "conditions": list(prof.chronic_conditions or []) if prof else [],
        "habits": list(prof.daily_habits or []) if prof else [],
        "bp_crisis": _bp_crisis(db, user.id),
        "sos_active": sos,
        "sleep_hours": last_night_sleep_hours(db, user.id),
        "gender": prof.gender if prof else None,
        "age": prof.age if prof else None,
    }


def todays_health_row(db: Session, user_id: int) -> Optional[HealthData]:
    start = datetime.combine(date.today(), datetime.min.time())
    return (db.query(HealthData).filter(HealthData.user_id == user_id, HealthData.date >= start)
            .order_by(HealthData.date.desc()).first())
