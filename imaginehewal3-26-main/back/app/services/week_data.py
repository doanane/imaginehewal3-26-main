"""The last seven days of one person's real data, as plain numbers, for the AI summaries.

De-identified on purpose: no name, email, phone or ID is ever included, only age and conditions, because this text is sent to an
outside AI service.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from app.models.health import FoodLog, HealthData
from app.models.iot_device import VitalReading
from app.models.user import User, UserProfile
from app.services.care_snapshot import aware, snapshot
from app.services.par import par
from app.services.risk_service import med_adherence


def _avg(xs):
    return sum(xs) / len(xs) if xs else None


def collect_week(user: User) -> Dict[str, Any]:
    uid = user.id
    now = datetime.now(timezone.utc)
    since7, since14 = now - timedelta(days=7), now - timedelta(days=14)

    def prof_snap(d):
        prof = d.query(UserProfile).filter_by(user_id=uid).first()
        return prof, snapshot(d, user, prof)
    (prof, snap), vitals, steps, meals, adherence = par(
        prof_snap,
        lambda d: d.query(VitalReading).filter(VitalReading.user_id == uid, VitalReading.timestamp >= since14).all(),
        lambda d: d.query(HealthData).filter(HealthData.user_id == uid, HealthData.date >= since14).all(),
        lambda d: d.query(FoodLog).filter(FoodLog.user_id == uid, FoodLog.created_at >= since7).all(),
        lambda d: med_adherence(d, uid),
    )
    out: Dict[str, Any] = {"age": prof.age if prof else None, "conditions": [str(c) for c in (prof.chronic_conditions or [])][:6] if prof else [],
                           "status": snap["status"], "reasons": snap["reasons"]}
    this = [v for v in vitals if aware(v.timestamp) >= since7]
    prev = [v for v in vitals if aware(v.timestamp) < since7]
    pick = lambda rows, col: [getattr(v, col) for v in rows if getattr(v, col)]       # noqa: E731
    hr, sy, di, ox = pick(this, "heart_rate"), pick(this, "blood_pressure_systolic"), pick(this, "blood_pressure_diastolic"), pick(this, "blood_oxygen")
    if hr:
        out.update(avg_hr=round(_avg(hr)), min_hr=min(hr), max_hr=max(hr), hr_readings=len(hr))
        if pick(prev, "heart_rate"):
            out["avg_hr_last_week"] = round(_avg(pick(prev, "heart_rate")))
    if sy and di:
        out.update(avg_systolic=round(_avg(sy)), avg_diastolic=round(_avg(di)), max_systolic=max(sy), bp_readings=len(sy), avg_bp=f"{round(_avg(sy))}/{round(_avg(di))}")
        psy, pdi = pick(prev, "blood_pressure_systolic"), pick(prev, "blood_pressure_diastolic")
        if psy and pdi:
            out["avg_bp_last_week"] = f"{round(_avg(psy))}/{round(_avg(pdi))}"
    if ox:
        out.update(avg_oxygen=round(_avg(ox), 1), min_oxygen=round(min(ox), 1))
    by_day: Dict[str, int] = {}
    prev_days: Dict[str, int] = {}
    for h in steps:
        if h.steps:
            day = aware(h.date).date().isoformat()
            target = by_day if aware(h.date) >= since7 else prev_days
            target[day] = max(target.get(day, 0), h.steps)
    if by_day:
        out.update(avg_steps=round(_avg(list(by_day.values()))), step_days=len(by_day), best_steps=max(by_day.values()),
                   daily_steps=[{"day": d, "steps": by_day[d]} for d in sorted(by_day)])
        if prev_days:
            out["avg_steps_last_week"] = round(_avg(list(prev_days.values())))
    scores = [m.diet_score for m in meals if m.diet_score is not None]
    if scores:
        out.update(avg_meal_score=round(_avg(scores)), meals_logged=len(scores))
    if adherence is not None:
        out["adherence"] = round(adherence * 100)
    days_with = {aware(v.timestamp).date() for v in this}
    out["readings_total"] = len(this)
    out["days_with_readings"] = len(days_with)
    out["has_data"] = any(k in out for k in ("avg_hr", "avg_bp", "avg_steps", "avg_meal_score", "adherence", "avg_oxygen"))
    return out
