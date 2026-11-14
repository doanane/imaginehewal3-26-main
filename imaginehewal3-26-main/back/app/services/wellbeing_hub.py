"""Weekly wellbeing challenges, the wellbeing score and interest groups.

Nothing here is invented. Challenge progress and every part of the score are worked out from what the person's own data says
(steps, workouts, sleep, meals, medicines, the check-in). A part with no data is left out and the score is re-weighted over the
parts that do have data; with fewer than two parts there is no score, only a prompt about what to add.
The score is a summary of habits, not a diagnosis, and the wording says so.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import HealthGoals, Participant, SleepSession, Workout
from app.models.explore import ArticleRead, ChallengeEntry, GroupMember
from app.models.health import FoodLog, HealthData
from app.models.safety import MedicationLog
from app.models.trust import WellbeingCheckin
from app.models.user import User
from app.services import activity_data as ad
from app.services import explore_media as media

# ------------------------------------------------------------------ challenges
CHALLENGES: Dict[str, dict] = {
    "steps": {"title": "Step up week", "icon": "walk-outline", "unit": "steps", "target": 50000, "domain": "Activity",
              "tagline": "Walk 50,000 steps this week", "about": "Take 50,000 steps between Monday and Sunday, about 7,000 a day. Steps come from your phone or watch."},
    "active": {"title": "150 active minutes", "icon": "flash-outline", "unit": "minutes", "target": 150, "domain": "Activity",
               "tagline": "Be active for 150 minutes this week", "about": "Health agencies suggest at least 150 minutes of moderate activity a week. Watch active minutes and recorded workouts both count."},
    "sleep": {"title": "Rested week", "icon": "moon-outline", "unit": "nights", "target": 5, "domain": "Sleep",
              "tagline": "Sleep 7 hours or more on 5 nights", "about": "Sleep at least 7 hours on 5 nights this week. Sleep comes from Apple Health or what you log."},
    "meals": {"title": "Mindful meals", "icon": "restaurant-outline", "unit": "days", "target": 5, "domain": "Nutrition",
              "tagline": "Log a meal on 5 days this week", "about": "Log at least one meal on 5 days this week. Noticing what you eat is the first step to changing it."},
    "meds": {"title": "On track with medicines", "icon": "medkit-outline", "unit": "days", "target": 5, "domain": "Habits",
             "tagline": "Take your medicines on 5 days", "about": "Mark your medicines as taken on 5 days this week."},
    "mind": {"title": "Check in with yourself", "icon": "heart-outline", "unit": "check-in", "target": 1, "domain": "Mind",
             "tagline": "Complete one wellbeing check-in", "about": "Complete the short wellbeing check-in once this week. Your answers stay private."},
    "learn": {"title": "Learn something new", "icon": "book-outline", "unit": "articles", "target": 3, "domain": "Learning",
              "tagline": "Read 3 articles this week", "about": "Read 3 articles in the library this week."},
}


def week_start(today: Optional[date] = None) -> date:
    today = today or date.today()
    return today - timedelta(days=today.weekday())


def _span(ws: date):
    lo = datetime.combine(ws, time.min, tzinfo=timezone.utc)
    return lo, lo + timedelta(days=7)


def progress_value(db: Session, user_id: int, key: str, ws: date, today: Optional[date] = None) -> int:
    today = today or date.today()
    end = min(today, ws + timedelta(days=6))
    lo, hi = _span(ws)
    if key == "steps":
        steps = ad.daily_steps(db, [user_id], ws, end)[user_id]
        return int(sum(min(v, 60000) for v in steps.values()))
    if key == "active":
        rows = db.query(HealthData).filter(HealthData.user_id == user_id, HealthData.date >= datetime.combine(ws, time.min),
                                           HealthData.date < datetime.combine(ws + timedelta(days=7), time.min)).all()
        per_day: Dict[date, int] = {}
        for r in rows:
            if r.active_minutes:
                d = r.date.date()
                per_day[d] = max(per_day.get(d, 0), int(r.active_minutes))
        watch = sum(per_day.values())
        wo = sum(w.duration_s for w in ad.workouts_between(db, [user_id], ws, end)[user_id]) // 60
        return int(max(watch, wo))
    if key == "sleep":
        rows = db.query(SleepSession).filter(SleepSession.user_id == user_id, SleepSession.end >= lo, SleepSession.end < hi, SleepSession.total_min >= 420).all()
        return len({(r.end.date() if r.end else None) for r in rows} - {None})
    if key == "meals":
        rows = db.query(FoodLog.created_at).filter(FoodLog.user_id == user_id, FoodLog.created_at >= lo, FoodLog.created_at < hi).all()
        return len({r[0].date() for r in rows if r[0]})
    if key == "meds":
        n = db.query(func.count(func.distinct(MedicationLog.day))).filter(MedicationLog.user_id == user_id, MedicationLog.status == "taken",
                                                                          MedicationLog.day >= ws, MedicationLog.day <= end).scalar()
        return int(n or 0)
    if key == "mind":
        n = db.query(func.count(WellbeingCheckin.id)).filter(WellbeingCheckin.user_id == user_id, WellbeingCheckin.created_at >= lo,
                                                             WellbeingCheckin.created_at < hi).scalar()
        return int(n or 0)
    if key == "learn":
        n = db.query(func.count(ArticleRead.id)).filter(ArticleRead.user_id == user_id, ArticleRead.read_at >= lo, ArticleRead.read_at < hi).scalar()
        return int(n or 0)
    return 0


def daily_values(db: Session, user_id: int, key: str, ws: date, today: Optional[date] = None) -> Optional[List[Optional[float]]]:
    """One value per day, Monday first, for the bar chart. Days that have not happened yet are None. Challenges counted once a week have no chart."""
    today = today or date.today()
    days = [ws + timedelta(days=i) for i in range(7)]
    end = min(today, ws + timedelta(days=6))
    vals: Dict[date, float] = {}
    if key == "steps":
        vals = {d: float(min(v, 60000)) for d, v in ad.daily_steps(db, [user_id], ws, end)[user_id].items()}
    elif key == "active":
        rows = db.query(HealthData).filter(HealthData.user_id == user_id, HealthData.date >= datetime.combine(ws, time.min),
                                           HealthData.date < datetime.combine(ws + timedelta(days=7), time.min)).all()
        for r in rows:
            if r.active_minutes:
                vals[r.date.date()] = max(vals.get(r.date.date(), 0.0), float(r.active_minutes))
        wm: Dict[date, float] = {}
        for w in ad.workouts_between(db, [user_id], ws, end)[user_id]:
            wm[w.started_at.date()] = wm.get(w.started_at.date(), 0.0) + w.duration_s / 60
        for d, m in wm.items():
            vals[d] = max(vals.get(d, 0.0), m)          # the watch and a recorded workout describe the same time, so take the larger
    elif key == "sleep":
        lo, hi = _span(ws)
        for r in db.query(SleepSession).filter(SleepSession.user_id == user_id, SleepSession.end >= lo, SleepSession.end < hi).all():
            vals[r.end.date()] = round(r.total_min / 60, 1)
    elif key == "meals":
        lo, hi = _span(ws)
        for (t,) in db.query(FoodLog.created_at).filter(FoodLog.user_id == user_id, FoodLog.created_at >= lo, FoodLog.created_at < hi).all():
            if t:
                vals[t.date()] = vals.get(t.date(), 0.0) + 1
    elif key == "meds":
        for d, n in db.query(MedicationLog.day, func.count(MedicationLog.id)).filter(MedicationLog.user_id == user_id, MedicationLog.status == "taken",
                                                                                      MedicationLog.day >= ws, MedicationLog.day <= end).group_by(MedicationLog.day).all():
            vals[d] = float(n)
    else:
        return None
    return [(vals.get(d, 0.0) if d <= end else None) for d in days]


def _card(key: str, value: Optional[int], joined: bool, members: int, days_left: int) -> dict:
    c = CHALLENGES[key]
    out = {"key": key, "title": c["title"], "tagline": c["tagline"], "image": media.url(key), "icon": c["icon"], "unit": c["unit"], "target": c["target"], "domain": c["domain"], "about": c["about"],
           "joined": joined, "members": members if members >= 5 else None, "days_left": days_left}
    if joined and value is not None:
        out.update({"value": min(value, c["target"] * 3), "percent": min(100, round(value * 100 / c["target"])), "done": value >= c["target"]})
    return out


def list_challenges(db: Session, user: User, today: Optional[date] = None) -> dict:
    today = today or date.today()
    ws = week_start(today)
    mine = {e.challenge_key for e in db.query(ChallengeEntry).filter_by(user_id=user.id, week_start=ws).all()}
    counts = dict(db.query(ChallengeEntry.challenge_key, func.count(ChallengeEntry.id)).filter_by(week_start=ws).group_by(ChallengeEntry.challenge_key).all())
    days_left = (ws + timedelta(days=6) - today).days + 1
    items = [_card(k, progress_value(db, user.id, k, ws, today) if k in mine else None, k in mine, int(counts.get(k, 0)), days_left) for k in CHALLENGES]
    return {"week_start": ws.isoformat(), "days_left": days_left, "items": items, "completed": sum(1 for i in items if i.get("done"))}


def join_challenge(db: Session, user: User, key: str, today: Optional[date] = None) -> None:
    ws = week_start(today)
    if not db.query(ChallengeEntry).filter_by(user_id=user.id, challenge_key=key, week_start=ws).first():
        db.add(ChallengeEntry(user_id=user.id, challenge_key=key, week_start=ws))
        db.commit()


def leave_challenge(db: Session, user: User, key: str, today: Optional[date] = None) -> None:
    db.query(ChallengeEntry).filter_by(user_id=user.id, challenge_key=key, week_start=week_start(today)).delete()
    db.commit()


def challenge_board(db: Session, user: User, key: str, today: Optional[date] = None) -> dict:
    """Ranking of the people in this challenge who chose to appear on leaderboards (by the same display name they use in the community)."""
    today = today or date.today()
    ws = week_start(today)
    entries = db.query(ChallengeEntry).filter_by(challenge_key=key, week_start=ws).all()
    opted = {p.user_id: p.display_name for p in db.query(Participant).filter(Participant.user_id.in_([e.user_id for e in entries] or [0]),
                                                                              Participant.leaderboard_opt_in == True).all()}  # noqa: E712
    target = CHALLENGES[key]["target"]
    rows = sorted(({"name": n, "value": progress_value(db, uid, key, ws, today), "is_me": uid == user.id} for uid, n in opted.items()),
                  key=lambda r: (-r["value"], r["name"]))
    prev_v, prev_r = None, 0
    for i, r in enumerate(rows, 1):
        r["rank"] = prev_r if r["value"] == prev_v else i
        prev_v, prev_r = r["value"], r["rank"]
        r["percent"] = min(100, round(r["value"] * 100 / target))
    return {"key": key, "target": target, "unit": CHALLENGES[key]["unit"], "members": len(entries), "rows": rows[:25],
            "me_opted_in": user.id in opted}


# ------------------------------------------------------------------ the wellbeing score
WEIGHTS = {"activity": 25, "sleep": 20, "nutrition": 15, "mind": 20, "habits": 20}
LABELS = {"activity": "Activity", "sleep": "Sleep", "nutrition": "Nutrition", "mind": "Mind", "habits": "Medicines and habits"}
HOW = {
    "activity": "Move toward your daily step goal. Even a 10 minute walk after a meal adds up.",
    "sleep": "Keep a regular bedtime and aim for 7 to 9 hours. Sleep and wake at the same time, even at weekends.",
    "nutrition": "Log your meals and build a plate with half vegetables or fruit. Swap one sugary drink for water.",
    "mind": "Complete the short wellbeing check-in. If your answers suggest it, talking to someone helps.",
    "habits": "Mark your medicines as taken when you take them. Steady routines protect your health.",
}


def _band(score: int) -> str:
    return "Excellent" if score >= 85 else "Good" if score >= 70 else "Fair" if score >= 50 else "Needs attention"


def _sleep_quality(minutes: float) -> float:
    h = minutes / 60
    if h < 7:
        return max(0.0, h / 7)
    if h <= 9:
        return 1.0
    return max(0.6, 1 - (h - 9) * 0.1)


def compute_score(db: Session, user: User, today: Optional[date] = None) -> dict:
    today = today or date.today()
    since = today - timedelta(days=6)
    parts: Dict[str, Optional[dict]] = {}

    goal = db.query(HealthGoals).filter_by(user_id=user.id).first()
    steps = ad.daily_steps(db, [user.id], since, today)[user.id]
    if steps:
        gs = (goal.steps if goal and goal.steps else 8000)
        v = sum(min(s / gs, 1.0) for s in steps.values()) / len(steps)
        parts["activity"] = {"value": round(v * 100), "detail": f"{len(steps)} days with steps in the last 7, average {round(sum(steps.values()) / len(steps)):,} a day against your goal of {gs:,}."}

    lo = datetime.combine(since, time.min, tzinfo=timezone.utc)
    nights = db.query(SleepSession).filter(SleepSession.user_id == user.id, SleepSession.end >= lo).all()
    if nights:
        v = sum(_sleep_quality(n.total_min) for n in nights) / len(nights)
        avg = sum(n.total_min for n in nights) / len(nights)
        parts["sleep"] = {"value": round(v * 100), "detail": f"{len(nights)} nights in the last 7, average {int(avg // 60)}h {int(avg % 60)}m."}

    meals = [m.diet_score for m in db.query(FoodLog).filter(FoodLog.user_id == user.id, FoodLog.created_at >= lo).all() if m.diet_score is not None]
    if meals:
        parts["nutrition"] = {"value": round(sum(meals) / len(meals)), "detail": f"{len(meals)} meals logged in the last 7 days, average meal score {round(sum(meals) / len(meals))} of 100 (an estimate)."}

    ck = db.query(WellbeingCheckin).filter(WellbeingCheckin.user_id == user.id).order_by(WellbeingCheckin.id.desc()).first()
    if ck and ck.created_at:
        at = ck.created_at if ck.created_at.tzinfo else ck.created_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - at <= timedelta(days=30):
            parts["mind"] = {"value": round((12 - (ck.phq2 + ck.gad2)) / 12 * 100), "detail": f"From your check-in on {at.date().isoformat()}. Your answers stay private."}

    logs = db.query(MedicationLog).filter(MedicationLog.user_id == user.id, MedicationLog.day >= today - timedelta(days=13)).all()
    if len(logs) >= 3:
        taken = sum(1 for g in logs if g.status == "taken")
        parts["habits"] = {"value": round(taken * 100 / len(logs)), "detail": f"{taken} of {len(logs)} logged doses taken in the last 14 days."}

    have = {k: v for k, v in parts.items() if v}
    weight = sum(WEIGHTS[k] for k in have)
    score = round(sum(WEIGHTS[k] * v["value"] for k, v in have.items()) / weight) if len(have) >= 2 else None
    domains = [{"key": k, "label": LABELS[k], "weight": WEIGHTS[k], "has_data": k in have, "value": have[k]["value"] if k in have else None,
                "detail": have[k]["detail"] if k in have else "No data yet.", "improve": HOW[k]} for k in WEIGHTS]
    return {"score": score, "band": _band(score) if score is not None else None, "domains": domains, "parts_used": len(have),
            "message": None if score is not None else "Add data from at least two areas to see your score. Check the areas marked as missing.",
            "note": "Your wellbeing score is a summary of your habits from your own data. It is not a diagnosis and does not replace advice from a clinician.",
            "method": "Each area is scored 0 to 100 from your last 7 to 30 days, then combined using the weights shown. Areas with no data are left out and the rest are re-weighted."}


# ------------------------------------------------------------------ interest groups
GROUPS: Dict[str, dict] = {
    "walking": {"title": "Walkers and runners", "icon": "walk-outline", "about": "Routes, goals and motivation for people who move on foot."},
    "heart": {"title": "Heart and blood pressure", "icon": "heart-outline", "about": "Living well with blood pressure and heart health."},
    "diabetes": {"title": "Diabetes support", "icon": "water-outline", "about": "Food, glucose and daily life with diabetes."},
    "eating": {"title": "Healthy eating", "icon": "nutrition-outline", "about": "Local, affordable meals and cooking ideas."},
    "sleep": {"title": "Sleep and stress", "icon": "moon-outline", "about": "Better rest and calmer days."},
    "peer": {"title": "Mental wellbeing", "icon": "happy-outline", "about": "A kind place to share how you are feeling. Not a substitute for professional help."},
    "carers": {"title": "Carers", "icon": "people-outline", "about": "For people looking after someone they love."},
}
GROUP_MIN_PUBLIC = 5


def list_groups(db: Session, user: User) -> List[dict]:
    counts = dict(db.query(GroupMember.group_key, func.count(GroupMember.id)).group_by(GroupMember.group_key).all())
    mine = {m.group_key for m in db.query(GroupMember).filter_by(user_id=user.id).all()}
    out = []
    for k, g in GROUPS.items():
        n = int(counts.get(k, 0))
        out.append({"key": k, "title": g["title"], "icon": g["icon"], "about": g["about"], "image": media.url("g_" + k), "joined": k in mine,
                    "members": n if n >= GROUP_MIN_PUBLIC else None})       # a small count could identify people, so it is hidden under 5
    return out
