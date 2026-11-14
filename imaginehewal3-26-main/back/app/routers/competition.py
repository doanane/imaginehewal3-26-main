"""Leaderboards and achievements. Opt-in only; see competition_service for the fairness rules."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.realtime import hub
from app.models.user import User
from app.services import competition_service as svc
from app.services import participant_service as ps

router = APIRouter(prefix="/competition", tags=["competition"])


class JoinIn(BaseModel):
    display_name: Optional[str] = Field(None, max_length=24)
    accept_rules: bool = False


def _me(db: Session, user: User) -> dict:
    p = ps.get(db, user)
    return {"joined_community": bool(p), "on_leaderboard": bool(p and p.leaderboard_opt_in), "display_name": p.display_name if p else None,
            "suggested_name": ps.suggest_name(user), "rules": ps.RULES,
            "visible_to_others": ["Your display name", "Your steps, distance, workout minutes and points for the period shown"],
            "never_visible": ["Your email, phone number or real name (unless you put it in your display name)", "Your heart rate, weight, sleep or any health condition"]}


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return _me(db, user)


@router.post("/join")
def join(body: JoinIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not body.accept_rules:
        raise HTTPException(400, "Please accept the community rules to join")
    ps.join(db, user, body.display_name, leaderboard=True)
    svc.notify_changed(db, user, force=True)
    return _me(db, user)


@router.post("/leave")
def leave(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    p = ps.get(db, user)
    if p:
        p.leaderboard_opt_in = False
        db.commit()
        hub.broadcast_from_thread({"type": "leaderboard.update"})
    return _me(db, user)


@router.get("/board")
def board(category: str = "steps", period: str = "week", limit: int = 50, q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if category not in svc.CATEGORIES or period not in svc.PERIODS:
        raise HTTPException(422, "Unknown category or period")
    return svc.board(db, user, category, period, max(1, min(limit, 100)), q.strip()[:24])


@router.get("/achievements")
def achievements(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    svc.evaluate(db, user)
    return {"items": svc.list_achievements(db, user)}
