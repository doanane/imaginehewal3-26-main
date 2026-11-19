"""The health record: allergies, labs, radiology, immunisations, insurance, dependents and visits. Offline."""
import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def test_patient_writes_own_record_and_validation(env):
    c, hp = env["client"], env["hp"]
    assert c.get("/records", headers=hp).json()["allergies"] == []
    a = c.post("/records/allergies", headers=hp, json={"substance": "Penicillin", "reaction": "Rash", "severity": "severe"})
    assert a.status_code == 200 and a.json()["source"] == "patient"
    assert c.post("/records/allergies", headers=hp, json={"substance": "X", "severity": "huge"}).status_code == 422
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    assert c.post("/records/immunisations", headers=hp, json={"vaccine": "Tetanus", "given_on": tomorrow}).status_code == 422
    ok = c.post("/records/immunisations", headers=hp, json={"vaccine": "Tetanus", "dose": "Booster", "given_on": "2024-03-01"})
    assert ok.status_code == 200
    ins = c.put("/records/insurance", headers=hp, json={"provider": "Daman", "plan": "Enhanced", "member_no": "123", "valid_until": "2020-01-01"})
    assert ins.status_code == 200 and ins.json()["expired"] is True
    rec = c.get("/records", headers=hp).json()
    assert [x["substance"] for x in rec["allergies"]] == ["Penicillin"] and rec["insurance"]["provider"] == "Daman"
    assert c.delete(f"/records/allergies/{a.json()['id']}", headers=hp).status_code == 200
    assert c.get("/records", headers=hp).json()["allergies"] == []


def test_dependents_are_private_to_the_guardian(env):
    c, hp, hc = env["client"], env["hp"], env["hc"]
    d = c.post("/records/dependents", headers=hp, json={"name": "Kofi", "relationship": "child", "birth_date": "2019-05-02", "allergies": "Peanuts"})
    assert d.status_code == 200
    assert c.post("/records/dependents", headers=hp, json={"name": "Z", "relationship": "alien"}).status_code == 422
    assert [x["name"] for x in c.get("/records/dependents", headers=hp).json()["dependents"]] == ["Kofi"]
    # another person can neither see nor change it
    assert c.get("/records/dependents", headers=hc).json()["dependents"] == []
    assert c.delete(f"/records/dependents/{d.json()['id']}", headers=hc).status_code == 404
    assert c.delete(f"/records/dependents/{d.json()['id']}", headers=hp).status_code == 200


def test_doctor_labs_radiology_and_visit_flow(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    lab = c.post(f"/doctor-portal/patients/{pid}/labs", headers=hd, json={"test": "HbA1c", "value": "7.4", "unit": "%", "ref_range": "4.0-5.6", "flag": "high"})
    assert lab.status_code == 200 and lab.json()["flag"] == "high"
    assert c.post(f"/doctor-portal/patients/{pid}/labs", headers=hd, json={"test": "X", "value": "1", "flag": "scary"}).status_code == 422
    rad = c.post(f"/doctor-portal/patients/{pid}/radiology", headers=hd, json={"modality": "xray", "body_part": "Chest", "impression": "Clear"})
    assert rad.status_code == 200
    assert c.post(f"/doctor-portal/patients/{pid}/radiology", headers=hd, json={"modality": "xray", "body_part": "Chest", "image_url": "http://x/y.png"}).status_code == 422
    # check-in once, then out with a summary
    v = c.post(f"/doctor-portal/patients/{pid}/visits", headers=hd, json={"kind": "clinic", "reason": "Review"})
    assert v.status_code == 200 and v.json()["open"] is True
    assert c.post(f"/doctor-portal/patients/{pid}/visits", headers=hd, json={}).status_code == 409
    out = c.post(f"/doctor-portal/patients/{pid}/visits/{v.json()['id']}/check-out", headers=hd, json={"summary": "Home, review in 2 weeks"})
    assert out.status_code == 200 and out.json()["open"] is False
    assert c.post(f"/doctor-portal/patients/{pid}/visits/{v.json()['id']}/check-out", headers=hd, json={}).status_code == 409
    # the patient sees all of it, and was notified
    mine = c.get("/records", headers=env["hp"]).json()
    assert mine["labs"][0]["test"] == "HbA1c" and mine["radiology"][0]["body_part"] == "Chest"
    assert mine["visits"][0]["summary"].startswith("Home") and mine["open_visit"] is None
    from app.database import SessionLocal
    from app.models.notification import Notification
    db = SessionLocal()
    try:
        titles = {n.title for n in db.query(Notification).filter(Notification.user_id == pid).all()}
    finally:
        db.close()
    assert {"New test result", "New imaging report", "Checked in", "Checked out"} <= titles


def test_doctor_cannot_touch_someone_elses_patient(env):
    c = env["client"]
    _, hd = login(c)                                   # doctor A; "other" belongs to doctor B
    oid = env["other"]
    assert c.get(f"/doctor-portal/patients/{oid}/records", headers=hd).status_code == 404
    assert c.post(f"/doctor-portal/patients/{oid}/labs", headers=hd, json={"test": "T", "value": "1"}).status_code == 404
    assert c.post(f"/doctor-portal/patients/{oid}/visits", headers=hd, json={}).status_code == 404
    # and the endpoints need a login at all
    assert c.get("/records").status_code in (401, 403)
