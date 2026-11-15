"""Appointments, clinical notes and prescriptions between a doctor and the patients who linked them, plus push-token registration
and the ICE server list for calls. Doctor endpoints live under /doctor-portal, patient endpoints under /my-doctor.

Every list a doctor reads is limited to their own patients (UserProfile.doctor_id), and a patient only ever sees their own rows.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user, get_current_user_or_admin
from app.database import get_db
from app.models.care_plan import CareNote, DoctorAppointment, DoctorNote, Prescription, PushToken
from app.models.caregiver import CaregiverRelationship, Doctor
from app.models.notification import Notification
from app.models.safety import Medication
from app.models.user import User, UserProfile
from app.realtime import hub
from app.routers.doctor_portal import _owned_patient
from app.services import care_chat, ice, push
from app.services.care_snapshot import iso as _iso

doctor_router = APIRouter(prefix="/doctor-portal", tags=["doctor_care_plan"])
patient_router = APIRouter(prefix="/my-doctor", tags=["my_doctor_care_plan"])
misc_router = APIRouter(tags=["calls_push"])

MODES = ("in_person", "video", "phone")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


# ------------------------------------------------------------------ schemas
class AppointmentIn(BaseModel):
    starts_at: datetime
    duration_min: int = Field(30, ge=10, le=240)
    mode: str = "in_person"
    reason: Optional[str] = Field(None, max_length=300)

    @field_validator("mode")
    @classmethod
    def _mode(cls, v):
        if v not in MODES:
            raise ValueError("mode must be in_person, video or phone")
        return v


class AppointmentPatch(BaseModel):
    status: Optional[str] = None
    starts_at: Optional[datetime] = None
    duration_min: Optional[int] = Field(None, ge=10, le=240)
    doctor_message: Optional[str] = Field(None, max_length=300)


class NoteIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    shared: bool = False


class PrescriptionIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    dose: Optional[str] = Field(None, max_length=60)
    times: List[str] = Field(..., min_length=1, max_length=6)
    instructions: Optional[str] = Field(None, max_length=400)

    @field_validator("times")
    @classmethod
    def _times(cls, v):
        bad = [t for t in v if not TIME_RE.match(t)]
        if bad:
            raise ValueError("times must look like 08:00")
        return sorted(set(v))


class StopIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


class PushIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    platform: Optional[str] = Field(None, max_length=10)


# ------------------------------------------------------------------ shapes
def _appt(a: DoctorAppointment, patient: Optional[str] = None, doctor: Optional[str] = None) -> dict:
    return {"id": a.id, "patient_id": a.patient_id, "patient": patient, "doctor": doctor, "starts_at": _iso(a.starts_at),
            "duration_min": a.duration_min, "mode": a.mode, "reason": a.reason, "status": a.status,
            "requested_by": a.requested_by, "doctor_message": a.doctor_message}


def _rx(p: Prescription, doctor: Optional[str] = None) -> dict:
    return {"id": p.id, "name": p.name, "dose": p.dose, "times": p.times, "instructions": p.instructions, "status": p.status,
            "stop_reason": p.stop_reason, "prescribed": _iso(p.created_at), "stopped": _iso(p.stopped_at), "doctor": doctor}


def _note(n: DoctorNote) -> dict:
    return {"id": n.id, "text": n.text, "shared": n.shared, "at": _iso(n.created_at)}


def _name(db: Session, user_id: int) -> str:
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if p and p.full_name:
        return p.full_name
    u = db.query(User).filter(User.id == user_id).first()
    return (f"{u.first_name or ''} {u.last_name or ''}".strip() if u else "") or "Patient"


def _tell_patient(db: Session, doctor: Doctor, patient_id: int, event: dict, title: str, text: str, kind: str) -> None:
    """A stored notification (so it is in the patient's list), a live event, and a generic push when the app is closed."""
    db.add(Notification(user_id=patient_id, notification_type=kind, title=title, message=text, sender_id=doctor.id, sender_type="doctor"))
    db.commit()
    hub.send_from_thread(patient_id, event)
    push.notify_users([patient_id], title, text, {"type": kind})


def _tell_doctor(doctor: Doctor, event: dict) -> None:
    hub.send_from_thread(care_chat.doctor_key(doctor), event)


def _conflict(db: Session, doctor_pk: int, start: datetime, minutes: int, ignore: Optional[int] = None) -> bool:
    """True when another confirmed appointment of this doctor overlaps the slot."""
    end = start + timedelta(minutes=minutes)
    rows = db.query(DoctorAppointment).filter(
        DoctorAppointment.doctor_pk == doctor_pk, DoctorAppointment.status == "confirmed",
        DoctorAppointment.starts_at >= start - timedelta(hours=5), DoctorAppointment.starts_at <= end).all()
    for r in rows:
        if ignore and r.id == ignore:
            continue
        s = _aware(r.starts_at)
        if s < end and s + timedelta(minutes=r.duration_min) > start:
            return True
    return False


def _future(d: datetime) -> datetime:
    d = _aware(d).astimezone(timezone.utc)
    if d < _now() + timedelta(minutes=5):
        raise HTTPException(422, "Choose a time in the future")
    if d > _now() + timedelta(days=365):
        raise HTTPException(422, "Choose a time within the next year")
    return d


# ------------------------------------------------------------------ doctor: appointments
@doctor_router.get("/appointments")
def doctor_appointments(scope: str = "upcoming", db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """scope=upcoming (requests and confirmed, from now) or scope=past."""
    q = db.query(DoctorAppointment).filter(DoctorAppointment.doctor_pk == doctor.id)
    if scope == "past":
        rows = q.filter(or_(DoctorAppointment.starts_at < _now(), DoctorAppointment.status == "completed")).order_by(DoctorAppointment.starts_at.desc()).limit(100).all()      # a visit finished ahead of its slot is still past
    else:
        rows = q.filter(DoctorAppointment.starts_at >= _now() - timedelta(hours=1), DoctorAppointment.status.in_(("requested", "confirmed"))) \
                .order_by(DoctorAppointment.starts_at.asc()).limit(200).all()
    return {"appointments": [_appt(a, patient=_name(db, a.patient_id)) for a in rows]}


@doctor_router.post("/patients/{patient_id}/appointments")
def doctor_book(patient_id: int, body: AppointmentIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    start = _future(body.starts_at)
    if _conflict(db, doctor.id, start, body.duration_min):
        raise HTTPException(409, "You already have an appointment at that time")
    a = DoctorAppointment(doctor_pk=doctor.id, patient_id=user.id, starts_at=start, duration_min=body.duration_min, mode=body.mode,
                          reason=(body.reason or "").strip() or None, status="confirmed", requested_by="doctor")
    db.add(a)
    db.commit()
    db.refresh(a)
    _tell_patient(db, doctor, user.id, {"type": "appointment.update", "appointment": _appt(a, doctor=doctor.full_name)},
                  "Appointment booked", f"{doctor.full_name} booked an appointment for you.", "appointment")
    return _appt(a, patient=_name(db, user.id))


@doctor_router.patch("/appointments/{appointment_id}")
def doctor_update_appointment(appointment_id: int, body: AppointmentPatch, db: Session = Depends(get_db),
                              doctor: Doctor = Depends(get_current_active_doctor)):
    a = db.query(DoctorAppointment).filter(DoctorAppointment.id == appointment_id, DoctorAppointment.doctor_pk == doctor.id).first()
    if not a:
        raise HTTPException(404, "Appointment not found")
    if a.status in ("declined", "cancelled", "completed"):
        raise HTTPException(409, f"This appointment is already {a.status}")
    new_start = _future(body.starts_at) if body.starts_at else _aware(a.starts_at)
    new_len = body.duration_min or a.duration_min
    status = body.status or a.status
    if status not in ("requested", "confirmed", "declined", "cancelled", "completed"):
        raise HTTPException(422, "Unknown status")
    if status == "completed" and _aware(a.starts_at) > _now():
        raise HTTPException(422, "An appointment in the future cannot be completed yet")
    if status == "confirmed" and _conflict(db, doctor.id, new_start, new_len, ignore=a.id):
        raise HTTPException(409, "You already have an appointment at that time")
    moved = body.starts_at is not None and new_start != _aware(a.starts_at)
    a.starts_at, a.duration_min, a.status = new_start, new_len, status
    if body.doctor_message is not None:
        a.doctor_message = body.doctor_message.strip() or None
    db.commit()
    db.refresh(a)
    when = new_start.strftime("%d %b %Y, %H:%M UTC")
    text = {"confirmed": f"Your appointment is confirmed for {when}." if not moved else f"Your appointment moved to {when}.",
            "declined": "Your appointment request was declined. Open the app to see why.",
            "cancelled": "Your appointment was cancelled.", "completed": None, "requested": None}[status]
    if text:
        _tell_patient(db, doctor, a.patient_id, {"type": "appointment.update", "appointment": _appt(a, doctor=doctor.full_name)},
                      "Appointment update", text, "appointment")
    return _appt(a, patient=_name(db, a.patient_id))


# ------------------------------------------------------------------ doctor: notes
@doctor_router.get("/patients/{patient_id}/notes")
def doctor_notes(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    rows = db.query(DoctorNote).filter(DoctorNote.doctor_pk == doctor.id, DoctorNote.patient_id == user.id).order_by(DoctorNote.id.desc()).limit(100).all()
    return {"notes": [_note(n) for n in rows]}


@doctor_router.post("/patients/{patient_id}/notes")
def doctor_add_note(patient_id: int, body: NoteIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "The note is empty")
    n = DoctorNote(doctor_pk=doctor.id, patient_id=user.id, text=text, shared=body.shared)
    db.add(n)
    db.commit()
    db.refresh(n)
    if n.shared:
        hub.send_from_thread(user.id, {"type": "note.new", "note": _note(n), "doctor": doctor.full_name})
        push.notify_users([user.id], "A note from your doctor", f"{doctor.full_name} shared a note with you.", {"type": "note"})
    return _note(n)


@doctor_router.delete("/notes/{note_id}")
def doctor_delete_note(note_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    n = db.query(DoctorNote).filter(DoctorNote.id == note_id, DoctorNote.doctor_pk == doctor.id).first()
    if not n:
        raise HTTPException(404, "Note not found")
    db.delete(n)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ doctor: prescriptions
@doctor_router.get("/patients/{patient_id}/prescriptions")
def doctor_prescriptions(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    rows = db.query(Prescription).filter(Prescription.doctor_pk == doctor.id, Prescription.patient_id == user.id).order_by(Prescription.id.desc()).limit(100).all()
    return {"prescriptions": [_rx(p) for p in rows]}


@doctor_router.post("/patients/{patient_id}/prescriptions")
def doctor_prescribe(patient_id: int, body: PrescriptionIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Adds the medicine to the patient's own medication list, so reminders and adherence tracking start by themselves."""
    user, _ = _owned_patient(db, doctor, patient_id)
    name = body.name.strip()
    dup = db.query(Prescription).filter(Prescription.patient_id == user.id, Prescription.doctor_pk == doctor.id,
                                        Prescription.status == "active", Prescription.name.ilike(name)).first()
    if dup:
        raise HTTPException(409, f"{name} is already prescribed and active. Stop it first to change the dose.")
    med = Medication(user_id=user.id, name=name, dose=(body.dose or "").strip() or None, times=body.times,
                     notes=f"Prescribed by {doctor.full_name}" + (f". {body.instructions.strip()}" if body.instructions and body.instructions.strip() else ""), active=True)
    db.add(med)
    db.flush()
    rx = Prescription(doctor_pk=doctor.id, patient_id=user.id, medication_id=med.id, name=name, dose=med.dose, times=body.times,
                      instructions=(body.instructions or "").strip() or None)
    db.add(rx)
    db.commit()
    db.refresh(rx)
    _tell_patient(db, doctor, user.id, {"type": "prescription.update", "prescription": _rx(rx, doctor.full_name)},
                  "New medicine from your doctor", f"{doctor.full_name} prescribed {name}. It is now in your medicine list.", "prescription")
    return _rx(rx)


@doctor_router.post("/prescriptions/{prescription_id}/stop")
def doctor_stop(prescription_id: int, body: StopIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    rx = db.query(Prescription).filter(Prescription.id == prescription_id, Prescription.doctor_pk == doctor.id).first()
    if not rx:
        raise HTTPException(404, "Prescription not found")
    if rx.status == "stopped":
        raise HTTPException(409, "Already stopped")
    rx.status, rx.stop_reason, rx.stopped_at = "stopped", (body.reason or "").strip() or None, _now()
    if rx.medication_id:
        med = db.query(Medication).filter(Medication.id == rx.medication_id).first()
        if med:
            med.active = False
    db.commit()
    _tell_patient(db, doctor, rx.patient_id, {"type": "prescription.update", "prescription": _rx(rx, doctor.full_name)},
                  "Medicine stopped", f"{doctor.full_name} stopped {rx.name}." + (f" Reason: {rx.stop_reason}" if rx.stop_reason else ""), "prescription")
    return _rx(rx)


# ------------------------------------------------------------------ patient side
def _my_doc(db: Session, user: User) -> Doctor:
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    doc = care_chat.doctor_of(db, user.id)
    if not doc:
        raise HTTPException(404, "Link your doctor first")
    return doc


@patient_router.get("/appointments")
def my_appointments(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    rows = db.query(DoctorAppointment).filter(DoctorAppointment.patient_id == user.id).order_by(DoctorAppointment.starts_at.desc()).limit(50).all()
    names = {d.id: d.full_name for d in db.query(Doctor).filter(Doctor.id.in_({r.doctor_pk for r in rows})).all()} if rows else {}
    return {"appointments": [_appt(a, doctor=names.get(a.doctor_pk)) for a in rows]}


@patient_router.post("/appointments")
def my_request_appointment(body: AppointmentIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    doc = _my_doc(db, user)
    start = _future(body.starts_at)
    open_n = db.query(DoctorAppointment).filter(DoctorAppointment.patient_id == user.id, DoctorAppointment.doctor_pk == doc.id,
                                                DoctorAppointment.status == "requested").count()
    if open_n >= 3:
        raise HTTPException(429, "You already have 3 requests waiting for your doctor")
    a = DoctorAppointment(doctor_pk=doc.id, patient_id=user.id, starts_at=start, duration_min=body.duration_min, mode=body.mode,
                          reason=(body.reason or "").strip() or None, status="requested", requested_by="patient")
    db.add(a)
    db.commit()
    db.refresh(a)
    _tell_doctor(doc, {"type": "appointment.update", "appointment": _appt(a, patient=_name(db, user.id))})
    return _appt(a, doctor=doc.full_name)


@patient_router.post("/appointments/{appointment_id}/cancel")
def my_cancel_appointment(appointment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    a = db.query(DoctorAppointment).filter(DoctorAppointment.id == appointment_id, DoctorAppointment.patient_id == user.id).first()
    if not a:
        raise HTTPException(404, "Appointment not found")
    if a.status not in ("requested", "confirmed"):
        raise HTTPException(409, f"This appointment is already {a.status}")
    a.status = "cancelled"
    db.commit()
    doc = db.query(Doctor).filter(Doctor.id == a.doctor_pk).first()
    if doc:
        _tell_doctor(doc, {"type": "appointment.update", "appointment": _appt(a, patient=_name(db, user.id))})
    return _appt(a, doctor=doc.full_name if doc else None)


@patient_router.get("/prescriptions")
def my_prescriptions(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    rows = db.query(Prescription).filter(Prescription.patient_id == user.id).order_by(Prescription.id.desc()).limit(50).all()
    names = {d.id: d.full_name for d in db.query(Doctor).filter(Doctor.id.in_({r.doctor_pk for r in rows})).all()} if rows else {}
    return {"prescriptions": [_rx(p, names.get(p.doctor_pk)) for p in rows]}


@patient_router.get("/notes")
def my_notes(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Only the notes the doctor chose to share. Private notes are never returned here."""
    if getattr(user, "is_caregiver", False):
        raise HTTPException(403, "Caregivers do not have a doctor link")
    rows = db.query(DoctorNote).filter(and_(DoctorNote.patient_id == user.id, DoctorNote.shared == True)).order_by(DoctorNote.id.desc()).limit(50).all()  # noqa: E712
    return {"notes": [_note(n) for n in rows]}


# ------------------------------------------------------------------ push tokens and call servers
@misc_router.post("/push/register")
def register_push(body: PushIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not (body.token.startswith("ExponentPushToken[") or body.token.startswith("ExpoPushToken[")):
        raise HTTPException(422, "Not an Expo push token")
    row = db.query(PushToken).filter(PushToken.token == body.token).first()
    if row:
        row.user_id, row.platform = user.id, body.platform          # the phone changed hands: the latest sign-in owns it
    else:
        db.add(PushToken(user_id=user.id, token=body.token, platform=body.platform))
    db.commit()
    return {"ok": True}


@misc_router.post("/push/unregister")
def unregister_push(body: PushIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    db.query(PushToken).filter(PushToken.token == body.token, PushToken.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


@misc_router.get("/rtc/ice")
def rtc_ice(current=Depends(get_current_user_or_admin)):
    """STUN and (when configured) TURN servers, with short-lived credentials, for the caller's own calls."""
    kind = "d" if isinstance(current, Doctor) else "u"
    return {"iceServers": ice.ice_servers(f"{kind}{current.id}"), "relay": ice.relay_configured()}


# ------------------------------------------------------------------ care log and care team (patient and approved caregivers)
class CareNoteIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


def _caregiver_ids(db: Session, patient_id: int) -> List[int]:
    return [r.caregiver_id for r in db.query(CaregiverRelationship).filter(
        CaregiverRelationship.patient_id == patient_id, CaregiverRelationship.status == "approved").all()]


def _can_see(db: Session, user: User, patient_id: int) -> bool:
    """The patient themselves, or a caregiver the patient approved."""
    return user.id == patient_id or user.id in _caregiver_ids(db, patient_id)


def _user_name(u: Optional[User]) -> str:
    return (f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Caregiver") if u else "Caregiver"


@misc_router.get("/care-team/{patient_id}")
def care_team(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Who looks after this patient: the patient, their approved caregivers, and their linked doctor."""
    if not _can_see(db, user, patient_id):
        raise HTTPException(404, "Patient not found")
    ids = _caregiver_ids(db, patient_id)
    rels = {r.caregiver_id: r for r in db.query(CaregiverRelationship).filter(
        CaregiverRelationship.patient_id == patient_id, CaregiverRelationship.status == "approved").all()}
    people = {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()} if ids else {}
    doc = care_chat.doctor_of(db, patient_id)
    return {
        "patient": {"id": patient_id, "name": _name(db, patient_id)},
        "caregivers": [{"id": i, "name": _user_name(people.get(i)), "type": getattr(people.get(i), "caregiver_type", None),
                        "relationship": rels[i].relationship_type, "online": hub.is_online(i), "me": i == user.id} for i in ids if i in people],
        "doctor": {"name": doc.full_name, "specialization": doc.specialization, "hospital": doc.hospital} if doc else None,
    }


@misc_router.get("/care-notes/{patient_id}")
def list_care_notes(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not _can_see(db, user, patient_id):
        raise HTTPException(404, "Patient not found")
    rows = db.query(CareNote).filter(CareNote.patient_id == patient_id).order_by(CareNote.id.desc()).limit(100).all()
    authors = {u.id: u for u in db.query(User).filter(User.id.in_({r.author_id for r in rows})).all()} if rows else {}
    return {"can_write": user.id != patient_id and bool(getattr(user, "is_caregiver", False)),
            "notes": [{"id": n.id, "text": n.text, "author": _user_name(authors.get(n.author_id)), "mine": n.author_id == user.id,
                       "at": _iso(n.created_at)} for n in rows]}


@misc_router.post("/care-notes/{patient_id}")
def add_care_note(patient_id: int, body: CareNoteIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if user.id == patient_id or not getattr(user, "is_caregiver", False) or user.id not in _caregiver_ids(db, patient_id):
        raise HTTPException(403, "Only a caregiver the patient approved can add to the care log")
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "The note is empty")
    n = CareNote(patient_id=patient_id, author_id=user.id, text=text)
    db.add(n)
    db.commit()
    db.refresh(n)
    who = _user_name(user)
    event = {"type": "care_note.new", "patient_id": patient_id,
             "note": {"id": n.id, "text": n.text, "author": who, "mine": False, "at": _iso(n.created_at)}}
    others = [i for i in {patient_id, *_caregiver_ids(db, patient_id)} if i != user.id]
    for uid in others:
        hub.send_from_thread(uid, event)
    push.notify_users(others, "New care note", f"{who} added a note to the care log.", {"type": "care_note", "patient_id": patient_id})
    return {"id": n.id, "text": n.text, "author": who, "mine": True, "at": _iso(n.created_at)}


@misc_router.delete("/care-notes/{note_id}")
def delete_care_note(note_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    n = db.query(CareNote).filter(CareNote.id == note_id, CareNote.author_id == user.id).first()
    if not n:
        raise HTTPException(404, "Note not found")
    db.delete(n)
    db.commit()
    return {"ok": True}
