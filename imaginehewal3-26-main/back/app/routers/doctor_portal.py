"""Doctor website API. A doctor sees only the patients whose profile names them (UserProfile.doctor_id),
and every number comes from the same tables the patient and caregiver apps write to
(VitalReading, HealthData, EmergencyEvent, Medication, CaregiverRelationship), so all three roles agree.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.hashing import verify_password
from app.auth.security import create_access_token, get_current_active_doctor, get_current_active_user
from app.database import get_db
from app.models.caregiver import CaregiverRelationship, Doctor
from app.models.safety import SosEvent
from app.services.emergency_service import OPEN, location_url
from app.models.health import FoodLog, HealthData
from app.models.iot_device import VitalReading
from app.models.notification import Notification
from app.models.safety import Medication, MedicationLog
from app.models.user import User, UserProfile
from app.realtime import hub
from app.services.care_snapshot import aware as _aware, iso as _iso, snapshot as _snapshot
from app.services import ai_features, clinical_analytics
from app.services.week_data import collect_week

router = APIRouter(prefix="/doctor-portal", tags=["doctor_portal"])

class LoginIn(BaseModel):
    doctor_id: str = Field(..., min_length=3, max_length=16)
    password: str = Field(..., min_length=1, max_length=128)


class MessageIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


def _my_patients(db: Session, doctor: Doctor) -> List[tuple]:
    return (db.query(User, UserProfile).join(UserProfile, UserProfile.user_id == User.id)
            .filter(UserProfile.doctor_id == doctor.doctor_id, User.is_caregiver == False).all())  # noqa: E712


def _owned_patient(db: Session, doctor: Doctor, patient_id: int):
    row = (db.query(User, UserProfile).join(UserProfile, UserProfile.user_id == User.id)
           .filter(User.id == patient_id, UserProfile.doctor_id == doctor.doctor_id).first())
    if not row:
        raise HTTPException(404, "Patient not found or not assigned to you")
    return row


def _sos(e: SosEvent, patient: str = None):
    """An emergency as the doctor sees it. Doctors watch; the patient or an approved caregiver clears it."""
    return {"id": e.id, "patient_id": e.user_id, "patient": patient, "reason": e.reason, "trigger": e.trigger,
            "status": e.status, "attempts": e.attempts, "escalated": e.escalated_at is not None,
            "location_url": location_url(e), "at": _iso(e.created_at), "resolved_at": _iso(e.resolved_at)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.doctor_id == body.doctor_id.strip().upper()).first()
    # same message for every failure so the form cannot be used to discover valid IDs
    if not doctor or not doctor.hashed_password or not verify_password(body.password, doctor.hashed_password):
        raise HTTPException(401, "Invalid doctor ID or password")
    if not doctor.is_active:
        raise HTTPException(403, "This doctor account is inactive")
    token = create_access_token({"sub": doctor.doctor_id}, user_type="doctor", expires_delta=timedelta(hours=12))
    return {"access_token": token, "token_type": "bearer", "doctor": {
        "doctor_id": doctor.doctor_id, "full_name": doctor.full_name,
        "specialization": doctor.specialization, "hospital": doctor.hospital}}


@router.get("/overview")
def overview(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    patients = [_snapshot(db, u, p) for u, p in _my_patients(db, doctor)]
    order = {"critical": 0, "monitor": 1, "stable": 2, "healthy": 3, "no_data": 4}
    patients.sort(key=lambda p: (order[p["group"]], p["name"].lower()))
    ids = [p["patient_id"] for p in patients]
    names = {p["patient_id"]: p["name"] for p in patients}
    events = (db.query(SosEvent).filter(SosEvent.user_id.in_(ids), SosEvent.status.in_(OPEN))
              .order_by(SosEvent.id.desc()).limit(20).all()) if ids else []
    count = lambda s: sum(1 for p in patients if p["group"] == s)  # noqa: E731
    return {
        "doctor": {"doctor_id": doctor.doctor_id, "full_name": doctor.full_name,
                   "specialization": doctor.specialization, "hospital": doctor.hospital},
        "stats": {"total": len(patients), "critical": count("critical"), "monitor": count("monitor"),
                  "stable": count("stable"), "healthy": count("healthy"), "no_data": count("no_data"), "active_alerts": len(events)},
        "alerts": [_sos(e, names.get(e.user_id)) for e in events],
        "patients": patients,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/cohort")
def cohort(days: int = 14, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Panel-level statistics: blood pressure control rate, medication adherence, who has gone quiet, and a review order."""
    pairs = _my_patients(db, doctor)
    snaps = [_snapshot(db, u, p) for u, p in pairs]
    return clinical_analytics.cohort_analytics(db, snaps, pairs, days)


@router.get("/patients/{patient_id}/analytics")
def patient_analytics(patient_id: int, days: int = 14, db: Session = Depends(get_db),
                      doctor: Doctor = Depends(get_current_active_doctor)):
    """Real statistics over this patient's stored readings: summaries, fitted trends with p-values, time in range, outliers, adherence."""
    user, _ = _owned_patient(db, doctor, patient_id)
    return clinical_analytics.patient_analytics(db, user, days)


@router.get("/patients/{patient_id}")
def patient_detail(patient_id: int, db: Session = Depends(get_db),
                   doctor: Doctor = Depends(get_current_active_doctor)):
    user, profile = _owned_patient(db, doctor, patient_id)
    snap = _snapshot(db, user, profile)

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    readings = (db.query(VitalReading).filter(VitalReading.user_id == user.id, VitalReading.timestamp >= since)
                .order_by(VitalReading.timestamp.desc()).limit(120).all())
    series = [{"at": _iso(r.timestamp), "heart_rate": r.heart_rate, "blood_oxygen": r.blood_oxygen,
               "systolic": r.blood_pressure_systolic, "diastolic": r.blood_pressure_diastolic}
              for r in reversed(readings)]

    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    rows = db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= week_start).all()
    by_day: Dict[str, int] = {}
    for r in rows:
        d = _aware(r.date).date().isoformat()
        by_day[d] = max(by_day.get(d, 0), r.steps or 0)
    steps = [{"day": d, "steps": by_day[d]} for d in sorted(by_day)]

    meds = db.query(Medication).filter_by(user_id=user.id, active=True).all()
    today = datetime.now().date()
    taken = {(l.medication_id, l.time) for l in db.query(MedicationLog).filter(
        MedicationLog.user_id == user.id, MedicationLog.day == today, MedicationLog.status == "taken").all()}
    medications = [{"name": m.name, "dose": m.dose, "doses": [{"time": t, "taken": (m.id, t) in taken} for t in (m.times or [])]}
                   for m in meds]

    meals = db.query(FoodLog).filter(FoodLog.user_id == user.id).order_by(FoodLog.created_at.desc()).limit(6).all()
    events = (db.query(SosEvent).filter(SosEvent.user_id == user.id).order_by(SosEvent.id.desc()).limit(10).all())
    sent = (db.query(Notification).filter(Notification.user_id == user.id, Notification.sender_type == "doctor",
                                          Notification.sender_id == doctor.id)
            .order_by(Notification.created_at.desc()).limit(10).all())
    return {
        "patient": snap,
        "profile": {"weight": profile.weight, "height": profile.height, "family_history": profile.family_history or [],
                    "emergency_contact": profile.emergency_contact_name},
        "vitals_series": series,
        "steps_week": steps,
        "medications": medications,
        "meals": [{"meal": m.meal_type, "score": m.diet_score,
                   "summary": ((m.ai_analysis or {}).get("analysis") if isinstance(m.ai_analysis, dict) else None),
                   "at": _iso(m.created_at)} for m in meals],
        "emergencies": [_sos(e, snap["name"]) for e in events],
        "messages": [{"message": n.message, "at": _iso(n.created_at)} for n in sent],
    }


@router.get("/patients/{patient_id}/brief")
def patient_brief(patient_id: int, refresh: bool = False, db: Session = Depends(get_db),
                  doctor: Doctor = Depends(get_current_active_doctor)):
    """A short AI-written brief of this patient's last 7 days. Built only from their real readings and sent to the AI without any
    name or contact detail. It is a reading aid for the clinician, not a diagnosis."""
    user, _ = _owned_patient(db, doctor, patient_id)
    if refresh:
        ai_features.forget("brief", patient_id)

    def make():
        data = collect_week(user)
        out = ai_features.clinician_brief(data)
        keep = ("avg_hr", "min_hr", "max_hr", "avg_bp", "max_systolic", "bp_readings", "avg_oxygen", "min_oxygen", "avg_steps", "step_days",
                "adherence", "avg_meal_score", "meals_logged")
        out["figures"] = {k: data[k] for k in keep if k in data}
        out["generated_at"] = datetime.now(timezone.utc).isoformat()
        return out
    return ai_features.cached(("brief", patient_id), 1800, make)


@router.post("/patients/{patient_id}/message")
async def send_message(patient_id: int, body: MessageIn, db: Session = Depends(get_db),
                       doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    text = body.message.strip()
    if not text:
        raise HTTPException(422, "Message is empty")
    n = Notification(user_id=user.id, notification_type="doctor", title=f"Message from {doctor.full_name}",
                     message=text, sender_id=doctor.id, sender_type="doctor")
    db.add(n)
    db.commit()
    await hub.send(user.id, {"type": "notification.new", "id": n.id, "title": n.title, "message": text})
    return {"ok": True, "id": n.id}


# ------------------------------------------------------------------ patient side: choose your own doctor
patient_router = APIRouter(prefix="/my-doctor", tags=["my_doctor"])


class LinkIn(BaseModel):
    doctor_id: str = Field(..., min_length=3, max_length=16)


def _doctor_card(d: Optional[Doctor]):
    return None if not d else {"doctor_id": d.doctor_id, "full_name": d.full_name, "specialization": d.specialization, "hospital": d.hospital}


@patient_router.get("")
def my_doctor(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    doc = db.query(Doctor).filter(Doctor.doctor_id == prof.doctor_id).first() if prof and prof.doctor_id else None
    return {"doctor": _doctor_card(doc)}


@patient_router.put("")
def link_doctor(body: LinkIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Only the patient can share their health with a doctor. The doctor sees them from this moment."""
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not prof:
        raise HTTPException(400, "Finish setting up your profile first")
    doc = db.query(Doctor).filter(Doctor.doctor_id == body.doctor_id.strip().upper(), Doctor.is_active == True).first()  # noqa: E712
    if not doc:
        raise HTTPException(404, "No doctor with that ID. Check it with your clinic.")
    prof.doctor_id = doc.doctor_id
    db.commit()
    return {"doctor": _doctor_card(doc)}


@patient_router.delete("")
def unlink_doctor(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if prof and prof.doctor_id:
        prof.doctor_id = None
        db.commit()
    return {"doctor": None}
