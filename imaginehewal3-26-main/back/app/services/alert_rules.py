"""When is a risk alert on the Home screen TRUE?

A single reading is not enough to tell someone their blood pressure is dangerous: cuffs slip, wrists move, and a new account has no history to
compare with. So an alert on Home needs all of:
  1. a reading that is fresh (the last 24 hours), never an old one;
  2. a REAL source: readings made by the demo tool never count;
  3. a repeat: the latest reading is out of range AND another reading at least 5 minutes before it was too (the "repeat the measurement"
     advice every guideline gives);
  4. some history: the account has data on at least 3 different days in the last 14, so a brand new user sees no alert until the app knows them.
This only decides what the Home alert list shows. The emergency pipeline (watch detection, SOS, caregiver escalation) is separate and unchanged.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Callable, List, Optional

from sqlalchemy.orm import Session

from app.models.health import FoodLog, HealthData
from app.models.iot_device import IoTDevice, VitalReading

FRESH_HOURS = 24
MIN_DAYS_OF_DATA = 3
HISTORY_DAYS = 14
REPEAT_GAP = timedelta(minutes=5)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_simulated(device: Optional[IoTDevice]) -> bool:
    """Readings made by the demo tool carry no device, or a device whose id starts with 'demo'. They exercise the emergency flow; they are not health data."""
    if device is None:
        return True
    return str(device.device_id or "").startswith("demo") or str(device.device_type or "") == "simulation"


def trusted_readings(db: Session, user_id: int, hours: int = FRESH_HOURS, now: Optional[datetime] = None) -> List[VitalReading]:
    """Fresh readings from real devices, newest first."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)
    rows = (db.query(VitalReading, IoTDevice).outerjoin(IoTDevice, VitalReading.device_id == IoTDevice.id)
            .filter(VitalReading.user_id == user_id).order_by(VitalReading.timestamp.desc()).limit(200).all())
    return [v for v, d in rows if not is_simulated(d) and _aware(v.timestamp) and _aware(v.timestamp) >= since]


def days_with_data(db: Session, user_id: int, now: Optional[datetime] = None) -> int:
    """Different calendar days, in the last 14, on which the person recorded anything real: a reading, activity or a meal."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=HISTORY_DAYS)
    days = set()
    for r in db.query(HealthData).filter(HealthData.user_id == user_id, HealthData.date >= since.replace(tzinfo=None)).all():
        # the dashboard creates an empty row for "today" the first time it is opened; only a row holding a real value counts as a day of data
        real = (r.steps or 0) > 0 or (r.water_intake or 0) > 0 or r.sleep_time or r.blood_pressure or r.heart_rate or r.blood_glucose             or (r.calories_burned or 0) > 0 or (r.active_minutes or 0) > 0
        if r.date and real:
            days.add(r.date.date())
    for (t,) in db.query(FoodLog.created_at).filter(FoodLog.user_id == user_id, FoodLog.created_at >= since).all():
        if t:
            days.add(t.date())
    for v in trusted_readings(db, user_id, hours=HISTORY_DAYS * 24, now=now):
        t = _aware(v.timestamp)
        if t:
            days.add(t.date())
    return len(days)


def has_history(db: Session, user_id: int, now: Optional[datetime] = None) -> bool:
    return days_with_data(db, user_id, now) >= MIN_DAYS_OF_DATA


def confirmed(readings: List[VitalReading], is_bad: Callable[[VitalReading], Optional[bool]]) -> Optional[List[VitalReading]]:
    """The two readings that make an alert true, or None. `is_bad` returns None when the reading does not contain that vital at all."""
    seen = [(r, is_bad(r)) for r in readings]
    seen = [(r, bad) for r, bad in seen if bad is not None]
    if not seen or not seen[0][1]:
        return None                                  # the latest reading is fine, so there is nothing to alert about now
    first = seen[0][0]
    t0 = _aware(first.timestamp)
    for other, bad in seen[1:]:
        t1 = _aware(other.timestamp)
        if bad and t0 and t1 and t0 - t1 >= REPEAT_GAP:
            return [first, other]
    return None


# ---- the three vital rules (the same thresholds as before, now needing a repeat)
def bp_critical(v: VitalReading) -> Optional[bool]:
    s, d = v.blood_pressure_systolic, v.blood_pressure_diastolic
    if not s and not d:
        return None
    return (s or 0) >= 180 or (d or 0) >= 120


def hr_out_of_range(v: VitalReading) -> Optional[bool]:
    if v.heart_rate is None:
        return None
    return v.heart_rate >= 120 or v.heart_rate <= 40


def oxygen_low(v: VitalReading) -> Optional[bool]:
    if v.blood_oxygen is None:
        return None
    return v.blood_oxygen < 90
