"""Three things the habit system does for the person, each visible and each under their control:

  GET  /behavior/goals            personalised activity and nutrition goals, from their profile and what they actually do (with the reason and source)
  POST /behavior/goals/apply      turn chosen goals into habit plans (the person decides which)
  GET  /behavior/reminder-plan    adaptive reminders: when, how often, why, and whether it is working
  PUT  /behavior/reminder-settings  off, automatic, or a time the person fixes
  GET  /behavior/comeback         the comeback coach after a lapse (opening, barriers; with ?barrier= the options, if-then plan and relapse plan)
  POST /behavior/comeback         the person's choice is applied and remembered, and later counted as worked or not (anonymously)

Privacy: all of it is the person's own data. The doctor sees habit progress only if they switched sharing on; the comeback statistics shown to
anyone else are group totals, hidden below 5 people.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.behavior import BehaviorAction, BehaviorContext, BehaviorPlan, ComebackSession
from app.models.user import User
from app.routers.behavior import _settings
from app.services import behavior_data as bdata
from app.services import behavior_engine as eng
from app.services import comeback as cb
from app.services import goal_planner as gp
from app.services import gulf
from app.services import reminder_plan as rp

router = APIRouter(prefix="/behavior", tags=["behavior_coach"])


# ------------------------------------------------------------------ personalised goals
@router.get("/goals")
def my_goals(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return gp.propose(gp.gather(db, user))


class ApplyIn(BaseModel):
    ids: List[str] = Field(..., min_length=1, max_length=8)


@router.post("/goals/apply")
def apply_goals(body: ApplyIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Create (or replace) habit plans from the goals the person picked. The engine then moves them toward the goal in small steps."""
    proposal = gp.propose(gp.gather(db, user))
    by_id = {i["id"]: i for i in proposal["items"]}
    made, skipped = [], []
    for gid in body.ids:
        it = by_id.get(gid)
        if not it or not it.get("behavior"):
            skipped.append({"id": gid, "why": "This one is tracked from your logs; it is not a daily habit plan."})
            continue
        cfg = eng.BEHAVIORS[it["behavior"]]
        base = it["now"] if it["now"] is not None else cfg["default_baseline"]
        goal = it["goal"]
        if (cfg["direction"] == "up" and goal <= base) or (cfg["direction"] == "down" and goal >= base):
            skipped.append({"id": gid, "why": "You already meet this goal."})
            continue
        db.query(BehaviorPlan).filter_by(user_id=user.id, behavior=it["behavior"], active=True).update({"active": False})
        plan = BehaviorPlan(user_id=user.id, behavior=it["behavior"], goal_text="Personalised goal: %s" % it["label"], baseline_value=float(base),
                            goal_value=float(goal), unit=cfg["unit"], level=1, start_date=date.today(), active=True)
        db.add(plan)
        made.append({"id": gid, "behavior": it["behavior"], "from": base, "to": goal})
    db.commit()
    return {"created": made, "skipped": skipped}


# ------------------------------------------------------------------ adaptive reminders
def _checkins(db: Session, user_id: int, region: Optional[str], days: int = 28):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.query(BehaviorAction.completed_at).filter(BehaviorAction.user_id == user_id, BehaviorAction.completed_at.isnot(None),
                                                        BehaviorAction.status.in_(("done", "partial"))).all()
    out = []
    for (at,) in rows:
        at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        if at >= since:
            loc = gulf.local_now(at, region or "gh")
            out.append((loc.date(), loc.hour * 60 + loc.minute))
    return out


def reminder_input(db: Session, user: User) -> dict:
    s = _settings(db, user)
    cx = bdata.context_for(db, user.id)
    health = bdata.health_context(db, user)
    first = db.query(BehaviorPlan.start_date).filter_by(user_id=user.id).order_by(BehaviorPlan.start_date).first()
    region = cx.get("region")
    return {"checkins": _checkins(db, user.id, region), "today": gulf.local_now(datetime.now(timezone.utc), region or "gh").date(),
            "plan_start": first[0] if first else date.today(), "segment": bdata.resolved_segment(cx, health), "region": region,
            "respect_prayer": bool(cx.get("respect_prayer", True)), "quiet_start": s.quiet_hours_start, "quiet_end": s.quiet_hours_end,
            "state": {"mode": s.reminder_mode or "auto", "hour": s.reminder_hour, "minute": s.reminder_minute or 0, "stage": s.reminder_stage or 0, "stage_on": s.reminder_stage_on}}


@router.get("/reminder-plan")
def reminder_plan(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    inp = reminder_input(db, user)
    plan = rp.evaluate(inp)
    s = _settings(db, user)
    if plan["changed_stage"] is not None and plan["changed_stage"] != (s.reminder_stage or 0):       # the plan learned something: remember it
        s.reminder_stage, s.reminder_stage_on = plan["changed_stage"], inp["today"]
        db.commit()
    plan["settings"] = {"mode": s.reminder_mode or "auto", "hour": s.reminder_hour,
                        "time": ("%02d:%02d" % (s.reminder_hour, s.reminder_minute or 0)) if s.reminder_hour is not None else None}
    plan["text"] = "A small step is waiting for you."          # generic on purpose: nothing about health on a lock screen
    return plan


class ReminderIn(BaseModel):
    mode: Literal["auto", "off", "fixed"]
    time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")      # the time the person picked, HH:MM
    hour: Optional[int] = Field(None, ge=0, le=23)                                 # older apps send only an hour


@router.put("/reminder-settings")
def set_reminders(body: ReminderIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if body.mode == "fixed" and body.time is None and body.hour is None:
        raise HTTPException(422, "Choose a time for a fixed reminder.")
    s = _settings(db, user)
    s.reminder_mode = body.mode
    if body.mode == "fixed":
        s.reminder_hour, s.reminder_minute = (int(body.time[:2]), int(body.time[3:])) if body.time else (body.hour, 0)
    else:
        s.reminder_hour, s.reminder_minute = None, 0
    if body.mode == "auto":                                   # turning it back on starts the learning again
        s.reminder_stage, s.reminder_stage_on = 0, date.today()
    db.commit()
    return reminder_plan(db, user)


# ------------------------------------------------------------------ comeback coach
def _lapsed(db: Session, user: User):
    """The active plan with the longest current gap, if it is a lapse (3 or more days)."""
    today = date.today()
    best = None
    for p in db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all():
        rows = db.query(BehaviorAction).filter(BehaviorAction.plan_id == p.id, BehaviorAction.status != "pending").all()
        missed = eng.consecutive_missed_days({r.action_date: r.status for r in rows}, today, p.start_date)
        if missed >= eng.LAPSE_DAYS and (best is None or missed > best[1]):
            best = (p, missed)
    return best


def _rates(db: Session, barrier: str) -> Dict[str, Dict[str, int]]:
    out: Dict[str, Dict[str, int]] = {}
    for r in db.query(ComebackSession).filter(ComebackSession.barrier == barrier).all():
        o = out.setdefault(r.option, {"n": 0, "returned": 0})
        o["n"] += 1
        o["returned"] += 1 if r.returned else 0
    return out


@router.get("/comeback")
def comeback_coach(barrier: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    lapsed = _lapsed(db, user)
    if not lapsed:
        return {"needed": False, "message": "You are on track. The coach appears when you have been away for 3 days or more."}
    plan, missed = lapsed
    cx = bdata.context_for(db, user.id)
    health = bdata.health_context(db, user)
    seg = bdata.resolved_segment(cx, health)
    ram = bool(cx.get("region") == "ae" and gulf.ramadan(date.today())["is_ramadan"])
    out = cb.build(barrier, plan.behavior, segment=seg, region=cx.get("region"), ramadan=ram, rates=_rates(db, barrier) if barrier else None,
                   safety_hold=bool(health.get("bp_crisis") or health.get("sos_active")), missed_days=missed)
    return {"needed": True, "plan_id": plan.id, "behavior": plan.behavior, "missed_days": missed, **out}


class ChooseIn(BaseModel):
    barrier: Literal["time", "tired", "forgot", "motivation", "weather", "access", "pain_sick", "stress", "craving", "other"]
    option: Literal["tiny", "retime", "swap", "buddy", "rest"]
    time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")      # the time the person picked, HH:MM
    when: Optional[Literal["morning", "midday", "evening"]] = None                 # older apps


@router.post("/comeback")
def choose(body: ChooseIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    lapsed = _lapsed(db, user)
    if not lapsed:
        raise HTTPException(409, "You are on track, so there is nothing to recover from right now.")
    plan, _ = lapsed
    health = bdata.health_context(db, user)
    s = _settings(db, user)
    result: Dict[str, object] = {"option": body.option, "message": cb.OPTIONS[body.option]["applies"]}
    if body.option == "tiny":
        plan.level = 1
    elif body.option == "retime":
        if not body.time and not body.when:
            raise HTTPException(422, "Choose the time that suits you.")
        h, m = (int(body.time[:2]), int(body.time[3:])) if body.time else (cb.TIMES[body.when], 0)
        cx = db.query(BehaviorContext).filter_by(user_id=user.id).first()
        if cx is None:
            cx = BehaviorContext(user_id=user.id)
            db.add(cx)
        cx.preferred_clock = "%02d:%02d" % (h, m)
        cx.preferred_time = "morning" if h < 11 else "midday" if h < 16 else "evening"
        s.reminder_mode, s.reminder_hour, s.reminder_minute = "fixed", h, m
        result["reminder_hour"], result["reminder_time"] = h, "%02d:%02d" % (h, m)
    elif body.option == "swap":
        recs = eng.recommend_behaviors(bdata.context_for(db, user.id), {"conditions": health.get("conditions") or []}, None, [plan.behavior])
        result["suggest"] = [r["behavior"] for r in recs[:2]]
    elif body.option == "buddy":
        result["open"] = "support"
    session = ComebackSession(user_id=user.id, plan_id=plan.id, barrier=body.barrier, option=body.option)
    db.add(session)
    db.commit()
    result["if_then"] = cb.if_then(plan.behavior, body.barrier)
    return result
