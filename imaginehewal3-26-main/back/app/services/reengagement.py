"""Reaching people who have gone quiet, kindly, and learning what actually brings them back.

Why this exists: a "welcome back" shown only when someone opens the app cannot reach the person who stopped opening it. This runs on the
server every half hour, finds plans with a gap, and sends at most a few gentle messages, adapting how and when:

  * Stage by gap length: 3+ days quiet -> a tiny-step invitation; 7+ days -> a different, lighter message; 14+ days -> one last note that
    the plan is waiting, and then silence. We never keep pushing someone who is not responding.
  * Channel adapts: the person's own choice first (push or in-app only); if both have enough history, the one that has brought THEM
    back more often. If two messages in a row got no response, push becomes quiet in-app only; after that, a supporter the person
    already chose may be told they could use a kind word (no details), and after that we stop.
  * Limits the person controls: outreach off, weekly cap, quiet hours. One message a day at most, only in the person's usual hours
    once we know them, never with health details on the lock screen.
  * Learning: every nudge records whether a check-in followed within 48 hours. That is shown back to the person and summarised (without
    names) in the impact report, so "did the outreach help" is measured, not assumed.
"""
import asyncio
import logging
import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import median
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.behavior import BehaviorAction, BehaviorNudge, BehaviorPlan, BehaviorSettings, BehaviorShare
from app.models.notification import Notification
from app.models.user import User
from app.services import audience as aud
from app.services import behavior_data as bdata
from app.services import behavior_engine as eng
from app.services import gulf

logger = logging.getLogger(__name__)

ANSWER_WINDOW = timedelta(hours=48)
MIN_FOR_LEARNING = 3        # sends per channel before the channel with the better record is preferred
KIND_KEY = {"reengage_1": "nudge_1", "reengage_2": "nudge_2", "paused": "nudge_paused", "supporter": "supporter_prompt"}


def _aware(d: Optional[datetime]) -> Optional[datetime]:
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def stage_for(missed_days: int) -> Optional[str]:
    if missed_days >= 14:
        return "paused"
    if missed_days >= 7:
        return "reengage_2"
    if missed_days >= eng.LAPSE_DAYS:
        return "reengage_1"
    return None


def in_quiet(hour: int, start: int, end: int) -> bool:
    return (start <= hour or hour < end) if start > end else (start <= hour < end)


def in_send_window(hour: int, best_hour: Optional[int]) -> bool:
    """Send in the person's usual hours once we know them; before that, a sensible daytime window."""
    if best_hour is not None:
        return abs(hour - best_hour) <= 1
    return 9 <= hour <= 18


def best_hour(db: Session, user_id: int, now: Optional[datetime] = None) -> Optional[int]:
    """The hour this person usually checks in (median), once there are at least five check-ins."""
    cut = (now or datetime.now(timezone.utc)) - timedelta(days=60)
    rows = (db.query(BehaviorAction.completed_at).filter(BehaviorAction.user_id == user_id, BehaviorAction.completed_at.isnot(None),
                                                         BehaviorAction.status.in_(("done", "partial"))).all())
    hours = [_aware(r[0]).astimezone().hour for r in rows if r[0] and _aware(r[0]) >= cut]
    return int(round(median(hours))) if len(hours) >= 5 else None


def channel_record(nudges: List[BehaviorNudge]) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = defaultdict(lambda: {"sent": 0, "came_back": 0})
    for n in nudges:
        if n.channel not in ("push", "in_app"):
            continue
        out[n.channel]["sent"] += 1
        out[n.channel]["came_back"] += 1 if n.responded else 0
    return out


def decide(*, settings, missed_days: int, lapse_start: date, recent: List[BehaviorNudge], now: datetime,
           has_supporter: bool, usual_hour: Optional[int], segment: Optional[str] = None, region: Optional[str] = None,
           respect_prayer: bool = True) -> dict:
    """Pure decision: send or not, which kind, which channel, and the plain reason. Fully unit-tested."""
    def skip(why: str) -> dict:
        return {"send": False, "reason": why}

    kind = stage_for(missed_days)
    if not kind:
        return skip("no gap")
    if not settings.notifications_enabled or (settings.reengage_channel or "push") == "none" or settings.max_nudges_per_week == 0:
        return skip("the person turned outreach off")
    local = gulf.local_now(now, region) if region else now           # the person's own clock, not the server's
    if in_quiet(local.hour, settings.quiet_hours_start, settings.quiet_hours_end):
        return skip("quiet hours")
    first, last = aud.send_window(segment, region, local.weekday(), usual_hour)
    if not (first <= local.hour <= last):
        return skip("outside the person's usual hours")
    why_not = gulf.nudge_gate(now, region, respect_prayer)
    if why_not:
        return skip(why_not)
    same_gap = [n for n in recent if n.lapse_start == lapse_start]
    if any(n.kind == kind for n in same_gap):
        return skip("already sent for this gap")
    if any(_aware(n.sent_at).date() == now.date() for n in recent):
        return skip("one message a day at most")
    cap = 2 if settings.max_nudges_per_week is None else settings.max_nudges_per_week
    if sum(1 for n in recent if _aware(n.sent_at) >= now - timedelta(days=7)) >= cap:
        return skip("weekly limit reached")
    channel = "in_app" if settings.reengage_channel == "in_app" else "push"
    rec = channel_record(recent)
    if settings.reengage_channel != "in_app" and rec["push"]["sent"] >= MIN_FOR_LEARNING and rec["in_app"]["sent"] >= MIN_FOR_LEARNING:
        rate = {c: rec[c]["came_back"] / rec[c]["sent"] for c in ("push", "in_app")}
        if rate["in_app"] > rate["push"] + 0.2:
            channel = "in_app"                                   # the quieter channel has worked better for this person
    if kind == "paused":
        return {"send": True, "kind": kind, "channel": "in_app", "reason": "last gentle note, then silence"}
    last_two = sorted(recent, key=lambda n: _aware(n.sent_at), reverse=True)[:2]
    fatigued = len(last_two) == 2 and all(not n.responded and now - _aware(n.sent_at) > ANSWER_WINDOW for n in last_two)
    if fatigued:
        if channel == "push":
            return {"send": True, "kind": kind, "channel": "in_app", "reason": "two messages went unanswered, so quieter now"}
        if has_supporter and not any(n.channel == "supporter" for n in same_gap):
            return {"send": True, "kind": "supporter", "channel": "supporter", "reason": "a supporter the person chose may help"}
        return skip("messages are not helping, so we are not sending more")
    return {"send": True, "kind": kind, "channel": channel, "reason": "gap of %d days" % missed_days}


def _plan_gaps(db: Session, today: date) -> List[dict]:
    """For each person with active plans, the plan with the longest current gap."""
    worst: Dict[int, dict] = {}
    for plan in db.query(BehaviorPlan).filter(BehaviorPlan.active == True).all():  # noqa: E712
        rows = db.query(BehaviorAction).filter(BehaviorAction.plan_id == plan.id, BehaviorAction.status != "pending").all()
        status = {r.action_date: r.status for r in rows}
        missed = eng.consecutive_missed_days(status, today, plan.start_date)
        if missed >= eng.LAPSE_DAYS and (plan.user_id not in worst or missed > worst[plan.user_id]["missed"]):
            worst[plan.user_id] = {"plan": plan, "missed": missed}
    return list(worst.values())


def _deliver(db: Session, user_id: int, plan: BehaviorPlan, kind: str, channel: str, lang: str, lapse_start: date, now: datetime) -> BehaviorNudge:
    from app.services import push
    from app.realtime import hub
    text = eng.msg(KIND_KEY[kind], lang)
    target = user_id
    if channel == "supporter":
        share = db.query(BehaviorShare).filter_by(owner_id=user_id, plan_id=plan.id, active=True).first() or \
            db.query(BehaviorShare).filter_by(owner_id=user_id, active=True).first()
        target = share.supporter_id
        sup = db.query(BehaviorSettings).filter_by(user_id=target).first()
        text = eng.msg("supporter_prompt", sup.language if sup else "en")
    db.add(Notification(user_id=target, notification_type="behavior_reengage" if channel != "supporter" else "behavior_support",
                        title="HEWAL3", message=text, sender_type="system"))
    nudge = BehaviorNudge(user_id=user_id, plan_id=plan.id, kind=kind, channel=channel, lapse_start=lapse_start, sent_at=now, hour=now.hour)
    db.add(nudge)
    db.commit()
    if channel in ("push", "supporter"):
        push.notify_users([target], "HEWAL3", text, {"type": "behavior"})          # generic text: nothing private on a lock screen
    try:
        hub.send_from_thread(target, {"type": "notification.new", "title": "HEWAL3", "message": text})
    except Exception:
        pass
    return nudge


def _record_agent(db: Session, user: User, now: datetime, decision: dict) -> None:
    """Keep the care agent's trace for every message sent, and for any hand-off a clinician should see. Never allowed to stop a message."""
    try:
        from app.services import care_agent as ca
        inp = ca.gather(db, user, now)
        if inp and (decision["send"] or ca.trace(inp)["handoff"]["needed"]):
            ca.record(db, user, inp, "nudge" if decision["send"] else "review")
    except Exception as e:                                           # the agent's notes must never block the message itself
        logger.warning("care agent trace failed: %s", type(e).__name__)
        db.rollback()


def run(db: Session, now: Optional[datetime] = None) -> List[dict]:
    """One pass. Returns what was sent (kind, channel, reason) for logging and tests."""
    now = now or datetime.now(timezone.utc).astimezone()
    sent: List[dict] = []
    for gap in _plan_gaps(db, now.date()):
        plan: BehaviorPlan = gap["plan"]
        s = db.query(BehaviorSettings).filter_by(user_id=plan.user_id).first()
        if s is None:                                    # never opened Settings: the defaults apply (column defaults only exist once a row is saved)
            s = BehaviorSettings(user_id=plan.user_id, notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2,
                                 quiet_hours_start=21, quiet_hours_end=7, language="en")
        user = db.query(User).filter(User.id == plan.user_id, User.is_active == True).first()  # noqa: E712
        if not user:
            continue
        lapse_start = now.date() - timedelta(days=gap["missed"])
        recent = db.query(BehaviorNudge).filter(BehaviorNudge.user_id == plan.user_id, BehaviorNudge.sent_at >= now - timedelta(days=30)).all()
        cx = bdata.context_for(db, plan.user_id)
        decision = decide(settings=s, missed_days=gap["missed"], lapse_start=lapse_start, recent=recent, now=now,
                          segment=bdata.resolved_segment(cx, bdata.health_context(db, user)), region=cx.get("region"),
                          respect_prayer=bool(cx.get("respect_prayer", True)),
                          has_supporter=db.query(BehaviorShare).filter_by(owner_id=plan.user_id, active=True).first() is not None,
                          usual_hour=best_hour(db, plan.user_id, now))
        _record_agent(db, user, now, decision)
        if not decision["send"]:
            continue
        _deliver(db, plan.user_id, plan, decision["kind"], decision["channel"], s.language or "en", lapse_start, now)
        sent.append({"user_id": plan.user_id, **{k: decision[k] for k in ("kind", "channel", "reason")}})
    return sent


def mark_responses(db: Session, user_id: int, plan_id: int, when: Optional[datetime]) -> int:
    """A check-in within 48 hours of a message means the message worked."""
    when = _aware(when) or datetime.now(timezone.utc)
    n = 0
    try:
        from app.models.behavior import ComebackSession
        for cs in db.query(ComebackSession).filter(ComebackSession.user_id == user_id, ComebackSession.returned == False).all():  # noqa: E712
            if cs.created_at and 0 <= (when - _aware(cs.created_at)).total_seconds() <= 72 * 3600:
                cs.returned, cs.returned_at = True, when
        db.commit()
    except Exception:
        db.rollback()
    for nudge in db.query(BehaviorNudge).filter(BehaviorNudge.user_id == user_id, BehaviorNudge.responded == False).all():  # noqa: E712
        if 0 <= (when - _aware(nudge.sent_at)).total_seconds() <= ANSWER_WINDOW.total_seconds():
            nudge.responded, nudge.responded_at = True, when
            n += 1
    if n:
        from app.models.behavior import AgentRun
        for r in db.query(AgentRun).filter(AgentRun.user_id == user_id, AgentRun.kind == "nudge", AgentRun.returned == False).all():  # noqa: E712
            if r.created_at and 0 <= (when - _aware(r.created_at)).total_seconds() <= ANSWER_WINDOW.total_seconds():
                r.returned, r.returned_at = True, when
        db.commit()
    return n


def person_summary(db: Session, user_id: int) -> dict:
    rows = db.query(BehaviorNudge).filter_by(user_id=user_id).order_by(BehaviorNudge.id.desc()).limit(50).all()
    rec = channel_record(rows)
    learned: List[str] = []
    for ch, label in (("push", "phone notifications"), ("in_app", "quiet in-app messages")):
        if rec[ch]["sent"] >= MIN_FOR_LEARNING:
            learned.append(f"After {label}, you came back {int(rec[ch]['came_back'])} of {int(rec[ch]['sent'])} times.")
    hr = best_hour(db, user_id)
    if hr is not None:
        learned.append(f"You usually check in around {hr:02d}:00, so we only message you near then.")
    return {"recent": [{"kind": n.kind, "channel": n.channel, "sent_at": _aware(n.sent_at).isoformat() if n.sent_at else None, "came_back": bool(n.responded)} for n in rows[:10]],
            "by_channel": {c: dict(v) for c, v in rec.items()}, "learned": learned,
            "limits": "At most the weekly number you set, never in quiet hours, and we stop if messages are not helping."}


def _run_once():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        sent = run(db)
        if sent:
            logger.info("re-engagement sent %d message(s)", len(sent))
    finally:
        db.close()


async def reengagement_worker(interval_s: int = 1800):
    """Background loop started with the API. Switch off with REENGAGE_ENABLED=0."""
    if os.getenv("REENGAGE_ENABLED", "1") == "0":
        return
    await asyncio.sleep(90)
    while True:
        try:
            await asyncio.to_thread(_run_once)
        except Exception as e:
            logger.warning("re-engagement pass failed: %s", type(e).__name__)
        await asyncio.sleep(interval_s)
