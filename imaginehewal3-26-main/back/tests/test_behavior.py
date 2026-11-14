"""Behaviour-change loop tests. Run offline:  DATABASE_URL=sqlite:///./test_behavior.db pytest tests/test_behavior.py
Unlike test_api.py these do not need a running server."""
import os
from datetime import date, timedelta

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_behavior.db")

import pytest
from app.services import behavior_engine as eng

T = date(2026, 11, 20)


def days(*pairs):
    return {T - timedelta(days=ago): s for ago, s in pairs}


def test_targets_are_a_small_step_and_monotonic():
    ts = [eng.target_for("movement", 3000, 8000, lv) for lv in range(1, 6)]
    assert ts == sorted(ts) and ts[0] > 3000 and ts[-1] == 8000
    assert eng.target_for("smoking", 10, 0, 1) < 10  # always a step down
    assert eng.target_for("movement", 3000, 8000, 5, comeback=True) < ts[1]


def test_lapse_detection_and_no_reset():
    start = T - timedelta(days=30)
    hist = days(*[(i, "done") for i in range(10, 30)])
    lapse = eng.detect_lapse(hist, T, start)
    assert lapse["state"] == "lapse" and lapse["missed_days"] == 9
    s = eng.streaks(hist, T)
    assert s["total_active_days"] == 20 and s["best"] == 20  # progress kept
    assert s["current"] == 0


def test_streak_tolerates_one_missed_day_only():
    one_gap = days((1, "done"), (3, "done"), (4, "done"))
    assert eng.streaks(one_gap, T)["current"] == 3
    two_gap = days((1, "done"), (4, "done"), (5, "done"))
    assert eng.streaks(two_gap, T)["current"] == 1


def test_level_up_down_and_no_flipflop():
    start = T - timedelta(days=10)
    great = days(*[(i, "done") for i in range(1, 8)])
    assert eng.suggest_level(2, great, T, start, None) == (3, "level_up")
    assert eng.suggest_level(2, great, T, start, T - timedelta(days=1)) == (2, None)
    bad = days((1, "skipped"), (2, "skipped"), (3, "skipped"), (4, "skipped"), (5, "skipped"))
    assert eng.suggest_level(3, bad, T, start, None) == (2, "level_down")
    assert eng.suggest_level(1, bad, T, start, None)[0] == 1  # floor


def test_barrier_adapts_action_and_explains():
    a = eng.build_action("movement", 3000, 8000, 2, T, top_barrier="weather")
    assert "indoor" in a["detail"].lower() and "Limits:" in a["rationale"]
    c = eng.build_action("movement", 3000, 8000, 2, T, comeback=True)
    assert c["technique"] == "Self-compassion after setbacks"


def test_status_from_value_directions():
    assert eng.status_from_value("movement", 6000, 5000, 3000) == "done"
    assert eng.status_from_value("smoking", 4, 5, 10) == "done"
    assert eng.status_from_value("smoking", 8, 5, 10) == "partial"
    assert eng.status_from_value("smoking", 12, 5, 10) == "skipped"


def test_outcomes_recovery_time():
    start = T - timedelta(days=21)
    hist = {start + timedelta(days=i): "done" for i in range(21) if not 5 <= i < 11}
    vals = {d: 6000.0 for d in hist if d >= T - timedelta(days=7)}
    o = eng.outcomes(hist, vals, 3000, "up", start, T)
    assert o["lapses"] == 1 and o["avg_days_to_recover"] == 6.0
    assert o["behaviour_change_pct_vs_baseline"] == 100.0


# ---------- API integration (offline, SQLite) ----------
@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import get_current_active_user
    from app.models.user import User
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    u = User(email="behavior_test@example.com", username="behavior_test")
    db.add(u)
    db.commit()
    db.refresh(u)
    app.dependency_overrides[get_current_active_user] = lambda: u
    yield TestClient(app)
    app.dependency_overrides.clear()
    db.query(User).filter_by(id=u.id).delete()
    db.commit()
    db.close()


def test_full_loop(client):
    r = client.post("/behavior/plans", json={"behavior": "movement"})
    assert r.status_code == 200, r.text
    r = client.get("/behavior/today")
    item = r.json()["items"][0]
    assert item["action"]["status"] == "pending" and item["action"]["rationale"]
    aid = item["action"]["id"]
    r = client.post(f"/behavior/actions/{aid}/checkin", json={"status": "skipped"})
    assert r.status_code == 200 and r.json()["ask_barrier"]
    assert client.post(f"/behavior/actions/{aid}/checkin",
                       json={"status": "skipped", "barrier": "nonsense"}).status_code == 400
    assert client.post("/behavior/plans", json={"behavior": "movement", "baseline_value": 9000,
                                                "goal_value": 100}).status_code == 400


def test_consent_enforced_and_demo_story(client):
    assert client.post("/behavior/sync-wearable").status_code == 403  # opt-in off by default
    assert client.put("/behavior/settings", json={"language": "xx"}).status_code == 400
    assert client.put("/behavior/settings", json={"language": "ar"}).json()["language"] == "ar"
    assert client.post("/behavior/demo/seed").status_code == 200
    out = client.get("/behavior/outcomes").json()[0]["outcomes"]
    assert out["lapses"] == 1 and out["recovered_lapses"] == 1
    today = client.get("/behavior/today").json()
    assert today["items"][0]["streak"]["total_active_days"] > 25
    eq = client.get("/behavior/equity").json()
    assert all(v["avg_adherence"] is None for g in eq["groups"].values() for v in g.values())
    assert client.delete("/behavior/my-data").json()["deleted"]
    assert client.get("/behavior/plans").json() == []


def test_live_vitals_roundtrip(client):
    assert client.post("/vitals/ingest", json={"device_id": "AA:BB"}).status_code == 400
    assert client.post("/vitals/ingest", json={"device_id": "AA:BB", "heart_rate": 999}).status_code == 422
    r = client.post("/vitals/ingest", json={"device_id": "AA:BB", "heart_rate": 72, "steps": 1234})
    assert r.status_code == 200, r.text
    live = client.get("/vitals/live").json()
    assert live["is_live"] and live["latest"]["heart_rate"] == 72 and len(live["history"]) >= 1
