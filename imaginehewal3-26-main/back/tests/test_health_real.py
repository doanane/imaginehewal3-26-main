"""The rings are the watch's own figures when it reported them, flagged estimates when it did not, and never go backwards. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.health import HealthData
    from app.models.iot_device import IoTDevice, VitalReading
    from app.models.user import User
    from app.services import simple_limiter
    simple_limiter.reset()
    db = SessionLocal()
    u = User(email="hr_a@example.com", username="hr_a", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add(u); db.commit()
    for m in (VitalReading, HealthData, IoTDevice):
        db.query(m).filter(m.user_id == u.id).delete(synchronize_session=False)
    db.commit()
    out = dict(client=TestClient(app), uid=u.id, h={"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")})
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    row = db2.query(User).filter(User.id == u.id).first()
    if row:
        delete_account(db2, row)
    db2.close(); db.close()


def summary(env):
    return env["client"].get("/activity/summary", headers=env["h"]).json()


def test_without_watch_figures_calories_and_minutes_are_flagged_estimates(env):
    s = summary(env)
    assert s["rings"]["steps"]["value"] == 0
    assert s["rings"]["calories"]["estimated"] is True and s["rings"]["minutes"]["estimated"] is True
    assert s["apple_health_synced_at"] is None and s["steps_source"] is None


def test_the_watchs_own_day_totals_replace_the_estimates(env):
    c = env["client"]
    r = c.post("/vitals/ingest", headers=env["h"], json={"device_id": "apple-health", "device_name": "Apple Health (HUAWEI Health)", "steps": 8420, "calories": 412,
                                                         "active_minutes": 47, "distance_m": 6100, "steps_source": "HUAWEI Health"})
    assert r.status_code == 200, r.text
    s = summary(env)
    assert s["rings"]["steps"]["value"] == 8420 and s["steps_source"] == "HUAWEI Health"
    assert s["rings"]["calories"] == {"value": 412, "goal": s["rings"]["calories"]["goal"], "estimated": False}
    assert s["rings"]["minutes"]["value"] == 47 and s["rings"]["minutes"]["estimated"] is False
    assert s["distance_m"] == 6100 and s["apple_health_synced_at"]


def test_day_totals_never_go_down(env):
    c = env["client"]
    c.post("/vitals/ingest", headers=env["h"], json={"device_id": "apple-health", "steps": 100, "calories": 5, "active_minutes": 1, "distance_m": 50})   # a late, smaller upload
    s = summary(env)
    assert s["rings"]["steps"]["value"] == 8420 and s["rings"]["calories"]["value"] == 412 and s["rings"]["minutes"]["value"] == 47
    c.post("/vitals/ingest", headers=env["h"], json={"device_id": "apple-health", "steps": 9000, "calories": 450, "active_minutes": 50, "steps_source": "iPhone"})
    s = summary(env)
    assert s["rings"]["steps"]["value"] == 9000 and s["rings"]["calories"]["value"] == 450 and s["steps_source"] == "iPhone"


def test_day_totals_are_validated(env):
    c = env["client"]
    for bad in ({"calories": 99999}, {"active_minutes": 5000}, {"steps": -1}, {"distance_m": 10 ** 9}):
        assert c.post("/vitals/ingest", headers=env["h"], json={"device_id": "apple-health", **bad}).status_code == 422, bad
    assert c.post("/vitals/ingest", headers=env["h"], json={"device_id": "apple-health"}).status_code == 400          # nothing to record
