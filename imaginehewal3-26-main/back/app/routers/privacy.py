"""Privacy centre API. Every endpoint only ever touches the signed-in user's own data."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import lockout
from app.auth.hashing import verify_password
from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.services import privacy_service as svc

router = APIRouter(prefix="/privacy", tags=["privacy"])


class DeleteIn(BaseModel):
    password: str = Field(..., min_length=1, max_length=200)
    confirm: str = Field(..., max_length=20)


@router.get("/access")
def access(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.access_list(db, user)


@router.post("/access/{relationship_id}/revoke")
def revoke(relationship_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not svc.revoke(db, user, relationship_id):
        raise HTTPException(404, "Not found")          # same answer for "does not exist" and "not yours"
    return {"revoked": True}


@router.get("/log")
def log(limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return {"items": svc.access_log(db, user, max(1, min(limit, 200)))}


@router.get("/export")
def export(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    return svc.export_all(db, user)


@router.post("/delete-account")
def delete_account(body: DeleteIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Permanently erases the account and everything linked to it. Needs the password and the word DELETE."""
    if body.confirm != "DELETE":
        raise HTTPException(400, 'Type DELETE to confirm')
    key = f"delete:{user.id}"
    lockout.check(key, "self")                          # stops guessing the password through this endpoint
    if not user.hashed_password or not verify_password(body.password, user.hashed_password):
        lockout.record_failure(key, "self")
        raise HTTPException(403, "Password is not correct")
    lockout.clear(key, "self")
    return svc.delete_account(db, user)
