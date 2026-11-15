"""The doctor's clinic workflow on the website: today's workspace, the week's schedule, working hours, conversations, consultations (SOAP notes with
diagnoses and the vitals taken in the room), issued documents with a public authenticity check, and quick-pick references for diagnoses and medicines.

Everything is limited to the signed-in doctor's own patients. A signed consultation is locked; later changes are addenda.
"""
import secrets
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor
from app.data import clinical_reference as ref
from app.database import get_db
from app.models.care_chat import DoctorMessage
from app.models.care_plan import DoctorAppointment, DoctorNote, Prescription
from app.models.caregiver import Doctor
from app.models.clinic import ClinicDocument, Consultation
from app.models.safety import Medication
from app.models.user import User, UserProfile
from app.realtime import hub
from app.routers.care_plan import _appt, _conflict, _name, _tell_patient
from app.routers.doctor_portal import _my_patients, _owned_patient
from app.services import push, simple_limiter
from app.services.care_snapshot import iso as _iso, snapshot as _snapshot

router = APIRouter(prefix="/doctor-portal", tags=["doctor_clinic"])
public_router = APIRouter(prefix="/verify", tags=["document_check"])

DEFAULT_HOURS = {"days": [0, 1, 2, 3, 4], "start": "08:00", "end": "17:00", "slot_min": 30}
OPEN_STATUS = ("requested", "confirmed")
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _day_window(day: date, offset_min: int) -> tuple:
    """The UTC span of one calendar day in the doctor's own time zone. `offset_min` is what the browser reports (minutes BEHIND UTC, so Ghana is 0)."""
    start_local = datetime.combine(day, time.min)
    start = (start_local + timedelta(minutes=offset_min)).replace(tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _local_today(offset_min: int) -> date:
    return (_now() - timedelta(minutes=offset_min)).date()


def hours_of(doctor: Doctor) -> Dict[str, Any]:
    return {**DEFAULT_HOURS, **(doctor.working_hours or {})}


# ------------------------------------------------------------------ today
@router.get("/today")
def today(offset: int = 0, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """What a doctor opens the day with: who is booked, who is next, who is waiting for an answer, and how many need a look."""
    offset = max(-840, min(840, offset))
    day = _local_today(offset)
    start, end = _day_window(day, offset)
    rows = (db.query(DoctorAppointment).filter(DoctorAppointment.doctor_pk == doctor.id, DoctorAppointment.starts_at >= start, DoctorAppointment.starts_at < end,
                                               DoctorAppointment.status.in_(("requested", "confirmed", "completed"))).order_by(DoctorAppointment.starts_at.asc()).all())
    pids = sorted({a.patient_id for a in rows})
    snaps = {}
    for u, p in _my_patients(db, doctor):
        if u.id in pids:
            snaps[u.id] = _snapshot(db, u, p)
    cons = {}
    for c in db.query(Consultation).filter(Consultation.doctor_pk == doctor.id, Consultation.appointment_id.in_([a.id for a in rows] or [0])).all():
        cons[c.appointment_id] = c
    now = _now()
    items = []
    for a in rows:
        c = cons.get(a.id)
        s = snaps.get(a.patient_id)
        items.append({**_appt(a, patient=_name(db, a.patient_id)), "group": s["group"] if s else None, "age": s["age"] if s else None, "gender": s["gender"] if s else None,
                      "consultation": {"id": c.id, "status": c.status} if c else None,
                      "is_now": a.status == "confirmed" and _aware(a.starts_at) <= now < _aware(a.starts_at) + timedelta(minutes=a.duration_min)})
    nxt = next((i for i in items if i["status"] == "confirmed" and _aware(datetime.fromisoformat(i["starts_at"])) + timedelta(minutes=i["duration_min"]) > now and not i["consultation"]), None)
    waiting = db.query(DoctorAppointment).filter(DoctorAppointment.doctor_pk == doctor.id, DoctorAppointment.status == "requested", DoctorAppointment.starts_at >= now - timedelta(hours=1)).count()
    week = db.query(DoctorAppointment).filter(DoctorAppointment.doctor_pk == doctor.id, DoctorAppointment.status == "confirmed",
                                              DoctorAppointment.starts_at >= now, DoctorAppointment.starts_at < now + timedelta(days=7)).count()
    unread = db.query(DoctorMessage).filter(DoctorMessage.doctor_pk == doctor.id, DoctorMessage.sender_role == "patient", DoctorMessage.read_at.is_(None)).count()
    drafts = db.query(Consultation).filter(Consultation.doctor_pk == doctor.id, Consultation.status == "draft").count()
    return {
        "date": day.isoformat(), "appointments": items, "next_up": nxt,
        "counts": {"today": sum(1 for i in items if i["status"] in ("confirmed", "completed")), "done": sum(1 for i in items if i["status"] == "completed"),
                   "waiting_requests": waiting, "week": week, "unread_messages": unread, "open_drafts": drafts},
        "hours": hours_of(doctor),
    }


# ------------------------------------------------------------------ schedule and working hours
@router.get("/schedule")
def schedule(start: Optional[str] = None, days: int = 7, offset: int = 0, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Appointments for `days` days from `start` (a date, default the Monday of this week), with the doctor's working hours for the grid."""
    offset = max(-840, min(840, offset))
    days = max(1, min(days, 14))
    try:
        first = date.fromisoformat(start) if start else _local_today(offset) - timedelta(days=_local_today(offset).weekday())
    except ValueError:
        raise HTTPException(422, "start must be a date like 2026-11-16")
    lo, _ = _day_window(first, offset)
    hi = lo + timedelta(days=days)
    rows = (db.query(DoctorAppointment).filter(DoctorAppointment.doctor_pk == doctor.id, DoctorAppointment.starts_at >= lo, DoctorAppointment.starts_at < hi,
                                               DoctorAppointment.status.in_(("requested", "confirmed", "completed"))).order_by(DoctorAppointment.starts_at.asc()).all())
    return {"start": first.isoformat(), "days": days, "appointments": [_appt(a, patient=_name(db, a.patient_id)) for a in rows], "hours": hours_of(doctor)}


class HoursIn(BaseModel):
    days: List[int] = Field(..., min_length=1, max_length=7)
    start: str = Field(..., pattern=HHMM)
    end: str = Field(..., pattern=HHMM)
    slot_min: int = 30


@router.get("/me/availability")
def get_availability(doctor: Doctor = Depends(get_current_active_doctor)):
    return hours_of(doctor)


@router.put("/me/availability")
def set_availability(body: HoursIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    if any(d < 0 or d > 6 for d in body.days) or len(set(body.days)) != len(body.days):
        raise HTTPException(422, "Choose days from Monday to Sunday")
    if body.start >= body.end:
        raise HTTPException(422, "The day must end after it starts")
    if body.slot_min not in (15, 20, 30, 45, 60):
        raise HTTPException(422, "A slot is 15, 20, 30, 45 or 60 minutes")
    doctor.working_hours = {"days": sorted(body.days), "start": body.start, "end": body.end, "slot_min": body.slot_min}
    db.commit()
    return hours_of(doctor)


# ------------------------------------------------------------------ conversations
@router.get("/conversations")
def conversations(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """One line per patient who has written to this doctor or been written to: the last message and how many are unread."""
    rows = db.query(DoctorMessage).filter(DoctorMessage.doctor_pk == doctor.id).order_by(DoctorMessage.id.desc()).limit(600).all()
    seen: Dict[int, Dict[str, Any]] = {}
    for m in rows:
        c = seen.get(m.patient_id)
        if c is None:
            seen[m.patient_id] = c = {"patient_id": m.patient_id, "last": m.content[:140], "from": m.sender_role, "at": _iso(m.created_at), "unread": 0}
        if m.sender_role == "patient" and m.read_at is None:
            c["unread"] += 1
    mine = {u.id: u for u, _ in _my_patients(db, doctor)}
    out = []
    for pid, c in seen.items():
        if pid in mine:
            out.append({**c, "patient": _name(db, pid), "online": hub.is_online(pid)})
    out.sort(key=lambda c: c["at"] or "", reverse=True)
    out.sort(key=lambda c: c["unread"] == 0)                                   # unread first, then newest
    return {"conversations": out, "unread_total": sum(c["unread"] for c in out)}


# ------------------------------------------------------------------ references and prescribing prompts
@router.get("/reference/diagnoses")
def reference_diagnoses(q: str = "", doctor: Doctor = Depends(get_current_active_doctor)):
    return {"results": ref.search_diagnoses(q[:60]), "note": "Common codes only. You can also type any diagnosis in your own words."}


@router.get("/reference/medicines")
def reference_medicines(q: str = "", doctor: Doctor = Depends(get_current_active_doctor)):
    return {"results": ref.search_medicines(q[:60])}


class CheckIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)


@router.post("/patients/{patient_id}/prescriptions/check")
def check_prescription(patient_id: int, body: CheckIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Reminders before prescribing: the same class twice, combinations that are usually avoided, and cautions for this patient's conditions.
    They are prompts, never blocks: the prescriber decides."""
    user, prof = _owned_patient(db, doctor, patient_id)
    active = [r.name for r in db.query(Prescription).filter(Prescription.patient_id == user.id, Prescription.status == "active").all()]
    active += [m.name for m in db.query(Medication).filter(Medication.user_id == user.id, Medication.active == True).all()]       # what they take on their own as well  # noqa: E712
    conds = [str(c) for c in ((prof.chronic_conditions if prof else None) or [])]
    return ref.check_prescription(body.name, active, conds)


# ------------------------------------------------------------------ consultations
class VitalsIn(BaseModel):
    systolic: Optional[int] = Field(None, ge=0, le=400)
    diastolic: Optional[int] = Field(None, ge=0, le=300)
    heart_rate: Optional[int] = Field(None, ge=0, le=300)
    spo2: Optional[float] = Field(None, ge=0, le=100)
    temperature: Optional[float] = Field(None, ge=0, le=50)
    weight: Optional[float] = Field(None, ge=0, le=600)
    glucose: Optional[float] = Field(None, ge=0, le=1500)


class DxIn(BaseModel):
    code: Optional[str] = Field(None, max_length=10)
    label: str = Field(..., min_length=2, max_length=160)


class ConsultStart(BaseModel):
    appointment_id: Optional[int] = None
    complaint: Optional[str] = Field(None, max_length=300)


class ConsultPatch(BaseModel):
    complaint: Optional[str] = Field(None, max_length=300)
    subjective: Optional[str] = Field(None, max_length=4000)
    objective: Optional[str] = Field(None, max_length=4000)
    assessment: Optional[str] = Field(None, max_length=3000)
    plan: Optional[str] = Field(None, max_length=3000)
    diagnoses: Optional[List[DxIn]] = Field(None, max_length=10)
    clinic_vitals: Optional[VitalsIn] = None
    follow_up_at: Optional[datetime] = None
    clear_follow_up: bool = False
    share_plan: Optional[bool] = None


class AddendumIn(BaseModel):
    text: str = Field(..., min_length=2, max_length=2000)


def _consult(c: Consultation, patient: Optional[str] = None) -> dict:
    return {"id": c.id, "patient_id": c.patient_id, "patient": patient, "appointment_id": c.appointment_id, "status": c.status, "complaint": c.complaint,
            "subjective": c.subjective, "objective": c.objective, "assessment": c.assessment, "plan": c.plan, "diagnoses": c.diagnoses or [],
            "clinic_vitals": c.clinic_vitals or {}, "follow_up_at": _iso(c.follow_up_at), "share_plan": bool(c.share_plan), "addenda": c.addenda or [],
            "started_at": _iso(c.created_at), "updated_at": _iso(c.updated_at), "signed_at": _iso(c.signed_at)}


def _mine(db: Session, doctor: Doctor, cid: int) -> Consultation:
    c = db.query(Consultation).filter(Consultation.id == cid, Consultation.doctor_pk == doctor.id).first()
    if not c:
        raise HTTPException(404, "Consultation not found")
    return c


@router.post("/patients/{patient_id}/consultations")
def start_consultation(patient_id: int, body: ConsultStart, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Open a consultation. Opening the same appointment (or the same patient's open draft) again returns the one that exists."""
    user, _ = _owned_patient(db, doctor, patient_id)
    appt = None
    if body.appointment_id:
        appt = db.query(DoctorAppointment).filter(DoctorAppointment.id == body.appointment_id, DoctorAppointment.doctor_pk == doctor.id, DoctorAppointment.patient_id == user.id).first()
        if not appt:
            raise HTTPException(404, "Appointment not found")
        if appt.status in ("declined", "cancelled"):
            raise HTTPException(409, f"This appointment is {appt.status}")
        existing = db.query(Consultation).filter(Consultation.doctor_pk == doctor.id, Consultation.appointment_id == appt.id).first()
        if existing:
            return _consult(existing, _name(db, user.id))
    else:
        existing = db.query(Consultation).filter(Consultation.doctor_pk == doctor.id, Consultation.patient_id == user.id, Consultation.status == "draft").order_by(Consultation.id.desc()).first()
        if existing:
            return _consult(existing, _name(db, user.id))
    c = Consultation(doctor_pk=doctor.id, patient_id=user.id, appointment_id=appt.id if appt else None, status="draft",
                     complaint=(body.complaint or (appt.reason if appt else None) or "").strip() or None)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _consult(c, _name(db, user.id))


@router.get("/patients/{patient_id}/consultations")
def list_consultations(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    rows = db.query(Consultation).filter(Consultation.doctor_pk == doctor.id, Consultation.patient_id == user.id).order_by(Consultation.id.desc()).limit(60).all()
    return {"consultations": [_consult(c) for c in rows]}


@router.get("/consultations/{cid}")
def get_consultation(cid: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    c = _mine(db, doctor, cid)
    return _consult(c, _name(db, c.patient_id))


@router.patch("/consultations/{cid}")
def update_consultation(cid: int, body: ConsultPatch, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    c = _mine(db, doctor, cid)
    if c.status != "draft":
        raise HTTPException(409, "A signed consultation cannot be edited. Add an addendum instead.")
    data = body.model_dump(exclude_unset=True)
    for k in ("complaint", "subjective", "objective", "assessment", "plan"):
        if k in data:
            setattr(c, k, (data[k] or "").strip() or None)
    if "diagnoses" in data:
        c.diagnoses = [{"code": (d.get("code") or "").strip() or None, "label": d["label"].strip()} for d in (data["diagnoses"] or [])]
    if "clinic_vitals" in data:
        c.clinic_vitals = {k: v for k, v in (data["clinic_vitals"] or {}).items() if v is not None}
    if body.clear_follow_up:
        c.follow_up_at = None
    elif body.follow_up_at is not None:
        when = _aware(body.follow_up_at)
        if when < _now() + timedelta(minutes=5):
            raise HTTPException(422, "Choose a follow-up time in the future")
        c.follow_up_at = when
    if body.share_plan is not None:
        c.share_plan = body.share_plan
    db.commit()
    db.refresh(c)
    return _consult(c, _name(db, c.patient_id))


@router.delete("/consultations/{cid}")
def delete_draft(cid: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    c = _mine(db, doctor, cid)
    if c.status != "draft":
        raise HTTPException(409, "A signed consultation is part of the record and cannot be deleted")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/consultations/{cid}/sign")
def sign_consultation(cid: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Lock the note. Books the follow-up, marks the appointment done, and (if chosen) sends the plan to the patient."""
    c = _mine(db, doctor, cid)
    if c.status == "signed":
        return _consult(c, _name(db, c.patient_id))
    if not (c.diagnoses or (c.assessment or "").strip()):
        raise HTTPException(422, "Add a diagnosis or an assessment before signing")
    follow = None
    if c.follow_up_at:
        when = _aware(c.follow_up_at)
        if when < _now():
            raise HTTPException(422, "The follow-up time has passed. Choose a new one.")
        if _conflict(db, doctor.id, when, 30):
            raise HTTPException(409, "You already have an appointment at the follow-up time")
        follow = DoctorAppointment(doctor_pk=doctor.id, patient_id=c.patient_id, starts_at=when, duration_min=30, mode="in_person", reason="Follow-up", status="confirmed", requested_by="doctor")
        db.add(follow)
    if c.appointment_id:
        a = db.query(DoctorAppointment).filter(DoctorAppointment.id == c.appointment_id).first()
        if a and a.status in ("requested", "confirmed"):
            a.status = "completed"
    c.status, c.signed_at = "signed", _now()
    note = None
    if c.share_plan and (c.plan or "").strip():
        dx = "; ".join(d["label"] for d in (c.diagnoses or []))
        note = DoctorNote(doctor_pk=doctor.id, patient_id=c.patient_id, shared=True, text=(f"Visit summary. {('Diagnosis: ' + dx + '. ') if dx else ''}Plan: {c.plan.strip()}")[:1900])
        db.add(note)
    db.commit()
    if follow is not None:
        db.refresh(follow)
        _tell_patient(db, doctor, c.patient_id, {"type": "appointment.update", "appointment": _appt(follow, doctor=doctor.full_name)},
                      "Follow-up booked", f"{doctor.full_name} booked your follow-up for {_aware(follow.starts_at).strftime('%d %b %Y, %H:%M UTC')}.", "appointment")
    if note is not None:
        db.refresh(note)
        hub.send_from_thread(c.patient_id, {"type": "note.new", "note": {"id": note.id, "text": note.text, "shared": True, "at": _iso(note.created_at)}, "doctor": doctor.full_name})
        push.notify_users([c.patient_id], "A note from your doctor", f"{doctor.full_name} shared your visit summary.", {"type": "note"})
    db.refresh(c)
    return _consult(c, _name(db, c.patient_id))


@router.post("/consultations/{cid}/addendum")
def add_addendum(cid: int, body: AddendumIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    c = _mine(db, doctor, cid)
    if c.status != "signed":
        raise HTTPException(409, "Sign the consultation first. Until then, edit it directly.")
    c.addenda = [*(c.addenda or []), {"text": body.text.strip(), "at": _now().isoformat()}]
    db.commit()
    db.refresh(c)
    return _consult(c, _name(db, c.patient_id))


# ------------------------------------------------------------------ documents
class DocIn(BaseModel):
    kind: str
    title: Optional[str] = Field(None, max_length=160)
    consultation_id: Optional[int] = None
    body: Dict[str, Any]


def _text(b: Dict[str, Any], key: str, limit: int, required: bool = False) -> str:
    v = str(b.get(key) or "").strip()
    if required and not v:
        raise HTTPException(422, f"{key.replace('_', ' ').capitalize()} is required")
    if len(v) > limit:
        raise HTTPException(422, f"{key.replace('_', ' ').capitalize()} is too long (limit {limit} characters)")
    return v


def _clean_body(kind: str, b: Dict[str, Any]) -> Dict[str, Any]:
    if kind == "referral":
        urgency = str(b.get("urgency") or "routine")
        if urgency not in ("routine", "urgent", "emergency"):
            raise HTTPException(422, "Urgency is routine, urgent or emergency")
        return {"to": _text(b, "to", 120, True), "specialty": _text(b, "specialty", 80), "urgency": urgency, "reason": _text(b, "reason", 800, True),
                "history": _text(b, "history", 1500), "medicines": _text(b, "medicines", 600)}
    if kind == "sick_note":
        try:
            a, z = date.fromisoformat(str(b.get("from_date"))), date.fromisoformat(str(b.get("to_date")))
        except ValueError:
            raise HTTPException(422, "Give the first and last day of rest as dates")
        if z < a:
            raise HTTPException(422, "The last day cannot be before the first day")
        if (z - a).days > 90:
            raise HTTPException(422, "A sick note longer than 90 days needs a different arrangement")
        return {"from_date": a.isoformat(), "to_date": z.isoformat(), "days": (z - a).days + 1, "show_diagnosis": bool(b.get("show_diagnosis")),
                "diagnosis": _text(b, "diagnosis", 200), "note": _text(b, "note", 400)}
    if kind == "letter":
        return {"to": _text(b, "to", 120), "text": _text(b, "text", 3000, True)}
    raise HTTPException(422, "A document is a referral, a sick note or a letter")


def _new_ref(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"                                # no 0/O/1/I, so a printed code is hard to misread
    for _ in range(8):
        r = f"HW-{datetime.now().strftime('%y')}-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.query(ClinicDocument).filter_by(ref=r).first():
            return r
    raise HTTPException(500, "Could not make a reference number. Try again.")


def _doc(d: ClinicDocument, patient: Optional[str] = None, doctor: Optional[Doctor] = None, profile: Optional[UserProfile] = None) -> dict:
    out = {"id": d.id, "ref": d.ref, "kind": d.kind, "title": d.title, "body": d.body, "revoked": bool(d.revoked), "issued_at": _iso(d.issued_at),
           "patient_id": d.patient_id, "patient": patient, "consultation_id": d.consultation_id}
    if doctor is not None:
        out["doctor"] = {"name": doctor.full_name, "specialization": doctor.specialization, "hospital": doctor.hospital, "doctor_id": doctor.doctor_id}
    if profile is not None:
        out["patient_info"] = {"age": profile.age, "gender": profile.gender, "identifier": None}
    return out


TITLES = {"referral": "Referral letter", "sick_note": "Medical certificate (sick note)", "letter": "Letter"}


@router.post("/patients/{patient_id}/documents")
def create_document(patient_id: int, body: DocIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, prof = _owned_patient(db, doctor, patient_id)
    clean = _clean_body(body.kind, body.body)
    if body.consultation_id:
        _mine(db, doctor, body.consultation_id)
    d = ClinicDocument(ref=_new_ref(db), doctor_pk=doctor.id, patient_id=user.id, consultation_id=body.consultation_id, kind=body.kind,
                       title=(body.title or TITLES[body.kind]).strip(), body=clean)
    db.add(d)
    db.commit()
    db.refresh(d)
    return _doc(d, _name(db, user.id), doctor, prof)


@router.get("/documents")
def my_documents(limit: int = 60, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    rows = db.query(ClinicDocument).filter(ClinicDocument.doctor_pk == doctor.id).order_by(ClinicDocument.id.desc()).limit(max(1, min(limit, 200))).all()
    return {"documents": [_doc(d, _name(db, d.patient_id)) for d in rows]}


@router.get("/patients/{patient_id}/documents")
def patient_documents(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    rows = db.query(ClinicDocument).filter(ClinicDocument.doctor_pk == doctor.id, ClinicDocument.patient_id == user.id).order_by(ClinicDocument.id.desc()).limit(60).all()
    return {"documents": [_doc(d, _name(db, user.id)) for d in rows]}


@router.get("/documents/{did}")
def get_document(did: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    d = db.query(ClinicDocument).filter(ClinicDocument.id == did, ClinicDocument.doctor_pk == doctor.id).first()
    if not d:
        raise HTTPException(404, "Document not found")
    prof = db.query(UserProfile).filter(UserProfile.user_id == d.patient_id).first()
    return _doc(d, _name(db, d.patient_id), doctor, prof)


@router.post("/documents/{did}/revoke")
def revoke_document(did: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    d = db.query(ClinicDocument).filter(ClinicDocument.id == did, ClinicDocument.doctor_pk == doctor.id).first()
    if not d:
        raise HTTPException(404, "Document not found")
    d.revoked = True
    db.commit()
    return {"ok": True}


@public_router.get("/document/{reference}")
def verify_document(reference: str, request: Request, db: Session = Depends(get_db)):
    """Anyone holding a printed document can check it is genuine. Shows who issued it and when, never the patient's name or the contents."""
    simple_limiter.hit(f"docverify:{request.client.host if request.client else 'x'}", 30, 60, "Too many checks. Please wait a minute.")
    d = db.query(ClinicDocument).filter(ClinicDocument.ref == reference.strip().upper()[:20]).first()
    if not d:
        return {"valid": False, "reason": "No document has this reference number."}
    doc = db.query(Doctor).filter(Doctor.id == d.doctor_pk).first()
    return {"valid": not d.revoked, "revoked": bool(d.revoked), "kind": TITLES.get(d.kind, d.kind), "issued_on": (_iso(d.issued_at) or "")[:10],
            "doctor": doc.full_name if doc else None, "hospital": doc.hospital if doc else None, "specialization": doc.specialization if doc else None,
            "reason": "This document was withdrawn by the doctor who issued it." if d.revoked else None}
