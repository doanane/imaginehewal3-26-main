"""The care agent: the loop that notices a person going quiet, decides what to do, does it, and hands off to a human when it should.

Why this is an agent and not a chatbot: a chatbot waits to be asked. This runs by itself, senses real signals (check-ins, readings, the
person's clock and week), decides with written rules, acts (one fitted message, a smaller step), hands off to a clinician when the situation
needs one, and then measures whether the person came back. Every pass produces a TRACE that says what it sensed, why it chose what it chose,
what it did, what it did NOT do, and who looks at it next. The trace is what the person, and a doctor they allowed, can read.

  SENSE    check-ins and gaps, blood pressure and sleep if shared, the person's own clock, week, Ramadan and prayer times, audience
  DECIDE   lapse or not, which stage, the safety gate, how small the next step is, whether to send now (all ordinary tested code, no model)
  ACT      one gentle message on the channel the person allowed, a smaller step, one-tap answers
  HAND OFF a clinician is asked to look only where it matters (a very high reading, or a long silence in a person with a condition)
  MEASURE  did a check-in follow within 48 hours

No language model takes part in any decision. Words come from reviewed templates (English, French, Arabic).
"""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from app.services import audience as aud
from app.services import behavior_engine as eng
from app.services import gulf
from app.services import reengagement as rg

METHOD = "Written rules, tested in code. No language model makes any decision here."
ONE_TAP = [
    {"id": "tiny_step", "label": "Start a tiny step"},
    {"id": "smaller", "label": "Make my step smaller"},
    {"id": "stop_messages", "label": "Stop these messages"},
    {"id": "not_helpful", "label": "This was not helpful"},
]
IF_WRONG = [
    "You can stop all messages in one tap, or ask for quieter ones. It takes effect at once.",
    "Nothing here is a diagnosis or a medical order. A very high reading holds your step and points you to a clinician.",
    "If the agent sends something unhelpful, tell it so: that is recorded and the channel is made quieter.",
    "A clinician can review, change or dismiss any hand-off. The agent never changes a medicine or a treatment.",
]
LIMITS = "At most the weekly number you set, never in quiet hours, and we stop if messages are not helping."

# A long silence is a concern worth a clinician's look only for someone living with a condition.
HANDOFF_SILENT_DAYS = 7


def _day_status_summary(day_status: Dict[date, str], today: date, start: date) -> Dict[str, Any]:
    def count(a: int, b: int):
        days = [today - timedelta(days=i) for i in range(a, b + 1)]
        days = [d for d in days if d >= start]
        return sum(1 for d in days if day_status.get(d) in ("done", "partial")), len(days)
    this, n_this = count(1, 7)
    prev, n_prev = count(8, 14)
    return {"this_week": this, "this_week_days": n_this, "last_week": prev, "last_week_days": n_prev}


def trace(inp: dict) -> dict:
    """The whole loop for one person at one moment. Pure: give it the facts, it returns the trace. Nothing is sent or saved here."""
    now: datetime = inp["now"]
    today: date = inp["today"]
    region = inp.get("region")
    lang = inp.get("lang") or "en"
    day_status: Dict[date, str] = inp["day_status"]
    start: date = inp["start_date"]
    settings = inp["settings"]
    segment = inp.get("segment")
    conditions = inp.get("conditions") or []
    bp = inp.get("bp")                                   # (systolic, diastolic) or None
    health = {"conditions": conditions, "bp_crisis": bool(inp.get("bp_crisis")), "sos_active": bool(inp.get("sos_active"))}

    lapse = eng.detect_lapse(day_status, today, start)
    missed = lapse["missed_days"]
    stage = rg.stage_for(missed)
    local = gulf.local_now(now, region) if region else now
    gate = gulf.nudge_gate(now, region, bool(inp.get("respect_prayer", True)))
    weeks = _day_status_summary(day_status, today, start)
    safety = eng.safety_note(inp["behavior"], health, lang)

    # ---------------- SENSE
    sense: List[dict] = [
        {"code": "quiet_days", "label": "Days since a check-in", "value": f"{missed} day(s)" if missed else "checked in recently", "source": "your check-ins", "params": {"n": missed}},
        {"code": "week", "label": "Check-ins, this week and last", "value": f"{weeks['this_week']} of {weeks['this_week_days']} days, then {weeks['last_week']} of {weeks['last_week_days']}",
         "source": "your check-ins", "params": {"a": weeks["this_week"], "b": weeks["this_week_days"], "c": weeks["last_week"], "d": weeks["last_week_days"]}},
    ]
    if bp:
        sense.append({"code": "bp", "label": "Latest blood pressure", "value": f"{bp[0]}/{bp[1]}", "source": "your own reading (last 24 hours)", "params": {"s": bp[0], "d": bp[1]}})
    if inp.get("sleep_hours") is not None:
        sense.append({"code": "sleep", "label": "Last night's sleep", "value": f"{inp['sleep_hours']} hours", "source": "your watch or phone, shared by you", "params": {"h": inp["sleep_hours"]}})
    if inp.get("usual_hour") is not None:
        sense.append({"code": "usual_hour", "label": "When you usually check in", "value": f"around {inp['usual_hour']:02d}:00", "source": "your check-in times", "params": {"h": inp["usual_hour"]}})
    kind_of_day = gulf.day_kind(local.date(), region) if region else None
    sense.append({"code": "clock", "label": "Your local time", "value": f"{local.strftime('%A %H:%M')}" + (f" ({kind_of_day.replace('_', ' ')})" if kind_of_day else ""),
                  "source": "your region setting", "params": {"t": local.strftime("%H:%M")}})
    if gate:
        sense.append({"code": "gulf_gate", "label": "Regional rule right now", "value": gate, "source": "estimated calendar and prayer times", "params": {}})
    if segment:
        sense.append({"code": "audience", "label": "Your audience", "value": aud.LABELS["en"].get(segment, segment), "source": "your profile or your choice", "params": {"segment": segment}})

    # ---------------- DECIDE
    reasons: List[dict] = []
    if lapse["state"] == "lapse":
        reasons.append({"code": "lapse", "text": f"No check-in for {missed} days, which is a lapse. A lapse is normal; the plan is kept and the step is made small."})
    elif lapse["state"] == "declining":
        reasons.append({"code": "declining", "text": "Check-ins have dropped by about a third compared with last week. We watch, and send nothing yet."})
    else:
        reasons.append({"code": "on_track", "text": "You are checking in. Nothing to do but keep going."})
    if safety["hold_level"]:
        reasons.append({"code": "safety_hold", "text": "A very high blood pressure reading or an open emergency was found, so your step is held at its size and you are pointed to a clinician."})

    send = {"send": False, "reason": "no gap"}
    if stage:
        recent = inp.get("recent") or []
        send = rg.decide(settings=settings, missed_days=missed, lapse_start=today - timedelta(days=missed), recent=recent, now=now,
                         has_supporter=bool(inp.get("has_supporter")), usual_hour=inp.get("usual_hour"), segment=segment, region=region,
                         respect_prayer=bool(inp.get("respect_prayer", True)))
        reasons.append({"code": "send" if send["send"] else "wait", "text": ("Will send: " if send["send"] else "Not sending now: ") + str(send["reason"])})

    grow = aud.grow_factor(segment) if not safety["hold_level"] else 1.0
    normal = eng.target_for(inp["behavior"], inp["baseline"], inp["goal"], inp["level"], False, grow)
    tiny = eng.target_for(inp["behavior"], inp["baseline"], inp["goal"], inp["level"], True, grow)
    unit = eng.BEHAVIORS[inp["behavior"]]["unit"]
    plan = {"behavior": inp["behavior"], "unit": unit, "usual_step": normal, "next_step": tiny if lapse["state"] == "lapse" else normal,
            "smaller": lapse["state"] == "lapse", "text": (f"Next step shrinks from {normal:g} to {tiny:g} {unit}: a deliberately tiny restart, so coming back feels easy." if lapse["state"] == "lapse" else None)}

    # ---------------- ACT
    message = eng.msg(rg.KIND_KEY[send["kind"]], lang) if send.get("send") else (eng.msg(rg.KIND_KEY[stage], lang) if stage else None)
    act = {"status": "send" if send["send"] else ("waiting" if stage else "nothing_to_do"),
           "channel": send.get("channel"), "kind": send.get("kind") or stage, "message": message,
           "note": "Generic words only: nothing about your health appears on a lock screen." if message else None,
           "one_tap": ONE_TAP if stage else [t for t in ONE_TAP if t["id"] in ("stop_messages",)]}

    # ---------------- HAND OFF
    why: List[dict] = []
    if health["bp_crisis"] or health["sos_active"]:
        why.append({"code": "safety", "text": "A very high blood pressure reading or an open emergency: a clinician should look, whatever the habit data says."})
    if conditions and missed >= HANDOFF_SILENT_DAYS:
        why.append({"code": "silent_condition", "text": f"Quiet for {missed} days while living with {', '.join(conditions[:2])}: worth a clinician's look."})
    doctor = inp.get("doctor")
    handoff = {"needed": bool(why), "reasons": why,
               "to": (doctor or "your care team") if why else None,
               "note": ("The clinician reviews, and can approve, change or dismiss. The agent never changes a treatment." if why
                        else "No clinician is needed for this: the agent handles an ordinary lapse on its own.")}

    # ---------------- MEASURE
    recent = inp.get("recent") or []
    sent30 = len(recent)
    back30 = sum(1 for n in recent if getattr(n, "responded", False))
    measure = {"messages_30_days": sent30, "came_back_within_48h": back30,
               "text": (f"Of {sent30} message(s) in the last 30 days, a check-in followed within 48 hours {back30} time(s)." if sent30
                        else "No messages yet, so nothing to measure.")}

    return {"person": {"name": inp.get("name"), "age": inp.get("age"), "segment": segment, "region": region, "language": lang},
            "state": lapse["state"], "missed_days": missed, "stage": stage,
            "sense": sense, "decide": {"reasons": reasons, "safety": safety, "plan": plan, "send": send, "method": METHOD},
            "act": act, "handoff": handoff, "measure": measure, "if_wrong": IF_WRONG, "limits": LIMITS}


# ---------------------------------------------------------------- gathering real facts for one person
def gather(db, user, now: Optional[datetime] = None) -> Optional[dict]:
    """Facts for this person's longest-quiet active plan (or their first plan). None when they have no plan yet."""
    from app.models.behavior import BehaviorAction, BehaviorNudge, BehaviorPlan, BehaviorSettings, BehaviorShare
    from app.models.caregiver import Doctor
    from app.models.user import UserProfile
    from app.services import behavior_data as bdata

    now = now or datetime.now(timezone.utc).astimezone()
    today = now.date()
    plans = db.query(BehaviorPlan).filter(BehaviorPlan.user_id == user.id, BehaviorPlan.active == True).all()  # noqa: E712
    if not plans:
        return None
    best, best_missed, best_status = None, -1, {}
    for p in plans:
        rows = db.query(BehaviorAction).filter(BehaviorAction.plan_id == p.id, BehaviorAction.status != "pending").all()
        status = {r.action_date: r.status for r in rows}
        m = eng.consecutive_missed_days(status, today, p.start_date)
        if m > best_missed:
            best, best_missed, best_status = p, m, status
    s = db.query(BehaviorSettings).filter_by(user_id=user.id).first()
    if s is None:
        s = SimpleNamespace(notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7,
                            language="en", wearable_data_enabled=False, share_with_doctor=False)
    cx = bdata.context_for(db, user.id)
    health = bdata.health_context(db, user)
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    doc = db.query(Doctor).filter(Doctor.doctor_id == prof.doctor_id).first() if prof and prof.doctor_id else None
    recent = db.query(BehaviorNudge).filter(BehaviorNudge.user_id == user.id, BehaviorNudge.sent_at >= now - timedelta(days=30)).all()
    from app.services import care_snapshot as snap
    vit = snap.latest_vitals(db, user.id)
    bp = (vit["systolic"], vit["diastolic"]) if vit.get("systolic") is not None and vit.get("diastolic") is not None else None
    return {
        "now": now, "today": today, "name": (prof.full_name if prof and prof.full_name else user.username) or "You", "age": health.get("age"),
        "segment": bdata.resolved_segment(cx, health), "region": cx.get("region"), "respect_prayer": bool(cx.get("respect_prayer", True)),
        "lang": s.language or "en", "conditions": health.get("conditions") or [], "work_pattern": cx.get("work_pattern"),
        "behavior": best.behavior, "level": best.level, "baseline": best.baseline_value, "goal": best.goal_value,
        "start_date": best.start_date, "day_status": best_status, "plan_id": best.id,
        "settings": s, "recent": recent,
        "has_supporter": db.query(BehaviorShare).filter_by(owner_id=user.id, active=True).first() is not None,
        "usual_hour": rg.best_hour(db, user.id, now),
        "bp": bp, "bp_crisis": bool(health.get("bp_crisis")), "sos_active": bool(health.get("sos_active")),
        "sleep_hours": health.get("sleep_hours") if getattr(s, "wearable_data_enabled", False) else None,
        "doctor": (doc.full_name if doc and getattr(doc, "full_name", None) else None),
        "consented": bool(getattr(s, "share_with_doctor", False)),
    }


def record(db, user, inp: dict, kind: str) -> Optional[Any]:
    """Save a trace. One open hand-off per gap, so the queue is never flooded."""
    from app.models.behavior import AgentRun
    t = trace(inp)
    lapse_start = inp["today"] - timedelta(days=t["missed_days"]) if t["missed_days"] else None
    if t["handoff"]["needed"] and lapse_start:
        dup = db.query(AgentRun).filter(AgentRun.user_id == user.id, AgentRun.lapse_start == lapse_start, AgentRun.handoff_needed == True,  # noqa: E712
                                        AgentRun.review_status == "pending").first()
        if dup:
            return dup
    run = AgentRun(user_id=user.id, plan_id=inp.get("plan_id"), lapse_start=lapse_start, kind=kind, trace=_jsonable(t),
                   handoff_needed=t["handoff"]["needed"], review_status="pending" if t["handoff"]["needed"] else "none")
    db.add(run)
    db.commit()
    return run


def _jsonable(o):
    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    return o


def redact(t: dict) -> dict:
    """What a doctor may see when the patient has NOT chosen to share habit progress: only the clinical reason for the hand-off."""
    keep = [r for r in t["handoff"]["reasons"] if r["code"] == "safety"]
    return {"person": {"name": t["person"]["name"]}, "handoff": {"needed": bool(keep), "reasons": keep, "to": t["handoff"].get("to"), "note": t["handoff"]["note"]},
            "hidden": "This patient has not chosen to share habit progress, so only the safety reason is shown."}


# ---------------------------------------------------------------- the story: one person, one moment, real rules on simulated facts
def story(scenario: str = "lapse") -> dict:
    """Khalid, a 47-year-old office worker in Abu Dhabi. The same moment twice: without the agent, then with it.
    Every number below is produced by the same functions the live service uses, on SIMULATED facts. Nothing here is real patient data."""
    region = "ae"
    # A Tuesday late morning, Abu Dhabi time (UTC+4), outside Ramadan and outside any prayer window.
    now = datetime(2026, 9, 15, 7, 30, tzinfo=timezone.utc)          # 11:30 in Abu Dhabi
    today = now.date()
    start = today - timedelta(days=21)
    status = {start + timedelta(days=i): "done" for i in range(0, 17)}       # steady for more than two weeks, then silence for four days
    base = {
        "now": now, "today": today, "name": "Khalid", "age": 47, "segment": "sedentary", "region": region, "respect_prayer": True, "lang": "en",
        "conditions": [], "behavior": "breaks", "level": 3, "baseline": 1, "goal": 8, "start_date": start, "day_status": status,
        "settings": SimpleNamespace(notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7, language="en"),
        "recent": [], "has_supporter": False, "usual_hour": None, "doctor": "Dr. Efua Owusu", "consented": True, "bp": None, "bp_crisis": False, "sos_active": False,
    }
    quiet_day = today - timedelta(days=4)
    for d in list(status):
        if d >= quiet_day:
            status.pop(d)
    safety = scenario == "safety"
    if safety:
        base.update(bp=(186, 124), bp_crisis=True, conditions=["Hypertension"], segment="chronic")
        base["name"] = "Khalid"
    on_track = trace({**base, "day_status": {d: "done" for d in (start + timedelta(days=i) for i in range(0, 21))}, "today": today - timedelta(days=5),
                      "now": now - timedelta(days=5)})
    lapse = trace(base)
    returned = trace({**base, "day_status": {**status, today: "done"}, "today": today + timedelta(days=1), "now": now + timedelta(days=1)})
    return {
        "label": "Simulated case. No real person. Every number comes from the same rules the live service runs.",
        "scenario": "safety" if safety else "lapse",
        "one_sentence": "For people who sit all day and drift away from a healthy routine, our agent notices the gap in a few days, sends one message that fits their day and prayer times, and shrinks the next step so they come back, with a clinician looking only where it matters.",
        "beats": [
            {"id": "problem", "title": "The problem", "text": "People who start a routine often go quiet after a week or two. Generic reminders are swiped away, and nobody on the care team sees the drift until it is a problem."},
            {"id": "user", "title": "The person", "text": "Khalid, 47, an office worker in Abu Dhabi. He feels fine. He sat through most of a week of meetings and his movement breaks stopped on Friday."},
            {"id": "solution", "title": "The agent in the moment", "text": "On the fourth quiet day it notices, picks a time that is neither prayer time nor outside his work hours, and sends one kind line with a much smaller first step."},
            {"id": "outcome", "title": "The outcome", "text": "Measured in the product: share of lapsed people who check in again within 48 hours, and how many days it took. Shown here on a simulated case."},
        ],
        "without_agent": {"text": "Time to exercise!", "when": "06:00 every day", "what_happens": "He swipes it away. Nobody notices. By the next week he has stopped.", "note": "Illustrative: the generic reminder most programmes send."},
        "moments": [
            {"id": "before", "title": "Day 0: he is on track", "trace": on_track},
            {"id": "lapse", "title": "Day 4: the agent steps in" if not safety else "Day 4: the safety rule comes first", "trace": lapse},
            {"id": "after", "title": "Day 5: he taps the tiny step", "trace": returned},
        ],
        "safeguards": ["No model decides anything: written rules, tested.", "A very high reading holds the step and asks a clinician to look.",
                       "He can stop all messages in one tap.", "Messages avoid prayer time and Ramadan fasting hours (estimated)."],
        "measured": ["Check-in within 48 hours of a message", "Days to return after a lapse", "Retention at day 7, 30 and 90", "Same results by audience, gender, age band, language and region"],
    }


# ---------------------------------------------------------------- demo hand-offs (sandbox and demo cohort only)
def demo_handoff(db, user, *, name: str, age: Optional[int], conditions: list, doctor: Optional[str], kind: str, region: str = "gh"):
    """Save one clearly simulated hand-off so a reviewer sees the doctor's queue working. kind: 'safety' | 'silent'.
    Built through the same trace() as a real one, then marked simulated. Never called outside the guest sandbox and the demo cohort."""
    now = datetime.now(timezone.utc).astimezone()
    today = now.date()
    start = today - timedelta(days=40)
    if kind == "safety":
        status = {start + timedelta(days=i): "done" for i in range(0, 37)}               # active until three days ago
        extra = {"bp": (186, 124), "bp_crisis": True}
    else:
        status = {start + timedelta(days=i): "done" for i in range(0, 20)}               # steady for three weeks, then 20 quiet days
        extra = {}
    inp = {"now": now, "today": today, "name": name, "age": age, "segment": "chronic" if conditions else None, "region": region, "respect_prayer": True, "lang": "en",
           "conditions": conditions, "behavior": "movement", "level": 3, "baseline": 3000, "goal": 7000, "start_date": start, "day_status": status,
           "settings": SimpleNamespace(notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7),
           "recent": [], "has_supporter": False, "usual_hour": None, "doctor": doctor, "sos_active": False, **{"bp": None, "bp_crisis": False, **extra}}
    run = record(db, user, inp, "review")
    run.trace = {**run.trace, "simulated": True}
    db.commit()
    return run
