"""POST /auth/guest: sign in to the demo sandbox with no sign-up (see services/guest_sandbox.py)."""
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import create_access_token
from app.database import get_db
from app.models.auth import RefreshToken
from app.services import guest_sandbox as sb

router = APIRouter(prefix="/auth", tags=["guest"])
GUEST_HOURS = 8
_hits: dict = defaultdict(deque)


def guest_enabled() -> bool:
    return os.getenv("GUEST_MODE", "1") != "0"


class GuestIn(BaseModel):
    role: Literal["patient", "doctor"] = "patient"


@router.get("/guest/status")
def guest_status():
    return {"enabled": guest_enabled()}


@router.post("/guest")
def guest_login(body: GuestIn, request: Request, db: Session = Depends(get_db)):
    if not guest_enabled():
        raise HTTPException(404, "Guest access is turned off")
    ip = request.client.host if request.client else "unknown"
    q = _hits[ip]
    now = time.time()
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= 20:
        raise HTTPException(429, "Too many guest sessions from this network. Try again in a few minutes.")
    q.append(now)
    user, doctor = sb.ensure_sandbox(db)
    life = timedelta(hours=GUEST_HOURS)
    if body.role == "doctor":
        token = create_access_token({"sub": doctor.doctor_id, "guest": True}, user_type="doctor", expires_delta=life)
        return {"access_token": token, "token_type": "bearer", "is_guest": True, "doctor": {
            "doctor_id": doctor.doctor_id, "full_name": doctor.full_name, "specialization": doctor.specialization, "hospital": doctor.hospital}}
    token = create_access_token({"sub": str(user.id), "type": "patient", "guest": True}, user_type="patient", expires_delta=life)
    refresh = secrets.token_urlsafe(32)
    db.add(RefreshToken(user_id=user.id, token=refresh, expires_at=datetime.utcnow() + life))
    db.commit()
    return {"access_token": token, "refresh_token": refresh, "token_type": "bearer", "user_type": "patient", "user_id": user.id, "email": user.email,
            "is_email_verified": True, "is_caregiver": False, "caregiver_id": None, "username": user.username, "profile_image": None, "is_guest": True}
