"""Direct HUAWEI Health connection (Health Kit cloud API), with Huawei's servers mocked. The real API is not reachable without a
developer account and Huawei's approval, so these tests prove OUR side: the sign-in link, state protection, encrypted storage, parsing,
ingestion, refresh, errors and disconnect. Offline."""
import os
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from fastapi.testclient import TestClient


class Resp:
    def __init__(self, status=200, body=None):
        self.status_code, self._b, self.content = status, body if body is not None else {}, b"x"

    def json(self):
        return self._b


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, SessionLocal, engine
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    a, b = (User(email=f"hw_{n}@example.com", username=f"hw_{n}", hashed_password=get_password_hash("Passw0rd!x1")) for n in "ab")
    db.add_all([a, b]); db.commit()
    from app.models.health import HealthData
    from app.models.iot_device import IoTDevice, VitalReading
    for m in (VitalReading, HealthData, IoTDevice):
        db.query(m).filter(m.user_id.in_([a.id, b.id])).delete(synchronize_session=False)
    db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), a=a.id, b=b.id, ha=tok(a), hb=tok(b))
    yield out
    from app.models.huawei import HuaweiLink
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    db2.query(HuaweiLink).filter(HuaweiLink.user_id.in_([a.id, b.id])).delete(synchronize_session=False); db2.commit()
    for uid in (a.id, b.id):
        row = db2.query(User).filter(User.id == uid).first()
        if row:
            delete_account(db2, row)
    db2.close(); db.close()


@pytest.fixture
def huawei(monkeypatch):
    """Configured credentials and a fake Huawei. `calls` records what we sent; `fake.fail` makes a data type refuse."""
    from app.services import huawei_health as hh
    monkeypatch.setenv("HUAWEI_CLIENT_ID", "123456"); monkeypatch.setenv("HUAWEI_CLIENT_SECRET", "s3cret")
    monkeypatch.setenv("HUAWEI_REDIRECT_URI", "https://demo.example/huawei/callback")
    calls = {"token": [], "api": []}
    fake = type("F", (), {"fail": {}, "auth_ok": True, "now_ns": int(time.time() * 1e9)})()

    def post(url, data=None, timeout=None, **kw):
        calls["token"].append(dict(data))
        if data["grant_type"] == "authorization_code" and data["code"] == "bad":
            return Resp(400, {"error": "invalid_grant", "error_description": "code is invalid or used"})
        if data["grant_type"] == "refresh_token":
            return Resp(200, {"access_token": "AT-refreshed", "refresh_token": "RT-refreshed", "expires_in": 3600})
        n = len(calls["token"])
        return Resp(200, {"access_token": f"AT{n}", "refresh_token": f"RT{n}", "expires_in": 3600, "scope": "step.read"})

    def request(method, url, headers=None, timeout=None, json=None, **kw):
        calls["api"].append({"method": method, "url": url, "auth": (headers or {}).get("Authorization"), "client": (headers or {}).get("x-client-id"), "json": json})
        if not fake.auth_ok:
            return Resp(401, {"error": "unauthorized"})
        for key, (status, msg) in fake.fail.items():
            if key in url or (json and key in str(json)):
                return Resp(status, {"error": {"message": msg}})
        ns = fake.now_ns
        if "polymerize" in url:
            kind = json["polymerizeWith"][0]["dataTypeName"]
            if "steps" in kind:
                return Resp(200, {"group": [{"sampleSet": [{"samplePoints": [{"value": [{"fieldName": "steps_delta", "integerValue": 3000}]}, {"value": [{"fieldName": "steps_delta", "integerValue": 5420}]}]}]}]})
            if "distance" in kind:
                return Resp(200, {"group": [{"sampleSet": [{"samplePoints": [{"value": [{"fieldName": "distance_delta", "floatValue": 6100.4}]}]}]}]})
            return Resp(200, {"group": [{"sampleSet": [{"samplePoints": [{"value": [{"fieldName": "calories_total", "floatValue": 412.6}]}]}]}]})
        if "heart_rate" in url:
            return Resp(200, {"samplePoints": [{"startTime": ns - 90 * 10 ** 9, "endTime": ns - 60 * 10 ** 9, "value": [{"fieldName": "bpm", "floatValue": 88.0}]}]})
        if "blood_pressure" in url:
            return Resp(200, {"samplePoints": [{"endTime": int((ns - 3600 * 10 ** 9) / 1e6), "value": [{"fieldName": "systolic_pressure", "floatValue": 128.0}, {"fieldName": "diastolic_pressure", "floatValue": 82.0}]}]})
        if "spo2" in url:
            return Resp(200, {"samplePoints": [{"endTime": int((ns - 7200 * 10 ** 9) / 1e9), "value": [{"fieldName": "saturation", "floatValue": 0.97}]}]})
        return Resp(404, {})

    monkeypatch.setattr(hh.requests, "post", post)
    monkeypatch.setattr(hh.requests, "request", request)
    monkeypatch.setattr(hh.requests, "delete", lambda *a, **k: Resp(200, {}))
    return hh, calls, fake


def link_row(uid):
    from app.database import SessionLocal
    from app.models.huawei import HuaweiLink
    with SessionLocal() as d:
        return d.query(HuaweiLink).filter_by(user_id=uid).first()


def test_not_configured_says_so_plainly(env, monkeypatch):
    for k in ("HUAWEI_CLIENT_ID", "HUAWEI_CLIENT_SECRET"):
        monkeypatch.delenv(k, raising=False)
    c = env["client"]
    assert c.get("/huawei/status", headers=env["ha"]).json() == {"configured": False, "linked": False, "last_sync_at": None, "last_error": None, "redirect_uri": None}
    r = c.post("/huawei/connect", headers=env["ha"])
    assert r.status_code == 503 and "not set up" in r.json()["detail"]
    assert c.get("/huawei/status").status_code in (401, 403)


def test_sign_in_link_carries_our_app_scopes_and_a_state_for_this_person(env, huawei):
    hh, calls, fake = huawei
    url = env["client"].post("/huawei/connect", headers=env["ha"]).json()["url"]
    u = urlparse(url); q = parse_qs(u.query)
    assert u.netloc == "oauth-login.cloud.huawei.com" and u.path.endswith("/authorize")
    assert q["client_id"] == ["123456"] and q["response_type"] == ["code"] and q["access_type"] == ["offline"]
    assert q["redirect_uri"] == ["https://demo.example/huawei/callback"]
    assert "healthkit/step.read" in q["scope"][0] and "healthkit/heartrate.read" in q["scope"][0] and " " in q["scope"][0]
    assert "+" not in u.query and "%20" in u.query                              # Huawei wants spaces encoded as %20
    assert hh.read_state(q["state"][0]) == env["a"]
    assert "s3cret" not in url                                                  # the secret never leaves the server


def test_state_cannot_be_forged_replayed_for_another_purpose_or_left_to_expire(env, huawei):
    from jose import jwt
    from app.config import settings
    hh, _, _ = huawei
    with pytest.raises(hh.HuaweiError):
        hh.read_state("not-a-token")
    other_purpose = jwt.encode({"sub": str(env["a"]), "purpose": "login", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(hh.HuaweiError):
        hh.read_state(other_purpose)
    expired = jwt.encode({"sub": str(env["a"]), "purpose": "huawei-link", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(hh.HuaweiError):
        hh.read_state(expired)
    forged = jwt.encode({"sub": str(env["a"]), "purpose": "huawei-link", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, "wrong-key", algorithm="HS256")
    with pytest.raises(hh.HuaweiError):
        hh.read_state(forged)


def test_callback_refuses_bad_requests_and_reflects_nothing(env, huawei):
    c = env["client"]
    assert c.get("/huawei/callback?error=access_denied").status_code == 400
    assert c.get("/huawei/callback").status_code == 400
    r = c.get("/huawei/callback?code=%3Cscript%3Ealert(1)%3C/script%3E&state=garbage")
    assert r.status_code == 400 and "<script>" not in r.text and "alert(1)" not in r.text
    assert link_row(env["a"]) is None


def test_callback_exchanges_the_code_stores_tokens_encrypted_and_pulls_data(env, huawei):
    hh, calls, fake = huawei
    c = env["client"]
    state = hh.make_state(env["a"])
    r = c.get(f"/huawei/callback?code=good-code&state={state}")
    assert r.status_code == 200 and "connected" in r.text.lower()
    assert calls["token"][0] == {"grant_type": "authorization_code", "code": "good-code", "client_id": "123456", "client_secret": "s3cret", "redirect_uri": "https://demo.example/huawei/callback"}
    link = link_row(env["a"])
    assert link and "AT1" not in link.access_token_enc and "RT1" not in (link.refresh_token_enc or "")        # never stored in clear text
    from app.services.secret_box import unseal
    assert unseal(link.access_token_enc) == "AT1" and unseal(link.refresh_token_enc) == "RT1"
    assert all(call["auth"] == "Bearer AT1" and call["client"] == "123456" for call in calls["api"])
    s = c.get("/activity/summary", headers=env["ha"]).json()                                              # the first pull already landed
    assert s["rings"]["steps"]["value"] == 8420 and s["steps_source"] == "HUAWEI Health (direct)"
    assert s["rings"]["calories"]["value"] == 413 and s["rings"]["calories"]["estimated"] is False and s["distance_m"] == 6100
    st = c.get("/huawei/status", headers=env["ha"]).json()
    assert st["linked"] is True and st["last_sync_at"] and st["last_error"] is None


def test_a_failed_code_exchange_stores_nothing(env, huawei):
    hh, calls, fake = huawei
    r = env["client"].get(f"/huawei/callback?code=bad&state={hh.make_state(env['b'])}")
    assert r.status_code == 400 and "invalid or used" in r.text
    assert link_row(env["b"]) is None


def test_vitals_keep_the_time_huawei_measured_them_in_any_unit_and_are_not_duplicated(env, huawei):
    from app.database import SessionLocal
    from app.models.iot_device import VitalReading
    c = env["client"]
    with SessionLocal() as d:                        # start from no readings: earlier tests synced with a different clock
        d.query(VitalReading).filter_by(user_id=env["a"]).delete(); d.commit()
    first = c.post("/huawei/sync", headers=env["ha"]).json()
    assert first["errors"] == [] and set(first["stored"]) >= {"totals", "heart_rate", "blood_pressure", "blood_oxygen"}
    c.post("/huawei/sync", headers=env["ha"])
    with SessionLocal() as d:
        rows = d.query(VitalReading).filter_by(user_id=env["a"]).all()
    kinds = {"hr": [r for r in rows if r.heart_rate == 88], "bp": [r for r in rows if r.blood_pressure_systolic == 128], "o2": [r for r in rows if r.blood_oxygen == 97.0]}
    assert all(len(v) == 1 for v in kinds.values()), {k: len(v) for k, v in kinds.items()}                 # a repeat sync adds no copies
    now = datetime.now(timezone.utc)
    ts = lambda r: (r.timestamp if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc))
    assert 30 < (now - ts(kinds["hr"][0])).total_seconds() < 180                    # nanoseconds
    assert 3000 < (now - ts(kinds["bp"][0])).total_seconds() < 4200                 # milliseconds, an hour old
    assert 6500 < (now - ts(kinds["o2"][0])).total_seconds() < 8000                 # seconds, two hours old, 0.97 read as 97%
    assert not any(r.is_emergency for r in rows)


def test_a_permission_huawei_refuses_is_reported_and_the_rest_still_arrives(env, huawei):
    hh, calls, fake = huawei
    fake.fail["blood_pressure"] = (403, "Insufficient Permission: Request had insufficient authentication scopes")
    r = env["client"].post("/huawei/sync", headers=env["ha"])
    assert r.status_code == 200
    body = r.json()
    assert any("bp:" in e and "insufficient" in e.lower() for e in body["errors"]) and body["steps"] == 8420.0 and body["heart_rate"] is not None
    assert "insufficient" in env["client"].get("/huawei/status", headers=env["ha"]).json()["last_error"].lower()


def test_an_expired_token_is_refreshed_before_use(env, huawei):
    from app.database import SessionLocal
    from app.models.huawei import HuaweiLink
    hh, calls, fake = huawei
    with SessionLocal() as d:
        row = d.query(HuaweiLink).filter_by(user_id=env["a"]).first()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5); d.commit()
    calls["token"].clear(); calls["api"].clear()
    assert env["client"].post("/huawei/sync", headers=env["ha"]).status_code == 200
    assert calls["token"][0]["grant_type"] == "refresh_token" and calls["token"][0]["refresh_token"] == "RT1"
    assert calls["api"] and all(call["auth"] == "Bearer AT-refreshed" for call in calls["api"])      # the NEW token was used


def test_a_rejected_token_asks_the_person_to_connect_again(env, huawei):
    hh, calls, fake = huawei
    fake.auth_ok = False
    r = env["client"].post("/huawei/sync", headers=env["ha"])
    assert r.status_code == 401 and "connect again" in r.json()["detail"].lower()
    assert "connect again" in env["client"].get("/huawei/status", headers=env["ha"]).json()["last_error"].lower()


def test_one_person_never_sees_or_syncs_anothers_link_and_disconnect_deletes_the_tokens(env, huawei):
    c = env["client"]
    assert c.get("/huawei/status", headers=env["hb"]).json()["linked"] is False
    assert c.post("/huawei/sync", headers=env["hb"]).status_code == 404
    assert c.delete("/huawei/link", headers=env["ha"]).json() == {"linked": False}
    assert link_row(env["a"]) is None
    assert c.get("/huawei/status", headers=env["ha"]).json()["linked"] is False
    assert c.post("/huawei/sync", headers=env["ha"]).status_code == 404
    assert c.delete("/huawei/link", headers=env["ha"]).status_code == 200                                    # disconnecting twice is harmless


def test_time_units_and_response_shapes(huawei):
    hh, _, _ = huawei
    ref = datetime(2026, 11, 12, 10, 0, tzinfo=timezone.utc)
    s = ref.timestamp()
    assert hh._to_dt(s) == ref and hh._to_dt(s * 1e3) == ref and hh._to_dt(s * 1e9) == ref and hh._to_dt("junk") is None and hh._to_dt(0) is None
    nested = {"a": {"b": [{"value": [{"fieldName": "x", "integerValue": 5}]}]}, "c": [{"deep": {"value": [{"fieldName": "y", "floatValue": 2.5}]}}]}
    assert [hh._numbers(p) for p in hh._points(nested)] == [{"x": 5.0}, {"y": 2.5}]
    assert hh._points({"nothing": 1}) == []
