"""Support around the daily step: a supporter the person chooses, group challenges, impact figures, and the doctor's view.

The rules this file enforces (and tests/test_behavior_support.py proves):
  * Sharing starts only from the person, goes only to a caregiver they already approved, and ends the moment they say so.
  * A supporter learns whether encouragement would help (and, if allowed, how many days were active). Never a reading, a value or a detail.
  * A cheer is one of three preset kind messages, at most one a day per supporter. No free text, so it cannot be used to pressure.
  * A group shows totals, and only when five or more people have joined. Nobody, including whoever created it, sees an individual.
  * A doctor sees a patient's behaviour progress only if that patient switched "share with my doctor" on.
"""
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user
from app.database import get_db
from app.models.behavior import (BehaviorAction, BehaviorCheer, BehaviorGroup, BehaviorGroupMember, BehaviorPlan, BehaviorSettings, BehaviorShare)
from app.models.caregiver import CaregiverRelationship, Doctor
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.realtime import hub
from app.routers.doctor_portal import _my_patients, _owned_patient
from app.services import behavior_engine as eng
from app.services import behavior_impact as impact
from app.services import push

router = APIRouter(prefix="/behavior", tags=["behavior_support"])
doctor_router = APIRouter(prefix="/doctor-portal", tags=["doctor_behavior"])

MIN_CELL = impact.MIN_CELL
CHEERS = {
    "proud": {"en": "{name} is proud of you.", "ar": "{name} فخور بك.", "fr": "{name} est fier de vous."},
    "keep_going": {"en": "{name} says: keep going, every step counts.", "ar": "{name} يقول: واصل، كل خطوة تُحسب.", "fr": "{name} dit : continuez, chaque pas compte."},
    "thinking_of_you": {"en": "{name} is thinking of you.", "ar": "{name} يفكر بك.", "fr": "{name} pense à vous."},
}
BEHAVIOR_LABEL = {"movement": "Moving more", "activity": "Being active", "nutrition": "Eating more vegetables and fruit", "sleep": "Sleeping better"}


# ------------------------------------------------------------------ helpers
def _name(db: Session, user_id: int, first_only: bool = True) -> str:
    u = db.query(User).filter(User.id == user_id).first()
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    full = (p.full_name if p and p.full_name else None) or (f"{u.first_name or ''} {u.last_name or ''}".strip() if u else "") or (u.username if u else "") or "Someone"
    return full.split()[0] if first_only else full


def _status(db: Session, plan: BehaviorPlan) -> Dict[date, str]:
    return {r.action_date: r.status for r in db.query(BehaviorAction).filter(BehaviorAction.plan_id == plan.id, BehaviorAction.status != "pending").all()}


def _is_approved_caregiver(db: Session, caregiver_id: int, patient_id: int) -> bool:
    return db.query(CaregiverRelationship).filter(CaregiverRelationship.caregiver_id == caregiver_id, CaregiverRelationship.patient_id == patient_id,
                                                  CaregiverRelationship.status == "approved").first() is not None


def _lang(db: Session, user_id: int) -> str:
    s = db.query(BehaviorSettings).filter_by(user_id=user_id).first()
    return (s.language if s and s.language in eng.MESSAGES else "en") or "en"


# ------------------------------------------------------------------ supporters
class ShareIn(BaseModel):
    plan_id: int
    supporter_id: int
    level: str = Field("cheers", pattern="^(cheers|progress)$")


class CheerIn(BaseModel):
    to_user_id: int
    kind: str


@router.get("/supporters")
def eligible_supporters(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Who the person could choose: caregivers who already have their approval. Nobody else can be picked."""
    rels = db.query(CaregiverRelationship).filter(CaregiverRelationship.patient_id == user.id, CaregiverRelationship.status == "approved").all()
    return {"eligible": [{"id": r.caregiver_id, "name": _name(db, r.caregiver_id, False), "relationship": r.relationship_type} for r in rels]}


@router.post("/shares")
def share_plan(body: ShareIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    plan = db.query(BehaviorPlan).filter_by(id=body.plan_id, user_id=user.id, active=True).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    if not _is_approved_caregiver(db, body.supporter_id, user.id):
        raise HTTPException(403, "You can only share with a caregiver you have approved")
    row = db.query(BehaviorShare).filter_by(owner_id=user.id, supporter_id=body.supporter_id, plan_id=plan.id).first()
    if row:
        row.active, row.level = True, body.level
    else:
        row = BehaviorShare(owner_id=user.id, supporter_id=body.supporter_id, plan_id=plan.id, level=body.level)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "supporter": _name(db, row.supporter_id, False), "plan_id": row.plan_id, "level": row.level}


@router.get("/shares")
def my_shares(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    rows = db.query(BehaviorShare).filter_by(owner_id=user.id, active=True).all()
    return {"shares": [{"id": s.id, "plan_id": s.plan_id, "supporter_id": s.supporter_id, "supporter": _name(db, s.supporter_id, False), "level": s.level} for s in rows]}


@router.delete("/shares/{share_id}")
def stop_share(share_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    row = db.query(BehaviorShare).filter_by(id=share_id, owner_id=user.id).first()
    if not row:
        raise HTTPException(404, "Not found")
    row.active = False
    db.commit()
    return {"stopped": True}


@router.get("/supporting")
def people_i_support(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """For a supporter: the people who chose them, with only what each person allowed."""
    today, out = date.today(), []
    for s in db.query(BehaviorShare).filter_by(supporter_id=user.id, active=True).all():
        plan = db.query(BehaviorPlan).filter_by(id=s.plan_id, active=True).first()
        if not plan:
            continue
        status = _status(db, plan)
        missed = eng.consecutive_missed_days(status, today, plan.start_date)
        item = {"owner_id": s.owner_id, "name": _name(db, s.owner_id), "behavior": BEHAVIOR_LABEL.get(plan.behavior, plan.behavior),
                "could_use_encouragement": missed >= eng.LAPSE_DAYS, "level": s.level}
        if s.level == "progress":
            item["active_days_last_7"] = sum(1 for i in range(1, 8) if status.get(today - timedelta(days=i)) in ("done", "partial"))
        out.append(item)
    return {"people": out, "cheers": list(CHEERS.keys()),
            "note": "You see only what each person chose to share. No readings, no details. You can send a kind preset message, once a day per person."}


@router.post("/cheers")
def send_cheer(body: CheerIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if body.kind not in CHEERS:
        raise HTTPException(400, f"kind must be one of {list(CHEERS)}")
    if not db.query(BehaviorShare).filter_by(owner_id=body.to_user_id, supporter_id=user.id, active=True).first():
        raise HTTPException(403, "This person has not chosen you as a supporter")
    day_start = datetime.combine(date.today(), datetime.min.time())
    if db.query(BehaviorCheer).filter(BehaviorCheer.from_id == user.id, BehaviorCheer.to_id == body.to_user_id, BehaviorCheer.created_at >= day_start).first():
        raise HTTPException(429, "You already sent a message today. One a day keeps it kind, not pushy.")
    text = CHEERS[body.kind][_lang(db, body.to_user_id)].format(name=_name(db, user.id))
    db.add(BehaviorCheer(from_id=user.id, to_id=body.to_user_id, kind=body.kind))
    db.add(Notification(user_id=body.to_user_id, notification_type="behavior_cheer", title="A kind word", message=text, sender_id=user.id, sender_type="supporter"))
    db.commit()
    hub.send_from_thread(body.to_user_id, {"type": "notification.new", "title": "A kind word", "message": text})
    push.notify_users([body.to_user_id], "A kind word", text, {"type": "behavior_cheer"})
    return {"sent": True, "message": text}


@router.get("/cheers")
def my_cheers(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    rows = db.query(BehaviorCheer).filter_by(to_id=user.id).order_by(BehaviorCheer.id.desc()).limit(20).all()
    lang = _lang(db, user.id)
    return {"cheers": [{"text": CHEERS[c.kind][lang].format(name=_name(db, c.from_id)), "at": c.created_at.isoformat() if c.created_at else None} for c in rows if c.kind in CHEERS]}


# ------------------------------------------------------------------ groups (workplace, community, family)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"        # no 0/O/1/I, so a code read aloud is not mistyped


class GroupIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    kind: str = Field("community", pattern="^(workplace|community|family)$")


class JoinIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


def group_summary(db: Session, group: BehaviorGroup, today: Optional[date] = None) -> dict:
    """Totals only. Hidden entirely under MIN_CELL members, and hidden per figure when too few have a plan."""
    today = today or date.today()
    members = [m.user_id for m in db.query(BehaviorGroupMember).filter_by(group_id=group.id).all()]
    base = {"id": group.id, "name": group.name, "kind": group.kind, "members": len(members)}
    if len(members) < MIN_CELL:
        return {**base, "visible": False, "note": f"Group results appear when {MIN_CELL} or more people have joined, so no one can be picked out."}
    plans = db.query(BehaviorPlan).filter(BehaviorPlan.user_id.in_(members), BehaviorPlan.active == True).all()  # noqa: E712
    people_with_plan = {p.user_id for p in plans}
    engaged, done_week, rates = set(), 0, []
    for p in plans:
        st = _status(db, p)
        for i in range(1, 8):
            v = st.get(today - timedelta(days=i))
            if v in ("done", "partial"):
                engaged.add(p.user_id)
            done_week += 1 if v == "done" else 0
        rate, n = eng.adherence(st, today, 14, p.start_date)
        if n >= 7:
            rates.append(rate)
    if len(people_with_plan) < MIN_CELL:
        return {**base, "visible": False, "note": f"{MIN_CELL} or more members need an active plan before totals are shown."}
    return {**base, "visible": True, "with_a_plan": len(people_with_plan), "active_this_week_pct": round(100 * len(engaged) / len(people_with_plan)),
            "steps_completed_this_week": done_week, "average_adherence_pct": round(100 * sum(rates) / len(rates)) if rates else None,
            "privacy": "Totals only. No names and no individual results are shown to anyone in the group."}


@router.post("/groups")
def create_group(body: GroupIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    for _ in range(10):
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not db.query(BehaviorGroup).filter_by(join_code=code).first():
            break
    g = BehaviorGroup(name=body.name.strip(), kind=body.kind, join_code=code, created_by=user.id)
    db.add(g)
    db.flush()
    db.add(BehaviorGroupMember(group_id=g.id, user_id=user.id))
    db.commit()
    return {**group_summary(db, g), "join_code": g.join_code}


@router.post("/groups/join")
def join_group(body: JoinIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    g = db.query(BehaviorGroup).filter_by(join_code=body.code.strip().upper()).first()
    if not g:
        raise HTTPException(404, "No group with that code")
    if not db.query(BehaviorGroupMember).filter_by(group_id=g.id, user_id=user.id).first():
        db.add(BehaviorGroupMember(group_id=g.id, user_id=user.id))
        db.commit()
    return group_summary(db, g)


@router.get("/groups")
def my_groups(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ids = [m.group_id for m in db.query(BehaviorGroupMember).filter_by(user_id=user.id).all()]
    groups = db.query(BehaviorGroup).filter(BehaviorGroup.id.in_(ids)).all() if ids else []
    return {"groups": [{**group_summary(db, g), **({"join_code": g.join_code} if g.created_by == user.id else {})} for g in groups]}


@router.delete("/groups/{group_id}/membership")
def leave_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    db.query(BehaviorGroupMember).filter_by(group_id=group_id, user_id=user.id).delete()
    db.commit()
    return {"left": True}


# ------------------------------------------------------------------ impact
@router.get("/impact")
def programme_impact(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Programme-wide results for everyone using the loop: retention, persistence, recovery, change, biomarkers, outreach and equity.
    Aggregates only; groups under five people are hidden."""
    return impact.compute_impact(db)


# ------------------------------------------------------------------ the doctor's view (consent first)
def _consented(db: Session, patient_id: int) -> bool:
    s = db.query(BehaviorSettings).filter_by(user_id=patient_id).first()
    return bool(s and s.share_with_doctor)


@doctor_router.get("/patients/{patient_id}/behavior")
def patient_behavior(patient_id: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, _ = _owned_patient(db, doctor, patient_id)
    if not _consented(db, user.id):
        return {"shared": False, "message": "This patient has not chosen to share their habit progress with you. They can switch it on in the app under Habits, Settings."}
    today, out = date.today(), []
    for plan in db.query(BehaviorPlan).filter_by(user_id=user.id, active=True).all():
        status = _status(db, plan)
        vals = {r.action_date: r.value_done for r in db.query(BehaviorAction).filter(BehaviorAction.plan_id == plan.id, BehaviorAction.value_done.isnot(None)).all()}
        o = eng.outcomes(status, vals, plan.baseline_value, eng.BEHAVIORS[plan.behavior]["direction"], plan.start_date, today)
        o["streak"] = eng.streaks(status, today)
        out.append({"behavior": BEHAVIOR_LABEL.get(plan.behavior, plan.behavior), "unit": plan.unit, "started": plan.start_date.isoformat(),
                    "baseline": plan.baseline_value, "goal": plan.goal_value, "level": plan.level,
                    "state": eng.detect_lapse(status, today, plan.start_date)["state"], "outcomes": o})
    return {"shared": True, "plans": out, "note": "Shared by the patient. A lapse is part of change; use it to support, not to judge."}


@doctor_router.get("/behavior/impact")
def panel_impact(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """Results across this doctor's patients who chose to share. Needs five sharing patients before anything is shown."""
    ids = [u.id for u, _ in _my_patients(db, doctor) if _consented(db, u.id)]
    return impact.compute_impact(db, user_ids=ids)
