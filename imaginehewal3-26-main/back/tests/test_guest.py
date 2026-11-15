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
    assert "(demo)" in (prof.get("full_name") or "")
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
    assert names and all("(demo)" in n for n in names)


def test_guest_can_be_turned_off(monkeypatch):
    monkeypatch.setenv("GUEST_MODE", "0")
    assert c.post("/auth/guest", json={}).status_code == 404
