"""Preventive health for the patient app: diabetes risk questionnaire, screening schedule, workplace heat check, and consent-based sharing of the
health record with another clinic (a short code the patient hands over, valid for a limited time, every use logged, revocable).
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user
from app.config import settings
from app.database import get_db
from app.models.behavior import BehaviorContext
from app.models.caregiver import Doctor
from app.models.records import (CareVisit, Immunisation, LabResult, PatientAllergy, RadiologyReport, RecordShare, RecordShareUse)
from app.models.user import User, UserProfile
from app.services import preventive
from app.services.care_snapshot import iso as _iso
from app.services.simple_limiter import hit as _hit

router = APIRouter(tags=["preventive"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _profile(db: Session, user: User) -> Optional[UserProfile]:
    return db.query(UserProfile).filter(UserProfile.user_id == user.id).first()


# ------------------------------------------------------------------ diabetes risk and screening
class DiabetesIn(BaseModel):
    waist_cm: Optional[float] = Field(None, ge=40, le=250)
    active_30min_daily: bool
    veg_fruit_daily: bool
    bp_medicine: bool
    high_glucose_before: bool
    family: str = "none"

    @field_validator("family")
    @classmethod
    def _family(cls, v):
        if v not in ("none", "second_degree", "first_degree"):
            raise ValueError("family must be none, second_degree or first_degree")
        return v


@router.post("/preventive/diabetes-risk")
def diabetes_risk(body: DiabetesIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    p = _profile(db, user)
    if not p or not p.age:
        raise HTTPException(400, "Add your age in your profile first")
    bmi = None
    if p.height and p.weight and p.height > 50:
        bmi = p.weight / ((p.height / 100) ** 2)
    return preventive.diabetes_risk(age=p.age, bmi=bmi, waist_cm=body.waist_cm, sex=p.gender or "", active_30min_daily=body.active_30min_daily,
                                    veg_fruit_daily=body.veg_fruit_daily, bp_medicine=body.bp_medicine, high_glucose_before=body.high_glucose_before, family=body.family)


@router.get("/preventive/screenings")
def screenings(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    p = _profile(db, user)
    if not p or not p.age:
        return {"screenings": [], "note": "Add your age in your profile to see the checks that suit you."}
    return {"screenings": preventive.screenings(p.age, p.gender or "", p.chronic_conditions or []),
            "note": "General public-health guidance by age and sex. Your clinician decides what applies to you."}


# ------------------------------------------------------------------ workplace heat
class HeatIn(BaseModel):
    temp_c: float = Field(..., ge=-20, le=60)
    humidity_pct: float = Field(..., ge=0, le=100)
    effort: str = "light"
    direct_sun: bool = False

    @field_validator("effort")
    @classmethod
    def _effort(cls, v):
        if v not in ("light", "moderate", "heavy"):
            raise ValueError("effort must be light, moderate or heavy")
        return v


@router.post("/preventive/heat-check")
def heat_check(body: HeatIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """The person types the temperature and humidity of their workplace (from a thermometer or a weather source they trust). Nothing is fetched or invented."""
    p = _profile(db, user)
    ctx = db.query(BehaviorContext).filter(BehaviorContext.user_id == user.id).first()
    return preventive.heat_check(temp_c=body.temp_c, humidity_pct=body.humidity_pct, effort=body.effort, direct_sun=body.direct_sun,
                                 conditions=(p.chronic_conditions if p else []) or [], region=getattr(ctx, "region", None))


# ------------------------------------------------------------------ sharing the record with another clinic
def _hash(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.strip().upper().encode(), hashlib.sha256).hexdigest()


class ShareIn(BaseModel):
    label: Optional[str] = Field(None, max_length=120)
    hours: int = Field(24, ge=1, le=168)


def _share(s: RecordShare, uses: list) -> dict:
    return {"id": s.id, "label": s.label, "expires_at": _iso(s.expires_at), "uses": s.uses, "max_uses": s.max_uses,
            "active": s.revoked_at is None and _aware(s.expires_at) > _now() and s.uses < s.max_uses, "revoked": s.revoked_at is not None,
            "accessed_by": [{"doctor": u["doctor"], "at": u["at"]} for u in uses]}


@router.post("/records/share")
def create_share(body: ShareIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    code = secrets.token_hex(5).upper()                                      # 10 characters, shown once
    s = RecordShare(user_id=user.id, code_hash=_hash(code), label=body.label, expires_at=_now() + timedelta(hours=body.hours), max_uses=3)
    db.add(s); db.commit(); db.refresh(s)
    return {**_share(s, []), "code": code, "note": "Give this code to the clinic. It works for a limited time and you can cancel it any time."}


@router.get("/records/share")
def list_shares(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    docs = {d.id: d.full_name for d in db.query(Doctor).all()}
    out = []
    for s in db.query(RecordShare).filter(RecordShare.user_id == user.id).order_by(RecordShare.id.desc()).limit(20).all():
        uses = [{"doctor": docs.get(u.doctor_pk, "A doctor"), "at": _iso(u.used_at)} for u in db.query(RecordShareUse).filter(RecordShareUse.share_id == s.id).order_by(RecordShareUse.id).all()]
        out.append(_share(s, uses))
    return {"shares": out}


@router.delete("/records/share/{share_id}")
def revoke_share(share_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    s = db.query(RecordShare).filter(RecordShare.id == share_id, RecordShare.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Not found")
    s.revoked_at = _now(); db.commit()
    return {"ok": True}


def _fhir(db: Session, uid: int, patient_name: str) -> dict:
    """A FHIR R4 bundle of the record rows only. Nothing is invented; a field without a value is left out."""
    pid = f"hewal3-{uid}"
    ref = {"reference": f"Patient/{pid}"}
    entries = [{"resource": {"resourceType": "Patient", "id": pid, "name": [{"text": patient_name}]}}]
    for a in db.query(PatientAllergy).filter(PatientAllergy.user_id == uid).all():
        r = {"resourceType": "AllergyIntolerance", "id": f"al-{a.id}", "patient": ref, "code": {"text": a.substance},
             "criticality": {"mild": "low", "moderate": "low", "severe": "high"}[a.severity]}
        if a.reaction:
            r["reaction"] = [{"description": a.reaction}]
        entries.append({"resource": r})
    for l in db.query(LabResult).filter(LabResult.user_id == uid).all():
        r = {"resourceType": "Observation", "id": f"lab-{l.id}", "status": "final", "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}],
             "code": {"text": l.test}, "subject": ref, "effectiveDateTime": _iso(l.taken_at), "valueString": f"{l.value} {l.unit or ''}".strip()}
        if l.ref_range:
            r["referenceRange"] = [{"text": l.ref_range}]
        if l.flag != "normal":
            r["interpretation"] = [{"text": l.flag}]
        entries.append({"resource": r})
    for x in db.query(RadiologyReport).filter(RadiologyReport.user_id == uid).all():
        r = {"resourceType": "DiagnosticReport", "id": f"rad-{x.id}", "status": "final", "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "RAD"}]}],
             "code": {"text": f"{x.modality.upper()} {x.body_part}"}, "subject": ref, "effectiveDateTime": _iso(x.performed_at)}
        if x.impression:
            r["conclusion"] = x.impression
        if x.image_url:
            r["presentedForm"] = [{"contentType": "image/*", "url": x.image_url}]
        entries.append({"resource": r})
    for i in db.query(Immunisation).filter(Immunisation.user_id == uid).all():
        entries.append({"resource": {"resourceType": "Immunization", "id": f"im-{i.id}", "status": "completed", "vaccineCode": {"text": i.vaccine}, "patient": ref,
                                     "occurrenceDateTime": i.given_on.isoformat()}})
    for v in db.query(CareVisit).filter(CareVisit.user_id == uid).all():
        r = {"resourceType": "Encounter", "id": f"enc-{v.id}", "status": "finished" if v.checked_out_at else "in-progress", "class": {"code": {"clinic": "AMB", "emergency": "EMER", "admission": "IMP"}[v.kind]},
             "subject": ref, "period": {"start": _iso(v.checked_in_at)}}
        if v.checked_out_at:
            r["period"]["end"] = _iso(v.checked_out_at)
        entries.append({"resource": r})
    return {"resourceType": "Bundle", "type": "collection", "timestamp": _iso(_now()), "entry": entries,
            "meta": {"source": "HEWAL3 health record, shared by the patient with a time-limited code"}}


class RedeemIn(BaseModel):
    code: str = Field(..., min_length=6, max_length=20)


@router.post("/doctor-portal/exchange/redeem")
def redeem(body: RedeemIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """A doctor at another clinic enters the code the patient gave them and receives the shared record as a FHIR bundle."""
    _hit(f"redeem:{doctor.id}", 8, 600, "Too many attempts. Try again in a few minutes.")
    s = db.query(RecordShare).filter(RecordShare.code_hash == _hash(body.code)).first()
    if not s or s.revoked_at is not None or _aware(s.expires_at) <= _now() or s.uses >= s.max_uses:
        raise HTTPException(404, "This code is not valid, or it has expired or was cancelled.")
    s.uses += 1
    db.add(RecordShareUse(share_id=s.id, user_id=s.user_id, doctor_pk=doctor.id))
    db.commit()
    user = db.query(User).filter(User.id == s.user_id).first()
    p = _profile(db, user) if user else None
    from app.services.names import person_name
    return _fhir(db, s.user_id, person_name(user, p) if user else "Patient")
