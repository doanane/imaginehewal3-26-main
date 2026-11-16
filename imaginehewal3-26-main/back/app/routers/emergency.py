"""Emergency Auto-Response API. See app/services/emergency_service.py for the full flow."""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.config import settings
from app.database import get_db
from app.models.caregiver import CaregiverRelationship
from app.models.safety import SosEvent
from app.models.user import User
from app.services import emergency_service as svc

router = APIRouter(prefix="/emergency", tags=["emergency"])


class SosIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)
    grace_seconds: Optional[int] = Field(None, ge=0, le=30)


class LocationIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, ge=0, le=100000)


class SimulateIn(BaseModel):
    heart_rate: Optional[int] = Field(None, ge=0, le=300)
    blood_oxygen: Optional[float] = Field(None, ge=0, le=100)
    systolic: Optional[int] = Field(None, ge=0, le=300)
    diastolic: Optional[int] = Field(None, ge=0, le=200)


def _get(db: Session, user: User, event_id: int) -> SosEvent:
    ev = db.query(SosEvent).filter_by(id=event_id).first()
    if not ev or not svc.can_view(db, user, ev):
        raise HTTPException(404, "Emergency not found")   # same answer whether it exists or not
    if ev.user_id != user.id:
        from app.services import privacy_service
        privacy_service.log_access(db, ev.user_id, user, "emergency")
    return ev


@router.get("/config")
def config(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    c = svc.cfg()
    from app.services import behavior_data as bdata, gulf
    region = bdata.context_for(db, user.id).get("region")
    nums = gulf.emergency_numbers(region)
    number = c["number"] if os.getenv("EMERGENCY_NUMBER") else nums.get("all") or nums.get("ambulance") or c["number"]     # an operator's explicit setting always wins
    return {"emergency_number": number, "numbers": nums, "region": region or "gh", "dispatch_mode": c["mode"], "simulation": c["mode"] != "live",
            "grace_seconds": c["grace_auto"], "ack_wait_seconds": c["ack_wait"], "max_attempts": svc.MAX_ATTEMPTS}


@router.post("/sos")
def sos(body: SosIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ev = svc.create_event(db, user, "manual", body.reason or "SOS pressed by the patient", "critical", grace=body.grace_seconds)
    return svc.event_dict(db, ev, with_logs=True)


@router.get("/active")
def active(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    mine = svc.active_event_for(db, user.id)
    patient_ids = [r.patient_id for r in db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == user.id, CaregiverRelationship.status == "approved").all()]
    others = []
    if patient_ids:
        others = db.query(SosEvent).filter(SosEvent.user_id.in_(patient_ids), SosEvent.status.in_(svc.OPEN)).order_by(SosEvent.id.desc()).all()
    return {"mine": svc.event_dict(db, mine, with_logs=True) if mine else None,
            "patients": [svc.event_dict(db, e, with_logs=True) for e in others]}


@router.get("/{event_id}")
def detail(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.event_dict(db, _get(db, user, event_id), with_logs=True)


@router.post("/{event_id}/ack")
def ack(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ev = _get(db, user, event_id)
    if not svc.acknowledge(db, ev, user):
        raise HTTPException(403, "Only an approved caregiver can acknowledge an open emergency")
    return svc.event_dict(db, ev, with_logs=True)


@router.post("/{event_id}/cancel")
def cancel(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ev = _get(db, user, event_id)
    if not svc.cancel(db, ev, user):
        raise HTTPException(403, "Only the patient can cancel an open emergency")
    return svc.event_dict(db, ev, with_logs=True)


@router.post("/{event_id}/resolve")
def resolve(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ev = _get(db, user, event_id)
    if not svc.resolve(db, ev, user):
        raise HTTPException(403, "Not allowed")
    return svc.event_dict(db, ev, with_logs=True)


@router.post("/{event_id}/location")
def location(event_id: int, body: LocationIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ev = _get(db, user, event_id)
    if not svc.update_location(db, ev, user, body.lat, body.lng, body.accuracy):
        raise HTTPException(403, "Only the patient can share location for an open emergency")
    return {"ok": True}


@router.post("/simulate-vitals")
def simulate_vitals(body: SimulateIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Demo only: feed a critical reading through the real detection and escalation pipeline."""
    if settings.ENVIRONMENT != "development":
        raise HTTPException(404, "Not found")
    ev = svc.check_and_trigger(db, user, body.heart_rate, body.blood_oxygen, force=True, systolic=body.systolic, diastolic=body.diastolic)
    if ev:
        from app.models.iot_device import IoTDevice, VitalReading
        sim = db.query(IoTDevice).filter_by(device_id=f"demo-simulation-{user.id}").first()
        if not sim:
            sim = IoTDevice(user_id=user.id, device_id=f"demo-simulation-{user.id}", device_type="simulation", device_name="Demo simulation", connection_status="demo")
            db.add(sim); db.flush()
        db.add(VitalReading(device_id=sim.id, user_id=user.id, heart_rate=body.heart_rate, blood_oxygen=body.blood_oxygen, blood_pressure_systolic=body.systolic,
                            blood_pressure_diastolic=body.diastolic, is_emergency=True))     # the same reading the clinician and caregiver then see
        db.commit()
    if not ev:
        raise HTTPException(400, "That reading is not in the critical range, so no emergency was started")
    return svc.event_dict(db, ev, with_logs=True)
