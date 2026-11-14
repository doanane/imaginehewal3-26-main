"""Statistics for the doctor website, computed from the patient's own stored readings. No model, no guessing.

Every figure here can be reproduced by hand from the readings:
  * summary: n, mean, median, standard deviation, 10th/90th percentile, coefficient of variation
  * trend: ordinary least squares on the daily means, with a two-sided p-value from Student's t distribution. A trend is only
    reported as rising or falling when p < 0.05 AND the change over the window is at least a clinically noticeable amount.
  * period comparison: mean of this window against the mean of the window just before it
  * time in range: share of readings inside the stated reference range
  * outliers: modified z-score (median and MAD), flagged above 3.5 (Iglewicz and Hoaglin)
  * coverage: how many days of the window have any reading, because few days means a weak conclusion, and the page says so

Reference ranges are the ones already used across HEWAL3 (AHA/ACC blood pressure, resting heart rate 60 to 100, oxygen 95 and above).
"""
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.health import HealthData
from app.models.iot_device import VitalReading
from app.models.safety import Medication, MedicationLog
from app.models.user import User, UserProfile
from app.services.care_snapshot import aware, parse_bp
from app.services.risk_service import bp_category

# metric -> (label, unit, low, high of the reference range, smallest change over the window worth mentioning)
METRICS: Dict[str, Tuple[str, str, Optional[float], Optional[float], float]] = {
    "heart_rate": ("Heart rate", "bpm", 60, 100, 5),
    "systolic": ("Systolic pressure", "mmHg", 90, 129, 5),
    "diastolic": ("Diastolic pressure", "mmHg", 60, 79, 3),
    "blood_oxygen": ("Oxygen saturation", "%", 95, 100, 1),
    "glucose": ("Blood glucose", "mg/dL", 70, 139, 10),
}


# ------------------------------------------------------------------ small statistics helpers
def _percentile(xs: List[float], p: float) -> float:
    s = sorted(xs)
    k = (len(s) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] if lo == hi else s[lo] + (s[hi] - s[lo]) * (k - lo)


def _t_cdf(t: float, df: int) -> float:
    """Student t cumulative distribution by numeric integration (Simpson). Accurate to well under 1e-4 for the sizes used here."""
    if df <= 0:
        return 0.5
    c = math.exp(math.lgamma((df + 1) / 2) - math.lgamma(df / 2)) / math.sqrt(df * math.pi)
    pdf = lambda x: c * (1 + x * x / df) ** (-(df + 1) / 2)  # noqa: E731
    n = 400
    a, b = 0.0, abs(t)
    h = (b - a) / n
    total = pdf(a) + pdf(b) + sum((4 if i % 2 else 2) * pdf(a + i * h) for i in range(1, n))
    half = total * h / 3
    return 0.5 + half if t >= 0 else 0.5 - half


def ols(xs: List[float], ys: List[float]) -> Optional[Dict[str, float]]:
    """Least squares line y = a + b x. Returns slope, r squared and a two-sided p-value for slope != 0. Needs 4 or more points."""
    n = len(xs)
    if n < 4:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    b = sxy / sxx
    a = my - b * mx
    sse = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 0.0 if syy == 0 else max(0.0, 1 - sse / syy)
    if sse == 0:
        p = 0.0 if b != 0 else 1.0
    else:
        se = math.sqrt(sse / (n - 2) / sxx)
        t = b / se if se else 0.0
        p = max(0.0, min(1.0, 2 * (1 - _t_cdf(abs(t), n - 2))))
    return {"slope": b, "intercept": a, "r2": r2, "p": p}


def summarize(values: List[float]) -> Optional[Dict[str, Any]]:
    if not values:
        return None
    n = len(values)
    mean = statistics.fmean(values)
    sd = statistics.stdev(values) if n > 1 else 0.0
    return {
        "n": n, "mean": round(mean, 1), "median": round(statistics.median(values), 1), "sd": round(sd, 1),
        "min": round(min(values), 1), "max": round(max(values), 1),
        "p10": round(_percentile(values, 0.10), 1), "p90": round(_percentile(values, 0.90), 1),
        "cv": round(sd / mean * 100, 1) if mean else None,
    }


def modified_z_outliers(points: List[Tuple[datetime, float]], threshold: float = 3.5) -> List[Dict[str, Any]]:
    vals = [v for _, v in points]
    if len(vals) < 8:
        return []                                       # too few readings to say what is unusual
    med = statistics.median(vals)
    mad = statistics.median([abs(v - med) for v in vals])
    if mad == 0:
        return []
    out = []
    for t, v in points:
        z = 0.6745 * (v - med) / mad
        if abs(z) > threshold:
            out.append({"at": t.isoformat(), "value": round(v, 1), "z": round(z, 1)})
    return sorted(out, key=lambda o: -abs(o["z"]))[:8]


# ------------------------------------------------------------------ gathering real readings
def _readings(db: Session, user: User, since: datetime) -> List[Dict[str, Any]]:
    """Every stored reading since `since` as one list, from the watch/device table and from the phone's daily sync."""
    rows: List[Dict[str, Any]] = []
    for v in db.query(VitalReading).filter(VitalReading.user_id == user.id, VitalReading.timestamp >= since).all():
        rows.append({"t": aware(v.timestamp), "heart_rate": v.heart_rate or None, "systolic": v.blood_pressure_systolic or None,
                     "diastolic": v.blood_pressure_diastolic or None, "blood_oxygen": v.blood_oxygen or None, "glucose": v.glucose_level or None})
    for h in db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= since).all():
        s, d = parse_bp(h.blood_pressure)
        if h.heart_rate or s or h.blood_glucose:
            rows.append({"t": aware(h.date), "heart_rate": h.heart_rate or None, "systolic": s, "diastolic": d,
                         "blood_oxygen": None, "glucose": h.blood_glucose or None})
    return rows


def _steps_by_day(db: Session, user: User, since: datetime) -> Dict[str, int]:
    by_day: Dict[str, int] = {}
    for h in db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= since).all():
        if h.steps:
            d = aware(h.date).date().isoformat()
            by_day[d] = max(by_day.get(d, 0), h.steps)        # steps are cumulative through the day, so the largest is the day's total
    return by_day


def _metric_block(key: str, rows: List[Dict[str, Any]], prev_rows: List[Dict[str, Any]], days: int, start: date) -> Optional[Dict[str, Any]]:
    label, unit, lo, hi, min_change = METRICS[key]
    pts = [(r["t"], float(r[key])) for r in rows if r.get(key) is not None]
    if not pts:
        return None
    vals = [v for _, v in pts]
    newest = max(pts, key=lambda p: p[0])
    block: Dict[str, Any] = {"key": key, "label": label, "unit": unit, "reference": [lo, hi], "stats": summarize(vals),
                             "latest": {"value": round(newest[1], 1), "at": newest[0].isoformat()}}
    inside = sum(1 for v in vals if (lo is None or v >= lo) and (hi is None or v <= hi))
    block["time_in_range"] = round(inside / len(vals) * 100)
    block["above"] = round(sum(1 for v in vals if hi is not None and v > hi) / len(vals) * 100)
    block["below"] = round(sum(1 for v in vals if lo is not None and v < lo) / len(vals) * 100)

    # daily means, the unit the trend is fitted on, so a burst of readings in one hour does not dominate
    per_day: Dict[date, List[float]] = defaultdict(list)
    for t, v in pts:
        per_day[t.date()].append(v)
    daily = [{"day": d.isoformat(), "mean": round(statistics.fmean(v), 1), "min": round(min(v), 1), "max": round(max(v), 1), "n": len(v)}
             for d, v in sorted(per_day.items())]
    block["daily"] = daily
    fit = ols([(date.fromisoformat(d["day"]) - start).days for d in daily], [d["mean"] for d in daily])
    if fit:
        change = fit["slope"] * (days - 1)
        meaningful = fit["p"] < 0.05 and abs(change) >= min_change
        block["trend"] = {"slope_per_day": round(fit["slope"], 2), "change_over_window": round(change, 1), "r2": round(fit["r2"], 2),
                          "p": round(fit["p"], 4), "days_used": len(daily), "direction": ("rising" if change > 0 else "falling") if meaningful else "steady",
                          "line": [round(fit["intercept"], 2), round(fit["slope"], 4)]}
    else:
        block["trend"] = {"direction": "unknown", "days_used": len(daily), "note": "Fewer than 4 days with readings, so no trend is fitted."}
    prev = [float(r[key]) for r in prev_rows if r.get(key) is not None]
    if prev:
        pm = statistics.fmean(prev)
        block["vs_previous"] = {"previous_mean": round(pm, 1), "delta": round(statistics.fmean(vals) - pm, 1), "previous_n": len(prev)}
    block["outliers"] = modified_z_outliers(pts)
    # readings per hour of day, to show when this patient is usually measured and when values run high
    by_hour: Dict[int, List[float]] = defaultdict(list)
    for t, v in pts:
        by_hour[t.hour].append(v)
    block["by_hour"] = [{"hour": h, "mean": round(statistics.fmean(v), 1), "n": len(v)} for h, v in sorted(by_hour.items())]
    return block


def _medication(db: Session, user: User, days: int) -> Optional[Dict[str, Any]]:
    meds = db.query(Medication).filter_by(user_id=user.id, active=True).all()
    if not meds:
        return None
    today = date.today()
    start = today - timedelta(days=days - 1)
    logs = db.query(MedicationLog).filter(MedicationLog.user_id == user.id, MedicationLog.day >= start).all()
    taken = {(l.medication_id, l.day, l.time) for l in logs if l.status == "taken"}
    per_day_expected = sum(len(m.times or []) for m in meds)
    daily, slot_expected, slot_taken = [], defaultdict(int), defaultdict(int)
    for i in range(days):
        d = start + timedelta(days=i)
        got = sum(1 for m in meds for t in (m.times or []) if (m.id, d, t) in taken)
        daily.append({"day": d.isoformat(), "taken": got, "expected": per_day_expected})
        for m in meds:
            for t in (m.times or []):
                slot_expected[t] += 1
                slot_taken[t] += 1 if (m.id, d, t) in taken else 0
    exp, got = per_day_expected * days, sum(d["taken"] for d in daily)
    by_slot = [{"time": t, "taken_pct": round(slot_taken[t] / slot_expected[t] * 100)} for t in sorted(slot_expected)]
    weakest = min(by_slot, key=lambda s: s["taken_pct"]) if by_slot else None
    half = days // 2
    first, second = daily[:half], daily[half:]
    pct = lambda ds: round(sum(x["taken"] for x in ds) / max(1, sum(x["expected"] for x in ds)) * 100)  # noqa: E731
    return {"adherence_pct": round(min(1.0, got / exp) * 100) if exp else None, "daily": daily, "by_time": by_slot,
            "weakest_time": weakest if weakest and weakest["taken_pct"] < 80 else None,
            "first_half_pct": pct(first) if first else None, "second_half_pct": pct(second) if second else None,
            "medicines": [{"name": m.name, "dose": m.dose, "times": m.times or []} for m in meds]}


def _findings(blocks: Dict[str, Dict[str, Any]], bp_cats: Dict[str, int], med: Optional[Dict[str, Any]], coverage: Dict[str, Any], steps: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Plain findings, each with the numbers it rests on. Ordered most important first."""
    out: List[Dict[str, Any]] = []
    add = lambda level, title, evidence: out.append({"level": level, "title": title, "evidence": evidence})  # noqa: E731

    sys_b, dia_b = blocks.get("systolic"), blocks.get("diastolic")
    if sys_b and dia_b:
        total = sum(bp_cats.values()) or 1
        high = bp_cats.get("stage2", 0) + bp_cats.get("crisis", 0)
        if bp_cats.get("crisis"):
            add("critical", "Blood pressure readings in the crisis range", f"{bp_cats['crisis']} of {total} readings at or above 180/120 mmHg.")
        if high / total >= 0.5:
            add("high", "Blood pressure is mostly stage 2 or higher", f"{high} of {total} readings at or above 140/90 mmHg. Mean {round(sys_b['stats']['mean'])}/{round(dia_b['stats']['mean'])}.")
        elif (bp_cats.get("stage1", 0) + high) / total >= 0.5:
            add("moderate", "Blood pressure is above target for most readings", f"{bp_cats.get('stage1', 0) + high} of {total} readings at or above 130/80 mmHg.")
        t = sys_b.get("trend", {})
        if t.get("direction") == "rising":
            add("moderate", "Systolic pressure is climbing", f"{t['change_over_window']:+g} mmHg over the window (slope {t['slope_per_day']:+g} per day, p = {t['p']}, {t['days_used']} days).")
        if t.get("direction") == "falling" and sys_b["stats"]["mean"] < 100:
            add("moderate", "Systolic pressure is falling and already low", f"{t['change_over_window']:+g} mmHg over the window, mean {sys_b['stats']['mean']}.")
    hr = blocks.get("heart_rate")
    if hr:
        if hr["above"] >= 25:
            add("moderate", "Heart rate often above 100 bpm", f"{hr['above']}% of {hr['stats']['n']} readings above 100 bpm. These readings are not filtered for exercise.")
        if hr["below"] >= 25:
            add("moderate", "Heart rate often below 60 bpm", f"{hr['below']}% of {hr['stats']['n']} readings below 60 bpm.")
        if hr.get("trend", {}).get("direction") == "rising":
            t = hr["trend"]
            add("moderate", "Heart rate is trending up", f"{t['change_over_window']:+g} bpm over the window (p = {t['p']}).")
        if hr["stats"]["max"] >= 120 or hr["stats"]["min"] <= 40:
            add("high", "Heart rate reached an extreme", f"Range {hr['stats']['min']:g} to {hr['stats']['max']:g} bpm.")
    ox = blocks.get("blood_oxygen")
    if ox:
        if ox["stats"]["min"] < 90:
            add("critical", "Oxygen saturation fell below 90%", f"Lowest {ox['stats']['min']:g}%, {ox['below']}% of readings under 95%.")
        elif ox["below"] >= 20:
            add("moderate", "Oxygen often below 95%", f"{ox['below']}% of {ox['stats']['n']} readings below 95%.")
    gl = blocks.get("glucose")
    if gl and gl["above"] >= 30:
        add("moderate", "Glucose often above 139 mg/dL", f"{gl['above']}% of {gl['stats']['n']} readings, mean {gl['stats']['mean']} mg/dL. Meal timing is not recorded, so fasting and after-meal values are mixed.")
    if med:
        if med["adherence_pct"] is not None and med["adherence_pct"] < 80:
            add("high" if med["adherence_pct"] < 60 else "moderate", "Medication taken less than prescribed", f"{med['adherence_pct']}% of scheduled doses logged as taken.")
        if med.get("weakest_time"):
            w = med["weakest_time"]
            add("moderate", f"Most missed dose is the {w['time']} one", f"Taken {w['taken_pct']}% of the time.")
    if steps and steps.get("trend", {}).get("direction") == "falling":
        t = steps["trend"]
        add("info", "Daily steps are falling", f"{t['change_over_window']:+g} steps over the window (p = {t['p']}).")
    if coverage["days_with_readings"] < max(3, coverage["window_days"] // 3):
        add("info", "Little data in this window", f"Readings on {coverage['days_with_readings']} of {coverage['window_days']} days. Trends below are weak.")
    order = {"critical": 0, "high": 1, "moderate": 2, "info": 3}
    return sorted(out, key=lambda f: order[f["level"]])


def patient_analytics(db: Session, user: User, days: int = 14) -> Dict[str, Any]:
    days = max(7, min(90, days))
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(days=days)
    prev_dt = now - timedelta(days=days * 2)
    all_rows = _readings(db, user, prev_dt)
    rows = [r for r in all_rows if r["t"] >= start_dt]
    prev_rows = [r for r in all_rows if r["t"] < start_dt]
    start = start_dt.date()

    blocks: Dict[str, Dict[str, Any]] = {}
    for key in METRICS:
        b = _metric_block(key, rows, prev_rows, days, start)
        if b:
            blocks[key] = b

    cats: Dict[str, int] = defaultdict(int)
    for r in rows:
        c = bp_category(r["systolic"], r["diastolic"])
        if c:
            cats[c] += 1

    step_map = _steps_by_day(db, user, start_dt)
    steps = None
    if step_map:
        sv = list(step_map.values())
        fit = ols([(date.fromisoformat(d) - start).days for d in sorted(step_map)], [step_map[d] for d in sorted(step_map)])
        steps = {"stats": summarize([float(x) for x in sv]), "daily": [{"day": d, "steps": step_map[d]} for d in sorted(step_map)],
                 "trend": ({"slope_per_day": round(fit["slope"]), "change_over_window": round(fit["slope"] * (days - 1)), "p": round(fit["p"], 4),
                            "days_used": len(sv), "direction": (("rising" if fit["slope"] > 0 else "falling") if fit["p"] < 0.05 and abs(fit["slope"] * (days - 1)) >= 1500 else "steady")}
                           if fit else {"direction": "unknown", "days_used": len(sv)})}

    med = _medication(db, user, min(days, 30))
    days_with = {r["t"].date() for r in rows}
    coverage = {"window_days": days, "days_with_readings": len(days_with), "readings": len(rows),
                "last_reading": max(r["t"] for r in rows).isoformat() if rows else None}
    return {
        "window_days": days, "coverage": coverage, "metrics": blocks, "bp_categories": dict(cats), "steps": steps, "medication": med,
        "findings": _findings(blocks, dict(cats), med, coverage, steps),
        "method": "Figures come from the patient's own stored readings. Trends are least-squares lines on daily means and are reported only when p < 0.05 "
                  "and the change is large enough to matter. Reference ranges: AHA/ACC blood pressure, heart rate 60 to 100 bpm, oxygen 95% and above. "
                  "This supports a clinician's judgement and is not a diagnosis.",
        "generated_at": now.isoformat(),
    }


# ------------------------------------------------------------------ whole panel
def cohort_analytics(db: Session, snapshots: List[Dict[str, Any]], patients: List[Tuple[User, Optional[UserProfile]]], days: int = 14) -> Dict[str, Any]:
    """Panel-level figures for the doctor's dashboard: how well controlled the whole list is, and who needs a look first."""
    days = max(7, min(90, days))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    controlled = measured = 0
    adh: List[float] = []
    silent: List[Dict[str, Any]] = []
    per_patient: Dict[int, Dict[str, Any]] = {}
    ages: List[int] = []
    cond_count: Dict[str, int] = defaultdict(int)
    for (user, prof), snap in zip(patients, snapshots):
        rows = _readings(db, user, since)
        sy = [r["systolic"] for r in rows if r["systolic"]]
        di = [r["diastolic"] for r in rows if r["diastolic"]]
        hr = [r["heart_rate"] for r in rows if r["heart_rate"]]
        info: Dict[str, Any] = {"readings": len(rows), "days": len({r["t"].date() for r in rows})}
        if sy and di:
            measured += 1
            ms, md = statistics.fmean(sy), statistics.fmean(di)
            info["mean_bp"] = f"{round(ms)}/{round(md)}"
            if ms < 140 and md < 90:
                controlled += 1
        if hr:
            info["mean_hr"] = round(statistics.fmean(hr))
        per_patient[user.id] = info
        if snap.get("adherence") is not None:
            adh.append(snap["adherence"])
        last = snap["vitals"]["at"]
        if not last or (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() > 48 * 3600:
            silent.append({"patient_id": user.id, "name": snap["name"], "last": last})
        if prof and prof.age:
            ages.append(prof.age)
        for c in (prof.chronic_conditions or []) if prof else []:
            cond_count[str(c)] += 1

    # review order: a plain, explainable score, highest first
    weights = {"critical": 100, "monitor": 40, "no_data": 15, "stable": 0, "healthy": 0}
    queue = []
    for snap in snapshots:
        pts = weights[snap["group"]] + 30 * snap["active_alerts"]
        why = list(snap["reasons"])
        if snap["adherence"] is not None and snap["adherence"] < 70:
            pts += 20
            why.append(f"Medication taken {snap['adherence']}%")
        if snap["group"] == "no_data":
            why.append("No readings in the last 24 hours")
        if pts > 0:
            queue.append({"patient_id": snap["patient_id"], "name": snap["name"], "group": snap["group"], "score": pts, "why": why})
    queue.sort(key=lambda q: -q["score"])
    return {
        "window_days": days,
        "bp_control": {"controlled": controlled, "measured": measured, "pct": round(controlled / measured * 100) if measured else None},
        "adherence": {"mean": round(statistics.fmean(adh)) if adh else None, "below_70": sum(1 for a in adh if a < 70), "measured": len(adh)},
        "silent_48h": silent,
        "review_queue": queue[:8],
        "per_patient": per_patient,
        "conditions": sorted(({"name": k, "count": v} for k, v in cond_count.items()), key=lambda c: -c["count"])[:6],
        "mean_age": round(statistics.fmean(ages)) if ages else None,
    }
