"""Did people actually change, and keep it? Measured over months, not downloads or messages.

Everything here is an aggregate. A group with fewer than `min_cell` people is never shown (so no individual can be picked out), and nothing in the
output carries a name, an id or a date that identifies one person. These figures describe what happened to groups of people and say nothing about
cause on their own; the biomarker section is labelled as association for that reason.

Measures (also returned under "definitions"):
  retention      share of people still active (a done or partial day) around day 7, 30 and 90 after they started
  persistence    share of plans older than 8 weeks that were kept up in at least 6 of the last 8 weeks
  recovery       share of lapses (3+ quiet days) that ended in a return, and the median days it took
  change         median % change in the target behaviour against where the person started
  biomarker      median change in blood pressure, weight and sleep between the first and the latest 14 days for people who have the readings
  outreach       share of gentle messages after a gap that were followed by a check-in within 48 hours, by channel
  equity         the same outcomes by gender, age band, language, mobility, work pattern and support, with the gap between groups flagged
"""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import median
from typing import Dict, Iterable, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.activity import SleepSession, WeightLog
from app.models.behavior import BehaviorAction, BehaviorContext, BehaviorNudge, BehaviorPlan, BehaviorSettings
from app.models.iot_device import VitalReading
from app.models.user import UserProfile
from app.services import behavior_engine as eng

MIN_CELL = 5
EQUITY_GAP_FLAG = 0.15
DIMENSIONS = ("gender", "age_band", "language", "mobility", "work_pattern", "support")

DEFINITIONS = {
    "retention": "Share of people still active (a done or partial day) within a week of day 7, 30 and 90 after they started.",
    "persistence": "Share of plans older than 8 weeks that were kept up in at least 6 of the last 8 weeks.",
    "recovery": "Share of lapses (3 or more quiet days) that ended with the person returning, and the median days it took.",
    "change": "Median percentage change in the target behaviour (steps, servings, sleep hours, minutes) against the person's own starting point.",
    "biomarker": "Median change between a person's first and latest 14 days of readings. This is an association; it does not show the app caused it.",
    "outreach": "Share of messages after a gap that were followed by a check-in within 48 hours.",
    "equity": "The same outcomes for each group. A gap of 15 percentage points or more between groups is flagged for review.",
}


def _aware(d):
    return d if d is None or getattr(d, "tzinfo", None) else d.replace(tzinfo=timezone.utc)


def _band(age: Optional[int]) -> str:
    return "not_provided" if age is None else "<30" if age < 30 else "30-49" if age < 50 else "50+"


def _history(db: Session, plan: BehaviorPlan):
    rows = db.query(BehaviorAction).filter(BehaviorAction.plan_id == plan.id, BehaviorAction.status != "pending").all()
    return {r.action_date: r.status for r in rows}, {r.action_date: r.value_done for r in rows if r.value_done is not None}


def _k(n: int, min_cell: int, payload: dict) -> dict:
    return payload if n >= min_cell else {"n": f"<{min_cell}", "hidden": True}


def _share(num: int, den: int, min_cell: int) -> dict:
    return _k(den, min_cell, {"n": den, "value": round(num / den, 2) if den else None})


def _biomarkers(db: Session, starts: Dict[int, date], today: date, min_cell: int) -> dict:
    """Per-person change between the first and latest 14 days of readings, summarised across people."""
    first_end = {u: s + timedelta(days=14) for u, s in starts.items()}
    last_start = today - timedelta(days=14)
    bp, wt, sl = [], [], []
    for u, s in starts.items():
        if (today - s).days < 28:
            continue
        reads = [(r.timestamp.date(), r.blood_pressure_systolic) for r in
                 db.query(VitalReading).filter(VitalReading.user_id == u, VitalReading.blood_pressure_systolic.isnot(None)).all()]
        a = [v for d, v in reads if s <= d <= first_end[u]]
        b = [v for d, v in reads if d >= last_start]
        if len(a) >= 3 and len(b) >= 3:
            bp.append(sum(b) / len(b) - sum(a) / len(a))
        w = [(_aware(r.at).date(), r.kg) for r in db.query(WeightLog).filter(WeightLog.user_id == u).all()]
        wa = [v for d, v in w if s <= d <= first_end[u]]
        wb = [v for d, v in w if d >= last_start]
        if wa and wb:
            wt.append(sum(wb) / len(wb) - sum(wa) / len(wa))
        sessions = db.query(SleepSession).filter(SleepSession.user_id == u).all()
        def asleep(x): return (x.light_min + x.deep_min + x.rem_min) if (x.stages or x.deep_min) else x.total_min
        sa = [asleep(x) for x in sessions if s <= _aware(x.end).date() <= first_end[u]]
        sb = [asleep(x) for x in sessions if _aware(x.end).date() >= last_start]
        if len(sa) >= 3 and len(sb) >= 3:
            sl.append(sum(sb) / len(sb) - sum(sa) / len(sa))

    def pack(vals: List[float], unit: str, good: str) -> dict:
        if len(vals) < min_cell:                                  # also covers "no readings at all": nothing is computed, nothing is shown
            return {"n": len(vals) if not vals else f"<{min_cell}", "hidden": True}
        return {"n": len(vals), "median_change": round(median(vals), 1), "unit": unit, "good_direction": good}
    return {"systolic_blood_pressure": pack(bp, "mmHg", "down"), "weight": pack(wt, "kg", "down"), "sleep": pack(sl, "min per night", "up"),
            "note": "Association only. These people also changed other things, and some would have improved without the app."}


def compute_impact(db: Session, today: Optional[date] = None, user_ids: Optional[Iterable[int]] = None, min_cell: int = MIN_CELL) -> dict:
    today = today or date.today()
    scope: Optional[Set[int]] = set(user_ids) if user_ids is not None else None
    plans = [p for p in db.query(BehaviorPlan).all() if scope is None or p.user_id in scope]
    people = sorted({p.user_id for p in plans})
    out: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "min_group_size": min_cell, "definitions": DEFINITIONS,
                 "privacy": "Group figures only. Groups smaller than %d are hidden. No names, no identifiers." % min_cell}
    if len(people) < min_cell:
        out.update({"people": f"<{min_cell}", "hidden": True,
                    "note": f"Results appear once {min_cell} or more people are included, so no one can be identified."})
        return out
    out["people"], out["plans"] = len(people), len(plans)

    per_plan, starts, engaged_days, lapses, recovered, recovery_days, change_by_beh = {}, {}, {}, 0, 0, [], defaultdict(list)
    sustained_num = sustained_den = 0
    for p in plans:
        status, values = _history(db, p)
        o = eng.outcomes(status, values, p.baseline_value, eng.BEHAVIORS[p.behavior]["direction"], p.start_date, today)
        per_plan[p.id] = (p, status, o)
        starts[p.user_id] = min(starts.get(p.user_id, p.start_date), p.start_date)
        lapses += o["lapses"]
        recovered += o["recovered_lapses"]
        if o["avg_days_to_recover"] is not None:
            recovery_days.append(o["avg_days_to_recover"])
        if o["behaviour_change_pct_vs_baseline"] is not None:
            change_by_beh[p.behavior].append(o["behaviour_change_pct_vs_baseline"])
        if (today - p.start_date).days >= 56 and o["sustained"] is not None:
            sustained_den += 1
            sustained_num += 1 if o["sustained"] else 0
        for d, st in status.items():
            if st in ("done", "partial"):
                engaged_days.setdefault(p.user_id, set()).add(d)

    retention = {}
    for n in (7, 30, 90):
        cohort = [u for u, s in starts.items() if (today - s).days >= n]
        kept = sum(1 for u in cohort if any(starts[u] + timedelta(days=n - 6) <= d <= starts[u] + timedelta(days=n + 6) for d in engaged_days.get(u, ())))
        retention[f"day_{n}"] = _share(kept, len(cohort), min_cell)
    out["retention"] = retention
    out["persistence"] = _share(sustained_num, sustained_den, min_cell)
    out["recovery"] = _k(lapses, min_cell, {"lapses": lapses, "recovered_share": round(recovered / lapses, 2) if lapses else None,
                                            "median_days_to_return": round(median(recovery_days), 1) if recovery_days else None})
    out["change"] = {b: _k(len(v), min_cell, {"n": len(v), "median_pct_change": round(median(v), 1)}) for b, v in change_by_beh.items()}
    out["biomarkers"] = _biomarkers(db, starts, today, min_cell)

    nudges = [n for n in db.query(BehaviorNudge).all() if scope is None or n.user_id in scope]
    by_ch: Dict[str, List[bool]] = defaultdict(list)
    for n in nudges:
        by_ch[n.channel].append(bool(n.responded))
    out["outreach"] = {c: _k(len(v), min_cell, {"sent": len(v), "followed_by_check_in": round(sum(v) / len(v), 2)}) for c, v in by_ch.items()}

    # equity: the same outcomes for each group, so a programme that works on average but not for everyone shows up
    prof = {r.user_id: r for r in db.query(UserProfile).filter(UserProfile.user_id.in_(people)).all()}
    ctx = {r.user_id: r for r in db.query(BehaviorContext).filter(BehaviorContext.user_id.in_(people)).all()}
    sets = {r.user_id: r for r in db.query(BehaviorSettings).filter(BehaviorSettings.user_id.in_(people)).all()}
    person: Dict[int, dict] = {}
    for p, status, o in per_plan.values():
        rate, nn = eng.adherence(status, today, 14, p.start_date)
        rec = person.setdefault(p.user_id, {"adh": [], "pers": [], "chg": []})
        if nn >= 7:
            rec["adh"].append(rate)
        if o["weeks_tracked"]:
            rec["pers"].append(o["weeks_persisted"] / o["weeks_tracked"])
        if o["behaviour_change_pct_vs_baseline"] is not None:
            rec["chg"].append(o["behaviour_change_pct_vs_baseline"])
    equity: Dict[str, dict] = {}
    for dim in DIMENSIONS:
        cells: Dict[str, List[dict]] = defaultdict(list)
        for u, rec in person.items():
            if not rec["adh"]:
                continue
            pr, cx, st = prof.get(u), ctx.get(u), sets.get(u)
            key = {"gender": (pr.gender if pr and pr.gender else "not_provided"), "age_band": _band(pr.age if pr else None),
                   "language": (st.language if st else "en") or "en", "mobility": (cx.mobility if cx else "not_provided"),
                   "work_pattern": (cx.work_pattern if cx else "not_provided"), "support": (cx.support if cx else "not_provided")}[dim]
            cells[key].append(rec)
        shown, visible = {}, []
        for key, recs in cells.items():
            if len(recs) < min_cell:
                shown[key] = {"n": f"<{min_cell}", "hidden": True}
                continue
            adh = sum(sum(r["adh"]) / len(r["adh"]) for r in recs) / len(recs)
            per = sum(sum(r["pers"]) / len(r["pers"]) for r in recs if r["pers"]) / max(1, sum(1 for r in recs if r["pers"]))
            chg = [sum(r["chg"]) / len(r["chg"]) for r in recs if r["chg"]]
            shown[key] = {"n": len(recs), "adherence": round(adh, 2), "persistence": round(per, 2), "median_change_pct": round(median(chg), 1) if chg else None}
            visible.append(adh)
        gap = round(max(visible) - min(visible), 2) if len(visible) >= 2 else None
        equity[dim] = {"groups": shown, "gap": gap, "review": bool(gap is not None and gap >= EQUITY_GAP_FLAG)}
    out["equity"] = equity
    out["equity_flags"] = [d for d, v in equity.items() if v["review"]]
    return out
