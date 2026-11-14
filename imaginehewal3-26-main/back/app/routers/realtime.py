"""Single authenticated WebSocket endpoint: /ws

Protocol (JSON text frames, max 4 KB):
  client -> {"type":"auth","token":"<access token>"}   must be the FIRST frame, within 8 s
  server -> {"type":"ready","user_id":N}
  client -> {"type":"ping"}                server -> {"type":"pong"}
  client -> {"type":"typing","to_user_id":N,"is_typing":true}   (only to approved contacts)
  server pushes: message.new, notification.new, vitals.update, presence, typing
The token is sent in the first frame, never in the URL, so it does not end up in access logs.
No cookies are used, so cross-site WebSocket hijacking does not apply.
"""
import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import or_

from app.config import settings
from app.database import SessionLocal
from app.models.caregiver import CaregiverRelationship
from app.models.user import User
from app.realtime import hub

logger = logging.getLogger(__name__)
router = APIRouter(tags=["realtime"])

AUTH_TIMEOUT_S = 8
IDLE_TIMEOUT_S = 90
MAX_FRAME = 4096
MAX_FRAMES_PER_10S = 100


def _user_from_token(token: str):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("user_type") not in ("patient", "caregiver"):
        return None
    uid = int(payload["sub"])
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == uid, User.is_active == True).first()  # noqa: E712
        return (user.id, user.is_caregiver) if user else None
    finally:
        db.close()


def _approved_contacts(user_id: int) -> set:
    db = SessionLocal()
    try:
        rels = db.query(CaregiverRelationship).filter(
            CaregiverRelationship.status == "approved",
            or_(CaregiverRelationship.caregiver_id == user_id,
                CaregiverRelationship.patient_id == user_id)).all()
        return {r.patient_id if r.caregiver_id == user_id else r.caregiver_id for r in rels}
    finally:
        db.close()


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=AUTH_TIMEOUT_S)
        if len(raw) > MAX_FRAME:
            raise ValueError("frame too large")
        msg = json.loads(raw)
        if msg.get("type") != "auth":
            raise ValueError("first frame must be auth")
        who = await asyncio.to_thread(_user_from_token, msg.get("token", ""))
        if not who:
            raise ValueError("unknown user")
    except (asyncio.TimeoutError, ValueError, JWTError, KeyError, TypeError, json.JSONDecodeError):
        await websocket.close(code=4401)
        return
    except WebSocketDisconnect:
        return

    user_id = who[0]
    if not hub.register(user_id, websocket):
        await websocket.close(code=4429)  # too many connections for this user
        return

    contacts = await asyncio.to_thread(_approved_contacts, user_id)
    await websocket.send_json({"type": "ready", "user_id": user_id})
    await hub.send_many(contacts, {"type": "presence", "user_id": user_id, "online": True})

    window_start, frames = time.monotonic(), 0
    try:
        while True:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=IDLE_TIMEOUT_S)
            now = time.monotonic()
            if now - window_start > 10:
                window_start, frames = now, 0
            frames += 1
            if len(raw) > MAX_FRAME or frames > MAX_FRAMES_PER_10S:
                await websocket.close(code=4408)
                break
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = data.get("type")
            if kind == "ping":
                await websocket.send_json({"type": "pong"})
            elif kind == "typing":
                to = data.get("to_user_id")
                if isinstance(to, int) and to in contacts:
                    await hub.send(to, {"type": "typing", "from_user_id": user_id,
                                        "is_typing": bool(data.get("is_typing"))})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        logger.warning("ws error user=%s: %s", user_id, type(e).__name__)
    finally:
        hub.unregister(user_id, websocket)
        if not hub.is_online(user_id):
            await hub.send_many(contacts, {"type": "presence", "user_id": user_id, "online": False})
