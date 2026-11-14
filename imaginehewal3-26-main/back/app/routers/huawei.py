"""Connect a person's own HUAWEI Health account (Health Kit cloud API). See app/services/huawei_health.py for how it works."""
import asyncio
import html
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import SessionLocal, get_db
from app.models.huawei import HuaweiLink
from app.models.user import User
from app.services import huawei_health as hh

router = APIRouter(prefix="/huawei", tags=["huawei"])
logger = logging.getLogger(__name__)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    link = db.query(HuaweiLink).filter_by(user_id=user.id).first()
    return {"configured": hh.configured(), "linked": link is not None, "last_sync_at": _iso(link.last_sync_at) if link else None,
            "last_error": link.last_error if link else None, "redirect_uri": hh.redirect_uri() if hh.configured() else None}


@router.post("/connect")
def connect(user: User = Depends(get_current_active_user)):
    """The Huawei sign-in address for this person. Open it in the browser; Huawei sends them back to /huawei/callback."""
    if not hh.configured():
        raise HTTPException(503, "HUAWEI Health is not set up on this server yet. The developer needs to add the HUAWEI Health Kit credentials.")
    return {"url": hh.authorize_url(user.id)}


def _page(title: str, message: str, ok: bool) -> HTMLResponse:
    # plain markup only: the security headers do not allow inline styles or scripts
    body = f"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>HEWAL3</title></head><body><h1>{html.escape(title)}</h1><p>{html.escape(message)}</p></body></html>"
    return HTMLResponse(body, status_code=200 if ok else 400)


@router.get("/callback", include_in_schema=False)
def callback(code: Optional[str] = Query(None, max_length=2048), state: Optional[str] = Query(None, max_length=2048),
             error: Optional[str] = Query(None, max_length=200), db: Session = Depends(get_db)):
    """Huawei sends the person's browser here after they sign in. Nothing from the query string is shown back (no reflected text)."""
    if error or not code or not state:
        return _page("HUAWEI Health was not connected", "You cancelled, or HUAWEI did not approve the request. Go back to HEWAL3 and try again.", False)
    try:
        user_id = hh.read_state(state)
    except hh.HuaweiError as e:
        return _page("This link has expired", e.message, False)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return _page("HUAWEI Health was not connected", "That account no longer exists.", False)
    try:
        link = hh.save_link(db, user_id, hh.exchange_code(code))
    except hh.HuaweiError as e:
        return _page("HUAWEI Health was not connected", e.message.replace("<", "").replace(">", ""), False)
    try:
        hh.sync_user(db, user, link)                      # first pull straight away, so the app has data when the person returns
    except hh.HuaweiError:
        pass
    return _page("HUAWEI Health is connected", "You can close this page and return to HEWAL3. Your steps, heart rate and other readings will appear there.", True)


@router.post("/sync")
def sync(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    link = db.query(HuaweiLink).filter_by(user_id=user.id).first()
    if not link:
        raise HTTPException(404, "HUAWEI Health is not connected.")
    try:
        result = hh.sync_user(db, user, link)
    except hh.HuaweiAuthError as e:
        raise HTTPException(401, e.message)
    except hh.HuaweiError as e:
        raise HTTPException(502, e.message)
    return {**result, "last_sync_at": _iso(link.last_sync_at)}


@router.delete("/link")
def disconnect(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    link = db.query(HuaweiLink).filter_by(user_id=user.id).first()
    if link:
        hh.best_effort_revoke(link)
        db.delete(link)                                  # the stored tokens are gone, whatever Huawei answered
        db.commit()
    return {"linked": False}


# ------------------------------------------------------------------ keeps linked accounts fresh without the app being open
def sync_all_linked() -> int:
    if not hh.configured():
        return 0
    done = 0
    with SessionLocal() as db:
        for link in db.query(HuaweiLink).limit(500).all():
            try:
                user = db.query(User).filter(User.id == link.user_id).first()
                if user and user.is_active:
                    hh.sync_user(db, user, link)
                    done += 1
            except hh.HuaweiError:
                continue                                 # recorded on the link; the person sees it in the app
            except Exception:
                db.rollback()
                logger.exception("huawei background sync failed for user %s", link.user_id)
    return done


async def huawei_worker(interval: float = 600.0) -> None:
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(sync_all_linked)
        except Exception:
            logger.exception("huawei worker error")
