"""Adaptive behaviour-change loop: plans -> daily small action -> check-in -> adapt -> outcomes.

Works fully offline (no Azure / LLM calls). All adaptation is rule-based and explainable.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.config import settings as app_settings
from app.database import get_db
from app.models.behavior import BehaviorAction, BehaviorPlan, BehaviorSettings
from app.models.health import HealthData
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.services import behavior_engine as eng
from app.services import learning_service as learning

router = APIRouter(prefix="/behavior", tags=["behavior"])

PRIVACY_STATEMENT = (
    "Your behaviour data is used only to personalise your plan. It is never shared "
    "with employers or insurers, and nothing is sent to anyone else unless you choose to. "
    "You can pause notifications, turn off wearable data, or delete everything at any time."
)
MIN_CELL = 5  # k-anonymity: groups smaller than this are hidden in equity reporting


# ---------- schemas ----------
class PlanCreate(BaseModel):
    behavior: str
    goal_text: Optional[str] = Field(None, max_length=200)
    baseline_value: Optional[float] = None
    goal_value: Optional[float] = None


class CheckIn(BaseModel):
    status: Optional[str] = None  # done|partial|skipped (optional if value_done given)
    value_done: Optional[float] = Field(None, ge=0)
    barrier: Optional[str] = None


class SettingsUpdate(BaseModel):
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23)
    wearable_data_enabled: Optional[bool] = None
    gamification_enabled: Optional[bool] = None
    gentle_tone: Optional[bool] = None


# ---------- helpers ----------
def _settings(db: Session, user: User) -> BehaviorSettings:
    s = db.query(BehaviorSettings).filter_by(user_id=user.id).first()
    if not s:
        s = BehaviorSettings(user_id=user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _history(db: Session, plan: BehaviorPlan):
    rows = (db.query(BehaviorAction)
            .filter(BehaviorAction.plan_id == plan.id, BehaviorAction.status != "pending")
            .all())
    status = {r.action_date: r.status for r in rows}
    values = {r.action_date: r.value_done for r in rows if r.value_done is not None}
    barriers = [(r.action_date, r.barrier) for r in rows if r.barrier]
    return status, values, barriers


def _action_dict(a: BehaviorAction) -> dict:
    return {
        "id": a.id, "plan_id": a.plan_id, "date": a.action_date.isoformat(),
        "title": a.title, "detail": a.detail, "technique": a.technique,
        "rationale": a.rationale, "target_value": a.target_value, "level": a.level,
        "is_comeback": a.is_comeback, "status": a.status, "value_done": a.value_done,
        "barrier": a.barrier, "source": a.source,
    }


def _plan_dict(p: BehaviorPlan) -> dict:
    return {
        "id": p.id, "behavior": p.behavior, "goal_text": p.goal_text,
        "baseline_value": p.baseline_value, "goal_value": p.goal_value,
        "unit": p.unit, "level": p.level, "active": p.active,
        "start_date": p.start_date.isoformat(),
    }


def _plan_or_404(db: Session, user: User, plan_id: int) -> BehaviorPlan:
    p = db.query(BehaviorPlan).filter_by(id=plan_id, user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Plan not found")
    return p


def _generate_action(db: Session, plan: BehaviorPlan, today: date,
                     lang: str) -> BehaviorAction:
    status, _, barriers = _history(db, plan)
    lapse = eng.detect_lapse(status, today, plan.start_date)
    comeback = lapse["state"] == "lapse"
    if comeback:
        new_level = max(1, plan.level - 1)
        reason = None
        if new_level != plan.level:
            plan.level, plan.last_level_change = new_level, today
    else:
        new_level, reason = eng.suggest_level(plan.level, status, today,
                                              plan.start_date, plan.last_level_change)
        if reason:
            plan.level, plan.last_level_change = new_level, today
    recent = [b for d, b in barriers if d >= today - timedelta(days=14)]
    top_barrier = eng.infer_barrier(recent, [])
    # learn from this person's own history: pick the style that works, and go lighter on their hard weekday
    idx, note = (None, "") if (comeback or top_barrier) else learning.pick_option_index(db, plan)
    lighter = False
    if not comeback:
        weak, _rate = learning.weak_weekday(db, plan, today)
        lighter = bool(weak and plan.level > 1)
        if lighter:
            note = (note + " " if note else "") + "Today is usually harder for you, so we made the step a little lighter."
    used_level = max(1, plan.level - 1) if lighter else plan.level
    built = eng.build_action(plan.behavior, plan.baseline_value, plan.goal_value,
                             used_level, today, comeback, top_barrier, option_index=idx, note=note)
    action = BehaviorAction(
        plan_id=plan.id, user_id=plan.user_id, action_date=today,
        title=built["title"], detail=built["detail"], technique=built["technique"],
        rationale=built["rationale"], target_value=built["target_value"],
        level=used_level, is_comeback=comeback, status="pending",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def _apply_checkin(db: Session, action: BehaviorAction, plan: BehaviorPlan,
                   body: CheckIn, source: str = "manual") -> str:
    status = body.status
    if body.value_done is not None:
        status = eng.status_from_value(plan.behavior, body.value_done,
                                       action.target_value, plan.baseline_value)
    if status not in ("done", "partial", "skipped"):
        raise HTTPException(400, "status must be done, partial or skipped (or send value_done)")
    if body.barrier and body.barrier not in eng.BARRIERS:
        raise HTTPException(400, f"barrier must be one of {eng.BARRIERS}")
    action.status = status
    action.value_done = body.value_done
    action.barrier = body.barrier if status != "done" else None
    action.source = source
    action.completed_at = datetime.now(timezone.utc)
    db.commit()
    return status


# ---------- settings / consent ----------
@router.get("/settings")
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    s = _settings(db, user)
    return {
        "language": s.language, "notifications_enabled": s.notifications_enabled,
        "quiet_hours_start": s.quiet_hours_start, "quiet_hours_end": s.quiet_hours_end,
        "wearable_data_enabled": s.wearable_data_enabled,
        "gamification_enabled": s.gamification_enabled, "gentle_tone": s.gentle_tone,
        "privacy_statement": PRIVACY_STATEMENT,
        "supported_languages": list(eng.MESSAGES.keys()),
    }


@router.put("/settings")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db),
                    user: User = Depends(get_current_active_user)):
    s = _settings(db, user)
    data = body.model_dump(exclude_none=True) if hasattr(body, "model_dump") else body.dict(exclude_none=True)
    if "language" in data and data["language"] not in eng.MESSAGES:
        raise HTTPException(400, f"language must be one of {list(eng.MESSAGES)}")
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    return get_settings(db, user)


@router.delete("/my-data")
def delete_my_behavior_data(db: Session = Depends(get_db),
                            user: User = Depends(get_current_active_user)):
    """Revoke consent: erase all plans, actions and preferences."""
    db.query(BehaviorAction).filter_by(user_id=user.id).delete()
    db.query(BehaviorPlan).filter_by(user_id=user.id).delete()
    db.query(BehaviorSettings).filter_by(user_id=user.id).delete()
    db.commit()
    return {"deleted": True}


# ---------- plans ----------
@router.get("/techniques")
def techniques():
    """Every technique we use, why it works, and its limits."""
    return [{"name": n, "why_it_works": w, "limits": l} for n, (w, l) in eng.TECHNIQUES.items()]


@router.get("/behaviors")
def behaviors():
    return {k: {"unit": v["unit"], "direction": v["direction"],
                "default_baseline": v["default_baseline"],
                "default_goal": v["default_goal"]} for k, v in eng.BEHAVIORS.items()}


@router.post("/plans")
def create_plan(body: PlanCreate, db: Session = Depends(get_db),
                user: User = Depends(get_current_active_user)):
    cfg = eng.BEHAVIORS.get(body.behavior)
    if not cfg:
        raise HTTPException(400, f"behavior must be one of {list(eng.BEHAVIORS)}")
    baseline = body.baseline_value if body.baseline_value is not None else cfg["default_baseline"]
    goal = body.goal_value if body.goal_value is not None else cfg["default_goal"]
    if cfg["direction"] == "up" and goal <= baseline:
        raise HTTPException(400, "goal_value must be higher than baseline_value for this behaviour")
    if cfg["direction"] == "down" and goal >= baseline:
        raise HTTPException(400, "goal_value must be lower than baseline_value for this behaviour")
    db.query(BehaviorPlan).filter_by(user_id=user.id, behavior=body.behavior,
                                     active=True).update({"active": False})
    plan = BehaviorPlan(user_id=user.id, behavior=body.behavior, goal_text=body.goal_text,
                        baseline_value=baseline, goal_value=goal, unit=cfg["unit"],
                        level=1, start_date=date.today(), active=True)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_dict(plan)


@router.get("/plans")
def list_plans(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    plans = db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all()
    return [_plan_dict(p) for p in plans]


@router.delete("/plans/{plan_id}")
def stop_plan(plan_id: int, db: Session = Depends(get_db),
              user: User = Depends(get_current_active_user)):
    plan = _plan_or_404(db, user, plan_id)
    plan.active = False
    db.commit()
    return {"stopped": True}


# ---------- daily loop ----------
@router.get("/today")
def today_view(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    s = _settings(db, user)
    lang = s.language
    today = date.today()
    plans = db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all()
    items, welcome_back, ask_barrier = [], False, False
    for plan in plans:
        action = db.query(BehaviorAction).filter_by(plan_id=plan.id, action_date=today).first()
        if not action:
            action = _generate_action(db, plan, today, lang)
        status, _, barriers = _history(db, plan)
        lapse = eng.detect_lapse(status, today, plan.start_date)
        streak = eng.streaks(status, today)
        recent_barriers = [b for d, b in barriers if d >= today - timedelta(days=14)]
        needs_barrier = (lapse["state"] != "ok" and not recent_barriers)
        welcome_back |= lapse["state"] == "lapse"
        ask_barrier |= needs_barrier
        items.append({
            "plan": _plan_dict(plan),
            "action": _action_dict(action),
            "engagement": lapse,
            "streak": streak if s.gamification_enabled else None,
        })
    notice = None
    if welcome_back:
        notice = eng.msg("welcome_back", lang)
        _notify_once(db, user, s, "Welcome back", notice)
    return {
        "date": today.isoformat(),
        "items": items,
        "notice": notice,
        "ask_barrier": eng.msg("ask_barrier", lang) if ask_barrier else None,
        "barrier_options": eng.BARRIERS,
    }


def _notify_once(db: Session, user: User, s: BehaviorSettings, title: str, message: str):
    """Re-engagement nudge: only if allowed, outside quiet hours, once per day."""
    if not s.notifications_enabled:
        return
    hour = datetime.now().hour
    qs, qe = s.quiet_hours_start, s.quiet_hours_end
    in_quiet = (qs <= hour or hour < qe) if qs > qe else (qs <= hour < qe)
    if in_quiet:
        return
    start_of_day = datetime.combine(date.today(), datetime.min.time())
    exists = (db.query(Notification)
              .filter(Notification.user_id == user.id,
                      Notification.notification_type == "behavior_reengage",
                      Notification.created_at >= start_of_day).first())
    if not exists:
        db.add(Notification(user_id=user.id, notification_type="behavior_reengage",
                            title=title, message=message, sender_type="system"))
        db.commit()


@router.post("/actions/{action_id}/checkin")
def checkin(action_id: int, body: CheckIn, db: Session = Depends(get_db),
            user: User = Depends(get_current_active_user)):
    action = db.query(BehaviorAction).filter_by(id=action_id, user_id=user.id).first()
    if not action:
        raise HTTPException(404, "Action not found")
    plan = _plan_or_404(db, user, action.plan_id)
    s = _settings(db, user)
    status = _apply_checkin(db, action, plan, body)
    hist, _, _ = _history(db, plan)
    streak = eng.streaks(hist, date.today())
    return {
        "action": _action_dict(action),
        "feedback": eng.msg(status, s.language),
        "streak": streak if s.gamification_enabled else None,
        "ask_barrier": (eng.msg("ask_barrier", s.language)
                        if status != "done" and not action.barrier else None),
        "barrier_options": eng.BARRIERS,
        "note": "Your plan adjusts tomorrow based on how the week is going.",
    }


@router.post("/sync-wearable")
def sync_wearable(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Use today's step count (if the user opted in) to complete the movement action."""
    s = _settings(db, user)
    if not s.wearable_data_enabled:
        raise HTTPException(403, "Wearable data is turned off. Enable it in behaviour settings.")
    plan = db.query(BehaviorPlan).filter_by(user_id=user.id, behavior="movement", active=True).first()
    if not plan:
        raise HTTPException(404, "No active movement plan")
    start = datetime.combine(date.today(), datetime.min.time())
    hd = (db.query(HealthData)
          .filter(HealthData.user_id == user.id, HealthData.date >= start)
          .order_by(HealthData.date.desc()).first())
    if not hd or not hd.steps:
        raise HTTPException(404, "No step data for today yet")
    action = db.query(BehaviorAction).filter_by(plan_id=plan.id, action_date=date.today()).first()
    if not action:
        action = _generate_action(db, plan, date.today(), s.language)
    status = _apply_checkin(db, action, plan, CheckIn(value_done=float(hd.steps)), source="wearable")
    return {"action": _action_dict(action), "feedback": eng.msg(status, s.language)}


@router.get("/heatmap")
def heatmap(weeks: int = 8, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """One score per day (done=1, partial=0.5, skipped=0, no check-in=null) averaged over the active plans. Monday-aligned."""
    weeks = max(2, min(weeks, 26))
    today = date.today()
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)
    active_ids = [p.id for p in db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all()]
    rows = (db.query(BehaviorAction).filter(BehaviorAction.user_id == user.id, BehaviorAction.plan_id.in_(active_ids),
                                            BehaviorAction.status != "pending", BehaviorAction.action_date >= start).all())
    per: Dict[date, List[float]] = {}
    for r in rows:
        per.setdefault(r.action_date, []).append(eng._score(r.status))
    days, d = [], start
    while d <= today:
        sc = per.get(d)
        days.append({"date": d.isoformat(), "weekday": d.weekday(), "score": round(sum(sc) / len(sc), 2) if sc else None})
        d += timedelta(days=1)
    return {"weeks": weeks, "start": start.isoformat(), "days": days}


@router.get("/insights")
def my_insights(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """What the system has learned about this person (shown back to them)."""
    return learning.insights(db, user.id)


# ---------- outcomes ----------
@router.get("/outcomes")
def my_outcomes(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    today = date.today()
    result = []
    for plan in db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all():
        status, values, _ = _history(db, plan)
        o = eng.outcomes(status, values, plan.baseline_value,
                         eng.BEHAVIORS[plan.behavior]["direction"], plan.start_date, today)
        o["streak"] = eng.streaks(status, today)
        result.append({"plan": _plan_dict(plan), "outcomes": o})
    return result


@router.get("/equity")
def equity(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Aggregated adherence by group over the last 14 days. Groups under MIN_CELL are hidden."""
    today = date.today()
    cutoff = today - timedelta(days=14)
    per_user: Dict[int, List[float]] = {}
    for plan in db.query(BehaviorPlan).filter_by(active=True).all():
        status, _, _ = _history(db, plan)
        rate, n = eng.adherence(status, today, 14, plan.start_date)
        if n >= 7:
            per_user.setdefault(plan.user_id, []).append(rate)
    groups: Dict[str, Dict[str, List[float]]] = {"gender": {}, "age_band": {}, "language": {}}
    for uid, rates in per_user.items():
        avg = sum(rates) / len(rates)
        prof = db.query(UserProfile).filter_by(user_id=uid).first()
        st = db.query(BehaviorSettings).filter_by(user_id=uid).first()
        gender = (prof.gender if prof and prof.gender else "unknown")
        age = prof.age if prof and prof.age else None
        band = "unknown" if age is None else ("<30" if age < 30 else "30-49" if age < 50 else "50+")
        groups["gender"].setdefault(gender, []).append(avg)
        groups["age_band"].setdefault(band, []).append(avg)
        groups["language"].setdefault(st.language if st else "en", []).append(avg)
    out = {}
    for dim, cells in groups.items():
        out[dim] = {k: ({"n": len(v), "avg_adherence": round(sum(v) / len(v), 2)}
                        if len(v) >= MIN_CELL else {"n": f"<{MIN_CELL}", "avg_adherence": None})
                    for k, v in cells.items()}
    return {"window_days": 14, "min_group_size": MIN_CELL, "groups": out,
            "note": "Small groups are hidden to protect privacy."}


# ---------- demo ----------
@router.post("/demo/seed")
def seed_demo(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Create 6 weeks of realistic history (steady start, a 6-day lapse, a no-blame recovery).
    Disabled in production. Replaces this user's existing behaviour data."""
    if app_settings.ENVIRONMENT == "production":
        raise HTTPException(403, "Demo seeding is disabled in production")
    db.query(BehaviorAction).filter_by(user_id=user.id).delete()
    db.query(BehaviorPlan).filter_by(user_id=user.id).delete()
    today = date.today()
    start = today - timedelta(days=42)
    plan = BehaviorPlan(user_id=user.id, behavior="movement",
                        goal_text="Walk more to help my blood pressure",
                        baseline_value=3000, goal_value=8000, unit="steps",
                        level=2, start_date=start, active=True,
                        last_level_change=today - timedelta(days=10))
    db.add(plan)
    db.commit()
    db.refresh(plan)
    for i in range(42):
        d = start + timedelta(days=i)
        if 14 <= i < 20:
            continue  # lapse: no check-ins for 6 days
        comeback = i == 20
        level = 1 if i < 7 else 2 if i < 14 else 1 if i < 24 else 2
        built = eng.build_action("movement", 3000, 8000, level, d, comeback,
                                 "time" if 20 < i < 30 else None)
        t = built["target_value"]
        if i < 14:
            status, val, barrier = ("partial", t * 0.7, "tired") if i in (5, 11) else ("done", t * 1.05, None)
        elif i == 20:
            status, val, barrier = "done", t * 1.1, None
        elif i in (24, 27, 33):
            status, val, barrier = "skipped", t * 0.2, "weather" if i == 27 else "time"
        else:
            status, val, barrier = "done", t * 1.05, None
        db.add(BehaviorAction(
            plan_id=plan.id, user_id=user.id, action_date=d, title=built["title"],
            detail=built["detail"], technique=built["technique"], rationale=built["rationale"],
            target_value=t, level=level, is_comeback=comeback, status=status,
            value_done=round(val), barrier=barrier, source="demo"))
    db.commit()
    return {"seeded": True, "plan": _plan_dict(plan),
            "story": "Weeks 1-2 steady, 6-day lapse, comeback step on day 21, recovery with a barrier-adapted plan."}
