import pytest
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)


def test_guest_patient_gets_a_labelled_sandbox_and_cannot_reach_the_outside():
    r = c.post("/auth/guest", json={"role": "patient"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["is_guest"] and j["email"].endswith("@guest.hewal3.local")
    h = {"Authorization": f"Bearer {j['access_token']}"}
    prof = c.get("/users/profile", headers=h).json()
    assert prof.get("full_name") == "Ama Mensah"
    meds = c.get("/medications", headers=h)
    assert meds.status_code == 200 and len(meds.json() if isinstance(meds.json(), list) else meds.json().get("medications", [])) >= 2
    for method, path in (("post", "/push/register"), ("post", "/auth/change-password"), ("post", "/emergency/sos")):
        assert getattr(c, method)(path, headers=h, json={}).status_code == 403, path


def test_guest_doctor_sees_the_demo_patient_only():
    r = c.post("/auth/guest", json={"role": "doctor"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    ov = c.get("/doctor-portal/overview", headers=h)
    assert ov.status_code == 200
    names = [p["name"] for p in ov.json().get("patients", [])]
    assert names and not any("(demo)" in n for n in names)


def test_guest_can_be_turned_off(monkeypatch):
    monkeypatch.setenv("GUEST_MODE", "0")
    assert c.post("/auth/guest", json={}).status_code == 404


def test_guest_doctor_has_something_on_every_page():
    r = c.post("/auth/guest", json={"role": "doctor"})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    ov = c.get("/doctor-portal/overview", headers=h).json()
    names = [p["name"] for p in ov["patients"]]
    assert len(names) >= 7 and not any("(demo)" in n for n in names)
    # Today: appointments today, requests waiting, someone to review
    today = c.get("/doctor-portal/today", headers=h).json()
    assert len(today.get("appointments", today.get("schedule", []))) >= 1, today.keys()
    appts = c.get("/doctor-portal/appointments?scope=upcoming", headers=h).json()["appointments"]
    assert any(a["status"] == "requested" for a in appts) and any(a["status"] == "confirmed" for a in appts)
    assert c.get("/doctor-portal/appointments?scope=past", headers=h).json()["appointments"]
    # Messages, documents, emergencies, care agent, workplaces
    assert c.get("/doctor-portal/conversations", headers=h).json()
    assert c.get("/doctor-portal/documents", headers=h).json()["documents"]
    assert c.get("/doctor-portal/agent/queue", headers=h).json()
    wp = c.get("/doctor-portal/workplaces", headers=h).json()["workplaces"]
    assert wp and wp[0]["level"] and wp[0]["members"] == 5
    # a patient chart: record, consultations
    abena = next(p for p in ov["patients"] if p["name"] == "Abena Owusu")
    rec = c.get(f"/doctor-portal/patients/{abena['patient_id']}/records", headers=h).json()
    assert rec["labs"] and rec["allergies"] == []
    assert c.get(f"/doctor-portal/patients/{abena['patient_id']}/consultations", headers=h).json()["consultations"]
    # second call in the same process does not rebuild or duplicate
    again = c.get("/doctor-portal/overview", headers=h).json()
    assert len(again["patients"]) == len(names)
