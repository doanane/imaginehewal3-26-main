"""ICE servers for calls: free STUN always, and a TURN relay when one is configured.

STUN lets two devices find each other. When both sit behind strict mobile or office networks they cannot connect directly, and the
call needs a TURN relay. Run coturn (config in deployment/coturn/) with `use-auth-secret` and set:
    TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp
    TURN_SECRET=<the static-auth-secret from turnserver.conf>
Credentials handed to clients are temporary (one hour) and tied to the person, so a leaked one stops working soon and the secret
never leaves the server.

No server of your own? A hosted relay with a free tier (for example Metered.ca's Open Relay, or Twilio's Network Traversal) gives you
a fixed URL list, username and password instead of a shared secret. Set those instead:
    TURN_URLS=turn:relay.example.com:80,turn:relay.example.com:443?transport=tcp
    TURN_USERNAME=<username>      TURN_CREDENTIAL=<password>
Those are handed to signed-in people only (this endpoint needs a login), never put in the app or the website source.
"""
import base64
import hashlib
import hmac
import os
import time
from typing import List

STUN = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
TTL_S = 3600


def ice_servers(who: str, now: float = None) -> List[dict]:
    urls = [u.strip() for u in os.getenv("TURN_URLS", "").split(",") if u.strip()]
    secret = os.getenv("TURN_SECRET", "")
    out = list(STUN)
    user, cred = os.getenv("TURN_USERNAME", ""), os.getenv("TURN_CREDENTIAL", "")
    if urls and secret:
        username = f"{int((now or time.time()) + TTL_S)}:{who}"
        credential = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
        out.append({"urls": urls, "username": username, "credential": credential})
    elif urls and user and cred:                                   # hosted relay with a fixed username and password
        out.append({"urls": urls, "username": user, "credential": cred})
    return out


def relay_configured() -> bool:
    return bool(os.getenv("TURN_URLS") and (os.getenv("TURN_SECRET") or (os.getenv("TURN_USERNAME") and os.getenv("TURN_CREDENTIAL"))))
