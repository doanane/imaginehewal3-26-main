from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.trust import WellbeingCheckin
from app.models.user import User
from app.services import emergency_service, wellbeing_service as svc

router = APIRouter(prefix="/wellbeing", tags=["wellbeing"])


class CheckinIn(BaseModel):
    answers: List[int] = Field(..., min_length=4, max_length=4)
    safety: bool = False


@router.get("/questionnaire")
def questionnaire(user: User = Depends(get_current_active_user)):
    return svc.questionnaire()


@router.get("/due")
def due(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.due(db, user)


@router.post("/checkin")
def checkin(body: CheckinIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    try:
        s = svc.score(body.answers)
    except ValueError as e:
        raise HTTPException(422, str(e))
    last = db.query(WellbeingCheckin).filter_by(user_id=user.id).order_by(WellbeingCheckin.id.desc()).first()
    if last and last.created_at:
        created = last.created_at if last.created_at.tzinfo else last.created_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - created < timedelta(minutes=30):
            raise HTTPException(429, "You already checked in a moment ago. Please try again later.")
    row = WellbeingCheckin(user_id=user.id, answers=body.answers, phq2=s["phq2"], gad2=s["gad2"], safety_flag=body.safety)
    db.add(row)
    db.commit()
    out = svc.assess(s["phq2"], s["gad2"], body.safety, emergency_service.cfg()["number"])
    return {"id": row.id, **s, **out, "summary": svc.summary(db, user)}


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.summary(db, user)


@router.post("/ask-for-support")
def ask_for_support(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """The user chooses to ask their care team to check in. Nothing from the questionnaire is shared."""
    n = svc.ask_for_support(db, user)
    return {"notified": n, "message": "Your care team has been asked to check in on you." if n else
            "You have no caregivers connected yet. You can add one in Care, or speak to someone you trust."}
