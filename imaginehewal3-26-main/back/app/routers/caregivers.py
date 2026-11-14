from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging
from pydantic import BaseModel
from app.database import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.models.caregiver import CaregiverRelationship
from app.models.notification import Notification
# Reuse messaging WebSocket manager for real-time signals when online
from app.routers.messages import manager as ws_manager

router = APIRouter(prefix="/caregivers", tags=["caregivers"])
logger = logging.getLogger(__name__)

# Pydantic Models
class CaregiverUpdateRequest(BaseModel):
    phone_number: Optional[str] = None

class AssignPatientRequest(BaseModel):
    patient_id: int
    relationship_type: str = "family"

class CaregiverProfileResponse(BaseModel):
    id: int
    email: str
    username: Optional[str]
    phone_number: Optional[str]
    is_caregiver: bool
    assigned_patients_count: int
    created_at: datetime

class CaregiverPatientResponse(BaseModel):
    patient_id: int
    email: str
    username: Optional[str]
    phone_number: Optional[str]
    relationship_type: str
    status: str
    assigned_since: datetime

class PatientCaregiverResponse(BaseModel):
    caregiver_id: int
    email: str
    username: Optional[str]
    phone_number: Optional[str]
    relationship_type: str
    status: str
    connected_since: datetime

class IncomingRequestResponse(BaseModel):
    request_id: int
    caregiver_id: int
    caregiver_name: str
    caregiver_email: str
    relationship_type: str
    status: str
    created_at: datetime

class RespondRequestBody(BaseModel):
    action: str  # "approve" or "reject"

# Helper function to check if user is caregiver
def verify_caregiver(user: User) -> None:
    """Raise exception if user is not a caregiver"""
    if not getattr(user, 'is_caregiver', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires caregiver privileges"
        )

# Helper function to get approved relationships
def get_approved_relationships(user_id: int, db: Session) -> List[CaregiverRelationship]:
    """Get approved caregiver relationships for a user"""
    return db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == user_id,
        CaregiverRelationship.status == "approved"
    ).all()


def _create_notification(db: Session, user_id: int, title: str, message: str, sender_id: int, sender_type: str = "caregiver"):
    notification = Notification(
        user_id=user_id,
        notification_type="caregiver",
        title=title,
        message=message,
        sender_id=sender_id,
        sender_type=sender_type
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def _push_ws_event(user_id: int, payload: dict):
    try:
        await ws_manager.send_personal_message(payload, user_id)
    except Exception as e:
        # Non-fatal: user might be offline
        print(f"WS notify failed for user {user_id}: {e}")

# Endpoints
@router.get("/profile", response_model=CaregiverProfileResponse)
def get_caregiver_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get caregiver profile information"""
    verify_caregiver(current_user)
    
    assignments = get_approved_relationships(current_user.id, db)
    
    return {
        "id": current_user.id,
        "email": current_user.email or "",
        "username": getattr(current_user, 'username', None),
        "phone_number": getattr(current_user, 'phone_number', None),
        "is_caregiver": getattr(current_user, 'is_caregiver', False),
        "assigned_patients_count": len(assignments),
        "created_at": getattr(current_user, 'created_at', datetime.utcnow())
    }

def _assigned_patient_row(db: Session, rel: CaregiverRelationship):
    from app.models.user import UserProfile
    from app.services.care_snapshot import snapshot
    patient = db.query(User).filter(User.id == rel.patient_id).first()
    if not patient:
        return None
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient.id).first()
    snap = snapshot(db, patient, profile)
    return {
        "id": patient.id,
        "patient_id": patient.patient_id or f"PAT{patient.id:06d}",
        "patient_name": snap["name"],
        "email": patient.email or "",
        "username": getattr(patient, "username", None),
        "phone_number": getattr(patient, "phone_number", None),
        "age": snap["age"], "gender": snap["gender"],
        "status": snap["status"], "reasons": snap["reasons"],
        "health_score": None,
        "last_checkup": snap["vitals"]["at"],
        "conditions": snap["conditions"],
        "vitals": snap["vitals"],
        "assigned_at": rel.created_at,
        "assigned_since": rel.created_at,
        "relationship_type": rel.relationship_type,
    }


@router.get("/patients")
def get_assigned_patients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Patients this caregiver looks after, most urgent first, with live status from their phone or watch."""
    verify_caregiver(current_user)
    rows = [r for r in (_assigned_patient_row(db, rel) for rel in get_approved_relationships(current_user.id, db)) if r]
    order = {"critical": 0, "monitor": 1, "stable": 2, "no_data": 3}
    rows.sort(key=lambda r: (order.get(r["status"], 9), r["patient_name"].lower()))
    return rows


@router.get("/patients/stats")
def get_patient_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_caregiver(current_user)
    rows = [r for r in (_assigned_patient_row(db, rel) for rel in get_approved_relationships(current_user.id, db)) if r]
    pending = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == current_user.id, CaregiverRelationship.status == "pending").count()
    return {
        "total_patients": len(rows),
        "active_patients": sum(1 for r in rows if r["status"] != "no_data"),
        "pending_requests": pending,
        "critical_patients": sum(1 for r in rows if r["status"] == "critical"),
        "average_health_score": 0,
    }


def _owned_patient_rel(db: Session, caregiver: User, patient_id: int) -> CaregiverRelationship:
    rel = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == caregiver.id, CaregiverRelationship.patient_id == patient_id,
        CaregiverRelationship.status == "approved").first()
    if not rel:
        raise HTTPException(status_code=404, detail="Patient not found or not linked to you")
    return rel


@router.get("/patients/{patient_id}/overview")
def get_patient_overview(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Everything the caregiver needs about one patient: live vitals, last 24 h, medicines, emergencies, doctor."""
    from datetime import timedelta, timezone
    from app.models.safety import SosEvent
    from app.models.iot_device import VitalReading
    from app.services.emergency_service import event_dict
    from app.models.safety import Medication, MedicationLog
    from app.models.caregiver import Doctor
    from app.models.user import UserProfile
    from app.services.care_snapshot import iso
    verify_caregiver(current_user)
    rel = _owned_patient_rel(db, current_user, patient_id)
    row = _assigned_patient_row(db, rel)
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    readings = (db.query(VitalReading).filter(VitalReading.user_id == patient_id, VitalReading.timestamp >= since)
                .order_by(VitalReading.timestamp.desc()).limit(120).all())
    today = datetime.now().date()
    taken = {(l.medication_id, l.time) for l in db.query(MedicationLog).filter(
        MedicationLog.user_id == patient_id, MedicationLog.day == today, MedicationLog.status == "taken").all()}
    meds = [{"name": m.name, "dose": m.dose, "doses": [{"time": t, "taken": (m.id, t) in taken} for t in (m.times or [])]}
            for m in db.query(Medication).filter_by(user_id=patient_id, active=True).all()]
    events = db.query(SosEvent).filter(SosEvent.user_id == patient_id).order_by(SosEvent.id.desc()).limit(10).all()
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.doctor_id == profile.doctor_id).first() if profile and profile.doctor_id else None
    return {
        "patient": row,
        "vitals_series": [{"at": iso(r.timestamp), "heart_rate": r.heart_rate, "blood_oxygen": r.blood_oxygen,
                           "systolic": r.blood_pressure_systolic, "diastolic": r.blood_pressure_diastolic} for r in reversed(readings)],
        "medications": meds,
        "emergencies": [event_dict(db, e) for e in events],
        "doctor": {"name": doctor.full_name, "specialization": doctor.specialization, "hospital": doctor.hospital} if doctor else None,
    }


@router.get("/my-caregivers", response_model=List[PatientCaregiverResponse])
def get_my_caregivers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Caregivers who are approved to see this patient's health."""
    relationships = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.patient_id == current_user.id,
        CaregiverRelationship.status == "approved"
    ).all()

    caregivers = []
    for rel in relationships:
        caregiver = db.query(User).filter(User.id == rel.caregiver_id).first()
        if not caregiver:
            continue
        caregivers.append({
            "caregiver_id": caregiver.id,
            "email": caregiver.email or "",
            "username": getattr(caregiver, 'username', None),
            "phone_number": getattr(caregiver, 'phone_number', None),
            "relationship_type": rel.relationship_type,
            "status": rel.status,
            "connected_since": rel.created_at,
        })
    return caregivers


@router.delete("/patients/{patient_id}")
async def remove_patient_connection(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Caregiver stops looking after a patient."""
    verify_caregiver(current_user)

    relationship = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == current_user.id,
        CaregiverRelationship.patient_id == patient_id
    ).first()

    if not relationship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient connection not found")

    patient = db.query(User).filter(User.id == patient_id).first()

    db.delete(relationship)
    db.commit()

    if patient:
        title = "Caregiver removed connection"
        message = f"Caregiver {current_user.email or current_user.username} has removed you from their patient list."
        _create_notification(db, patient.id, title, message, current_user.id, sender_type="caregiver")
        await _push_ws_event(patient.id, {"type": "connection_removed", "from_user_id": current_user.id})

    return {"message": "Patient removed successfully"}


@router.post("/request-access")
async def request_patient_access(
    request: AssignPatientRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Caregiver asks a patient (by numeric id) for access."""
    verify_caregiver(current_user)

    patient = db.query(User).filter(User.id == request.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    existing = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == current_user.id,
        CaregiverRelationship.patient_id == request.patient_id
    ).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Access request already exists")

    relationship = CaregiverRelationship(
        caregiver_id=current_user.id,
        patient_id=request.patient_id,
        relationship_type=request.relationship_type,
        status="pending"
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)

    title = "New caregiver access request"
    message = f"Caregiver {current_user.email or current_user.username} wants access to your health data."
    _create_notification(db, patient.id, title, message, current_user.id, sender_type="caregiver")
    await _push_ws_event(patient.id, {"type": "connection_request", "request_id": relationship.id, "from_user_id": current_user.id})

    return {
        "message": "Access request sent successfully",
        "request_id": relationship.id,
        "status": relationship.status
    }


@router.put("/profile")
def update_caregiver_profile(
    request: CaregiverUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verify_caregiver(current_user)

    if request.phone_number is not None:
        current_user.phone_number = request.phone_number
    db.commit()

    return {"message": "Profile updated successfully"}


@router.post("/connect-patient")
async def connect_with_patient(
    patient_caregiver_id: str = Body(..., embed=True, description="Patient's Caregiver ID or Patient ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Caregiver connects to a patient using the patient's ID (the patient must approve)."""
    verify_caregiver(current_user)

    logger.info(f"Caregiver {current_user.id} ({current_user.email}) attempting to connect with patient: {patient_caregiver_id}")

    if not patient_caregiver_id or not str(patient_caregiver_id).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patient ID cannot be empty")

    # Look up by caregiver id or patient id first
    patient = db.query(User).filter(
        (User.caregiver_id == patient_caregiver_id) |
        (User.patient_id == patient_caregiver_id)
    ).first()

    # Fall back to the numeric database id
    if not patient:
        try:
            numeric_id = int(patient_caregiver_id)
            patient = db.query(User).filter(User.id == numeric_id).first()
            if patient:
                logger.info(f"Found patient by numeric ID: {numeric_id}")
        except ValueError:
            pass

    if not patient:
        logger.warning(f"Patient not found with ID: {patient_caregiver_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    if patient.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot connect to yourself")

    existing = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == current_user.id,
        CaregiverRelationship.patient_id == patient.id
    ).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Already connected with {patient.email}")

    relationship = CaregiverRelationship(
        caregiver_id=current_user.id,
        patient_id=patient.id,
        relationship_type="professional",
        status="pending"
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)

    logger.info(f"Connection request {relationship.id} sent from caregiver {current_user.id} to patient {patient.id}")

    title = "New caregiver connection request"
    message = f"Caregiver {current_user.email or current_user.username} wants to connect with you."
    _create_notification(db, patient.id, title, message, current_user.id, sender_type="caregiver")
    await _push_ws_event(patient.id, {"type": "connection_request", "request_id": relationship.id, "from_user_id": current_user.id})

    return {
        "message": "Connection request sent to patient",
        "patient_email": patient.email,
        "patient_name": f"{getattr(patient, 'first_name', '')} {getattr(patient, 'last_name', '')}".strip(),
        "request_id": relationship.id,
        "status": relationship.status
    }


@router.post("/connect-caregiver")
async def connect_with_caregiver(
    caregiver_id: str = Body(..., embed=True, description="Caregiver ID to connect with"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Patient invites a caregiver using the caregiver's ID (the caregiver must approve)."""
    if not caregiver_id or not caregiver_id.strip():
        raise HTTPException(status_code=400, detail="Caregiver ID cannot be empty")

    caregiver = db.query(User).filter(User.caregiver_id == caregiver_id).first()
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found")

    if caregiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")

    existing = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == caregiver.id,
        CaregiverRelationship.patient_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Request already exists or you are already connected")

    relationship = CaregiverRelationship(
        caregiver_id=caregiver.id,
        patient_id=current_user.id,
        relationship_type="professional",
        status="pending"
    )
    db.add(relationship)
    db.commit()
    db.refresh(relationship)

    title = "New patient connection request"
    message = f"{current_user.email or current_user.username} wants to connect with you."
    _create_notification(db, caregiver.id, title, message, current_user.id, sender_type="patient")
    await _push_ws_event(caregiver.id, {"type": "connection_request", "request_id": relationship.id, "from_user_id": current_user.id})

    return {
        "message": "Connection request sent to caregiver",
        "caregiver_email": caregiver.email,
        "caregiver_name": f"{getattr(caregiver, 'first_name', '')} {getattr(caregiver, 'last_name', '')}".strip(),
        "request_id": relationship.id,
        "status": relationship.status
    }


@router.get("/requests/incoming", response_model=List[IncomingRequestResponse])
def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pending requests from caregivers waiting for this patient's answer."""
    requests = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.patient_id == current_user.id,
        CaregiverRelationship.status == "pending"
    ).order_by(CaregiverRelationship.created_at.desc()).all()

    result = []
    for rel in requests:
        caregiver = db.query(User).filter(User.id == rel.caregiver_id).first()
        if not caregiver:
            continue
        result.append(IncomingRequestResponse(
            request_id=rel.id,
            caregiver_id=rel.caregiver_id,
            caregiver_name=f"{getattr(caregiver, 'first_name', '')} {getattr(caregiver, 'last_name', '')}".strip() or caregiver.email,
            caregiver_email=caregiver.email,
            relationship_type=rel.relationship_type,
            status=rel.status,
            created_at=rel.created_at
        ))
    return result


@router.post("/requests/{request_id}/respond")
async def respond_request(
    request_id: int,
    body: RespondRequestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """The patient approves or rejects a caregiver's request."""
    rel = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.id == request_id,
        CaregiverRelationship.patient_id == current_user.id
    ).first()

    if not rel:
        raise HTTPException(status_code=404, detail="Request not found")

    if rel.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    action = body.action.lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    rel.status = "approved" if action == "approve" else "rejected"
    db.commit()
    db.refresh(rel)

    title = "Connection response"
    message = f"Patient {current_user.email or current_user.username} {rel.status} your request."
    _create_notification(db, rel.caregiver_id, title, message, current_user.id, sender_type="patient")
    await _push_ws_event(rel.caregiver_id, {"type": "connection_response", "request_id": rel.id, "status": rel.status})

    return {"message": f"Request {rel.status}"}


@router.get("/my-id")
def get_my_caregiver_id(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get caregiver's unique ID"""
    verify_caregiver(current_user)

    if not getattr(current_user, 'caregiver_id', None):
        current_user.caregiver_id = current_user.generate_caregiver_id()
        db.commit()

    return {
        "caregiver_id": current_user.caregiver_id,
        "name": f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip(),
        "email": current_user.email,
        "qr_code_url": f"/caregivers/qr/{current_user.caregiver_id}"
    }
