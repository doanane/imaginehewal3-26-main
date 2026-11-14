"""Leaderboards and achievements.

Fairness and privacy:
- Only people who opted in appear, under their display name. User ids and emails are never returned.
- Workouts whose speed is implausible are flagged and never count.
- Steps come from the phone sensor and cannot be fully verified, so the daily step value is capped.
- Points = steps / 100 + 10 per km + 1 per workout minute, so one big number cannot dominate by luck.
"""
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.activity import Achievement, HealthGoals, Participant
from app.models.user import User
from app.realtime import hub
from app.services import activity_data as ad

CATEGORIES = {"steps": "Total steps", "distance": "Distance (km)", "minutes": "Workout minutes", "points": "Achievement points"}
PERIODS = ("today", "week", "month")
DAILY_STEP_CAP = 60000

ACHIEVEMENTS = {
    "first_workout": ("First workout", "Finish your first run, walk or ride.", "flag-outline"),
    "run_5k": ("5K runner", "Run 5 km in one go.", "walk-outline"),
    "steps_10k": ("10,000 step day", "Take 10,000 steps in a day.", "footsteps-outline"),
    "streak_7": ("7-day streak", "Be active 7 days in a row.", "flame-outline"),
    "km_100": ("100 km club", "Cover 100 km in total.", "trophy-outline"),
    "goal_5_days": ("Goal getter", "Reach your step goal on 5 days in one week.", "ribbon-outline"),
}


def period_range(period: str, today: Optional[date] = None) -> tuple:
    today = today or date.today()
    if period == "today":
        return today, today
    if period == "week":
        return today - timedelta(days=today.weekday()), today
    return today.replace(day=1), today


def values(db: Session, user_ids: List[int], period: str, today: Optional[date] = None) -> Dict[int, dict]:
    start, end = period_range(period, today)
    steps = ad.daily_steps(db, user_ids, start, end)
    wos = ad.workouts_between(db, user_ids, start, end)
    out: Dict[int, dict] = {}
    for uid in user_ids:
        total_steps = sum(min(s, DAILY_STEP_CAP) for s in steps[uid].values())
        km = sum(w.distance_m for w in wos[uid]) / 1000.0
        minutes = sum(w.duration_s for w in wos[uid]) // 60
        points = total_steps // 100 + round(km * 10) + minutes
        out[uid] = {"steps": total_steps, "distance": round(km, 2), "minutes": int(minutes), "points": int(points)}
    return out


def board(db: Session, me: User, category: str, period: str, limit: int = 50, q: str = "", today: Optional[date] = None) -> dict:
    parts = db.query(Participant).filter(Participant.leaderboard_opt_in == True).all()  # noqa: E712
    vals = values(db, [p.user_id for p in parts], period, today)
    ranked = sorted(parts, key=lambda p: (-vals[p.user_id][category], p.id))
    rows, prev_val, prev_rank = [], None, 0
    for i, p in enumerate(ranked, start=1):
        v = vals[p.user_id][category]
        rank = prev_rank if v == prev_val else i               # ties share a rank (1, 2, 2, 4)
        prev_val, prev_rank = v, rank
        rows.append({"rank": rank, "participant_id": p.id, "name": p.display_name, "value": v, "is_me": p.user_id == me.id})
    mine = next((r for r in rows if r["is_me"]), None)
    shown = [r for r in rows if not q or q.lower() in r["name"].lower()][:limit]
    return {"category": category, "label": CATEGORIES[category], "period": period, "participants": len(rows), "rows": shown,
            "me": mine, "podium": rows[:3], "updated_at": datetime.now(timezone.utc).isoformat()}


# ------------------------------------------------------------------ achievements
def evaluate(db: Session, user: User, today: Optional[date] = None) -> List[str]:
    """Award anything newly earned. Returns the new keys."""
    today = today or date.today()
    have = {a.key for a in db.query(Achievement).filter_by(user_id=user.id).all()}
    new: List[str] = []
    wos = ad.workouts_between(db, [user.id], today - timedelta(days=3650), today)[user.id]
    steps = ad.daily_steps(db, [user.id], today - timedelta(days=60), today)[user.id]
    goal = db.query(HealthGoals).filter_by(user_id=user.id).first()
    goal_steps = goal.steps if goal else 8000
    wk_start = today - timedelta(days=today.weekday())

    checks = {
        "first_workout": bool(wos),
        "run_5k": any(w.kind == "run" and w.distance_m >= 5000 for w in wos),
        "steps_10k": any(s >= 10000 for s in steps.values()),
        "streak_7": ad.streak_days(db, user.id, today) >= 7,
        "km_100": sum(w.distance_m for w in wos) >= 100000,
        "goal_5_days": sum(1 for d, s in steps.items() if d >= wk_start and s >= goal_steps) >= 5,
    }
    for key, ok in checks.items():
        if ok and key not in have:
            db.add(Achievement(user_id=user.id, key=key))
            new.append(key)
    if new:
        db.commit()
        for k in new:
            hub.send_from_thread(user.id, {"type": "achievement.new", "key": k, "title": ACHIEVEMENTS[k][0]})
    return new


def list_achievements(db: Session, user: User) -> List[dict]:
    got = {a.key: a.earned_at for a in db.query(Achievement).filter_by(user_id=user.id).all()}
    return [{"key": k, "title": t, "description": d, "icon": i, "earned": k in got,
             "earned_at": got[k].isoformat() if k in got and got[k] else None} for k, (t, d, i) in ACHIEVEMENTS.items()]


# ------------------------------------------------------------------ live updates
_last = {"t": 0.0}
_lock = threading.Lock()


def notify_changed(db: Session, user: User, force: bool = False) -> None:
    """Tell connected clients to refresh their leaderboard. No data is sent, only a nudge, and at most every 1.5 s."""
    p = db.query(Participant).filter_by(user_id=user.id, leaderboard_opt_in=True).first()
    if not p:
        return
    with _lock:
        if not force and time.time() - _last["t"] < 1.5:
            return
        _last["t"] = time.time()
    hub.broadcast_from_thread({"type": "leaderboard.update"})
