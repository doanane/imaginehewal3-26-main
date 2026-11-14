"""One-page clinician summary: the context a clinic needs, in one place, in plain text and structured form.

Coordinated care: the patient (or an approved caregiver, with an access-log entry) can produce it. Wellbeing answers are
included ONLY when the patient asks for them for their own export; they are never included for anyone else.
"""
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.behavior import BehaviorAction, BehaviorPlan
from app.models.health import FoodLog, HealthData
from app.models.iot_device import VitalReading
from app.models.safety import Medication, SosEvent
from app.models.user import User, UserProfile
from app.services import behavior_engine as eng
from app.services import risk_service, wellbeing_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _avg(xs: List[float]) -> Optional[float]:
    return round(statistics.mean(xs), 1) if xs else None


def build(db: Session, patient: User, days: int = 30, include_wellbeing: bool = False) -> dict:
    days = max(7, min(days, 90))
    since = _now() - timedelta(days=days)
    prof = db.query(UserProfile).filter_by(user_id=patient.id).first()
    name = f"{patient.first_name or ''} {patient.last_name or ''}".strip() or (prof.full_name if prof else None) or patient.username

    vs = db.query(VitalReading).filter(VitalReading.user_id == patient.id, VitalReading.timestamp >= since).all()
    hr = [v.heart_rate for v in vs if v.heart_rate]
    spo = [v.blood_oxygen for v in vs if v.blood_oxygen]
    bp = [(v.blood_pressure_systolic, v.blood_pressure_diastolic) for v in vs if v.blood_pressure_systolic and v.blood_pressure_diastolic]
    hd = db.query(HealthData).filter(HealthData.user_id == patient.id, HealthData.date >= since).all()
    steps = [h.steps for h in hd if h.steps]
    sleep = [h.sleep_time / 60 for h in hd if h.sleep_time]
    logged_bp = [h.blood_pressure for h in sorted(hd, key=lambda r: r.date, reverse=True) if h.blood_pressure][:5]

    risk = risk_service.assess(db, patient)
    meds = db.query(Medication).filter_by(user_id=patient.id, active=True).all()
    adherence = risk_service.med_adherence(db, patient.id)

    meals = db.query(FoodLog).filter(FoodLog.user_id == patient.id, FoodLog.created_at >= since).all()
    scores = [m.diet_score for m in meals if m.diet_score is not None]
    kcal = [(m.nutrients or {}).get("calories", 0) for m in meals]

    today = date.today()
    plans = []
    for p in db.query(BehaviorPlan).filter_by(user_id=patient.id, active=True).all():
        acts = db.query(BehaviorAction).filter(BehaviorAction.plan_id == p.id, BehaviorAction.status != "pending").all()
        st = {a.action_date: a.status for a in acts}
        vals = {a.action_date: a.value_done for a in acts if a.value_done is not None}
        o = eng.outcomes(st, vals, p.baseline_value, eng.BEHAVIORS[p.behavior]["direction"], p.start_date, today)
        plans.append({"behavior": p.behavior, "unit": p.unit, "baseline": p.baseline_value, "goal": p.goal_value,
                      "weeks_persisted": o["weeks_persisted"], "weeks_tracked": o["weeks_tracked"], "lapses": o["lapses"],
                      "avg_days_to_recover": o["avg_days_to_recover"], "change_pct": o["behaviour_change_pct_vs_baseline"]})

    sos = db.query(SosEvent).filter(SosEvent.user_id == patient.id, SosEvent.created_at >= since).all()
    emergencies = {"count": len(sos), "escalated": sum(1 for e in sos if e.status == "escalated" or e.escalated_at),
                   "cancelled_false_alarms": sum(1 for e in sos if e.status == "cancelled")}

    out = {
        "patient": {"name": name, "age": prof.age if prof else None, "gender": prof.gender if prof else None,
                    "conditions": prof.chronic_conditions if prof and isinstance(prof.chronic_conditions, list) else []},
        "period_days": days, "generated_at": _now().isoformat(),
        "vitals": {"readings": len(vs), "heart_rate": {"avg": _avg(hr), "min": min(hr) if hr else None, "max": max(hr) if hr else None},
                   "blood_oxygen_avg": _avg(spo), "watch_blood_pressure": [f"{s}/{d}" for s, d in bp[-5:]], "logged_blood_pressure": logged_bp},
        "activity": {"avg_daily_steps": round(statistics.mean(steps)) if steps else None, "avg_sleep_hours": _avg(sleep)},
        "risk": {"tier": risk["tier"], "label": risk["label"], "score": risk["score"],
                 "reasons": [f["label"] for f in risk["factors"][:5]], "anomalies": [a["label"] for a in risk["anomalies"]], "method": risk["method"]},
        "medicines": {"list": [{"name": m.name, "dose": m.dose, "times": m.times} for m in meds], "weekly_adherence": adherence},
        "meals": {"logged": len(meals), "avg_meal_score": round(statistics.mean(scores)) if scores else None,
                  "avg_calories_per_meal": round(statistics.mean(kcal)) if kcal else None},
        "behaviour": plans, "emergencies": emergencies, "wellbeing": None,
        "disclaimer": "Generated by HEWAL3 from information the patient recorded or shared. Estimates and screening results support, and do not replace, clinical judgement.",
    }
    if include_wellbeing:
        s = wellbeing_service.summary(db, patient)
        if s["history"]:
            last = s["history"][-1]
            out["wellbeing"] = {"latest_phq2": last["phq2"], "latest_gad2": last["gad2"], "trend": s["trend"], "checkins": s["count"],
                                "note": "PHQ-2 and GAD-2 screening scores. A total of 3 or more on either is a positive screen, not a diagnosis."}
    out["text"] = to_text(out)
    return out


def to_text(s: dict) -> str:
    p, v, a, r = s["patient"], s["vitals"], s["activity"], s["risk"]
    L = [f"HEWAL3 health summary for {p['name']}", f"Last {s['period_days']} days, generated {s['generated_at'][:10]}", ""]
    L.append(f"Age {p['age'] or 'not recorded'}. Conditions: {', '.join(p['conditions']) or 'none recorded'}.")
    L.append(f"Screening result: {r['label']} (score {r['score']} of 100).")
    if r["reasons"]: L.append("Main reasons: " + "; ".join(r["reasons"]) + ".")
    if r["anomalies"]: L.append("Unusual: " + "; ".join(r["anomalies"]) + ".")
    L.append("")
    hr = v["heart_rate"]
    L.append(f"Heart rate: average {hr['avg'] or 'n/a'} bpm (range {hr['min'] or 'n/a'} to {hr['max'] or 'n/a'}), {v['readings']} watch readings.")
    if v["blood_oxygen_avg"]: L.append(f"Blood oxygen average {v['blood_oxygen_avg']}%.")
    if v["logged_blood_pressure"]: L.append("Recent logged blood pressure: " + ", ".join(v["logged_blood_pressure"]) + ".")
    L.append(f"Daily steps average {a['avg_daily_steps'] or 'n/a'}. Sleep average {a['avg_sleep_hours'] or 'n/a'} hours.")
    m = s["medicines"]
    if m["list"]:
        L.append("Medicines: " + "; ".join(f"{x['name']}{' ' + x['dose'] if x['dose'] else ''} at {', '.join(x['times'])}" for x in m["list"]) + ".")
        if m["weekly_adherence"] is not None: L.append(f"Doses taken this week: {round(m['weekly_adherence'] * 100)}%.")
    me = s["meals"]
    if me["logged"]: L.append(f"Meals logged: {me['logged']}. Average meal score {me['avg_meal_score']} of 100.")
    for b in s["behaviour"]:
        rec = f", recovers from setbacks in {b['avg_days_to_recover']} days" if b["avg_days_to_recover"] is not None else ""
        L.append(f"Goal ({b['behavior']}): kept going {b['weeks_persisted']} of {b['weeks_tracked']} weeks, {b['lapses']} setbacks{rec}.")
    e = s["emergencies"]
    if e["count"]: L.append(f"Emergency alerts: {e['count']} ({e['escalated']} escalated, {e['cancelled_false_alarms']} cancelled as false alarms).")
    if s["wellbeing"]:
        w = s["wellbeing"]; L.append(f"Wellbeing screening (patient chose to include): PHQ-2 {w['latest_phq2']}, GAD-2 {w['latest_gad2']}, trend {w['trend'] or 'n/a'}.")
    L += ["", s["disclaimer"]]
    return "\n".join(L)
