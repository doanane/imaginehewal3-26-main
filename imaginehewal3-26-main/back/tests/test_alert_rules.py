"""Home risk alerts only when they are TRUE: fresh, real, repeated, and for someone the app already knows. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User
    from app.services import simple_limiter
    from app.services.privacy_service import delete_account
    simple_limiter.reset()
    db = SessionLocal()
    old = db.query(User).filter_by(email="rules_a@example.com").first()
    if old:
        delete_account(db, old)
    u = User(email="rules_a@example.com", username="rules_a", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add(u); db.commit()
    out = dict(client=TestClient(app), uid=u.id, db=db, h={"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")})
    yield out
    db2 = SessionLocal()
    row = db2.query(User).filter(User.id == u.id).first()
    if row:
        delete_account(db2, row)
    db2.close(); db.close()


def _device(env, device_id="apple-health", dtype="smartwatch"):
    from app.models.iot_device import IoTDevice
    db = env["db"]
    d = db.query(IoTDevice).filter_by(device_id=f"{device_id}-{env['uid']}").first()
    if not d:
        d = IoTDevice(user_id=env["uid"], device_id=f"{device_id}-{env['uid']}", device_type=dtype, device_name=device_id, connection_status="connected")
        db.add(d); db.commit()
    return d


def _clear(env):
    from app.models.health import HealthData
    from app.models.iot_device import VitalReading
    env["db"].query(VitalReading).filter_by(user_id=env["uid"]).delete()
    env["db"].query(HealthData).filter_by(user_id=env["uid"]).delete()
    env["db"].commit()


def _bp(env, sys, dia, minutes_ago, device=None, hours_ago=0):
    from app.models.iot_device import VitalReading
    when = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago, hours=hours_ago)
    dev = device if device is not None else _device(env)
    env["db"].add(VitalReading(user_id=env["uid"], device_id=dev.id if dev else None, blood_pressure_systolic=sys, blood_pressure_diastolic=dia, timestamp=when))
    env["db"].commit()


def _history(env, days=3):
    from app.models.health import HealthData
    for k in range(days):
        env["db"].add(HealthData(user_id=env["uid"], date=datetime.now() - timedelta(days=k + 1), steps=3000 + k))
    env["db"].commit()


def alerts(env):
    r = env["client"].get("/health/dashboard", headers=env["h"])
    assert r.status_code == 200, r.text
    return r.json()["risk_alerts"]


def test_a_new_user_gets_no_alert_even_from_two_critical_readings(env):
    _clear(env)
    _bp(env, 190, 125, 30); _bp(env, 188, 124, 5)
    assert alerts(env) == []                                   # no history yet, and opening the dashboard (which adds an empty row for today) changes nothing
    assert alerts(env) == []


def test_two_real_critical_readings_for_a_person_with_history_is_a_true_alert(env):
    _clear(env)
    _history(env)
    _bp(env, 190, 125, 30); _bp(env, 186, 122, 5)
    a = alerts(env)
    assert [x["code"] for x in a] == ["high_blood_pressure"] and a[0]["severity"] == "critical"
    assert len(a[0]["based_on"]) == 2 and "now" in a[0]["based_on"][0] and "earlier" in a[0]["based_on"][1]
    assert "last two" in a[0]["message"]


def test_one_reading_is_not_enough(env):
    _clear(env)
    _history(env)
    _bp(env, 190, 125, 5)
    assert alerts(env) == []


def test_a_repeat_must_be_at_least_five_minutes_later(env):
    _clear(env)
    _history(env)
    _bp(env, 190, 125, 4); _bp(env, 188, 124, 2)
    assert alerts(env) == []                                   # the same measurement twice in a row is not a repeat


def test_if_the_latest_reading_is_fine_there_is_no_alert(env):
    _clear(env)
    _history(env)
    _bp(env, 190, 125, 60); _bp(env, 186, 122, 30); _bp(env, 118, 76, 5)
    assert alerts(env) == []


def test_old_readings_never_alert(env):
    _clear(env)
    _history(env)
    _bp(env, 190, 125, 10, hours_ago=30); _bp(env, 186, 122, 5, hours_ago=30)
    assert alerts(env) == []


def test_the_demo_tool_never_counts_as_real(env):
    _clear(env)
    _history(env)
    sim = _device(env, "demo-simulation", "simulation")
    _bp(env, 190, 125, 30, device=sim); _bp(env, 186, 122, 5, device=sim)
    _bp(env, 190, 125, 20, device=False)                       # a reading with no device at all (how the demo tool used to store it)
    assert alerts(env) == []


def test_days_with_only_empty_rows_do_not_count_as_history(env):
    from app.models.health import HealthData
    from app.services import alert_rules
    _clear(env)
    for k in range(5):
        env["db"].add(HealthData(user_id=env["uid"], date=datetime.now() - timedelta(days=k), steps=0, water_intake=0))
    env["db"].commit()
    assert alert_rules.days_with_data(env["db"], env["uid"]) == 0 and not alert_rules.has_history(env["db"], env["uid"])


def test_daily_tip_changes_with_the_day_never_invents_and_works_offline(env):
    from app.routers.food_analysis import TIP_FALLBACKS
    c, h = env["client"], env["h"]
    a = c.get("/api/daily-tip", headers=h).json()
    assert a["success"] and a["tip"] in TIP_FALLBACKS and a["ai"] is False and a["language"] == "en"
    assert c.get("/api/daily-tip", headers=h).json()["tip"] == a["tip"]                  # the same tip all day
    assert c.get("/api/daily-tip?lang=fr", headers=h).json()["language"] == "fr"
    assert c.get("/api/daily-tip?lang=xx", headers=h).json()["language"] == "en"          # an unknown language falls back
    assert len(set(TIP_FALLBACKS)) == len(TIP_FALLBACKS) >= 14                         # a different one for at least two weeks
