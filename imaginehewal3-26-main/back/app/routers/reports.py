from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.caregiver import CaregiverRelationship
from app.models.user import User
from app.services import privacy_service, summary_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/clinician-summary")
def my_summary(days: int = 30, include_wellbeing: bool = False, db: Session = Depends(get_db),
               user: User = Depends(get_current_active_user)):
    """The patient's own summary, to share with a clinician as they choose."""
    return summary_service.build(db, user, days, include_wellbeing)


@router.get("/clinician-summary/{patient_id}")
def patient_summary(patient_id: int, days: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """An approved caregiver's view of a patient's summary. Wellbeing answers are never included here. The access is logged."""
    ok = db.query(CaregiverRelationship).filter(CaregiverRelationship.caregiver_id == user.id, CaregiverRelationship.patient_id == patient_id,
                                                CaregiverRelationship.status == "approved").first()
    patient = db.query(User).filter(User.id == patient_id).first()
    if not ok or not patient:
        raise HTTPException(404, "Not found")
    privacy_service.log_access(db, patient_id, user, "clinician_summary")
    return summary_service.build(db, patient, days, include_wellbeing=False)
