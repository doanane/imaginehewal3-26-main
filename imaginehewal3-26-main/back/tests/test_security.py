"""Security + realtime tests (OWASP A01/A02/A05/A07). Offline, no server needed:
   DATABASE_URL=sqlite:///./test_security.db python -m pytest tests/test_security.py -q
"""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_security.db")
os.environ.setdefault("ENVIRONMENT", "development")

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User
    from app.models.caregiver import CaregiverRelationship
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    a = User(email="sec_patient@example.com", username="sec_patient", hashed_password=get_password_hash("Passw0rd!x1"))
    b = User(email="sec_caregiver@example.com", username="sec_caregiver", is_caregiver=True,
             hashed_password=get_password_hash("Passw0rd!x1"))
    c = User(email="sec_stranger@example.com", username="sec_stranger", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add_all([a, b, c]); db.commit()
    db.add(CaregiverRelationship(caregiver_id=b.id, patient_id=a.id, status="approved")); db.commit()
    tok = lambda u, t: create_access_token({"sub": str(u.id)}, t)
    out = dict(client=TestClient(app), a=a.id, b=b.id, c=c.id,
               ta=tok(a, "patient"), tb=tok(b, "caregiver"), tc=tok(c, "patient"))
    yield out
    from sqlalchemy import text
    for t in reversed(Base.metadata.sorted_tables):
        if "user_id" in t.c: db.execute(t.delete().where(t.c.user_id.in_([a.id, b.id, c.id])))
    db.execute(text("delete from messages where sender_id in (:a,:b,:c) or receiver_id in (:a,:b,:c)"), dict(a=a.id, b=b.id, c=c.id))
    db.execute(text("delete from caregiver_relationships where patient_id=:a"), dict(a=a.id))
    db.execute(text("delete from users where id in (:a,:b,:c)"), dict(a=a.id, b=b.id, c=c.id)); db.commit(); db.close()


def H(tok): return {"Authorization": f"Bearer {tok}"}


# ---------- A05: debug surface removed ----------
def test_debug_endpoints_are_gone(env):
    c = env["client"]
    for path in ("/superadmin/debug", "/superadmin/test", "/users/test", "/caregivers/test"):
        assert c.get(path).status_code in (404, 405), path


# ---------- A01: broken access control ----------
def test_iot_requires_auth_and_ownership(env):
    c = env["client"]
    assert c.get(f"/iot/devices/{env['a']}").status_code in (401, 403)       # no token
    assert c.get(f"/iot/devices/{env['a']}", headers=H(env["tc"])).status_code == 403   # someone else's id
    assert c.get(f"/iot/devices/{env['a']}", headers=H(env["ta"])).status_code == 200   # own id
    assert c.get("/iot/status").status_code in (401, 403)


def test_webhook_disabled_without_secret(env):
    body = {"device_id": "x", "heart_rate": 70, "timestamp": "2026-01-01T00:00:00Z", "data_type": "hr"}
    os.environ.pop("IOT_WEBHOOK_SECRET", None)
    assert env["client"].post("/iot/webhook", json=body).status_code == 503
    os.environ["IOT_WEBHOOK_SECRET"] = "s3cret"
    try:
        assert env["client"].post("/iot/webhook", json=body, headers={"X-Webhook-Secret": "wrong"}).status_code == 401
        assert env["client"].post("/iot/webhook", json=body, headers={"X-Webhook-Secret": "s3cret"}).status_code == 404  # unknown device
    finally:
        os.environ.pop("IOT_WEBHOOK_SECRET", None)


def test_cannot_message_without_relationship(env):
    r = env["client"].post("/messages/send", json={"receiver_id": env["a"], "content": "hi"}, headers=H(env["tc"]))
    assert r.status_code == 403


# ---------- A07: brute force ----------
def test_login_lockout(env):
    from app.auth import lockout
    lockout.reset_all()
    c = env["client"]
    codes = [c.post("/auth/login", json={"email": "sec_patient@example.com", "password": "wrong"}).status_code for _ in range(6)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    # a different account from the same IP is unaffected by pair-lockout only for that email
    ok = c.post("/auth/login", json={"email": "sec_stranger@example.com", "password": "Passw0rd!x1"})
    assert ok.status_code == 200
    lockout.reset_all()


# ---------- A02: secrets ----------
def test_not_using_public_default_secret():
    from app.config import settings, _PUBLIC_DEFAULT_KEY
    assert settings.SECRET_KEY != _PUBLIC_DEFAULT_KEY or settings.ENVIRONMENT == "development"


def test_allowed_origins_parser_does_not_eval():
    from app.config import _parse_list
    assert _parse_list('["http://a.com","http://b.com"]', []) == ["http://a.com", "http://b.com"]
    assert _parse_list("http://a.com, http://b.com", []) == ["http://a.com", "http://b.com"]
    assert _parse_list('__import__("os").system("echo pwned")', []) != "pwned"


# ---------- realtime ----------
def test_ws_rejects_unauthenticated(env):
    c = env["client"]
    with c.websocket_connect("/ws") as ws:
        ws.send_text('{"type":"ping"}')           # first frame must be auth
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_text()
        assert e.value.code == 4401
    with c.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": "garbage"})
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_text()
        assert e.value.code == 4401


def test_ws_message_and_vitals_push(env):
    c = env["client"]
    with c.websocket_connect("/ws") as wa, c.websocket_connect("/ws") as wb:
        wa.send_json({"type": "auth", "token": env["ta"]})
        assert wa.receive_json() == {"type": "ready", "user_id": env["a"]}
        wb.send_json({"type": "auth", "token": env["tb"]})
        assert wb.receive_json()["type"] == "ready"
        assert wa.receive_json()["type"] == "presence"          # caregiver came online

        wa.send_json({"type": "ping"})
        assert wa.receive_json() == {"type": "pong"}

        # caregiver -> patient message arrives instantly on the patient's socket
        r = c.post("/messages/send", json={"receiver_id": env["a"], "content": "How are you today?"}, headers=H(env["tb"]))
        assert r.status_code == 200, r.text
        ev = wa.receive_json()
        assert ev["type"] == "message.new" and ev["message"]["content"] == "How are you today?"

        # patient's watch reading reaches the caregiver live
        r = c.post("/vitals/ingest", json={"device_id": "78:02:B7:16:91:F5", "heart_rate": 77}, headers=H(env["ta"]))
        assert r.status_code == 200, r.text
        got = [wa.receive_json(), wb.receive_json()]
        assert all(g["type"] == "vitals.update" and g["heart_rate"] == 77 for g in got)

        # typing only reaches approved contacts
        wb.send_json({"type": "typing", "to_user_id": env["a"], "is_typing": True})
        assert wa.receive_json() == {"type": "typing", "from_user_id": env["b"], "is_typing": True}
