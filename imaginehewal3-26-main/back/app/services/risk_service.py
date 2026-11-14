"""Health risk screening, anomaly detection and recommendations. Local, free, explainable.

Method (stated to the user in the app): guideline-based screening using AHA/ACC blood-pressure categories, ADA
glucose cut-offs and WHO BMI classes, plus a personal-baseline check on heart rate (robust median/MAD).
It is NOT a diagnosis and NOT a trained machine-learning model: there is no labelled dataset yet. Every factor
carries its own plain-language explanation so a clinician can see exactly why a tier was given.
"""
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.behavior import BehaviorAction, BehaviorPlan
from app.models.caregiver import CaregiverRelationship
from app.models.health import FoodLog, HealthData
from app.models.iot_device import VitalReading
from app.models.notification import Notification
from app.models.safety import Medication, MedicationLog, SosEvent
from app.models.user import User, UserProfile
from app.services.emergency_service import parse_bp

METHOD = ("Guideline-based screening (AHA/ACC blood pressure categories, ADA glucose cut-offs, WHO BMI classes) plus a "
          "personal-baseline check on heart rate. It is not a diagnosis and it is not a trained machine-learning model.")
DISCLAIMER = "This is a screening aid. It does not replace advice from your clinician."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    return None if dt is None else (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc))


# ------------------------------------------------------------------ inputs
def gather(db: Session, user: User) -> dict:
    prof = db.query(UserProfile).filter_by(user_id=user.id).first()
    since30 = _now() - timedelta(days=30)
    rows = (db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= since30)
            .order_by(HealthData.date.desc()).all())
    first = lambda attr: next((getattr(r, attr) for r in rows if getattr(r, attr) not in (None, "", 0)), None)
    bp = first("blood_pressure") or (prof.blood_pressure if prof else None)
    sys_, dia_ = parse_bp(bp)
    glucose = first("blood_glucose") or (prof.blood_glucose if prof else None)
    weight, height = (prof.weight if prof else None), (prof.height if prof else None)
    bmi = prof.bmi if prof and prof.bmi else (round(weight / ((height / 100) ** 2), 1) if weight and height and height > 50 else None)

    since7 = _now() - timedelta(days=7)
    r7 = [r for r in rows if _utc(r.date) and _utc(r.date) >= since7]
    steps = [r.steps for r in r7 if r.steps]
    sleep = [r.sleep_time for r in r7 if r.sleep_time]
    vit24 = db.query(VitalReading).filter(VitalReading.user_id == user.id, VitalReading.timestamp >= _now() - timedelta(hours=24)).all()
    hr24 = [v.heart_rate for v in vit24 if v.heart_rate]
    spo24 = [v.blood_oxygen for v in vit24 if v.blood_oxygen]
    diet = [f.diet_score for f in db.query(FoodLog).filter(FoodLog.user_id == user.id, FoodLog.created_at >= since7).all() if f.diet_score is not None]
    conds = [str(c).lower() for c in (prof.chronic_conditions or [])] if prof and isinstance(prof.chronic_conditions, list) else []
    return {
        "age": prof.age if prof else None, "bmi": bmi, "systolic": sys_, "diastolic": dia_, "glucose": glucose,
        "conditions": conds, "family_history": bool(prof and prof.family_history),
        "avg_hr": round(statistics.mean(hr24)) if hr24 else (prof.heart_rate if prof and prof.heart_rate else None),
        "avg_spo2": round(statistics.mean(spo24), 1) if spo24 else None,
        "avg_steps": round(statistics.mean(steps)) if steps else None,
        "avg_sleep_min": round(statistics.mean(sleep)) if sleep else None,
        "avg_diet": round(statistics.mean(diet)) if diet else None,
        "med_adherence": med_adherence(db, user.id),
        "smoking": db.query(BehaviorPlan).filter_by(user_id=user.id, behavior="smoking", active=True).first() is not None,
    }


# ------------------------------------------------------------------ scoring
def bp_category(s: Optional[int], d: Optional[int]) -> Optional[str]:
    if s is None or d is None:
        return None
    if s >= 180 or d >= 120:
        return "crisis"
    if s >= 140 or d >= 90:
        return "stage2"
    if s >= 130 or d >= 80:
        return "stage1"
    if s >= 120:
        return "elevated"
    return "normal"


def score(i: dict) -> dict:
    F: List[dict] = []
    add = lambda key, label, detail, pts: F.append({"key": key, "label": label, "detail": detail, "points": pts})

    cat = bp_category(i["systolic"], i["diastolic"])
    bp_txt = f"{i['systolic']}/{i['diastolic']} mmHg"
    if cat == "crisis": add("bp", "Blood pressure in the crisis range", f"{bp_txt}. Seek urgent medical advice (AHA/ACC).", 30)
    elif cat == "stage2": add("bp", "High blood pressure, stage 2", f"{bp_txt}. At or above 140/90 (AHA/ACC).", 16)
    elif cat == "stage1": add("bp", "High blood pressure, stage 1", f"{bp_txt}. Between 130/80 and 139/89 (AHA/ACC).", 8)
    elif cat == "elevated": add("bp", "Blood pressure slightly raised", f"{bp_txt}. Systolic 120 to 129 (AHA/ACC).", 4)

    g = i["glucose"]
    if g:
        if g >= 200: add("glucose", "Blood sugar is high", f"{g} mg/dL. 200 or above (ADA).", 18)
        elif g >= 140: add("glucose", "Blood sugar is raised", f"{g} mg/dL. 140 to 199 (ADA).", 10)
        elif g >= 100: add("glucose", "Blood sugar slightly raised", f"{g} mg/dL. 100 to 139 may point to pre-diabetes if measured fasting (ADA).", 5)

    b = i["bmi"]
    if b:
        if b >= 35: add("bmi", "Body weight is in the obese class II-III range", f"BMI {b} (WHO).", 13)
        elif b >= 30: add("bmi", "Body weight is in the obese range", f"BMI {b} (WHO).", 9)
        elif b >= 25: add("bmi", "Body weight is above the healthy range", f"BMI {b} (WHO).", 5)

    for key, words, pts, label in (("diabetes", ("diabet",), 8, "Living with diabetes"),
                                   ("hypertension", ("hypertens", "high blood"), 8, "Living with high blood pressure"),
                                   ("cardio", ("cardio", "heart"), 10, "Heart condition")):
        if any(w in c for c in i["conditions"] for w in words):
            add(key, label, "A diagnosed condition raises your baseline risk.", pts)

    a = i["age"]
    if a and a >= 65: add("age", "Age 65 or older", "Risk rises with age.", 8)
    elif a and a >= 50: add("age", "Age 50 to 64", "Risk rises with age.", 4)
    if i["family_history"]: add("family", "Family history", "A close relative has had a related condition.", 3)

    if i["avg_hr"]:
        if i["avg_hr"] > 100: add("hr", "Resting heart rate is high", f"Average {i['avg_hr']} bpm over the last day (over 100 is tachycardia).", 8)
        elif i["avg_hr"] < 50: add("hr", "Resting heart rate is low", f"Average {i['avg_hr']} bpm over the last day.", 4)
    if i["avg_spo2"] and i["avg_spo2"] < 92: add("spo2", "Blood oxygen is low", f"Average {i['avg_spo2']}% over the last day.", 12)
    if i["avg_steps"] is not None:
        if i["avg_steps"] < 3000: add("steps", "Very little daily movement", f"About {i['avg_steps']} steps a day this week.", 6)
        elif i["avg_steps"] < 5000: add("steps", "Low daily movement", f"About {i['avg_steps']} steps a day this week.", 3)
    if i["avg_sleep_min"] and i["avg_sleep_min"] < 360: add("sleep", "Short sleep", f"About {round(i['avg_sleep_min'] / 60, 1)} hours a night this week.", 4)
    if i["avg_diet"] is not None and i["avg_diet"] < 50: add("diet", "Meals scoring low for your conditions", f"Average meal score {i['avg_diet']} out of 100 this week.", 4)
    if i["med_adherence"] is not None and i["med_adherence"] < 0.7: add("meds", "Missing medicine doses", f"{round(i['med_adherence'] * 100)}% of doses taken this week.", 6)
    if i["smoking"]: add("smoking", "Smoking", "You are working on cutting down. Every cigarette less helps.", 6)

    total = min(100, sum(f["points"] for f in F))
    tier = "low" if total < 20 else "moderate" if total < 40 else "high" if total < 60 else "urgent"
    if cat == "crisis" or (i["avg_spo2"] and i["avg_spo2"] < 88):
        tier = "urgent"
    F.sort(key=lambda f: -f["points"])
    missing = [m for ok, m in ((i["systolic"] is not None, "blood pressure"), (i["glucose"], "blood glucose"), (i["bmi"], "weight and height"),
                               (i["avg_hr"], "heart rate (connect your watch)"), (i["avg_steps"] is not None, "daily steps")) if not ok]
    labels = {"low": "Low risk", "moderate": "Moderate risk", "high": "High risk", "urgent": "Needs prompt attention"}
    summary = {"low": "Your readings look steady. Keep up your daily habits.",
               "moderate": "A few things are worth improving. Small daily steps will help.",
               "high": "Several readings need attention. Please speak to your clinician soon.",
               "urgent": "Some readings are in a range that needs prompt medical attention."}[tier]
    return {"tier": tier, "label": labels[tier], "score": total, "summary": summary, "factors": F, "missing": missing}


def anomalies(db: Session, user: User) -> List[dict]:
    """Heart rate far above this person's own normal, sustained over the last readings."""
    since = _now() - timedelta(days=7)
    vs = (db.query(VitalReading).filter(VitalReading.user_id == user.id, VitalReading.heart_rate.isnot(None), VitalReading.timestamp >= since)
          .order_by(VitalReading.timestamp.asc()).all())
    if len(vs) < 20:
        return []
    recent, base = vs[-3:], [v.heart_rate for v in vs[:-3]]
    med = statistics.median(base)
    mad = statistics.median([abs(x - med) for x in base]) or 1.0
    limit = med + 3 * 1.4826 * mad
    if all(v.heart_rate > limit and v.heart_rate > 100 for v in recent):
        now_hr = round(statistics.mean(v.heart_rate for v in recent))
        return [{"key": "hr_spike", "label": "Heart rate is well above your normal",
                 "detail": f"{now_hr} bpm now, compared with your usual {round(med)} bpm."}]
    return []


def assess(db: Session, user: User) -> dict:
    i = gather(db, user)
    out = score(i)
    out["anomalies"] = anomalies(db, user)
    out["inputs"] = {k: i[k] for k in ("age", "bmi", "systolic", "diastolic", "glucose", "avg_hr", "avg_spo2", "avg_steps", "avg_diet", "med_adherence")}
    out["method"], out["disclaimer"] = METHOD, DISCLAIMER
    out["generated_at"] = _now().isoformat()
    return out


# ------------------------------------------------------------------ medicines
def med_adherence(db: Session, user_id: int, days: int = 7) -> Optional[float]:
    meds = db.query(Medication).filter_by(user_id=user_id, active=True).all()
    if not meds:
        return None
    today = date.today()
    start = today - timedelta(days=days - 1)
    expected = sum(len(m.times or []) for m in meds) * days
    taken = db.query(MedicationLog).filter(MedicationLog.user_id == user_id, MedicationLog.day >= start, MedicationLog.status == "taken").count()
    return min(1.0, taken / expected) if expected else None


# ------------------------------------------------------------------ recommendations
REC = {
    "bp": ("Cut back on salt and check your blood pressure", "Use less stock cube and salted fish, add vegetables, and measure at the same time each day.", "/(patient)/health/log-health"),
    "glucose": ("Keep starchy portions smaller", "Fill half your plate with vegetables, and walk for 10 to 15 minutes after meals.", "/(patient)/(tabs)/assistant"),
    "bmi": ("Aim for small, steady changes", "Smaller portions of rice, banku and fufu, and more movement most days, work better than strict diets.", "/(patient)/(tabs)/today"),
    "steps": ("Add a short walk", "A 10-minute walk after a meal is a good first step.", "/(patient)/(tabs)/today"),
    "sleep": ("Protect your sleep", "A regular bedtime and no screens for 30 minutes before bed help.", "/(patient)/(tabs)/assistant"),
    "diet": ("Choose lighter meals", "Try red red with less oil, or grilled fish with kontomire stew.", "/(patient)/nutrition/meal"),
    "meds": ("Take your medicines on time", "Link each dose to a daily routine such as breakfast, and turn on reminders.", "/(patient)/medications"),
    "smoking": ("Keep going with cutting down", "Delay the first cigarette and swap one a day for water or a walk.", "/(patient)/(tabs)/today"),
    "hr": ("Rest and recheck your heart rate", "Sit quietly for 5 minutes and check again. If it stays high or you feel unwell, speak to your clinician.", "/(patient)/(tabs)/insights"),
    "spo2": ("Check your oxygen level and speak to a clinician", "A low reading that stays low needs medical advice.", "/(patient)/(tabs)/insights"),
}


def recommendations(db: Session, user: User, result: Optional[dict] = None) -> List[dict]:
    result = result or assess(db, user)
    recs: List[dict] = []
    for f in result["anomalies"]:
        recs.append({"id": "anomaly", "priority": 0, "title": f["label"], "why": f["detail"], "action": "Rest, then recheck. Call your care team if you feel unwell.", "route": "/(patient)/(tabs)/insights"})
    for n, f in enumerate(result["factors"]):
        if f["key"] in REC and len([r for r in recs if r["id"] != "anomaly"]) < 3:
            t, a, route = REC[f["key"]]
            recs.append({"id": f["key"], "priority": 1 + n, "title": t, "why": f["detail"], "action": a, "route": route})
    # behaviour loop and logging nudges
    if not db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).first():
        recs.append({"id": "plan", "priority": 8, "title": "Choose a daily goal", "why": "You have no goal yet.", "action": "Pick one small habit and get one step a day.", "route": "/(patient)/(tabs)/today"})
    if result["missing"]:
        recs.append({"id": "data", "priority": 9, "title": "Add missing readings", "why": "Your risk check improves with: " + ", ".join(result["missing"][:3]) + ".", "action": "Log a reading or connect your watch.", "route": "/(patient)/health/log-health"})
    recs.sort(key=lambda r: r["priority"])
    return recs[:6]


def check_alerts(db: Session, user: User) -> Optional[Notification]:
    """After a new reading: tell the patient when risk is high or the heart rate is unusual. At most once per 6 hours."""
    res = assess(db, user)
    if res["tier"] not in ("high", "urgent") and not res["anomalies"]:
        return None
    since = _now() - timedelta(hours=6)
    if db.query(Notification).filter(Notification.user_id == user.id, Notification.notification_type == "risk_alert", Notification.created_at >= since).first():
        return None
    title = res["anomalies"][0]["label"] if res["anomalies"] else res["label"]
    msg = res["anomalies"][0]["detail"] if res["anomalies"] else (res["factors"][0]["detail"] if res["factors"] else res["summary"])
    n = Notification(user_id=user.id, notification_type="risk_alert", title=title, message=msg, sender_type="system")
    db.add(n)
    db.commit()
    from app.realtime import hub
    hub.send_from_thread(user.id, {"type": "notification.new", "notification": {"notification_type": "risk_alert", "title": title, "message": msg, "is_read": False}})
    return n


def patients_overview(db: Session, caregiver: User) -> List[dict]:
    out = []
    for r in db.query(CaregiverRelationship).filter(CaregiverRelationship.caregiver_id == caregiver.id, CaregiverRelationship.status == "approved").all():
        p = db.query(User).filter(User.id == r.patient_id).first()
        if not p:
            continue
        res = assess(db, p)
        last = db.query(VitalReading).filter_by(user_id=p.id).order_by(VitalReading.timestamp.desc()).first()
        open_sos = db.query(SosEvent).filter(SosEvent.user_id == p.id, SosEvent.status.in_(("pending", "active", "acknowledged", "escalated"))).first()
        out.append({"patient_id": p.id, "name": f"{p.first_name or ''} {p.last_name or ''}".strip() or p.username or p.email,
                    "tier": res["tier"], "label": res["label"], "score": res["score"], "top_factor": res["factors"][0]["label"] if res["factors"] else None,
                    "anomalies": res["anomalies"], "last_heart_rate": last.heart_rate if last else None,
                    "last_reading_at": _utc(last.timestamp).isoformat() if last and last.timestamp else None, "emergency_open": bool(open_sos)})
    rank = {"urgent": 0, "high": 1, "moderate": 2, "low": 3}
    out.sort(key=lambda x: (not x["emergency_open"], rank[x["tier"]]))
    return out
