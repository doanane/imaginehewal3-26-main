"""Create three clearly labelled DEMO patients so the doctor's website shows all three triage groups for a screenshot or a demo.

    python scripts/seed_demo_patients.py            # add or refresh them
    python scripts/seed_demo_patients.py --remove   # delete them again

It never runs on its own, only in development, and every account sits on a reserved address (demo.*@hewal3.local). Run it against the database you are demoing with:
it writes to whatever DATABASE_URL points at. Readings are stamped "now", so run it just before you show the dashboard.

  Ama Critical   hypertension, blood pressure 188/122      -> Critical
  Kofi Stable    diabetes, readings in range               -> Stable
  Esi Healthy    no condition, readings in range           -> Healthy
All use the password StrongPass1 and are linked to doctor DOC00001 and the demo caregiver.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth.hashing import get_password_hash  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import SessionLocal, create_tables  # noqa: E402
from app.models.caregiver import CaregiverRelationship, Doctor  # noqa: E402
from app.models.health import HealthData  # noqa: E402
from app.models.iot_device import IoTDevice, VitalReading  # noqa: E402
from app.models.user import User, UserProfile  # noqa: E402

DOCTOR_ID = "DOC00001"
PEOPLE = [
    ("demo.critical@hewal3.local", "Ama Critical", 58, "Female", ["Hypertension"], dict(hr=96, spo2=96.0, sys=188, dia=122, steps=2100)),
    ("demo.stable@hewal3.local", "Kofi Stable", 49, "Male", ["Diabetes"], dict(hr=74, spo2=98.0, sys=124, dia=80, steps=6400)),
    ("demo.healthy@hewal3.local", "Esi Healthy", 27, "Female", [], dict(hr=68, spo2=99.0, sys=114, dia=72, steps=9800)),
]


def main(remove: bool) -> None:
    if settings.ENVIRONMENT != "development":
        raise SystemExit("Demo patients are for development only.")
    create_tables()
    db = SessionLocal()
    try:
        if remove:
            from app.services.privacy_service import delete_account
            for email, *_ in PEOPLE:
                u = db.query(User).filter(User.email == email).first()
                if u:
                    delete_account(db, u)
                    print("removed", email)
            return
        if not db.query(Doctor).filter(Doctor.doctor_id == DOCTOR_ID).first():
            raise SystemExit(f"Doctor {DOCTOR_ID} is missing. Start the backend once in development mode first (it creates the demo doctor).")
        caregiver = db.query(User).filter(User.email == "caregiver@gmail.com").first()
        now = datetime.now(timezone.utc)
        for email, name, age, gender, conditions, v in PEOPLE:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(email=email, username=email.split("@")[0], hashed_password=get_password_hash("StrongPass1"), is_active=True,
                         is_email_verified=True, is_caregiver=False)
                db.add(u); db.commit(); db.refresh(u)
            prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
            if not prof:
                prof = UserProfile(user_id=u.id); db.add(prof)
            prof.full_name, prof.age, prof.gender, prof.chronic_conditions = name, age, gender, conditions
            prof.doctor_id, prof.profile_completed = DOCTOR_ID, True
            if caregiver and not db.query(CaregiverRelationship).filter_by(caregiver_id=caregiver.id, patient_id=u.id).first():
                db.add(CaregiverRelationship(caregiver_id=caregiver.id, patient_id=u.id, relationship_type="nurse", status="approved"))
            device = db.query(IoTDevice).filter_by(device_id=f"demo-{u.id}").first()
            if not device:
                device = IoTDevice(user_id=u.id, device_id=f"demo-{u.id}", device_type="smartwatch", device_name="Demo watch", manufacturer="demo",
                                   model="demo", connection_status="connected", last_sync=now)
                db.add(device); db.flush()
            device.last_sync = now
            for minutes_ago in (10, 5, 0):         # a short recent trace, newest last
                db.add(VitalReading(user_id=u.id, device_id=device.id, heart_rate=v["hr"], blood_oxygen=v["spo2"], blood_pressure_systolic=v["sys"],
                                    blood_pressure_diastolic=v["dia"], is_emergency=False, timestamp=now - timedelta(minutes=minutes_ago)))
            today = datetime.combine(datetime.now().date(), datetime.min.time())
            hd = db.query(HealthData).filter(HealthData.user_id == u.id, HealthData.date >= today).first()
            if not hd:
                hd = HealthData(user_id=u.id); db.add(hd)
            hd.steps, hd.heart_rate = v["steps"], v["hr"]
            db.commit()
            print("ready:", name, "(", email, ")")
        print("\nOpen the doctor website and sign in as", DOCTOR_ID, "/ StrongPass1")
    finally:
        db.close()


if __name__ == "__main__":
    main("--remove" in sys.argv)
