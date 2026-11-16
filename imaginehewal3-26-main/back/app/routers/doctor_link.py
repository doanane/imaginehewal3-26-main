"""Doctor and patient connect in either direction, and the patient always has the last word.

  Patient types the doctor's ID        PUT  /my-doctor                    (already existed: the patient chose the doctor, so it takes effect at once)
  Doctor asks to follow a patient      GET  /doctor-portal/find?q=        exact patient ID or email only, shows a name and nothing else
                                       POST /doctor-portal/link-requests  sends the request; the patient is told in the app
                                       GET  /doctor-portal/link-requests  the doctor's own requests and their answers
                                       DELETE /doctor-portal/link-requests/{id}  withdraw a pending request
  Patient answers                      GET  /my-doctor/requests           requests waiting for me
                                       POST /my-doctor/requests/{id}      {"accept": true|false}

Rules: a doctor cannot browse patients (exact match only) and sees no health data before the patient accepts. A request expires after 14 days.
Accepting links the doctor from that moment; it does not turn on sharing of habit progress, which is a separate switch the patient controls.
Declining is silent to everything except the doctor's request list.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user
from app.database import get_db
from app.models.caregiver import Doctor
from app.models.link_request import DoctorLinkRequest
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.realtime import hub
from app.services import push

doctor_router = APIRouter(prefix="/doctor-portal", tags=["doctor_link"])
patient_router = APIRouter(prefix="/my-doctor", tags=["my_doctor_requests"])
EXPIRES = timedelta(days=14)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _live(r: DoctorLinkRequest) -> bool:
    return r.status == "pending" and r.created_at is not None and datetime.now(timezone.utc) - _aware(r.created_at) < EXPIRES


def _name(db: Session, u: User) -> str:
    from app.services.names import lookup
    return lookup(db, u.id)


def _find_patient(db: Session, q: str) -> Optional[User]:
    """Exact patient ID or exact email. Never a partial match, so nobody can browse."""
    q = (q or "").strip()
    if len(q) < 4:
        return None
    u = db.query(User).filter(func.lower(User.patient_id) == q.lower()).first() or db.query(User).filter(func.lower(User.email) == q.lower()).first()
    if not u or not u.is_active or getattr(u, "is_caregiver", False):
        return None
    return u


# ------------------------------------------------------------------ doctor
@doctor_router.get("/find")
def find_patient(q: str, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    if doctor.doctor_id == "DOCGUEST":
        raise HTTPException(403, "The demo doctor cannot look up real people.")
    u = _find_patient(db, q)
    if not u:
        return {"found": False, "message": "No patient with that ID or email. Ask the patient for the ID shown on their Profile screen."}
    prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
    pending = db.query(DoctorLinkRequest).filter_by(doctor_pk=doctor.id, patient_id=u.id, status="pending").all()
    if prof and prof.doctor_id == doctor.doctor_id:
        state = "yours"
    elif any(_live(r) for r in pending):
        state = "pending"
    else:
        state = "available"
    return {"found": True, "state": state, "patient": {"user_id": u.id, "name": _name(db, u), "patient_id": u.patient_id},
            "note": "You see a name only. Health information is shared only after the patient accepts."}


class RequestIn(BaseModel):
    patient_user_id: int
    message: Optional[str] = Field(None, max_length=200)


@doctor_router.post("/link-requests")
def send_request(body: RequestIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    u = db.query(User).filter(User.id == body.patient_user_id, User.is_active == True).first()  # noqa: E712
    if not u or getattr(u, "is_caregiver", False):
        raise HTTPException(404, "Patient not found")
    prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
    if not prof or not prof.profile_completed:
        raise HTTPException(409, "This patient has not finished setting up their profile yet.")
    if prof.doctor_id == doctor.doctor_id:
        raise HTTPException(409, "This patient is already yours.")
    for r in db.query(DoctorLinkRequest).filter_by(doctor_pk=doctor.id, patient_id=u.id, status="pending").all():
        if _live(r):
            return {"id": r.id, "status": "pending", "already": True}
    r = DoctorLinkRequest(doctor_pk=doctor.id, patient_id=u.id, message=(body.message or "").strip() or None, status="pending")
    db.add(r)
    db.add(Notification(user_id=u.id, notification_type="doctor", title="A doctor wants to follow your health",
                        message=f"{doctor.full_name} asked to be your doctor. Open Profile, My doctor to accept or decline. Nothing is shared until you accept.",
                        sender_id=doctor.id, sender_type="doctor"))
    db.commit()
    db.refresh(r)
    push.notify_users([u.id], "HEWAL3", "A doctor sent you a request", {"type": "doctor_link"})        # generic text only
    try:
        hub.send_from_thread(u.id, {"type": "doctor_link.request", "request_id": r.id, "doctor": doctor.full_name})
    except Exception:
        pass
    return {"id": r.id, "status": "pending"}


@doctor_router.get("/link-requests")
def my_requests(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    rows = db.query(DoctorLinkRequest).filter_by(doctor_pk=doctor.id).order_by(DoctorLinkRequest.id.desc()).limit(40).all()
    out = []
    for r in rows:
        u = db.query(User).filter(User.id == r.patient_id).first()
        status = "expired" if r.status == "pending" and not _live(r) else r.status
        out.append({"id": r.id, "patient": _name(db, u) if u else "Patient", "patient_id": u.patient_id if u else None, "status": status,
                    "message": r.message, "sent_at": r.created_at.isoformat() if r.created_at else None,
                    "answered_at": r.responded_at.isoformat() if r.responded_at else None})
    return {"requests": out}


@doctor_router.delete("/link-requests/{request_id}")
def withdraw(request_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    r = db.query(DoctorLinkRequest).filter_by(id=request_id, doctor_pk=doctor.id, status="pending").first()
    if not r:
        raise HTTPException(404, "No pending request with that number")
    r.status, r.responded_at = "cancelled", datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ patient
@patient_router.get("/requests")
def requests_for_me(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    rows = db.query(DoctorLinkRequest).filter_by(patient_id=user.id, status="pending").order_by(DoctorLinkRequest.id.desc()).all()
    out = []
    for r in rows:
        if not _live(r):
            continue
        d = db.query(Doctor).filter(Doctor.id == r.doctor_pk).first()
        if d:
            out.append({"id": r.id, "message": r.message, "sent_at": r.created_at.isoformat() if r.created_at else None,
                        "doctor": {"doctor_id": d.doctor_id, "full_name": d.full_name, "specialization": d.specialization, "hospital": d.hospital}})
    return {"requests": out}


class AnswerIn(BaseModel):
    accept: bool


@patient_router.post("/requests/{request_id}")
def answer(request_id: int, body: AnswerIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    r = db.query(DoctorLinkRequest).filter_by(id=request_id, patient_id=user.id, status="pending").first()
    if not r or not _live(r):
        raise HTTPException(404, "This request is no longer open.")
    d = db.query(Doctor).filter(Doctor.id == r.doctor_pk, Doctor.is_active == True).first()  # noqa: E712
    r.responded_at = datetime.now(timezone.utc)
    if not body.accept or not d:
        r.status = "declined"
        db.commit()
        return {"status": "declined", "doctor": None}
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not prof:
        raise HTTPException(400, "Finish setting up your profile first")
    replaced = prof.doctor_id if prof.doctor_id and prof.doctor_id != d.doctor_id else None
    prof.doctor_id, r.status = d.doctor_id, "accepted"
    db.commit()
    try:
        hub.send_from_thread(-d.id, {"type": "care.refresh"})                    # the doctor's patient list updates at once
    except Exception:
        pass
    return {"status": "accepted", "replaced_previous_doctor": bool(replaced),
            "doctor": {"doctor_id": d.doctor_id, "full_name": d.full_name, "specialization": d.specialization, "hospital": d.hospital}}
