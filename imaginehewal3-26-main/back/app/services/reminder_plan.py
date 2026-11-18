"""Adaptive reminders for the daily step: when to remind, how often, and when to stop, learned from what actually works for this person.

The rule of thumb behind it: a reminder helps most when it arrives just before the time the person already acts, and it stops helping (and starts
to annoy) when it is ignored. So:

  * TIME      The person's own usual check-in time (the median of their check-ins, once there are five) minus 30 minutes. Until we know them, a
              sensible time for their audience. The time is moved out of quiet hours, prayer windows and Ramadan fasting hours (an estimate).
  * ANSWERED  A day counts as answered when a check-in lands within 3 hours after the reminder time.
  * ADAPT     After a week, if fewer than 3 in 10 days were answered, the reminder moves to the exact time the person usually checks in. If
              that does not help after another week, it goes to every other day. If it still does not help, it pauses and says so: the
              person decides whether to turn it back on. We never keep nagging.
  * CONTROL   The person can switch it off, or fix the time themselves; both are always respected.

Pure functions, no network. The phone schedules the result as local notifications (so it works without push credentials), with generic text.
"""
from datetime import date, datetime, timedelta, timezone
from statistics import median
from typing import Any, Dict, List, Optional, Tuple

from app.services import gulf

ANSWER_WINDOW_MIN = 180
MIN_CHECKINS = 5
REVIEW_DAYS = 7
DEFAULT_TIME = {"sedentary": (10, 30), "older_adult": (9, 0), "young_adult": (18, 30), "adult": (18, 0), "chronic": (8, 0)}
STAGE_NAME = {0: "daily", 1: "daily, moved to your usual time", 2: "every other day", 3: "paused"}


def _mins(h: int, m: int) -> int:
    return h * 60 + m


def _hhmm(total: int) -> str:
    total = max(0, min(23 * 60 + 59, int(total)))
    return "%02d:%02d" % (total // 60, total % 60)


def usual_minute(checkins: List[Tuple[date, int]]) -> Optional[int]:
    if len(checkins) < MIN_CHECKINS:
        return None
    return int(median(m for _, m in checkins))


def _clear_of_rules(d: date, minute: int, region: Optional[str], respect_prayer: bool, quiet_start: int, quiet_end: int) -> Optional[str]:
    """Why this minute of this day is NOT a good time to remind, or None."""
    h = minute // 60
    if (quiet_start <= h or h < quiet_end) if quiet_start > quiet_end else (quiet_start <= h < quiet_end):
        return "quiet hours"
    if region:
        local = datetime(d.year, d.month, d.day, h, minute % 60, tzinfo=timezone(timedelta(hours=gulf.region_info(region)["utc_offset"])))
        return gulf.nudge_gate(local.astimezone(timezone.utc), region, respect_prayer)
    return None


def _place(d: date, minute: int, region, respect_prayer, quiet_start, quiet_end) -> Tuple[int, Optional[str]]:
    """Move a time later, 15 minutes at a time (up to 3 hours), until it clears quiet hours, prayer windows and fasting hours."""
    minute = max(_mins(7, 0), min(_mins(20, 30), minute))
    why = None
    for _ in range(12):
        blocked = _clear_of_rules(d, minute, region, respect_prayer, quiet_start, quiet_end)
        if not blocked:
            return minute, why
        why = blocked
        minute += 15
    return min(minute, _mins(20, 30)), why


def answered(checkins: List[Tuple[date, int]], since: date, until: date, at_min: int) -> Tuple[int, int]:
    """(days answered, days considered) between `since` and `until` inclusive."""
    by_day: Dict[date, List[int]] = {}
    for d, m in checkins:
        by_day.setdefault(d, []).append(m)
    days, hit = 0, 0
    d = since
    while d <= until:
        days += 1
        if any(at_min <= m < at_min + ANSWER_WINDOW_MIN for m in by_day.get(d, [])):
            hit += 1
        d += timedelta(days=1)
    return hit, days


def evaluate(inp: Dict[str, Any]) -> Dict[str, Any]:
    """inp: checkins [(date, minute_of_day)], today, plan_start, segment, region, respect_prayer, quiet_start, quiet_end,
    state {mode: auto|off|fixed, hour: int|None, stage: 0..3, stage_on: date|None}."""
    today: date = inp["today"]
    st = inp.get("state") or {}
    mode = st.get("mode") or "auto"
    stage = int(st.get("stage") or 0)
    stage_on: Optional[date] = st.get("stage_on")
    region, rp = inp.get("region"), bool(inp.get("respect_prayer", True))
    qs, qe = inp.get("quiet_start", 21), inp.get("quiet_end", 7)
    checkins = [c for c in inp.get("checkins", []) if c[0] < today + timedelta(days=1)]
    why: List[str] = []

    if mode == "off":
        return {"enabled": False, "mode": "off", "stage": stage, "frequency": "off", "time": None, "why": ["You turned reminders off. Nothing will be scheduled."],
                "observed": None, "changed_stage": None, "fire_dates": []}

    usual = usual_minute(checkins)
    if mode == "fixed" and st.get("hour") is not None:
        target = _mins(int(st["hour"]), 0)
        why.append("You chose this time yourself, so it never changes.")
    else:
        if stage >= 1 and usual is not None:
            target = usual
            why.append("The first time did not bring you back, so the reminder moved to the time you usually check in.")
        elif usual is not None:
            target = usual - 30
            why.append("You usually check in around %s, so the reminder comes 30 minutes before." % _hhmm(usual))
        else:
            h, m = DEFAULT_TIME.get(inp.get("segment"), (18, 0))
            target = _mins(h, m) + (120 if stage >= 1 else 0)
            why.append("We do not know your usual time yet, so we start at %s and learn from your check-ins." % _hhmm(target))
    placed, moved_for = _place(today, target, region, rp, qs, qe)
    if moved_for and placed != target:
        why.append("Moved to %s to avoid %s (an estimate)." % (_hhmm(placed), moved_for))

    # ---- did it work? (only in auto mode; a time the person fixed is theirs)
    observed, changed = None, None
    if mode == "auto":
        since = max(stage_on or inp["plan_start"], today - timedelta(days=14))
        until = today - timedelta(days=1)
        if (until - since).days + 1 >= REVIEW_DAYS and stage < 3:
            hit, days = answered(checkins, since, until, placed)
            share = hit / days if days else 0.0
            observed = {"days": days, "answered": hit, "share": round(share, 2)}
            limit = 0.2 if stage == 2 else 0.3
            if share < limit:
                changed = stage + 1
                why.append("Only %d of the last %d days brought a check-in, so the reminder is changing: %s." % (hit, days, STAGE_NAME[changed]))
            else:
                why.append("%d of the last %d days brought a check-in within 3 hours, so it stays as it is." % (hit, days))
        elif stage == 3:
            why.append("Reminders are paused because they were not helping. Turn them back on whenever you like.")
    new_stage = changed if changed is not None else stage

    freq = {0: "daily", 1: "daily", 2: "every_other_day", 3: "paused"}[new_stage]
    fire: List[str] = []
    if freq != "paused":
        for i in range(0, 7):
            d = today + timedelta(days=i)
            if freq == "every_other_day" and (d.toordinal() % 2):
                continue
            fire.append(d.isoformat())
    return {"enabled": freq != "paused", "mode": mode, "stage": new_stage, "frequency": freq, "time": _hhmm(placed), "why": why, "observed": observed,
            "changed_stage": changed, "fire_dates": fire,
            "how_it_learns": "A day counts as answered when you check in within 3 hours after the reminder. We review after a week."}
