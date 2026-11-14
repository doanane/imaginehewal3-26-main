"""Risk engine, recommendations, Ghanaian meals and medicines. Offline: no network, no API keys."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_care.db")
os.environ["VISION_PROVIDER"] = "off"

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.models.user import User, UserProfile
    from app.models.caregiver import CaregiverRelationship
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    mk = lambda n, **k: User(email=f"care_{n}@example.com", username=f"care_{n}", **k)
    sick, well, cg, other = mk("sick", first_name="Yaw"), mk("well"), mk("cg", is_caregiver=True), mk("other")
    db.add_all([sick, well, cg, other]); db.commit()
    db.add_all([
        UserProfile(user_id=sick.id, full_name="Yaw", age=58, gender="male", chronic_conditions=["hypertension", "diabetes"],
                    weight=95, height=170, blood_pressure="150/95", blood_glucose=150),
        UserProfile(user_id=well.id, full_name="Efua", age=30, gender="female", chronic_conditions=[], weight=62, height=168, blood_pressure="110/70", blood_glucose=88),
        CaregiverRelationship(caregiver_id=cg.id, patient_id=sick.id, status="approved"),
    ]); db.commit()
    tok = lambda u, t="patient": {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, t)}
    ids = [sick.id, well.id, cg.id, other.id]
    yield dict(client=TestClient(app), sick=sick.id, well=well.id, hs=tok(sick), hw=tok(well), hcg=tok(cg, "caregiver"), ho=tok(other))
    q = ",".join(map(str, ids))
    for sql in (f"delete from access_logs where patient_id in ({q}) or viewer_id in ({q})", f"delete from medication_logs where user_id in ({q})", f"delete from medications where user_id in ({q})",
                f"delete from food_logs where user_id in ({q})", f"delete from vital_readings where user_id in ({q})",
                f"delete from iot_devices where user_id in ({q})", f"delete from notifications where user_id in ({q})",
                f"delete from user_profiles where user_id in ({q})", f"delete from behavior_plans where user_id in ({q})",
                f"delete from caregiver_relationships where patient_id in ({q})", f"delete from users where id in ({q})"):
        db.execute(text(sql))
    db.commit(); db.close()


# ----------------------------------------------------------------------- risk
def test_risk_tiers_follow_the_guidelines(env):
    c = env["client"]
    sick = c.get("/risk/summary", headers=env["hs"]).json()
    assert sick["tier"] in ("high", "urgent") and sick["score"] >= 40
    keys = [f["key"] for f in sick["factors"]]
    assert "bp" in keys and "glucose" in keys and "bmi" in keys and "hypertension" in keys
    assert sick["factors"] == sorted(sick["factors"], key=lambda f: -f["points"])          # most important first
    assert "not a diagnosis" in sick["method"].lower() and sick["disclaimer"]
    well = c.get("/risk/summary", headers=env["hw"]).json()
    assert well["tier"] == "low" and well["score"] < 20
    assert "heart rate (connect your watch)" in well["missing"]                           # honest about what it cannot see


def test_bp_crisis_is_urgent_regardless_of_score(env):
    from app.services.risk_service import score, bp_category
    base = dict(age=30, bmi=22, systolic=185, diastolic=125, glucose=None, conditions=[], family_history=False, avg_hr=None,
                avg_spo2=None, avg_steps=None, avg_sleep_min=None, avg_diet=None, med_adherence=None, smoking=False)
    assert bp_category(185, 125) == "crisis" and score(base)["tier"] == "urgent"
    assert bp_category(119, 79) == "normal" and bp_category(125, 70) == "elevated" and bp_category(135, 75) == "stage1" and bp_category(145, 85) == "stage2"


def test_personal_baseline_anomaly(env):
    from app.database import SessionLocal
    from app.models.iot_device import IoTDevice, VitalReading
    db = SessionLocal()
    dev = IoTDevice(user_id=env["well"], device_id="CARE:TEST:01", device_type="smartwatch", device_name="t", manufacturer="t", model="t", connection_status="connected")
    db.add(dev); db.flush()
    now = datetime.now(timezone.utc)
    for n in range(40):                                   # a calm personal baseline around 68 bpm
        db.add(VitalReading(device_id=dev.id, user_id=env["well"], heart_rate=66 + (n % 5), timestamp=now - timedelta(hours=40 - n)))
    db.commit()
    assert env["client"].get("/risk/summary", headers=env["hw"]).json()["anomalies"] == []
    for n in range(3):                                    # then three readings far above their own normal
        db.add(VitalReading(device_id=dev.id, user_id=env["well"], heart_rate=128, timestamp=now - timedelta(minutes=3 - n)))
    db.commit(); db.close()
    out = env["client"].get("/risk/summary", headers=env["hw"]).json()
    assert out["anomalies"] and "above your normal" in out["anomalies"][0]["label"]
    recs = env["client"].get("/risk/recommendations", headers=env["hw"]).json()
    assert recs["items"][0]["id"] == "anomaly"            # an anomaly is always the first recommendation


def test_recommendations_and_caregiver_overview(env):
    c = env["client"]
    items = c.get("/risk/recommendations", headers=env["hs"]).json()["items"]
    assert 1 <= len(items) <= 6 and all(r["title"] and r["why"] and r["route"].startswith("/") for r in items)
    patients = c.get("/risk/patients", headers=env["hcg"]).json()
    assert [p["patient_id"] for p in patients] == [env["sick"]] and patients[0]["tier"] in ("high", "urgent")
    assert c.get("/risk/patients", headers=env["ho"]).json() == []                          # no relationship, no data
    assert c.get("/risk/summary").status_code in (401, 403)


# ----------------------------------------------------------------------- meals
def test_food_search_and_scaling(env):
    c = env["client"]
    names = [f["name"] for f in c.get("/meals/foods?q=fufu", headers=env["hs"]).json()["items"]]
    assert any("Fufu" in n for n in names)
    assert c.get("/meals/foods?q=zzzz", headers=env["hs"]).json()["items"] == []
    reg = c.get("/meals/foods/jollof_rice", headers=env["hs"]).json()
    big = c.get("/meals/foods/jollof_rice?portion=large", headers=env["hs"]).json()
    assert reg["nutrients"]["calories"] == 420 and big["nutrients"]["calories"] == round(420 * 1.4)
    assert c.get("/meals/foods/jollof_rice?portion=huge", headers=env["hs"]).status_code == 404
    assert c.get("/meals/foods/not_a_dish", headers=env["hs"]).status_code == 404


def test_assessment_depends_on_the_persons_conditions(env):
    c = env["client"]
    diabetic_hypertensive = c.get("/meals/foods/fufu_groundnut_soup", headers=env["hs"]).json()["assessment"]
    healthy = c.get("/meals/foods/fufu_groundnut_soup", headers=env["hw"]).json()["assessment"]
    assert diabetic_hypertensive["diet_score"] < healthy["diet_score"]
    assert any("salt" in x.lower() or "starch" in x.lower() for x in diabetic_hypertensive["concerns"])
    good = c.get("/meals/foods/grilled_tilapia", headers=env["hs"]).json()["assessment"]
    assert good["warning_level"] == "low" and good["diet_score"] >= 70


def test_log_meal_and_daily_total(env):
    c = env["client"]
    r = c.post("/meals/log", json={"dish_id": "waakye", "portion": "regular", "meal_type": "lunch"}, headers=env["hw"])
    assert r.status_code == 200 and r.json()["nutrients"]["calories"] == 520
    r2 = c.post("/meals/log", json={"dish_id": "oats", "portion": "small", "meal_type": "breakfast"}, headers=env["hw"]).json()
    assert r2["today"]["calories"] == 520 + round(220 * 0.7) and len(r2["today"]["meals"]) == 2
    m = r2["today"]
    assert m["calories"] == 520 + round(220 * 0.7)
    macros = c.get("/meals/today", headers=env["hw"]).json()["macros"]            # waakye 82 g carbs + 0.7 x oats 36 g
    assert abs(macros["carbs_g"] - (82 + 36 * 0.7)) < 0.2 and macros["kcal_from"]["fat"] == round(macros["fat_g"] * 9)
    assert c.get("/meals/today", headers=env["ho"]).json()["calories"] == 0                 # another user's meals are not visible
    assert c.post("/meals/log", json={"dish_id": "nope", "portion": "regular", "meal_type": "lunch"}, headers=env["hw"]).status_code == 404
    assert c.post("/meals/log", json={"dish_id": "waakye", "portion": "gigantic", "meal_type": "lunch"}, headers=env["hw"]).status_code == 422
    assert c.post("/meals/log", json={"dish_id": "waakye", "portion": "regular", "meal_type": "midnight"}, headers=env["hw"]).status_code == 422


def test_identify_validates_and_falls_back_to_the_list(env):
    c = env["client"]
    assert c.post("/meals/identify", files={"file": ("a.txt", b"hello", "text/plain")}, headers=env["hw"]).status_code == 400
    ok = c.post("/meals/identify", files={"file": ("a.jpg", b"\xff\xd8\xff\xe0fake", "image/jpeg")}, headers=env["hw"]).json()
    assert ok["provider"] == "none" and ok["candidates"] == [] and len(ok["suggestions"]) == 8       # asks the user to choose


def test_vision_provider_output_is_sanitised(monkeypatch):
    from app.services import vision_service as vs
    monkeypatch.setenv("VISION_PROVIDER", "auto"); monkeypatch.setenv("GEMINI_API", "test-key")

    class R:
        def raise_for_status(self): pass
        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": '{"candidates":[{"id":"waakye","confidence":1.7},{"id":"made_up_dish","confidence":0.9},{"id":"banku_okro","confidence":0.4}]}'}]}}]}
    seen = {}
    def fake_post(url, json=None, headers=None, timeout=None):
        seen["headers"], seen["timeout"] = headers, timeout
        return R()
    monkeypatch.setattr(vs.requests, "post", fake_post)
    out = vs.identify(b"img", "image/jpeg")
    assert [c["id"] for c in out["candidates"]] == ["waakye", "banku_okro"]                  # unknown dish dropped
    assert out["candidates"][0]["confidence"] == 1.0                                          # clamped to 0..1
    assert seen["headers"]["x-goog-api-key"] == "test-key" and seen["timeout"]               # key in a header, never in the URL
    monkeypatch.setattr(vs.requests, "post", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))
    assert vs.identify(b"img", "image/jpeg")["candidates"] == []                              # provider failure never raises


# ----------------------------------------------------------------------- medicines
def test_medicine_flow(env):
    c = env["client"]
    assert c.post("/medications", json={"name": "Amlodipine", "times": ["8:00"]}, headers=env["hs"]).status_code == 422   # bad time format
    assert c.post("/medications", json={"name": "", "times": ["08:00"]}, headers=env["hs"]).status_code == 422
    m = c.post("/medications", json={"name": "Amlodipine", "dose": "5 mg", "times": ["20:00", "08:00", "08:00"]}, headers=env["hs"]).json()
    assert m["times"] == ["08:00", "20:00"]                                                  # sorted and de-duplicated
    today = c.get("/medications/today", headers=env["hs"]).json()
    assert today["total"] == 2 and today["taken"] == 0 and {d["time"] for d in today["doses"]} == {"08:00", "20:00"}
    assert c.post(f"/medications/{m['id']}/log", json={"time": "08:00", "status": "taken"}, headers=env["hs"]).status_code == 200
    assert c.post(f"/medications/{m['id']}/log", json={"time": "09:30", "status": "taken"}, headers=env["hs"]).status_code == 400
    assert c.post(f"/medications/{m['id']}/log", json={"time": "08:00", "status": "maybe"}, headers=env["hs"]).status_code == 422
    after = c.get("/medications/today", headers=env["hs"]).json()
    assert after["taken"] == 1 and 0 < after["weekly_adherence"] <= 1
    assert c.post(f"/medications/{m['id']}/log", json={"time": "08:00", "status": "taken"}, headers=env["ho"]).status_code == 404   # not someone else's
    assert c.delete(f"/medications/{m['id']}", headers=env["ho"]).status_code == 404
    assert c.delete(f"/medications/{m['id']}", headers=env["hs"]).json()["removed"] is True
    assert c.get("/medications", headers=env["hs"]).json() == []
