"""The care agent's window: what it senses, decides and does for one person, who a clinician is asked to look at, and a public story.

  Patient   GET  /agent/loop           my own loop right now, in plain words (why am I getting this message?)
            POST /agent/act            one-tap answers: make my step smaller, stop messages, not helpful
  Doctor    GET  /doctor-portal/agent/queue                 hand-offs waiting for review, and recently reviewed
            GET  /doctor-portal/patients/{id}/agent         the live loop for one patient (habit detail only if they shared it)
            POST /doctor-portal/agent/runs/{id}/review      approve, change or dismiss, optionally with a message to the patient
  Public    GET  /agent/story                               one simulated person, one moment, the same rules the live service runs

Consent: a doctor sees habit detail only when the patient switched sharing on. A safety hand-off (a very high reading) is shown with its
clinical reason only, because the doctor already sees the patient's readings.
"""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user
from app.database import get_db
from app.models.behavior import AgentRun, BehaviorPlan
from app.models.caregiver import Doctor
from app.models.user import User, UserProfile
from app.routers.behavior import _settings
from app.routers.behavior_support import _consented
from app.routers.doctor_portal import _my_patients, _owned_patient, _push_message
from app.services import care_agent as ca

router = APIRouter(prefix="/agent", tags=["care_agent"])
doctor_router = APIRouter(prefix="/doctor-portal", tags=["doctor_agent"])


def _run_row(r: AgentRun) -> dict:
    return {"id": r.id, "kind": r.kind, "created_at": r.created_at.isoformat() if r.created_at else None, "handoff": bool(r.handoff_needed),
            "review_status": r.review_status, "came_back": bool(r.returned)}


# ------------------------------------------------------------------ the person's own view
@router.get("/loop")
def my_loop(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    inp = ca.gather(db, user)
    if inp is None:
        return {"has_plan": False, "message": "Start one habit and your care agent will begin to look after your routine. Nothing is sent until you have a plan."}
    t = ca.trace(inp)
    runs = db.query(AgentRun).filter(AgentRun.user_id == user.id).order_by(AgentRun.id.desc()).limit(5).all()
    return {"has_plan": True, **t, "history": [_run_row(r) for r in runs]}


class ActIn(BaseModel):
    action: Literal["smaller", "stop_messages", "not_helpful"]


@router.post("/act")
def act(body: ActIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    s = _settings(db, user)
    if body.action == "smaller":
        n = 0
        for p in db.query(BehaviorPlan).filter(BehaviorPlan.user_id == user.id, BehaviorPlan.active == True).all():  # noqa: E712
            if p.level > 1:
                p.level -= 1
                n += 1
        db.commit()
        return {"ok": True, "changed": n, "message": "Done. Your next step will be smaller." if n else "Your step is already as small as it goes."}
    if body.action == "stop_messages":
        s.reengage_channel = "none"
        db.commit()
        return {"ok": True, "message": "Messages are off. Your plan and progress are kept. You can turn them back on in Habits, Settings."}
    if (s.reengage_channel or "push") == "push":
        s.reengage_channel = "in_app"
    db.commit()
    return {"ok": True, "message": "Thank you. We will send quieter messages inside the app only."}


# ------------------------------------------------------------------ the story (public, simulated)
@router.get("/story")
def the_story(scenario: Literal["lapse", "safety"] = "lapse"):
    return ca.story(scenario)


# ------------------------------------------------------------------ the doctor's view
def _name(db: Session, user: User) -> str:
    p = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return (p.full_name if p and p.full_name else None) or user.username or user.email


@doctor_router.get("/agent/queue")
def queue(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    mine = {u.id: u for u, _ in _my_patients(db, doctor)}
    if not mine:
        return {"pending": [], "reviewed": []}
    rows = (db.query(AgentRun).filter(AgentRun.user_id.in_(list(mine)), AgentRun.handoff_needed == True)  # noqa: E712
            .order_by(AgentRun.id.desc()).limit(80).all())

    def visible(r: AgentRun) -> bool:
        # habit detail only with consent; without it, only a safety reason is ever shown
        return _consented(db, r.user_id) or any(x.get("code") == "safety" for x in r.trace["handoff"]["reasons"])
    rows = [r for r in rows if visible(r)]

    def item(r: AgentRun) -> dict:
        shared = _consented(db, r.user_id)
        t = r.trace if shared else ca.redact(r.trace)
        return {**_run_row(r), "patient_id": r.user_id, "patient": _name(db, mine[r.user_id]), "shared": shared, "trace": t,
                "review_note": r.review_note}
    return {"pending": [item(r) for r in rows if r.review_status == "pending"],
            "reviewed": [item(r) for r in rows if r.review_status not in ("pending", "none")][:20]}


@doctor_router.get("/patients/{patient_id}/agent")
def patient_loop(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    inp = ca.gather(db, user)
    if inp is None:
        return {"has_plan": False, "message": "This patient has no habit plan yet."}
    t = ca.trace(inp)
    if not _consented(db, user.id):
        return {"has_plan": True, "shared": False, **ca.redact(t)}
    return {"has_plan": True, "shared": True, **t}


class ReviewIn(BaseModel):
    decision: Literal["approve", "override", "dismiss"]
    note: Optional[str] = Field(None, max_length=500)
    message: Optional[str] = Field(None, max_length=500)       # an optional message to the patient, sent through the normal chat


@doctor_router.post("/agent/runs/{run_id}/review")
def review(run_id: int, body: ReviewIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.handoff_needed == True).first()  # noqa: E712
    if not run:
        raise HTTPException(404, "Hand-off not found")
    user, _ = _owned_patient(db, doctor, run.user_id)                      # only the patient's own doctor may review
    run.review_status = {"approve": "approved", "override": "overridden", "dismiss": "dismissed"}[body.decision]
    run.reviewed_by, run.reviewed_at, run.review_note = doctor.id, datetime.now(timezone.utc), (body.note or None)
    db.commit()
    if body.message and body.message.strip():
        _push_message(db, doctor, user, "doctor", body.message.strip())
    return {"ok": True, "review_status": run.review_status}
