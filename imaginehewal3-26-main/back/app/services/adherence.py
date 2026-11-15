"""Medicine adherence the way a clinician would count it.

The old figure was "doses logged as taken, divided by EVERY scheduled dose for EVERY day in the window". That reads 0% (or far too low) for:
- a medicine added today (the days before it existed counted as missed),
- doses that are not due yet (this evening's tablet counted as missed at noon),
- a patient who just started and has had no chance to log anything.
Now only doses that were DUE count: on or after the moment the medicine was added, and past their scheduled time plus one hour of grace.
With fewer than 3 due doses there is nothing fair to judge, so the answer is None ("not enough data"), never 0%.
A dose with no log is reported as "not logged", separately from "skipped": the patient may simply not have tapped the button.
Times are the server's local clock (Ghana is UTC+0); the medicine list stores plain "HH:MM" with no time zone.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.safety import Medication, MedicationLog

GRACE = timedelta(minutes=60)
MIN_DUE = 3


def _local(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.astimezone().replace(tzinfo=None) if dt.tzinfo else dt


def _slot(day: date, hhmm: str) -> Optional[datetime]:
    try:
        h, m = hhmm.split(":")
        return datetime.combine(day, time(int(h), int(m)))
    except Exception:
        return None


def due_slots(meds: List[Medication], days: int, now: Optional[datetime] = None) -> List[Tuple[int, date, str]]:
    """(medication id, day, 'HH:MM') for every dose that is due in the last `days` days."""
    now = now or datetime.now()
    start = now.date() - timedelta(days=days - 1)
    out = []
    for m in meds:
        added = _local(m.created_at) or datetime.min
        for i in range(days):
            day = start + timedelta(days=i)
            for t in (m.times or []):
                s = _slot(day, str(t))
                if s is not None and s >= added and s + GRACE <= now:
                    out.append((m.id, day, str(t)))
    return out


def adherence(db: Session, user_id: int, days: int = 7, now: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """None when the person has no active medicine. Otherwise the counts and `pct` (None while fewer than 3 doses were due)."""
    meds = db.query(Medication).filter_by(user_id=user_id, active=True).all()
    if not meds:
        return None
    now = now or datetime.now()
    start = now.date() - timedelta(days=days - 1)
    logs = db.query(MedicationLog).filter(MedicationLog.user_id == user_id, MedicationLog.day >= start).all()
    state = {(l.medication_id, l.day, l.time): l.status for l in logs}
    due = taken = skipped = 0
    per_day: Dict[date, List[int]] = defaultdict(lambda: [0, 0])
    per_slot: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    for mid, day, t in due_slots(meds, days, now):
        due += 1
        per_day[day][0] += 1
        per_slot[t][0] += 1
        s = state.get((mid, day, t))
        if s == "taken":
            taken += 1; per_day[day][1] += 1; per_slot[t][1] += 1
        elif s == "skipped":
            skipped += 1
    daily = [{"day": (start + timedelta(days=i)).isoformat(), "taken": per_day[start + timedelta(days=i)][1], "expected": per_day[start + timedelta(days=i)][0]} for i in range(days)]
    by_time = [{"time": t, "taken_pct": round(v[1] / v[0] * 100)} for t, v in sorted(per_slot.items()) if v[0]]
    return {"due": due, "taken": taken, "skipped": skipped, "unlogged": due - taken - skipped,
            "pct": round(taken / due * 100) if due >= MIN_DUE else None, "daily": daily, "by_time": by_time,
            "medicines": [{"name": m.name, "dose": m.dose, "times": m.times or []} for m in meds]}
