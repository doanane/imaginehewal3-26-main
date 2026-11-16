"""Continue as Guest: a ready-made sandbox for reviewers, with no sign-up.

What it is: ONE demo patient ("Ama Mensah (demo)"), ONE demo doctor and their history, rebuilt on demand so the dates are always recent.
What it is not: real data. Every name carries "(demo)", the apps show a "Demo data" banner for a guest, and the patient is linked to nobody real.
Safety: a guest can never reach anyone outside the sandbox (see `blocked()`), and the sandbox is rebuilt every few hours so what one
reviewer changes does not stay for the next.
"""
import logging
import random
import re
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.hashing import get_password_hash

logger = logging.getLogger(__name__)

GUEST_EMAIL = "guest.reviewer@guest.hewal3.local"
GUEST_DOCTOR_ID = "DOCGUEST"
GUEST_DOMAIN = "@guest.hewal3.local"
REBUILD_AFTER_S = 6 * 3600
_last_built = 0.0

# what a guest may not do: anything that reaches a real person, a real phone, money, or the account itself
_BLOCKED = re.compile(
    r"^/(auth/(change-password|forgot-password|reset-password|resend-verification|delete)|users/(delete|change)|privacy|push/|emergency|payment|huawei|"
    r"caregivers/(invite|link|request)|my-doctor/(link|requests)|doctor-portal/link-requests|sms|admin|superadmin)", re.I)


def is_guest_email(email: str | None) -> bool:
    return bool(email) and email.lower().endswith(GUEST_DOMAIN)


def blocked(method: str, path: str) -> bool:
    """True when a guest must be refused. Reading is always allowed; writing is allowed inside the sandbox except for the paths above."""
    return method.upper() not in ("GET", "HEAD", "OPTIONS") and bool(_BLOCKED.match(path))


_MEALS = [
    ("breakfast", "Oats porridge with banana", dict(calories=320, carbs=58, protein=9, fat=6, sodium_mg=90), 86),
    ("lunch", "Jollof rice with grilled chicken and salad", dict(calories=610, carbs=82, protein=34, fat=16, sodium_mg=780), 70),
    ("dinner", "Light soup with tilapia and boiled yam", dict(calories=480, carbs=52, protein=36, fat=14, sodium_mg=640), 82),
    ("lunch", "Waakye with egg and gari", dict(calories=690, carbs=104, protein=22, fat=20, sodium_mg=820), 58),
    ("breakfast", "Kenkey with grilled fish and pepper", dict(calories=540, carbs=88, protein=28, fat=9, sodium_mg=700), 74),
    ("dinner", "Banku with okro stew", dict(calories=510, carbs=84, protein=18, fat=12, sodium_mg=720), 66),
]


def _wipe(db: Session, uid: int, doctor_pk: int | None) -> None:
    for tbl, col in (("vital_readings", "user_id"), ("health_data", "user_id"), ("medication_logs", "user_id"), ("medications", "user_id"),
                     ("food_logs", "user_id"), ("sleep_sessions", "user_id"), ("doctor_messages", "patient_id"), ("doctor_appointments", "patient_id"),
                     ("notifications", "user_id"), ("agent_runs", "user_id"), ("behavior_nudges", "user_id"), ("behavior_actions", "user_id"),
                     ("behavior_plans", "user_id"), ("behavior_settings", "user_id")):
        try:
            db.execute(text(f"DELETE FROM {tbl} WHERE {col} = :u"), {"u": uid})
        except Exception:
            db.rollback()
    db.commit()


def ensure_sandbox(db: Session, force: bool = False):
    """Create the demo patient and doctor if missing, and rebuild their data when it is old. Returns (patient, doctor)."""
    global _last_built
    from app.models.user import User, UserProfile
    from app.models.caregiver import Doctor

    doctor = db.query(Doctor).filter(Doctor.doctor_id == GUEST_DOCTOR_ID).first()
    if not doctor:
        doctor = Doctor(doctor_id=GUEST_DOCTOR_ID, full_name="Dr. Efua Owusu (demo)", specialization="Internal medicine", hospital="HEWAL3 demo clinic",
                        email="doctor" + GUEST_DOMAIN, is_active=True, hashed_password=get_password_hash(random_secret()))
        db.add(doctor); db.commit(); db.refresh(doctor)
    user = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not user:
        user = User(email=GUEST_EMAIL, username="guest_reviewer", hashed_password=get_password_hash(random_secret()), is_active=True,
                    is_email_verified=True, is_caregiver=False)
        db.add(user); db.commit(); db.refresh(user)
    if not force and time.time() - _last_built < REBUILD_AFTER_S:
        return user, doctor
    # another server process may have built it already: look at the newest reading before rebuilding
    from sqlalchemy import func
    from app.models.iot_device import VitalReading
    fresh = db.query(func.max(VitalReading.timestamp)).filter(VitalReading.user_id == user.id).scalar()
    from app.models.behavior import AgentRun
    has_agent = db.query(AgentRun.id).filter(AgentRun.user_id == user.id).first() is not None       # an older sandbox is rebuilt once to gain the agent demo
    if not force and fresh is not None and has_agent:
        fresh = fresh if getattr(fresh, "tzinfo", None) else fresh.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - fresh < timedelta(seconds=REBUILD_AFTER_S):
            _last_built = time.time()
            return user, doctor
    _build(db, user, doctor)
    _last_built = time.time()
    return user, doctor


def random_secret() -> str:
    import secrets
    return secrets.token_urlsafe(32)          # nobody can sign in with a password; guests get a token from /auth/guest only


def _build(db: Session, user, doctor) -> None:
    from app.models.user import UserProfile
    from app.models.health import FoodLog, HealthData
    from app.models.iot_device import IoTDevice, VitalReading
    from app.models.safety import Medication, MedicationLog
    from app.models.activity import SleepSession
    from app.models.care_plan import DoctorAppointment
    from app.models.care_chat import DoctorMessage

    _wipe(db, user.id, doctor.id)
    rnd = random.Random(2026)                 # the same story every time
    now = datetime.now(timezone.utc)
    today = date.today()

    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first() or UserProfile(user_id=user.id)
    prof.full_name, prof.age, prof.gender = "Ama Mensah (demo)", 52, "Female"
    prof.chronic_conditions, prof.doctor_id, prof.profile_completed = ["Hypertension"], GUEST_DOCTOR_ID, True
    db.add(prof)

    device = db.query(IoTDevice).filter_by(device_id=f"sandbox-{user.id}").first()
    if not device:
        device = IoTDevice(user_id=user.id, device_id=f"sandbox-{user.id}", device_type="smartwatch", device_name="Demo watch", manufacturer="demo",
                           model="demo", connection_status="connected", last_sync=now)
        db.add(device); db.flush()
    device.last_sync = now

    for back in range(13, -1, -1):
        day = today - timedelta(days=back)
        d0 = datetime.combine(day, datetime.min.time())
        steps = rnd.randint(3400, 9200) if back else rnd.randint(2200, 4200)
        db.add(HealthData(user_id=user.id, date=d0, steps=steps, heart_rate=rnd.randint(66, 78), calories_burned=int(steps * 0.045),
                          active_minutes=int(steps / 150), distance_m=int(steps * 0.72), steps_source="Demo data"))
        for hour in (8, 14, 20):
            ts = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour, minutes=rnd.randint(0, 40))
            if ts > now:
                continue
            db.add(VitalReading(user_id=user.id, device_id=device.id, heart_rate=rnd.randint(64, 82), blood_oxygen=float(rnd.randint(96, 98)),
                                blood_pressure_systolic=rnd.randint(122, 136), blood_pressure_diastolic=rnd.randint(78, 86), is_emergency=False, timestamp=ts))
        if back:
            total = rnd.randint(360, 470)
            start = datetime.combine(day - timedelta(days=1), datetime.min.time()) + timedelta(hours=22, minutes=rnd.randint(0, 50))
            deep, rem = int(total * .17), int(total * .2)
            db.add(SleepSession(user_id=user.id, start=start, end=start + timedelta(minutes=total + 15), stages=None, total_min=total, awake_min=15,
                                light_min=total - deep - rem, deep_min=deep, rem_min=rem, score=min(95, 45 + total // 8), source="demo"))

    meds = [Medication(user_id=user.id, name="Amlodipine", dose="5 mg", times=["08:00"], notes="Demo medicine", active=True, created_at=now - timedelta(days=15)),
            Medication(user_id=user.id, name="Losartan", dose="50 mg", times=["20:00"], notes="Demo medicine", active=True, created_at=now - timedelta(days=15))]
    db.add_all(meds); db.flush()
    for m in meds:
        for back in range(13, 0, -1):
            db.add(MedicationLog(medication_id=m.id, user_id=user.id, day=today - timedelta(days=back), time=m.times[0],
                                 status="taken" if rnd.random() < .85 else "missed", logged_at=now - timedelta(days=back)))

    for i, (kind, name, n, score) in enumerate(_MEALS):
        at = datetime.now() - timedelta(days=i // 2, hours=3 * (i % 2))
        nut = {**n, "fats": n["fat"]}
        db.add(FoodLog(user_id=user.id, meal_type=kind, food_image_url=None, diet_score=score, nutrients=nut, created_at=at,
                       ai_analysis={"meal_type": kind, "detected_food": name, "description": f"{name} (demo meal)", "nutrients": nut, "diet_score": score,
                                    "analysis_source": "demo", "category": "meal", "timestamp": at.isoformat()}))

    db.add(DoctorAppointment(doctor_pk=doctor.id, patient_id=user.id, starts_at=datetime.now() + timedelta(days=3, hours=2), duration_min=20,
                            mode="video", reason="Blood pressure review (demo)", status="confirmed", requested_by="doctor"))
    db.add(DoctorMessage(doctor_pk=doctor.id, patient_id=user.id, sender_role="doctor", created_at=now - timedelta(hours=5),
                         content="Welcome to the HEWAL3 demo. Your readings this week look steady. Keep taking your medicines as planned."))
    # a movement habit that went quiet four days ago, so the care agent has something real to show in the app and on the doctor's patient page
    from app.models.behavior import BehaviorAction, BehaviorPlan, BehaviorSettings
    from app.services import care_agent
    plan = BehaviorPlan(user_id=user.id, behavior="movement", goal_text="Walk more (demo)", baseline_value=3000.0, goal_value=7000.0, unit="steps", level=3,
                        active=True, start_date=today - timedelta(days=14))
    db.add(plan); db.flush()
    for back in range(13, 4, -1):                                                # engaged for nine days, then four quiet days
        db.add(BehaviorAction(plan_id=plan.id, user_id=user.id, action_date=today - timedelta(days=back), title="Reach 4,500 steps", detail="A small step for today (demo).",
                              technique="Goal setting", rationale="Small steps add up.", target_value=4500.0, level=3, is_comeback=False, status="done",
                              value_done=4700.0, source="demo", completed_at=now - timedelta(days=back)))
    db.add(BehaviorSettings(user_id=user.id, language="en", notifications_enabled=True, wearable_data_enabled=False, share_with_doctor=True, max_nudges_per_week=2))
    db.commit()
    care_agent.demo_handoff(db, user, name="Ama Mensah (demo)", age=52, conditions=["Hypertension"], doctor="Dr. Efua Owusu (demo)", kind="safety")
    db.commit()
    logger.info("guest sandbox rebuilt")
