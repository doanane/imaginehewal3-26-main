"""Single authenticated WebSocket endpoint: /ws

Protocol (JSON text frames, max 4 KB):
  client -> {"type":"auth","token":"<access token>"}   must be the FIRST frame, within 8 s
  server -> {"type":"ready","user_id":N}
  client -> {"type":"ping"}                server -> {"type":"pong"}
  client -> {"type":"typing","to_user_id":N,"is_typing":true}   (only to approved contacts)
  server pushes: message.new, notification.new, vitals.update, presence, typing, doctor_message.new, care.refresh
  Doctors connect with their website token and are addressed by the NEGATIVE of their doctors.id (patients are positive user ids).
  Calls (WebRTC signalling only, media goes peer to peer): call.invite | call.accept | call.reject | call.end | call.signal,
  each with {"to": key, "call_id": str}. The server checks the two people are linked, then forwards it with from_user_id/from_name.
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
from app.models.caregiver import CaregiverRelationship, Doctor
from app.models.user import User, UserProfile
from app.services import photos
from app.realtime import hub
from app.services import push

logger = logging.getLogger(__name__)
router = APIRouter(tags=["realtime"])

AUTH_TIMEOUT_S = 8
IDLE_TIMEOUT_S = 90
MAX_FRAME = 16384
MAX_FRAMES_PER_10S = 100


def _identity(token: str):
    """(key, display name, role) for a valid token, else None. Doctors use a negative key so they never collide with user ids."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    kind = payload.get("user_type")
    db = SessionLocal()
    try:
        if kind == "doctor":
            doc = db.query(Doctor).filter(Doctor.doctor_id == str(payload["sub"]), Doctor.is_active == True).first()  # noqa: E712
            return (-doc.id, doc.full_name or "Doctor", "doctor") if doc else None
        if kind not in ("patient", "caregiver"):
            return None
        user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()  # noqa: E712
        if not user:
            return None
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "HEWAL3 user"
        return user.id, name, ("caregiver" if user.is_caregiver else "patient")
    finally:
        db.close()


def _photo(key: int):
    """The picture of whoever is calling (doctor or user), or None."""
    db = SessionLocal()
    try:
        if key < 0:
            return photos.doctor_photo(db.query(Doctor).filter(Doctor.id == -key).first())
        return photos.user_photo(db, key)
    finally:
        db.close()


def _contacts(key: int) -> set:
    """Who this connection may talk to: approved caregiver links, and the patient/doctor link."""
    db = SessionLocal()
    try:
        if key < 0:
            doc = db.query(Doctor).filter(Doctor.id == -key).first()
            if not doc:
                return set()
            return {uid for (uid,) in db.query(UserProfile.user_id).filter(UserProfile.doctor_id == doc.doctor_id).all()}
        rels = db.query(CaregiverRelationship).filter(
            CaregiverRelationship.status == "approved",
            or_(CaregiverRelationship.caregiver_id == key, CaregiverRelationship.patient_id == key)).all()
        out = {r.patient_id if r.caregiver_id == key else r.caregiver_id for r in rels}
        prof = db.query(UserProfile).filter(UserProfile.user_id == key).first()
        if prof and prof.doctor_id:
            doc = db.query(Doctor).filter(Doctor.doctor_id == prof.doctor_id, Doctor.is_active == True).first()  # noqa: E712
            if doc:
                out.add(-doc.id)
        return out
    finally:
        db.close()


# who is currently in a call with whom (one call per person; a second caller hears "busy")
_in_call: dict = {}
# invitations for someone whose app is closed: delivered when they open it (from the push), for up to RING_S seconds
_pending: dict = {}
# which device (socket) of a person is part of a call: (call_id, user key) -> websocket. Someone signed in on a phone AND a laptop gets the
# ring on both; once one answers, the other is told to stop and the call's audio signalling goes only to the device that answered.
_sock: dict = {}
RING_S = 45
CALL_KINDS = ("audio", "video")


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
        who = await asyncio.to_thread(_identity, msg.get("token", ""))
        if not who:
            raise ValueError("unknown user")
    except (asyncio.TimeoutError, ValueError, JWTError, KeyError, TypeError, json.JSONDecodeError):
        await websocket.close(code=4401)
        return
    except WebSocketDisconnect:
        return

    user_id, my_name, my_role = who
    if not hub.register(user_id, websocket):
        await websocket.close(code=4429)  # too many connections for this user
        return

    contacts = await asyncio.to_thread(_contacts, user_id)
    contacts_at = time.monotonic()
    if photos.stale(user_id):
        photos.remember(user_id, await asyncio.to_thread(_photo, user_id))
    await websocket.send_json({"type": "ready", "user_id": user_id, "role": my_role})
    waiting = _pending.pop(user_id, None)
    if waiting and waiting[1] > time.monotonic() and _in_call.get(user_id, (None, None))[1] == waiting[0]["call_id"]:
        await websocket.send_json(waiting[0])                    # the call that woke this phone is still ringing
    elif waiting:
        peer = _in_call.pop(user_id, None)
        if peer:
            _in_call.pop(peer[0], None)
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
            elif kind in ("typing", "call.invite", "call.accept", "call.reject", "call.end", "call.signal"):
                to = data.get("to_user_id") if kind == "typing" else data.get("to")
                if not isinstance(to, int):
                    continue
                if to not in contacts or time.monotonic() - contacts_at > 30:   # links change while connected
                    contacts = await asyncio.to_thread(_contacts, user_id)
                    contacts_at = time.monotonic()
                if to not in contacts:
                    continue
                if kind == "typing":
                    await hub.send(to, {"type": "typing", "from_user_id": user_id, "is_typing": bool(data.get("is_typing"))})
                    continue
                call_id = str(data.get("call_id", ""))[:64]
                if not call_id:
                    continue
                out = {"type": kind, "call_id": call_id, "from_user_id": user_id, "from_name": my_name, "from_role": my_role}
                if kind == "call.invite" and photos.stale(user_id):
                    photos.remember(user_id, await asyncio.to_thread(_photo, user_id))       # picked up again after a change
                if kind in ("call.invite", "call.accept"):
                    out["from_photo"] = photos.peek(user_id)                                  # no database work while a call is being set up
                if kind == "call.invite":
                    out["media"] = data.get("media") if data.get("media") in CALL_KINDS else "audio"
                    if _in_call.get(to) or _in_call.get(user_id):
                        await websocket.send_json({"type": "call.unavailable", "call_id": call_id, "reason": "busy", "from_user_id": to})
                        continue
                    if to > 0 and hub.is_online(to):
                        # the app is connected, but it may be in the background where a socket message makes no sound: ring the phone too
                        # (the app hides this notification when it is open on screen and rings by itself)
                        asyncio.get_running_loop().run_in_executor(None, lambda: push.notify_users(
                            [to], f"Incoming {out['media']} call", f"{my_name} is calling you on HEWAL3.", {"type": "call", "call_id": call_id}, True, True))
                    if not hub.is_online(to):
                        # app closed: wake the phone with a push and hold the invitation until they open the app
                        woke = await asyncio.to_thread(push.notify_users, [to], f"Incoming {out['media']} call",
                                                       f"{my_name} is calling you on HEWAL3. Open the app to answer.", {"type": "call", "call_id": call_id}, True)
                        _sock[(call_id, user_id)] = websocket
                        if not woke:
                            await websocket.send_json({"type": "call.unavailable", "call_id": call_id, "reason": "offline", "from_user_id": to})
                            continue
                        _pending[to] = (out, time.monotonic() + RING_S)
                        await websocket.send_json({"type": "call.ringing", "call_id": call_id, "via": "push", "from_user_id": to})
                    _in_call[user_id] = (to, call_id)
                    _in_call[to] = (user_id, call_id)
                    if to in _pending and hub.is_online(to) is False:
                        continue                                  # nothing to forward yet; delivered when they connect
                elif kind in ("call.reject", "call.end"):
                    _pending.pop(to, None)
                    _pending.pop(user_id, None)
                    for k in (user_id, to):
                        if _in_call.get(k, (None, None))[1] == call_id:
                            _in_call.pop(k, None)
                    if kind == "call.reject" and _sock.get((call_id, user_id)) is None:
                        await hub.send_except(user_id, websocket, {"type": "call.handled", "call_id": call_id, "reason": "declined_elsewhere"})
                    target = _sock.pop((call_id, to), None)
                    _sock.pop((call_id, user_id), None)
                    if target is not None:
                        await hub.send_ws(to, target, out)          # only the device that is actually in the call
                        continue
                elif kind == "call.accept":
                    _sock[(call_id, user_id)] = websocket
                    await hub.send_except(user_id, websocket, {"type": "call.handled", "call_id": call_id, "reason": "answered_elsewhere"})
                    target = _sock.get((call_id, to))
                    if target is not None:
                        await hub.send_ws(to, target, out)
                        continue
                elif kind == "call.signal":
                    sig = data.get("data")
                    if not isinstance(sig, dict):
                        continue
                    out["data"] = sig
                    target = _sock.get((call_id, to))
                    if target is not None and await hub.send_ws(to, target, out):
                        continue
                if kind == "call.invite":
                    _sock[(call_id, user_id)] = websocket           # the calling device
                await hub.send(to, out)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        logger.warning("ws error user=%s: %s", user_id, type(e).__name__)
    finally:
        hub.unregister(user_id, websocket)
        for k in [k for k, v in _sock.items() if v is websocket]:
            _sock.pop(k, None)
        if not hub.is_online(user_id):
            peer = _in_call.pop(user_id, None)         # hang up on the other side when someone drops out
            if peer:
                _in_call.pop(peer[0], None)
                await hub.send(peer[0], {"type": "call.end", "call_id": peer[1], "from_user_id": user_id, "reason": "dropped"})
            await hub.send_many(contacts, {"type": "presence", "user_id": user_id, "online": False})
