"""Shared queries for activity data: daily steps, workout totals, streaks. Used by the activity API and the leaderboard."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.activity import Workout
from app.models.health import HealthData


def day_bounds(d: date) -> tuple:
    start = datetime.combine(d, time.min)
    return start, start + timedelta(days=1)


def daily_steps(db: Session, user_ids: Iterable[int], start: date, end: date) -> Dict[int, Dict[date, int]]:
    """Steps per user per day: the highest value recorded that day (the phone reports a running day total)."""
    ids = list(user_ids)
    out: Dict[int, Dict[date, int]] = {i: {} for i in ids}
    if not ids:
        return out
    lo, _ = day_bounds(start)
    _, hi = day_bounds(end)
    for r in db.query(HealthData).filter(HealthData.user_id.in_(ids), HealthData.date >= lo, HealthData.date < hi).all():
        if not r.steps:
            continue
        d = r.date.date()
        out[r.user_id][d] = max(out[r.user_id].get(d, 0), int(r.steps))
    return out


def today_metrics(db: Session, user_id: int, day: date) -> dict:
    """What the phone and watch reported for one day: the highest value of each running total, and which source gave the steps."""
    lo, hi = day_bounds(day)
    out = {"steps": 0, "calories": None, "active_minutes": None, "distance_m": None, "steps_source": None}
    for r in db.query(HealthData).filter(HealthData.user_id == user_id, HealthData.date >= lo, HealthData.date < hi).all():
        if (r.steps or 0) >= out["steps"] and r.steps:
            out["steps"], out["steps_source"] = int(r.steps), getattr(r, "steps_source", None) or out["steps_source"]
        for key, col in (("calories", "calories_burned"), ("active_minutes", "active_minutes"), ("distance_m", "distance_m")):
            v = getattr(r, col, None)
            if v:
                out[key] = max(out[key] or 0, int(v))
    return out


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def workouts_between(db: Session, user_ids: Iterable[int], start: date, end: date, include_flagged: bool = False) -> Dict[int, List[Workout]]:
    ids = list(user_ids)
    out: Dict[int, List[Workout]] = defaultdict(list)
    if not ids:
        return out
    lo = datetime.combine(start, time.min, tzinfo=timezone.utc)
    hi = datetime.combine(end, time.min, tzinfo=timezone.utc) + timedelta(days=1)
    q = db.query(Workout).filter(Workout.user_id.in_(ids), Workout.started_at >= lo, Workout.started_at < hi)
    if not include_flagged:
        q = q.filter(Workout.flagged == False)  # noqa: E712
    for w in q.all():
        out[w.user_id].append(w)
    return out


def streak_days(db: Session, user_id: int, today: Optional[date] = None, min_steps: int = 3000) -> int:
    """Consecutive days up to today with at least `min_steps` steps or a workout. Today not counting yet does not break it."""
    today = today or date.today()
    start = today - timedelta(days=120)
    steps = daily_steps(db, [user_id], start, today)[user_id]
    active = {d for d, s in steps.items() if s >= min_steps}
    for w in workouts_between(db, [user_id], start, today)[user_id]:
        active.add(_utc(w.started_at).date())
    n, d = 0, today if today in active else today - timedelta(days=1)
    while d in active:
        n += 1
        d -= timedelta(days=1)
    return n
