from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.services import risk_service as svc

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.assess(db, user)


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    res = svc.assess(db, user)
    return {"tier": res["tier"], "items": svc.recommendations(db, user, res), "disclaimer": svc.DISCLAIMER}


@router.get("/patients")
def patients(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Caregiver and doctor view: every approved patient with their current risk tier, most urgent first."""
    out = svc.patients_overview(db, user)
    from app.services import privacy_service
    for p in out:
        privacy_service.log_access(db, p["patient_id"], user, "risk_summary")
    return out
