"""Doctor <-> patient chat helpers. Doctors are addressed on the realtime hub by the negative of doctors.id."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.caregiver import Doctor
from app.models.care_chat import DoctorMessage
from app.models.user import UserProfile
from app.realtime import hub


def doctor_key(doc: Doctor) -> int:
    return -doc.id


def doctor_of(db: Session, patient_id: int) -> Optional[Doctor]:
    prof = db.query(UserProfile).filter(UserProfile.user_id == patient_id).first()
    if not prof or not prof.doctor_id:
        return None
    return db.query(Doctor).filter(Doctor.doctor_id == prof.doctor_id, Doctor.is_active == True).first()  # noqa: E712


def message_dict(m: DoctorMessage) -> dict:
    return {"id": m.id, "sender_role": m.sender_role, "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "read_at": m.read_at.isoformat() if m.read_at else None}


def refresh_doctor(db: Session, patient_id: int, reason: str) -> None:
    """Tell the patient's doctor (if connected) that something about this patient changed, so the website refetches.
    Best effort and carries no health data. Safe to call from sync code."""
    try:
        doc = doctor_of(db, patient_id)
        if doc:
            hub.send_from_thread(doctor_key(doc), {"type": "care.refresh", "patient_id": patient_id, "reason": reason})
    except Exception:
        pass
