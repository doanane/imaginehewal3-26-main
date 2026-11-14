"""Public identity for the community and leaderboards. Opt-in; display names are never emails or phone numbers."""
import random
import re
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import Participant
from app.models.user import User

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.\-]{2,23}$")
RULES = [
    "Be kind. No insults, bullying or hate.",
    "Share your own experience. Community advice is from other members, not from clinicians. Talk to your clinician before changing treatment.",
    "The marketplace is only for health and fitness items that help people use this app. Medicines, alcohol, tobacco and anything illegal are not allowed.",
    "Do not share other people's private details. Keep your own phone number out of discussions.",
    "If you are in danger or thinking about harming yourself, call your emergency number now.",
]


def get(db: Session, user: User) -> Optional[Participant]:
    return db.query(Participant).filter_by(user_id=user.id).first()


def suggest_name(user: User) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    base = (first + (" " + last[0] + "." if last else "")).strip() or (user.username or "").split("@")[0] or "Member"
    base = re.sub(r"[^A-Za-z0-9 _.\-]", "", base)[:20].strip() or "Member"
    return base if len(base) >= 3 else base + "123"


def validate_name(name: str) -> str:
    name = " ".join(name.split())
    if not NAME_RE.match(name):
        raise HTTPException(422, "Choose a name of 3 to 24 letters, numbers, spaces, dots, dashes or underscores")
    if "@" in name or re.search(r"\d{6,}", name.replace(" ", "")):
        raise HTTPException(422, "A display name cannot be an email address or phone number")
    return name


def _unique(db: Session, name: str, user_id: int) -> str:
    candidate = name
    while db.query(Participant).filter(func.lower(Participant.display_name) == candidate.lower(), Participant.user_id != user_id).first():
        candidate = f"{name[:19]}{random.randint(10, 99)}"
    return candidate


def join(db: Session, user: User, display_name: Optional[str], leaderboard: Optional[bool] = None) -> Participant:
    p = get(db, user)
    if p:
        if display_name and display_name != p.display_name:
            p.display_name = _unique(db, validate_name(display_name), user.id)
        if leaderboard is not None:
            p.leaderboard_opt_in = leaderboard
    else:
        name = _unique(db, validate_name(display_name or suggest_name(user)), user.id)
        p = Participant(user_id=user.id, display_name=name, leaderboard_opt_in=bool(leaderboard))
        db.add(p)
    db.commit()
    db.refresh(p)
    return p


def require(db: Session, user: User) -> Participant:
    p = get(db, user)
    if not p:
        raise HTTPException(403, "Join the community first and accept the community rules")
    return p
