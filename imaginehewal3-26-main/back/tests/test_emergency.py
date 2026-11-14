"""Emergency Auto-Response tests. Offline. Time is controlled by passing `now` to advance()."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_emergency.db")
os.environ["EMERGENCY_DISPATCH_MODE"] = "simulate"
os.environ["EMERGENCY_ACK_WAIT_SECONDS"] = "60"

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.models.user import User
    from app.models.caregiver import CaregiverRelationship
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    mk = lambda n, **k: User(email=f"em_{n}@example.com", username=f"em_{n}", **k)
    p1, p2, cg, st = mk("p1", first_name="Ama", last_name="Mensah"), mk("p2"), mk("cg", is_caregiver=True, first_name="Kofi"), mk("st")
    db.add_all([p1, p2, cg, st]); db.commit()
    db.add(CaregiverRelationship(caregiver_id=cg.id, patient_id=p1.id, status="approved")); db.commit()
    tok = lambda u, t="patient": {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, t)}
    ids = [p1.id, p2.id, cg.id, st.id]
    yield dict(client=TestClient(app), p1=p1.id, p2=p2.id, cg=cg.id, st=st.id,
               hp1=tok(p1), hp2=tok(p2), hcg=tok(cg, "caregiver"), hst=tok(st),
               tcg=create_access_token({"sub": str(cg.id)}, "caregiver"))
    q = ",".join(map(str, ids))
    for sql in (f"delete from access_logs where patient_id in ({q}) or viewer_id in ({q})", f"delete from sos_logs where event_id in (select id from sos_events where user_id in ({q}))",
                f"delete from sos_events where user_id in ({q})", f"delete from notifications where user_id in ({q})",
                f"delete from vital_readings where user_id in ({q})", f"delete from iot_devices where user_id in ({q})",
                f"delete from health_data where user_id in ({q})", f"delete from caregiver_relationships where patient_id in ({q})",
                f"delete from users where id in ({q})"):
        db.execute(text(sql))
    db.commit(); db.close()


def _db():
    from app.database import SessionLocal
    return SessionLocal()


def _event(db, event_id):
    from app.models.safety import SosEvent
    return db.query(SosEvent).filter_by(id=event_id).first()


def _reset(env):
    """Close any open events so each test starts clean."""
    from app.models.safety import SosEvent
    db = _db()
    db.query(SosEvent).filter(SosEvent.user_id.in_([env["p1"], env["p2"]])).update({"status": "resolved"}, synchronize_session=False)
    db.commit(); db.close()


def test_thresholds():
    from app.services.emergency_service import evaluate_vitals
    assert evaluate_vitals(hr=72, spo2=97) is None
    assert evaluate_vitals(hr=155)[0].startswith("Heart rate is dangerous")
    assert evaluate_vitals(hr=30) is not None
    assert evaluate_vitals(spo2=85)[0].startswith("Blood oxygen")
    assert evaluate_vitals(systolic=190, diastolic=100)[0].startswith("Blood pressure")
    assert evaluate_vitals(hr=130) is None   # fast but not in the critical range


def test_full_escalation_timeline(env):
    _reset(env)
    c = env["client"]
    ev = c.post("/emergency/sos", json={"grace_seconds": 0, "reason": "Chest pain"}, headers=env["hp1"]).json()
    assert ev["status"] == "active" and ev["attempts"] == 1            # caregiver alert 1 sent at once
    from app.services.emergency_service import advance
    db = _db()
    t0 = datetime.now(timezone.utc)
    assert advance(db, _event(db, ev["id"]), t0 + timedelta(seconds=30)) is None             # still waiting
    assert advance(db, _event(db, ev["id"]), t0 + timedelta(seconds=61)) == "caregiver_alert_2"
    assert advance(db, _event(db, ev["id"]), t0 + timedelta(seconds=125)) == "escalated"
    final = c.get(f"/emergency/{ev['id']}", headers=env["hp1"]).json()
    kinds = [t["kind"] for t in final["timeline"]]
    assert final["status"] == "escalated"
    assert kinds[0] == "created" and "caregiver_alert_1" in kinds and "caregiver_alert_2" in kinds and "dispatch_simulated" in kinds
    assert final["dispatch_mode"] == "simulate"
    db.close()


def test_acknowledge_stops_escalation_and_permissions(env):
    _reset(env)
    c = env["client"]
    ev = c.post("/emergency/sos", json={"grace_seconds": 0}, headers=env["hp1"]).json()
    assert c.post(f"/emergency/{ev['id']}/ack", headers=env["hst"]).status_code == 404       # a stranger cannot even see it
    assert c.post(f"/emergency/{ev['id']}/ack", headers=env["hp1"]).status_code == 403       # patients cannot self-acknowledge
    ok = c.post(f"/emergency/{ev['id']}/ack", headers=env["hcg"])
    assert ok.status_code == 200 and ok.json()["status"] == "acknowledged"
    from app.services.emergency_service import advance
    db = _db()
    assert advance(db, _event(db, ev["id"]), datetime.now(timezone.utc) + timedelta(minutes=10)) is None   # nothing escalates
    db.close()
    assert c.get(f"/emergency/{ev['id']}", headers=env["hcg"]).json()["status"] == "acknowledged"


def test_cancel_in_grace_period_never_alerts_caregivers(env):
    _reset(env)
    c = env["client"]
    ev = c.post("/emergency/sos", json={"grace_seconds": 30}, headers=env["hp1"]).json()
    assert ev["status"] == "pending" and ev["attempts"] == 0
    assert c.post(f"/emergency/{ev['id']}/cancel", headers=env["hcg"]).status_code == 403     # only the patient cancels
    done = c.post(f"/emergency/{ev['id']}/cancel", headers=env["hp1"]).json()
    assert done["status"] == "cancelled" and done["attempts"] == 0
    from app.services.emergency_service import advance
    db = _db()
    assert advance(db, _event(db, ev["id"]), datetime.now(timezone.utc) + timedelta(minutes=5)) is None
    db.close()


def test_no_caregivers_escalates_immediately(env):
    _reset(env)
    ev = env["client"].post("/emergency/sos", json={"grace_seconds": 0}, headers=env["hp2"]).json()
    assert ev["status"] == "escalated"
    assert "no_recipients" in [t["kind"] for t in env["client"].get(f"/emergency/{ev['id']}", headers=env["hp2"]).json()["timeline"]]


def test_auto_trigger_needs_two_critical_readings(env):
    _reset(env)
    c = env["client"]
    body = {"device_id": "TEST:WATCH:01", "heart_rate": 165}
    c.post("/vitals/ingest", json={"device_id": "TEST:WATCH:01", "heart_rate": 72}, headers=env["hp1"])
    c.post("/vitals/ingest", json=body, headers=env["hp1"])
    assert c.get("/emergency/active", headers=env["hp1"]).json()["mine"] is None            # one spike is not enough
    c.post("/vitals/ingest", json=body, headers=env["hp1"])
    mine = c.get("/emergency/active", headers=env["hp1"]).json()["mine"]
    assert mine and mine["trigger"] == "auto_vitals" and mine["status"] == "pending"        # grace period for the patient
    assert "165" in mine["reason"] or "Heart rate" in mine["reason"]
    seen = c.get("/emergency/active", headers=env["hcg"]).json()["patients"]
    assert seen and seen[0]["id"] == mine["id"]                                              # caregiver can see their patient's event


def test_location_sharing_rules_and_realtime(env):
    _reset(env)
    c = env["client"]
    with c.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": env["tcg"]})
        assert ws.receive_json()["type"] == "ready"
        ev = c.post("/emergency/sos", json={"grace_seconds": 0}, headers=env["hp1"]).json()
        alert = ws.receive_json()
        assert alert["type"] == "alert" and alert["kind"] == "emergency" and alert["event"]["id"] == ev["id"]
        assert c.post(f"/emergency/{ev['id']}/location", json={"lat": 5.6037, "lng": -0.187, "accuracy": 12}, headers=env["hcg"]).status_code == 403
        assert c.post(f"/emergency/{ev['id']}/location", json={"lat": 5.6037, "lng": -0.187, "accuracy": 12}, headers=env["hp1"]).status_code == 200
        loc = ws.receive_json()
        assert loc["type"] == "emergency.location" and abs(loc["lat"] - 5.6037) < 1e-6 and "maps.google.com" in loc["location_url"]
    assert c.post("/emergency/1/location", json={"lat": 200, "lng": 0}, headers=env["hp1"]).status_code == 422   # bad coordinates rejected


def test_simulate_endpoint_runs_the_real_pipeline(env):
    _reset(env)
    c = env["client"]
    assert c.post("/emergency/simulate-vitals", json={"heart_rate": 80}, headers=env["hp1"]).status_code == 400
    r = c.post("/emergency/simulate-vitals", json={"heart_rate": 170}, headers=env["hp1"])
    assert r.status_code == 200 and r.json()["trigger"] == "auto_vitals"
    assert c.get("/emergency/config", headers=env["hp1"]).json()["simulation"] is True
