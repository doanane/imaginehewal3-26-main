"""DEMO ONLY. Creates a small cohort of clearly labelled demo participants with 12 weeks of habit history, so the Impact page and the doctor's Habits tab
have something to show in a presentation. It refuses to run in production and every account is named "Demo Participant N" with a
demo_cohort_N@example.com address. Run it again to rebuild the same cohort; `--remove` deletes it.

    python scripts/seed_behavior_cohort.py            # 12 participants linked to doctor DOC00001
    python scripts/seed_behavior_cohort.py --remove

The history is invented to tell a realistic story (steady starts, gaps that end in a return, a few people who drift away, blood pressure and weight
moving the right way). It is NOT real data and must never be presented as results.
"""
import os
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth.hashing import get_password_hash  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import Base, SessionLocal, _ensure_columns, engine  # noqa: E402
import app.main  # noqa: E402,F401  (registers every model)
from app.models.activity import SleepSession, WeightLog  # noqa: E402
from app.models.behavior import BehaviorAction, BehaviorContext, BehaviorNudge, BehaviorPlan, BehaviorSettings  # noqa: E402
from app.models.iot_device import VitalReading  # noqa: E402
from app.models.user import User, UserProfile  # noqa: E402
from app.services.privacy_service import delete_account  # noqa: E402

N, DOCTOR = 12, "DOC00001"
MOBILITY = ["full", "wheelchair", "limited", "full"]
WORK = ["regular", "shift", "irregular", "not_working"]
LANGS = ["en", "fr", "en", "ar"]


def remove(db):
    for u in db.query(User).filter(User.email.like("demo_cohort_%@example.com")).all():
        delete_account(db, u)
    db.commit()


def main():
    if settings.ENVIRONMENT == "production":
        raise SystemExit("Refusing to create demo data in production.")
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    db = SessionLocal()
    remove(db)
    if "--remove" in sys.argv:
        print("demo cohort removed")
        return
    today = date.today()
    start = today - timedelta(days=84)
    for k in range(N):
        u = User(email=f"demo_cohort_{k}@example.com", username=f"demo_cohort_{k}", hashed_password=get_password_hash("DemoCohort1!"), is_email_verified=True)
        db.add(u)
        db.commit()
        db.refresh(u)
        db.add(UserProfile(user_id=u.id, full_name=f"Demo Participant {k + 1}", age=34 + k * 3, gender="Female" if k % 2 else "Male",
                           chronic_conditions=["Hypertension"] if k % 3 else ["Type 2 diabetes"], profile_completed=True, doctor_id=DOCTOR))
        db.add(BehaviorSettings(user_id=u.id, language=LANGS[k % 4], share_with_doctor=True, wearable_data_enabled=True))
        db.add(BehaviorContext(user_id=u.id, mobility=MOBILITY[k % 4], work_pattern=WORK[k % 4], support="family" if k % 2 else "alone", readiness=2 + k % 3))
        behavior = "activity" if MOBILITY[k % 4] != "full" else "movement"
        plan = BehaviorPlan(user_id=u.id, behavior=behavior, goal_text="Demo", baseline_value=10 if behavior == "activity" else 3000,
                            goal_value=30 if behavior == "activity" else 8000, unit="active minutes" if behavior == "activity" else "steps", level=3, start_date=start, active=True)
        db.add(plan)
        db.flush()
        for i in range(84):
            d = start + timedelta(days=i)
            if k % 3 == 0 and 28 <= i < 36:
                continue                                  # a gap that ends in a return
            if k in (5, 10) and i > 55:
                continue                                  # drifted away, never returned
            if k % 4 == 1 and 50 <= i < 54:
                continue                                  # a short gap
            db.add(BehaviorAction(plan_id=plan.id, user_id=u.id, action_date=d, title="Demo step", target_value=20, level=3,
                                  status="done" if i % 8 else "partial", barrier=None, source="demo",
                                  value_done=(12 + i / 5) if behavior == "activity" else (3200 + i * 50)))
        for i in range(0, 14, 2):
            db.add(VitalReading(user_id=u.id, blood_pressure_systolic=154 - k % 3, blood_pressure_diastolic=96, timestamp=datetime.now(timezone.utc) - timedelta(days=84 - i)))
            db.add(VitalReading(user_id=u.id, blood_pressure_systolic=140 - k % 4, blood_pressure_diastolic=88, timestamp=datetime.now(timezone.utc) - timedelta(days=i)))
        db.add(WeightLog(user_id=u.id, kg=88.0 - k, at=datetime.now(timezone.utc) - timedelta(days=82)))
        db.add(WeightLog(user_id=u.id, kg=85.5 - k, at=datetime.now(timezone.utc) - timedelta(days=2)))
        db.add(BehaviorNudge(user_id=u.id, plan_id=plan.id, kind="reengage_1", channel="push" if k % 2 else "in_app", lapse_start=start + timedelta(days=28),
                             sent_at=datetime.now(timezone.utc) - timedelta(days=54), responded=k not in (5, 10)))
        db.commit()
    print(f"created {N} demo participants (demo_cohort_N@example.com / DemoCohort1!) linked to doctor {DOCTOR}. DEMO DATA ONLY.")


if __name__ == "__main__":
    main()
