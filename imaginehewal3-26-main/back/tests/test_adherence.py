"""Adherence counts only doses that were DUE, so a new medicine or a quiet morning never reads 0%. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from datetime import date, datetime, timedelta

import pytest


@pytest.fixture()
def env():
    from app.auth.hashing import get_password_hash
    from app.database import Base, SessionLocal, engine
    from app.models.user import User
    from app.services.privacy_service import delete_account
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    old = db.query(User).filter_by(email="adh_a@example.com").first()
    if old:
        delete_account(db, old)
    u = User(email="adh_a@example.com", username="adh_a", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add(u); db.commit()
    yield db, u
    row = db.query(User).filter(User.id == u.id).first()
    if row:
        delete_account(db, row)
    db.close()


def _med(db, uid, times, added, name="Amlodipine"):
    from app.models.safety import Medication
    m = Medication(user_id=uid, name=name, dose="5 mg", times=times, active=True, created_at=added)
    db.add(m); db.commit(); db.refresh(m)
    return m


def _log(db, uid, med, day, t, status="taken"):
    from app.models.safety import MedicationLog
    db.add(MedicationLog(medication_id=med.id, user_id=uid, day=day, time=t, status=status)); db.commit()


NOW = datetime(2026, 11, 14, 12, 0)


def test_a_medicine_added_today_is_not_judged_on_doses_that_were_never_due(env):
    from app.services import adherence
    db, u = env
    _med(db, u.id, ["08:00", "20:00"], datetime(2026, 11, 14, 15, 0))
    r = adherence.adherence(db, u.id, 7, now=datetime(2026, 11, 14, 16, 0))
    assert r["due"] == 0 and r["pct"] is None                                   # nothing was due: "not enough data", not 0%


def test_only_doses_after_the_medicine_was_added_and_past_their_time_count(env):
    from app.services import adherence
    db, u = env
    _med(db, u.id, ["08:00", "10:00"], datetime(2026, 11, 14, 9, 30))           # the 08:00 dose was before it existed
    r = adherence.adherence(db, u.id, 7, now=NOW)
    assert r["due"] == 1 and r["pct"] is None                                   # one due dose is too little to judge
    r2 = adherence.adherence(db, u.id, 7, now=datetime(2026, 11, 14, 10, 30))
    assert r2["due"] == 0                                                       # 10:00 plus the one hour of grace is 11:00


def test_a_full_week_is_counted_exactly_and_unlogged_is_not_the_same_as_skipped(env):
    from app.services import adherence
    db, u = env
    m = _med(db, u.id, ["08:00", "20:00"], datetime(2026, 11, 1, 0, 0))
    days = [date(2026, 11, 8) + timedelta(days=i) for i in range(6)]            # Nov 8 to 13, then today
    for d in days[:5]:
        _log(db, u.id, m, d, "08:00"); _log(db, u.id, m, d, "20:00")            # 10 taken
    _log(db, u.id, m, days[5], "08:00", "skipped")                                # 1 skipped; 20:00 on the 13th never logged
    _log(db, u.id, m, date(2026, 11, 14), "08:00")                                # today's morning dose taken
    r = adherence.adherence(db, u.id, 7, now=NOW)
    assert r["due"] == 13 and r["taken"] == 11 and r["skipped"] == 1 and r["unlogged"] == 1
    assert r["pct"] == 85                                                       # 11 of 13
    assert sum(d["expected"] for d in r["daily"]) == 13 and r["by_time"] == [{"time": "08:00", "taken_pct": 86}, {"time": "20:00", "taken_pct": 83}]


def test_a_dose_is_not_due_until_an_hour_after_its_time(env):
    from app.services import adherence
    db, u = env
    _med(db, u.id, ["08:00"], datetime(2026, 11, 1, 0, 0))
    assert adherence.adherence(db, u.id, 1, now=datetime(2026, 11, 14, 8, 30))["due"] == 0
    assert adherence.adherence(db, u.id, 1, now=datetime(2026, 11, 14, 9, 0))["due"] == 1


def test_no_medicine_means_no_figure(env):
    from app.services import adherence
    db, u = env
    assert adherence.adherence(db, u.id, 7, now=NOW) is None


def test_the_patient_snapshot_and_the_panel_do_not_count_a_missing_figure_as_zero(env):
    from app.services.risk_service import med_adherence
    from app.services.clinical_analytics import _medication
    db, u = env
    _med(db, u.id, ["08:00", "20:00"], datetime.now())                          # added just now: nothing due yet
    assert med_adherence(db, u.id) is None
    block = _medication(db, u, 14)
    assert block["adherence_pct"] is None and block["due"] == 0 and block["first_half_pct"] is None
