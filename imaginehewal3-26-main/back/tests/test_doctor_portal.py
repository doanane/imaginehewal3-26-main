"""Doctor website + its link to the patient and caregiver apps. Offline."""
import os
import re

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.caregiver import CaregiverRelationship, Doctor
    from app.models.user import User, UserProfile
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    from app.database import _ensure_columns
    _ensure_columns()
    simple_limiter.reset()
    db = SessionLocal()
    for d in ("DPT0001A", "DPT0001B"):
        db.query(Doctor).filter(Doctor.doctor_id == d).delete()
    docs = {d: Doctor(doctor_id=d, full_name=f"Dr {d}", specialization="GP", hospital="Test", is_active=True,
                      hashed_password=get_password_hash("Passw0rd!x1")) for d in ("DPT0001A", "DPT0001B")}
    db.add_all(docs.values()); db.commit()
    mk = lambda n, **k: User(email=f"dp_{n}@example.com", username=f"dp_{n}", hashed_password=get_password_hash("Passw0rd!x1"), **k)
    pat, other, cg = mk("pat"), mk("other"), mk("cg", is_caregiver=True)
    db.add_all([pat, other, cg]); db.commit()
    # SQLite reuses ids of deleted users, so clear anything an earlier test left behind for these ids
    from app.models.health import HealthData
    from app.models.iot_device import VitalReading
    from app.models.safety import SosEvent
    for model in (VitalReading, HealthData, SosEvent):
        db.query(model).filter(model.user_id.in_([pat.id, other.id, cg.id])).delete(synchronize_session=False)
    db.commit()
    db.add_all([
        UserProfile(user_id=pat.id, full_name="Ama Test", age=61, gender="Female", chronic_conditions=["Hypertension"], doctor_id="DPT0001A", profile_completed=True),
        UserProfile(user_id=other.id, full_name="Not Mine", age=50, gender="Male", chronic_conditions=[], doctor_id="DPT0001B", profile_completed=True),
        CaregiverRelationship(caregiver_id=cg.id, patient_id=pat.id, relationship_type="nurse", status="approved"),
    ]); db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), pat=pat.id, other=other.id, cg=cg.id, hp=tok(pat), hc=tok(cg))
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for uid in (pat.id, other.id, cg.id):
        row = db2.query(User).filter(User.id == uid).first()
        if row:
            delete_account(db2, row)
    db2.query(Doctor).filter(Doctor.doctor_id.in_(["DPT0001A", "DPT0001B"])).delete(synchronize_session=False)
    db2.commit(); db2.close(); db.close()


def login(c, doctor_id="DPT0001A", password="Passw0rd!x1"):
    r = c.post("/doctor-portal/login", json={"doctor_id": doctor_id, "password": password})
    return r, ({"Authorization": "Bearer " + r.json()["access_token"]} if r.status_code == 200 else None)


def test_site_is_served(env):
    r = env["client"].get("/doctor/")
    assert r.status_code == 200 and "HEWAL3 Doctor" in r.text
    assets = re.findall(r'(?:src|href)="/doctor/(assets/[^"]+)"', r.text)
    assert any(a.endswith(".js") for a in assets) and any(a.endswith(".css") for a in assets)
    for a in assets:
        assert env["client"].get("/doctor/" + a).status_code == 200


def test_login_rules(env):
    c = env["client"]
    assert login(c)[0].status_code == 200
    assert login(c, password="wrong")[0].status_code == 401
    r = login(c, doctor_id="NOPE0000")[0]
    assert r.status_code == 401 and r.json()["detail"] == "Invalid doctor ID or password"   # same message: no ID discovery
    assert c.get("/doctor-portal/overview").status_code == 401
    assert c.get("/doctor-portal/overview", headers=env["hp"]).status_code == 403            # a patient token is not a doctor


def test_doctor_sees_only_own_patients(env):
    c = env["client"]
    _, h = login(c)
    data = c.get("/doctor-portal/overview", headers=h).json()
    names = [p["name"] for p in data["patients"]]
    assert "Ama Test" in names and "Not Mine" not in names
    assert c.get(f"/doctor-portal/patients/{env['other']}", headers=h).status_code == 404
    assert c.post(f"/doctor-portal/patients/{env['other']}/message", headers=h, json={"message": "hi"}).status_code == 404


def test_vitals_flow_to_caregiver_and_doctor(env):
    c = env["client"]
    _, h = login(c)
    before = next(p for p in c.get("/doctor-portal/overview", headers=h).json()["patients"] if p["patient_id"] == env["pat"])
    assert before["status"] == "no_data"

    r = c.post("/vitals/ingest", headers=env["hp"], json={"device_id": "dp-watch-1", "heart_rate": 72, "blood_oxygen": 98})
    assert r.status_code == 200, r.text
    mid = next(p for p in c.get("/doctor-portal/overview", headers=h).json()["patients"] if p["patient_id"] == env["pat"])
    assert mid["status"] == "stable" and mid["vitals"]["heart_rate"] == 72

    for _ in range(2):    # two critical readings in a row start an emergency (one could be a sensor glitch)
        r = c.post("/vitals/ingest", headers=env["hp"], json={"device_id": "dp-watch-1", "heart_rate": 155, "blood_pressure_systolic": 190, "blood_pressure_diastolic": 125})
        assert r.status_code == 200, r.text
    ov = c.get("/doctor-portal/overview", headers=h).json()
    me = next(p for p in ov["patients"] if p["patient_id"] == env["pat"])
    assert me["status"] == "critical" and ov["stats"]["critical"] >= 1 and ov["stats"]["active_alerts"] >= 1
    assert ov["patients"][0]["patient_id"] == env["pat"]                                      # critical patients sort first
    assert "dp_cg" in me["caregivers"]

    detail = c.get(f"/doctor-portal/patients/{env['pat']}", headers=h).json()
    assert len(detail["vitals_series"]) >= 2 and detail["emergencies"]

    # the same patient shows up on the caregiver side too
    cg = c.get("/caregivers/dashboard", headers=env["hc"])
    assert cg.status_code == 200, cg.text
    assert any(p["id"] == env["pat"] for p in cg.json()["recent_patients"])

    # the open emergency is visible to the doctor with its real status; the caregiver acknowledges it and the doctor sees that
    alert = ov["alerts"][0]
    assert alert["patient_id"] == env["pat"] and alert["status"] in ("pending", "active")
    ack = c.post(f"/emergency/{alert['id']}/ack", headers=env["hc"])
    assert ack.status_code == 200, ack.text
    after = c.get("/doctor-portal/overview", headers=h).json()
    assert after["alerts"][0]["status"] == "acknowledged"
    # a doctor cannot clear an emergency
    assert c.post(f"/emergency/{alert['id']}/resolve", headers=h).status_code in (401, 403)
    assert c.post(f"/emergency/{alert['id']}/resolve", headers=env["hc"]).status_code == 200
    assert c.get("/doctor-portal/overview", headers=h).json()["stats"]["active_alerts"] == 0


def test_caregiver_contract(env):
    c = env["client"]
    pats = c.get("/caregivers/patients", headers=env["hc"])
    assert pats.status_code == 200, pats.text
    p = next(x for x in pats.json() if x["id"] == env["pat"])
    for key in ("id", "patient_id", "patient_name", "email", "status", "conditions", "assigned_at", "relationship_type"):
        assert key in p, key
    assert isinstance(p["patient_id"], str)
    stats = c.get("/caregivers/patients/stats", headers=env["hc"]).json()
    assert stats["total_patients"] >= 1
    ov = c.get(f"/caregivers/patients/{env['pat']}/overview", headers=env["hc"])
    assert ov.status_code == 200, ov.text
    assert c.get(f"/caregivers/patients/{env['other']}/overview", headers=env["hc"]).status_code == 404   # not their patient
    assert c.get("/caregivers/patients", headers=env["hp"]).status_code == 403                            # patients are not caregivers


def test_message_reaches_patient(env):
    c = env["client"]
    _, h = login(c)
    assert c.post(f"/doctor-portal/patients/{env['pat']}/message", headers=h, json={"message": "   "}).status_code in (400, 422)
    r = c.post(f"/doctor-portal/patients/{env['pat']}/message", headers=h, json={"message": "Please rest and recheck your BP tonight."})
    assert r.status_code == 200
    notes = c.get("/notifications/", headers=env["hp"])
    assert notes.status_code == 200, notes.text
    assert "recheck your BP" in notes.text


def test_patient_links_and_unlinks_own_doctor(env):
    c = env["client"]
    assert c.get("/my-doctor", headers=env["hp"]).json()["doctor"]["doctor_id"] == "DPT0001A"
    assert c.put("/my-doctor", headers=env["hp"], json={"doctor_id": "NOSUCH99"}).status_code == 404
    assert c.put("/my-doctor", headers=env["hc"], json={"doctor_id": "DPT0001B"}).status_code == 403   # caregivers have no doctor link
    assert c.delete("/my-doctor", headers=env["hp"]).json()["doctor"] is None
    _, h = login(c)
    assert all(p["patient_id"] != env["pat"] for p in c.get("/doctor-portal/overview", headers=h).json()["patients"])   # gone from the doctor's list
    assert c.put("/my-doctor", headers=env["hp"], json={"doctor_id": "dpt0001a"}).json()["doctor"]["full_name"] == "Dr DPT0001A"   # case-insensitive
    assert any(p["patient_id"] == env["pat"] for p in c.get("/doctor-portal/overview", headers=h).json()["patients"])


def test_old_watch_reading_keeps_its_time_and_never_alarms(env):
    from datetime import datetime, timedelta, timezone
    c = env["client"]
    _, h = login(c)
    c.delete("/my-doctor", headers=env["hp"]); c.put("/my-doctor", headers=env["hp"], json={"doctor_id": "DPT0001A"})
    old = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    body = {"device_id": "dp-old-watch", "heart_rate": 170, "measured_at": old}
    r = c.post("/vitals/ingest", headers=env["hp"], json=body)
    assert r.status_code == 200 and r.json()["alert_reasons"] == []                       # 3 hours old: not an emergency now
    again = c.post("/vitals/ingest", headers=env["hp"], json=body)                         # the same reading again must not duplicate
    assert again.status_code == 200
    detail = c.get(f"/doctor-portal/patients/{env['pat']}", headers=h).json()
    ages = [x for x in detail["vitals_series"] if x["heart_rate"] == 170]
    assert len(ages) == 1


def _clean(uid):
    """Start a scenario from a quiet patient: no readings and no earlier emergencies (an automatic emergency has a 10 minute cooldown)."""
    from app.database import SessionLocal
    from app.models.health import HealthData
    from app.models.iot_device import VitalReading
    from app.models.safety import SosEvent
    db = SessionLocal()
    for m in (VitalReading, HealthData, SosEvent):
        db.query(m).filter(m.user_id == uid).delete(synchronize_session=False)
    db.commit(); db.close()


def test_blood_pressure_spike_starts_an_emergency_the_doctor_sees(env):
    """The brief: a dangerous blood pressure spike, on its own, starts the emergency protocol."""
    from app.services import simple_limiter
    c = env["client"]
    _, h = login(c)
    c.delete("/my-doctor", headers=env["hp"]); c.put("/my-doctor", headers=env["hp"], json={"doctor_id": "DPT0001A"})
    simple_limiter.reset(); _clean(env["pat"])
    for _ in range(2):      # two readings in a row, so one glitch cannot start it
        r = c.post("/vitals/ingest", headers=env["hp"], json={"device_id": "dp-bp-watch", "heart_rate": 80, "blood_pressure_systolic": 195, "blood_pressure_diastolic": 128})
        assert r.status_code == 200 and "blood_pressure" in r.json()["alert_reasons"], r.text
    ov = c.get("/doctor-portal/overview", headers=h).json()
    alert = next(a for a in ov["alerts"] if a["patient_id"] == env["pat"])
    assert "blood pressure" in alert["reason"].lower() and "195/128" in alert["reason"]
    me = next(p for p in ov["patients"] if p["patient_id"] == env["pat"])
    assert me["status"] == "critical" and me["group"] == "critical"
    c.post(f"/emergency/{alert['id']}/resolve", headers=env["hc"])


def test_simulated_spike_goes_through_the_same_pipeline(env):
    c = env["client"]
    _, h = login(c)
    _clean(env["pat"])
    r = c.post("/emergency/simulate-vitals", headers=env["hp"], json={"systolic": 190, "diastolic": 125})
    assert r.status_code == 200, r.text
    assert "blood pressure" in r.json()["reason"].lower()
    ov = c.get("/doctor-portal/overview", headers=h).json()
    assert any(a["patient_id"] == env["pat"] for a in ov["alerts"])
    assert c.post("/emergency/simulate-vitals", headers=env["hp"], json={"systolic": 120, "diastolic": 80}).status_code == 400   # a normal reading starts nothing
    c.post(f"/emergency/{r.json()['id']}/resolve", headers=env["hc"])


def test_meal_tip_uses_the_live_readings(env):
    from app.services import ghana_foods as gf, simple_limiter
    c = env["client"]
    simple_limiter.reset()
    salty = next(k for k, f in gf.FOODS.items() if gf.scale(f, 1.0)["sodium_mg"] > 600)
    # nothing recent: honest about it
    _clean(env["pat"])
    none = c.get(f"/meals/foods/{salty}", headers=env["hp"]).json()["coach"]
    assert none["based_on"] == [] and "watch" in none["message"].lower()
    # a high blood pressure and a salty dish
    c.post("/vitals/ingest", headers=env["hp"], json={"device_id": "dp-meal-watch", "heart_rate": 78, "blood_pressure_systolic": 150, "blood_pressure_diastolic": 95})
    tip = c.get(f"/meals/foods/{salty}", headers=env["hp"]).json()["coach"]
    assert tip["tone"] == "warning" and "150/95" in tip["message"] and "salt" in tip["message"].lower()
    assert any("blood pressure" in x for x in tip["based_on"])
    # a dangerous reading: no food advice at all, sit down
    for _ in range(2):
        c.post("/vitals/ingest", headers=env["hp"], json={"device_id": "dp-meal-watch", "heart_rate": 160})
    danger = c.get(f"/meals/foods/{salty}", headers=env["hp"]).json()["coach"]
    assert danger["tone"] == "danger" and "sit down" in danger["headline"].lower() and "112" in danger["message"]


def test_triage_groups(env):
    from app.services.care_snapshot import _group
    assert _group("critical", ["Diabetes"]) == "critical" and _group("monitor", []) == "monitor" and _group("no_data", []) == "no_data"
    assert _group("stable", ["Hypertension"]) == "stable" and _group("stable", []) == "healthy"
