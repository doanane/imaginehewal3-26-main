"""Signup and login for patients and caregivers, run offline against the app (no server needed).

These guard the rules in CLAUDE.md that broke before: email is normalised the same way at signup and login, login works with any
letter case, and a caregiver's login carries is_caregiver and caregiver_id. Each run uses fresh addresses, so reruns never collide.
"""
import os
import uuid

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from fastapi.testclient import TestClient

PASSWORD = "TestPassword123!"


@pytest.fixture(scope="module")
def client():
    from app.main import app
    from app.services import simple_limiter
    simple_limiter.reset()
    return TestClient(app)


def _tag():
    return uuid.uuid4().hex[:10]


@pytest.fixture(scope="module")
def patient(client):
    t = _tag()
    body = {"email": f"auth_{t}@example.com", "password": PASSWORD, "username": f"auth_{t}", "phone_number": "+233200000000"}
    r = client.post("/auth/signup", json=body)
    assert r.status_code == 200, r.text
    return {**body, **r.json()}


def test_patient_signup_returns_a_token(patient):
    assert patient.get("access_token")
    assert patient.get("user_id")


def test_patient_login(client, patient):
    r = client.post("/auth/login", json={"email": patient["email"], "password": PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


def test_login_ignores_email_case_and_spaces(client, patient):
    r = client.post("/auth/login", json={"email": "  " + patient["email"].upper() + " ", "password": PASSWORD})
    assert r.status_code == 200, r.text


def test_wrong_password_is_refused(client, patient):
    r = client.post("/auth/login", json={"email": patient["email"], "password": "not-the-password"})
    assert r.status_code == 401


@pytest.fixture(scope="module")
def caregiver(client):
    t = _tag()
    body = {"email": f"cg_{t}@example.com", "password": "CaregiverPass123!", "first_name": "John", "last_name": "Caregiver",
            "phone_number": "+233200000001", "caregiver_type": "professional", "agree_to_terms": True}
    r = client.post("/auth/signup/caregiver", json=body)
    assert r.status_code == 200, r.text
    return {**body, **r.json()}


def test_caregiver_signup_identifies_a_caregiver(caregiver):
    assert caregiver.get("caregiver_id")


def test_caregiver_login_keeps_caregiver_fields(client, caregiver):
    r = client.post("/auth/login", json={"email": caregiver["email"], "password": caregiver["password"]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("is_caregiver") is True
    assert data.get("caregiver_id")


def test_refresh_token_renews_the_session(client, patient):
    r = client.post("/auth/login", json={"email": patient["email"], "password": PASSWORD})
    refresh = r.json()["refresh_token"]
    new = client.post("/auth/token/refresh", json={"refresh_token": refresh})
    assert new.status_code == 200, new.text
    body = new.json()
    assert body["user_type"] == "patient"
    assert client.get("/auth/me", headers={"Authorization": "Bearer " + body["access_token"]}).status_code == 200
    from jose import jwt
    from app.config import settings
    assert jwt.decode(body["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])["user_type"] == "patient"   # accepted by /ws
    assert client.post("/auth/token/refresh", json={"refresh_token": "nope"}).status_code == 401
    assert client.post("/auth/token/refresh", json={}).status_code == 422
