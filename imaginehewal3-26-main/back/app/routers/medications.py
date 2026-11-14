"""Medicines: schedule, today's doses, taken/skipped logging, weekly adherence."""
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.safety import Medication, MedicationLog
from app.models.user import User
from app.services.risk_service import med_adherence
from app.services.par import par

router = APIRouter(prefix="/medications", tags=["medications"])
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
OVERDUE_AFTER_MIN = 60


class MedIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    dose: Optional[str] = Field(None, max_length=60)
    times: List[str] = Field(..., min_length=1, max_length=6)
    notes: Optional[str] = Field(None, max_length=300)

    @field_validator("times")
    @classmethod
    def _times(cls, v):
        for t in v:
            if not TIME_RE.match(t):
                raise ValueError("times must look like 08:00")
        return sorted(set(v))


class DoseLog(BaseModel):
    time: str
    status: str = Field(..., pattern="^(taken|skipped)$")
    day: Optional[date] = None


def _med(db: Session, user: User, med_id: int) -> Medication:
    m = db.query(Medication).filter_by(id=med_id, user_id=user.id, active=True).first()
    if not m:
        raise HTTPException(404, "Medicine not found")
    return m


def _dict(m: Medication) -> dict:
    return {"id": m.id, "name": m.name, "dose": m.dose, "times": m.times, "notes": m.notes}


@router.get("")
def list_meds(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return [_dict(m) for m in db.query(Medication).filter_by(user_id=user.id, active=True).order_by(Medication.id).all()]


@router.post("")
def add_med(body: MedIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if db.query(Medication).filter_by(user_id=user.id, active=True).count() >= 30:
        raise HTTPException(400, "Too many medicines")
    m = Medication(user_id=user.id, name=body.name.strip(), dose=body.dose, times=body.times, notes=body.notes)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _dict(m)


@router.delete("/{med_id}")
def remove_med(med_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    _med(db, user, med_id).active = False
    db.commit()
    return {"removed": True}


@router.get("/today")
def today(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    day, now = date.today(), datetime.now()
    uid = user.id
    meds, log_rows, adherence = par(
        lambda d: d.query(Medication).filter_by(user_id=uid, active=True).all(),
        lambda d: d.query(MedicationLog).filter_by(user_id=uid, day=day).all(),
        lambda d: med_adherence(d, uid),
    )
    logs = {(l.medication_id, l.time): l.status for l in log_rows}
    doses = []
    for m in meds:
        for t in m.times or []:
            status = logs.get((m.id, t))
            if not status:
                due = datetime.combine(day, datetime.strptime(t, "%H:%M").time())
                status = "overdue" if now > due + timedelta(minutes=OVERDUE_AFTER_MIN) else "pending"
            doses.append({"medication_id": m.id, "name": m.name, "dose": m.dose, "time": t, "status": status})
    doses.sort(key=lambda d: (d["time"], d["name"]))
    taken = sum(1 for d in doses if d["status"] == "taken")
    return {"date": day.isoformat(), "doses": doses, "taken": taken, "total": len(doses), "weekly_adherence": adherence}


@router.post("/{med_id}/log")
def log_dose(med_id: int, body: DoseLog, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    m = _med(db, user, med_id)
    if body.time not in (m.times or []):
        raise HTTPException(400, "That time is not in this medicine's schedule")
    day = body.day or date.today()
    if day > date.today() or day < date.today() - timedelta(days=7):
        raise HTTPException(400, "You can log doses for today or the last 7 days")
    row = db.query(MedicationLog).filter_by(medication_id=m.id, user_id=user.id, day=day, time=body.time).first()
    if row:
        row.status = body.status
    else:
        db.add(MedicationLog(medication_id=m.id, user_id=user.id, day=day, time=body.time, status=body.status))
    db.commit()
    return {"ok": True, "status": body.status}
