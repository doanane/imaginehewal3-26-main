"""The statistics behind the doctor website must be right, not just plausible. Checked against known values and a seeded patient."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from datetime import datetime, timedelta, timezone

import pytest

from app.services import clinical_analytics as ca


def test_t_distribution_matches_tables():
    assert ca._t_cdf(2.228, 10) == pytest.approx(0.975, abs=2e-4)     # classic two-sided 5% critical value, df 10
    assert ca._t_cdf(0, 7) == pytest.approx(0.5)
    assert ca._t_cdf(-2.228, 10) == pytest.approx(0.025, abs=2e-4)
    assert ca._t_cdf(1.96, 1000) == pytest.approx(0.975, abs=1e-3)    # approaches the normal


def test_ols_exact_line_and_noise():
    fit = ca.ols([0, 1, 2, 3, 4, 5], [10, 12, 14, 16, 18, 20])
    assert fit["slope"] == pytest.approx(2) and fit["r2"] == pytest.approx(1) and fit["p"] < 1e-6
    flat = ca.ols([0, 1, 2, 3, 4, 5, 6, 7], [5, 9, 4, 8, 5, 9, 4, 8])
    assert flat["p"] > 0.5                                             # no trend in a zig-zag
    assert ca.ols([0, 1, 2], [1, 2, 3]) is None                        # too few points to fit


def test_summary_and_percentiles():
    s = ca.summarize([60, 70, 80, 90, 100])
    assert s["mean"] == 80 and s["median"] == 80 and s["min"] == 60 and s["max"] == 100
    assert s["sd"] == pytest.approx(15.8, abs=0.05) and s["p10"] == 64 and s["p90"] == 96
    assert ca.summarize([]) is None


def test_outliers_use_median_not_mean():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    pts = [(base + timedelta(hours=i), v) for i, v in enumerate([72, 74, 71, 73, 75, 72, 74, 73, 71, 190])]
    out = ca.modified_z_outliers(pts)
    assert len(out) == 1 and out[0]["value"] == 190
    assert ca.modified_z_outliers(pts[:5]) == []                       # not enough readings to judge


@pytest.fixture(scope="module")
def seeded():
    from app.main import app
    from app.database import Base, engine, SessionLocal, _ensure_columns
    from app.auth.hashing import get_password_hash
    from app.models.caregiver import Doctor
    from app.models.iot_device import VitalReading
    from app.models.user import User, UserProfile
    from fastapi.testclient import TestClient
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    simple_limiter.reset()
    db = SessionLocal()
    db.query(Doctor).filter(Doctor.doctor_id == "DAN0001A").delete()
    db.add(Doctor(doctor_id="DAN0001A", full_name="Dr Stats", is_active=True, hashed_password=get_password_hash("Passw0rd!x1")))
    u = User(email="an_pat@example.com", username="an_pat", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add(u)
    db.commit()
    db.query(VitalReading).filter(VitalReading.user_id == u.id).delete()
    db.add(UserProfile(user_id=u.id, full_name="Kofi Stats", age=58, gender="Male", chronic_conditions=["Hypertension"],
                       doctor_id="DAN0001A", profile_completed=True))
    now = datetime.now(timezone.utc)
    # 12 days, one reading a day: systolic climbing 2 mmHg per day from 128, a steady heart rate, oxygen with one dip
    for i in range(12):
        db.add(VitalReading(user_id=u.id, heart_rate=72 + (i % 3), blood_pressure_systolic=128 + 2 * i,
                            blood_pressure_diastolic=82 + i // 2, blood_oxygen=97 if i != 5 else 88,
                            timestamp=now - timedelta(days=11 - i, hours=1)))
    db.commit()
    c = TestClient(app)
    tok = c.post("/doctor-portal/login", json={"doctor_id": "DAN0001A", "password": "Passw0rd!x1"}).json()["access_token"]
    yield dict(c=c, h={"Authorization": "Bearer " + tok}, uid=u.id)
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    row = db2.query(User).filter(User.id == u.id).first()
    if row:
        delete_account(db2, row)
    db2.query(Doctor).filter(Doctor.doctor_id == "DAN0001A").delete()
    db2.commit()
    db2.close()
    db.close()


def test_patient_analytics_finds_the_real_trend(seeded):
    r = seeded["c"].get(f"/doctor-portal/patients/{seeded['uid']}/analytics?days=14", headers=seeded["h"])
    assert r.status_code == 200
    a = r.json()
    sys = a["metrics"]["systolic"]
    assert sys["trend"]["direction"] == "rising" and sys["trend"]["slope_per_day"] == pytest.approx(2, abs=0.05)
    assert sys["trend"]["p"] < 0.001 and sys["stats"]["n"] == 12
    assert a["metrics"]["heart_rate"]["trend"]["direction"] == "steady"
    assert a["metrics"]["blood_oxygen"]["stats"]["min"] == 88
    assert any(f["title"].startswith("Oxygen saturation fell below 90") for f in a["findings"])
    assert any("climbing" in f["title"] for f in a["findings"])
    assert a["coverage"]["days_with_readings"] == 12


def test_analytics_is_private_to_the_doctors_patient(seeded):
    c = seeded["c"]
    assert c.get(f"/doctor-portal/patients/{seeded['uid']}/analytics").status_code in (401, 403)
    assert c.get("/doctor-portal/patients/999999/analytics", headers=seeded["h"]).status_code == 404


def test_cohort(seeded):
    r = seeded["c"].get("/doctor-portal/cohort", headers=seeded["h"])
    assert r.status_code == 200
    j = r.json()
    assert j["bp_control"]["measured"] == 1
    assert j["review_queue"][0]["patient_id"] == seeded["uid"]
