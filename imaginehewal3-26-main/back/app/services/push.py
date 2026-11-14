"""Push notifications through Expo's push service (free; Expo forwards to Apple and Google).

Rules that keep this safe:
  * Titles and bodies are generic ("New message from your doctor"). They never carry readings, diagnoses or message text,
    because a lock screen is visible to anyone holding the phone.
  * Nothing is sent to someone who has the app open (the live socket already showed it).
  * Sending never blocks or breaks the request that triggered it: it runs on a background thread and swallows failures.
  * Tokens Expo reports as dead are deleted.
Delivery needs the app built with push credentials (an Apple key attached to the Expo project). Without them, tokens still register
but the phone receives nothing; the backend log shows Expo's refusal.
"""
import logging
import os
import threading
from typing import Iterable, Optional

import requests

from app.database import SessionLocal
from app.models.care_plan import PushToken
from app.realtime import hub

logger = logging.getLogger(__name__)
EXPO_URL = "https://exp.host/--/api/v2/push/send"


def _enabled() -> bool:
    return os.getenv("PUSH_ENABLED", "1") != "0" and os.getenv("PYTEST_CURRENT_TEST") is None


def _deliver(tokens: list, title: str, body: str, data: dict, channel: str, urgent: bool) -> None:
    msgs = [{"to": t, "title": title, "body": body, "data": data, "sound": "default", "channelId": channel,
             "priority": "high" if urgent else "default", "ttl": 60 if urgent else 3600} for t in tokens]
    try:
        r = requests.post(EXPO_URL, json=msgs, timeout=10, headers={"Accept": "application/json"})
        out = r.json().get("data", []) if r.ok else []
        dead = [tokens[i] for i, item in enumerate(out) if item.get("status") == "error" and (item.get("details") or {}).get("error") == "DeviceNotRegistered"]
        for item in out:
            if item.get("status") == "error":
                logger.warning("push refused: %s", (item.get("message") or "")[:160])
        if dead:
            db = SessionLocal()
            try:
                db.query(PushToken).filter(PushToken.token.in_(dead)).delete(synchronize_session=False)
                db.commit()
            finally:
                db.close()
    except Exception as e:
        logger.warning("push failed: %s", type(e).__name__)


def notify_users(user_ids: Iterable[int], title: str, body: str, data: Optional[dict] = None, urgent: bool = False) -> int:
    """Push to these people's phones, skipping anyone currently connected. Returns how many phones were queued."""
    if not _enabled():
        return 0
    ids = [u for u in set(user_ids) if u and u > 0 and not hub.is_online(u)]
    if not ids:
        return 0
    db = SessionLocal()
    try:
        tokens = [t for (t,) in db.query(PushToken.token).filter(PushToken.user_id.in_(ids)).all()]
    finally:
        db.close()
    if not tokens:
        return 0
    threading.Thread(target=_deliver, args=(tokens, title, body, data or {}, "calls" if urgent else "default", urgent), daemon=True).start()
    return len(tokens)
