"""Adaptive behaviour-change loop: plans -> daily small action -> check-in -> adapt -> outcomes.

Works fully offline (no Azure / LLM calls). All adaptation is rule-based and explainable.
"""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.config import settings as app_settings
from app.database import get_db
from app.models.behavior import (AgentRun, ComebackSession, BehaviorAction, BehaviorCheer, BehaviorContext, BehaviorGroupMember, BehaviorNudge, BehaviorPlan,
                                 BehaviorSettings, BehaviorShare)
from app.models.health import HealthData
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.services import behavior_engine as eng
from app.services import learning_service as learning
from app.services import behavior_data as bdata
from app.services import audience as aud
from app.services import gulf
from app.services import reengagement

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
    reengage_channel: Optional[str] = None
    max_nudges_per_week: Optional[int] = Field(None, ge=0, le=7)
    share_with_doctor: Optional[bool] = None


class ContextUpdate(BaseModel):
    preferred_clock: Optional[str] = None                       # HH:MM, the time the person picked ('' clears it)
    preferred_time: Optional[str] = None
    work_pattern: Optional[str] = None
    mobility: Optional[str] = None
    support: Optional[str] = None
    literacy: Optional[str] = None
    readiness: Optional[int] = Field(None, ge=1, le=5)
    motivation_text: Optional[str] = Field(None, max_length=200)
    segment: Optional[str] = None
    region: Optional[str] = None
    respect_prayer: Optional[bool] = None


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
    user = db.query(User).filter(User.id == plan.user_id).first()
    ctx = bdata.context_for(db, plan.user_id)
    health = bdata.health_context(db, user) if user else {}
    s = _settings(db, user) if user else None
    lang = (s.language if s and s.language else lang) or "en"
    safety = eng.safety_note(plan.behavior, health, lang)
    wearable_ok = bool(s and s.wearable_data_enabled)                # sleep from a watch is only used when the person allowed it
    lapse = eng.detect_lapse(status, today, plan.start_date)
    comeback = lapse["state"] == "lapse"
    if comeback:
        new_level = max(1, plan.level - 1)
        reason = None
        if new_level != plan.level:
            plan.level, plan.last_level_change = new_level, today
    else:
        new_level, reason = eng.suggest_level(plan.level, status, today, plan.start_date, plan.last_level_change,
                                              slow=(ctx.get("readiness") or 3) <= 2, hold=safety["hold_level"])
        if reason:
            plan.level, plan.last_level_change = new_level, today
    recent = [b for d, b in barriers if d >= today - timedelta(days=14)]
    said = eng.infer_barrier(recent, [])
    top_barrier, barrier_source = eng.infer_barrier_from_data(said, health.get("sleep_hours") if wearable_ok else None, bool(health.get("bp_crisis")))
    # learn from this person's own history: pick the style that works, and go lighter on their hard weekday
    idx, note = (None, "") if (comeback or top_barrier) else learning.pick_option_index(db, plan)
    lighter = False
    if not comeback:
        weak, _rate = learning.weak_weekday(db, plan, today)
        lighter = bool(weak and plan.level > 1)
        if lighter:
            note = (note + " " if note else "") + "Today is usually harder for you, so we made the step a little lighter."
    used_level = max(1, plan.level - 1) if lighter else plan.level
    seg = bdata.resolved_segment(ctx, health)
    region = ctx.get("region") or "gh"
    if idx is None and not (comeback or top_barrier) and aud.preferred_style(seg):      # no personal history yet: start with the style that suits this audience
        idx = next((i for i, o in enumerate(eng.BASE_ACTIONS[plan.behavior]) if o[2] == aud.preferred_style(seg)), None)
    from app.services import behavior_l10n as L
    P = lambda k: L.pick(L.FITTED_PARTS, lang, k) or L.FITTED_PARTS["en"][k]          # noqa: E731
    fitted = []
    if barrier_source == "data":
        what = P("bp") if health.get("bp_crisis") else P("sleep").format(h=health.get("sleep_hours") or 0)
        fitted.append(P("data").format(what=what))
    if ctx.get("work_pattern") in ("shift", "irregular"):
        fitted.append(P("work"))
    if ctx.get("mobility") in ("limited", "wheelchair") and plan.behavior in ("movement", "activity"):
        fitted.append(P("mobility"))
    if (ctx.get("readiness") or 3) <= 2:
        fitted.append(P("slow"))
    if safety["hold_level"]:
        fitted.append(P("hold"))
    if fitted:
        note = (note + " " if note else "") + L.FITTED.get(lang, L.FITTED["en"]) + " " + "; ".join(fitted) + "."
    built = eng.build_action(plan.behavior, plan.baseline_value, plan.goal_value,
                             used_level, today, comeback, top_barrier, option_index=idx, note=note, lang=lang,
                             grow=aud.grow_factor(seg) if not safety["hold_level"] else 1.0)
    built = eng.adapt_for_context(built, plan.behavior, ctx, lang)
    extra = aud.notes_for(seg, plan.behavior, region, today, lang)
    if extra and not comeback:
        built["detail"] = f"{built['detail']} {' '.join(extra)}"
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
    reengagement.mark_responses(db, plan.user_id, plan.id, action.completed_at)
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
        "reengage_channel": s.reengage_channel or "push", "max_nudges_per_week": 2 if s.max_nudges_per_week is None else s.max_nudges_per_week,
        "share_with_doctor": bool(s.share_with_doctor),
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
    if "reengage_channel" in data and data["reengage_channel"] not in ("push", "in_app", "none"):
        raise HTTPException(400, "reengage_channel must be push, in_app or none")
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    return get_settings(db, user)


@router.delete("/my-data")
def delete_my_behavior_data(db: Session = Depends(get_db),
                            user: User = Depends(get_current_active_user)):
    """Revoke consent: erase all plans, actions and preferences."""
    db.query(AgentRun).filter_by(user_id=user.id).delete()
    db.query(ComebackSession).filter_by(user_id=user.id).delete()
    db.query(BehaviorNudge).filter_by(user_id=user.id).delete()
    db.query(BehaviorShare).filter((BehaviorShare.owner_id == user.id) | (BehaviorShare.supporter_id == user.id)).delete(synchronize_session=False)
    db.query(BehaviorCheer).filter((BehaviorCheer.from_id == user.id) | (BehaviorCheer.to_id == user.id)).delete(synchronize_session=False)
    db.query(BehaviorGroupMember).filter_by(user_id=user.id).delete()
    db.query(BehaviorContext).filter_by(user_id=user.id).delete()
    db.query(BehaviorAction).filter_by(user_id=user.id).delete()
    db.query(BehaviorPlan).filter_by(user_id=user.id).delete()
    db.query(BehaviorSettings).filter_by(user_id=user.id).delete()
    db.commit()
    return {"deleted": True}


@router.get("/my-data")
def export_my_behavior_data(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Everything this feature holds about you, as you would receive it: yours to keep, move or check."""
    plans = db.query(BehaviorPlan).filter_by(user_id=user.id).all()
    actions = db.query(BehaviorAction).filter_by(user_id=user.id).order_by(BehaviorAction.action_date).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": get_settings(db, user), "context": bdata.context_for(db, user.id),
        "plans": [_plan_dict(p) for p in plans], "actions": [_action_dict(a) for a in actions],
        "nudges_sent": [{"kind": n.kind, "channel": n.channel, "sent_at": n.sent_at.isoformat() if n.sent_at else None, "came_back": bool(n.responded)}
                        for n in db.query(BehaviorNudge).filter_by(user_id=user.id).order_by(BehaviorNudge.id).all()],
        "agent_runs": [{"id": r.id, "kind": r.kind, "at": r.created_at.isoformat() if r.created_at else None, "trace": r.trace, "review": r.review_status}
                       for r in db.query(AgentRun).filter_by(user_id=user.id).order_by(AgentRun.id).all()],
        "shared_with": [{"supporter_id": s.supporter_id, "plan_id": s.plan_id, "level": s.level, "active": s.active}
                        for s in db.query(BehaviorShare).filter_by(owner_id=user.id).all()],
    }


# ---------- circumstances (what makes the plan fit this person's life) ----------
@router.get("/context")
def get_context(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    cx = bdata.context_for(db, user.id)
    h = bdata.health_context(db, user)
    return {**cx, "segment_suggested": aud.suggest(h.get("age"), h.get("conditions"), cx.get("work_pattern")),
            "segment_resolved": bdata.resolved_segment(cx, h),
            "today": gulf.context(datetime.now(timezone.utc), cx.get("region")),
            "choices": {**bdata.CONTEXT_CHOICES, "readiness": [1, 2, 3, 4, 5]},
            "why": "These answers only change the wording and timing of your steps, and how quickly they grow. They are never shared, and you can change or erase them any time."}


@router.put("/context")
def update_context(body: ContextUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    data = body.model_dump(exclude_none=True)
    clock = data.pop("preferred_clock", None)
    if clock is not None:
        if clock == "":
            data["preferred_time"] = "any"
        else:
            if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", clock):
                raise HTTPException(400, "preferred_clock must look like 14:30")
            hour = int(clock[:2])
            data["preferred_time"] = "morning" if hour < 11 else "midday" if hour < 16 else "evening"      # the wording still uses the part of the day
    clear_segment = data.get("segment") == ""                     # "" returns to the suggested audience
    if clear_segment:
        data.pop("segment")
    for k, allowed in bdata.CONTEXT_CHOICES.items():
        if k in data and data[k] not in allowed:
            raise HTTPException(400, f"{k} must be one of {list(allowed)}")
    row = db.query(BehaviorContext).filter_by(user_id=user.id).first()
    if not row:
        row = BehaviorContext(user_id=user.id)
        db.add(row)
    for k, v in data.items():
        setattr(row, k, v.strip() if isinstance(v, str) else v)
    if clock is not None:
        row.preferred_clock = clock or None
    if clear_segment:
        row.segment = None
    db.commit()
    return get_context(db, user)


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """What to start with, from the person's circumstances, health context and chosen data, each with the reason."""
    health = bdata.health_context(db, user)
    s = _settings(db, user)
    active = [p.behavior for p in db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all()]
    sleep = health.get("sleep_hours") if s.wearable_data_enabled else None
    cx = bdata.context_for(db, user.id)
    cx["segment_resolved"] = bdata.resolved_segment(cx, health)
    recs = eng.recommend_behaviors(cx, {"conditions": health["conditions"], "habits": health["habits"]}, sleep, active)
    for rec in recs:
        cfg = eng.BEHAVIORS[rec["behavior"]]
        b0, g0 = aud.goals_for(cx["segment_resolved"], rec["behavior"], cfg["default_baseline"], cfg["default_goal"])
        rec.update({"unit": cfg["unit"], "baseline_value": b0, "goal_value": g0})
    return {"recommendations": recs, "based_on": "your profile, circumstances and, only if you allowed it, your sleep from Apple Health"}


# ---------- every kind of support we use, with its reason and its limits ----------
APPROACHES = [
    {"id": "graded", "kind": "technique", "name": "Small steps that grow", "technique": "Small steps (graded tasks)",
     "control": "Pace in your plan. You can ask for easier steps any time."},
    {"id": "planning", "kind": "technique", "name": "Deciding when and where", "technique": "Implementation intention", "control": "You choose your usual time in About you."},
    {"id": "monitoring", "kind": "technique", "name": "Seeing your own numbers", "technique": "Self-monitoring", "control": "Turn off wearable data, or the numbers, in Settings."},
    {"id": "recovery", "kind": "technique", "name": "A kind restart after a gap", "technique": "Self-compassion after setbacks", "control": "Always on. A lapse never resets your progress."},
    {"id": "gamification", "kind": "gamification", "name": "Streaks and points",
     "why_it_works": "Visible progress and small rewards can make starting feel good and help people keep going in the first weeks.",
     "limits": "Effects often fade after a few weeks, and rankings can discourage people who are behind. So streaks forgive one missed day, a lapse never removes points or progress, and you can switch it all off.",
     "evidence": "mixed", "bct_code": "10.3", "bct_name": "Non-specific reward", "control": "Streaks and points switch in Settings."},
    {"id": "incentive", "kind": "incentive", "name": "Comeback recognition",
     "why_it_works": "Recognising a return after a gap, not only perfect weeks, rewards the behaviour that matters most for lasting change.",
     "limits": "There is no money or prize, and nothing is taken away. Recognition is shown only to you.",
     "evidence": "emerging", "bct_code": "10.4", "bct_name": "Social reward", "control": "Part of streaks and points. Switch off in Settings."},
    {"id": "peer", "kind": "peer", "name": "A supporter who can cheer you on",
     "why_it_works": "Encouragement from someone you trust helps many people stay with a change and recover from setbacks.",
     "limits": "Only works if you want it. A supporter sees whether you could use encouragement (and, if you choose, how many days you were active), never your readings or details, and can send only kind preset messages.",
     "evidence": "moderate", "bct_code": "3.3", "bct_name": "Social support (emotional)", "control": "You pick the person and the level, and stop it any time."},
    {"id": "group", "kind": "workplace", "name": "Group challenges (workplace, community, family)",
     "why_it_works": "Shared goals add belonging and friendly momentum.",
     "limits": "A group sees totals only, and only when five or more people have joined. Nobody, including whoever made the group, sees an individual's results. Employers and insurers are not given individual data.",
     "evidence": "mixed", "bct_code": "3.1", "bct_name": "Social support (unspecified)", "control": "You join with a code and can leave any time; your numbers leave the totals at once."},
    {"id": "reminders", "kind": "outreach", "name": "Gentle outreach after a gap",
     "why_it_works": "A small, kind message after a few quiet days brings many people back before the habit is lost.",
     "limits": "At most the number you allow each week, never during quiet hours, never with health details on the lock screen. If messages are not helping, we reduce them and stop; we do not push harder.",
     "evidence": "moderate", "bct_code": "7.1", "bct_name": "Prompts/cues", "control": "Channel and weekly limit in Settings."},
]


@router.get("/approaches")
def approaches(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    s = _settings(db, user)
    on = {"gamification": bool(s.gamification_enabled), "incentive": bool(s.gamification_enabled), "monitoring": bool(s.wearable_data_enabled),
          "reminders": bool(s.notifications_enabled) and (s.reengage_channel or "push") != "none"}
    out = []
    for a in APPROACHES:
        item = dict(a)
        if "technique" in a:
            from app.services import behavior_l10n as L
            why, limits = L.tech(s.language or "en", a["technique"]) or eng.TECHNIQUES[a["technique"]]
            item.update({"why_it_works": why, "limits": limits, **eng.TECHNIQUE_META[a["technique"]]})
        item["enabled"] = on.get(a["id"], True)
        out.append(item)
    return {"approaches": out,
            "taxonomy": "Behaviour Change Technique Taxonomy v1 (Michie et al., 2013). Evidence is a plain summary of research on groups; we also measure what works for you.",
            "commitments": ["No streak is ever lost to a single missed day, and no lapse resets progress.",
                            "Nothing is sent to employers, insurers or anyone else about you as an individual.",
                            "You can pause outreach, switch off gamification and data use, export or delete everything."]}


@router.get("/nudges")
def my_nudges(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """What we sent after gaps, and which messages brought you back. Shown so the system's learning is never hidden."""
    return reengagement.person_summary(db, user.id)



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
    cx = bdata.context_for(db, user.id)
    d_base, d_goal = aud.goals_for(bdata.resolved_segment(cx, bdata.health_context(db, user)), body.behavior, cfg["default_baseline"], cfg["default_goal"])
    baseline = body.baseline_value if body.baseline_value is not None else d_base
    goal = body.goal_value if body.goal_value is not None else d_goal
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
        safety = eng.safety_note(plan.behavior, bdata.health_context(db, user), lang)
        items.append({
            "plan": _plan_dict(plan),
            "action": _action_dict(action),
            "engagement": lapse,
            "streak": streak if s.gamification_enabled else None,
            "safety_note": safety["note"],
            "step_held": safety["hold_level"],
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
    hist, vals, _ = _history(db, plan)
    streak = eng.streaks(hist, date.today())
    # Recognition goes to the RETURN, not to a perfect run: coming back after a gap is the hardest part and the one that predicts lasting change.
    recognition = None
    if s.gamification_enabled and action.is_comeback and status in ("done", "partial"):
        o = eng.outcomes(hist, vals, plan.baseline_value, eng.BEHAVIORS[plan.behavior]["direction"], plan.start_date, date.today())
        recognition = {"title": "You came back", "comebacks": max(1, o["recovered_lapses"]),
                       "text": "Returning after a gap is the hardest part, and it counts for more than any streak. Nothing was lost."}
    return {
        "recognition": recognition,
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
    """Complete today's step for plans that a watch or phone can measure (steps, active minutes, sleep), if the person opted in."""
    s = _settings(db, user)
    if not s.wearable_data_enabled:
        raise HTTPException(403, "Wearable data is turned off. Enable it in behaviour settings.")
    row = bdata.todays_health_row(db, user.id)
    sleep_h = bdata.last_night_sleep_hours(db, user.id)
    plans = db.query(BehaviorPlan).filter(BehaviorPlan.user_id == user.id, BehaviorPlan.active == True,  # noqa: E712
                                          BehaviorPlan.behavior.in_(("movement", "activity", "sleep"))).all()
    if not plans:
        raise HTTPException(404, "No active plan that uses wearable data")
    done, missing = [], []
    for plan in plans:
        value = ({"movement": float(row.steps) if row and row.steps else None,
                  "activity": float(row.active_minutes) if row and row.active_minutes else None,
                  "sleep": sleep_h}[plan.behavior])
        if value is None:
            missing.append(plan.behavior)
            continue
        action = db.query(BehaviorAction).filter_by(plan_id=plan.id, action_date=date.today()).first()
        if not action:
            action = _generate_action(db, plan, date.today(), s.language)
        if action.status != "pending" and action.source != "wearable":
            continue                                                # something the person reported by hand is never overwritten
        st = _apply_checkin(db, action, plan, CheckIn(value_done=value), source="wearable")
        done.append({"behavior": plan.behavior, "action": _action_dict(action), "feedback": eng.msg(st, s.language)})
    if not done:
        raise HTTPException(404, "No data for today yet: " + ", ".join(missing))
    return {"updated": done, "missing": missing, "action": done[0]["action"], "feedback": done[0]["feedback"]}


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
