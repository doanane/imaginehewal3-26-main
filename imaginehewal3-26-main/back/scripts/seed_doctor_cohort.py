"""Fill the doctor website with SIX fully populated, clearly labelled DEMO patients linked to doctor DOC00001, for screenshots and demos.

    python scripts/seed_doctor_cohort.py            # create or rebuild them (safe to run again; dates move to "now")
    python scripts/seed_doctor_cohort.py --remove   # delete them again
    python scripts/seed_doctor_cohort.py --password Secret123   # also lets you sign in to the phone app as them

What each patient gets (so no page shows n/a or 0): 30 days of vitals (heart rate, blood pressure, oxygen, temperature, glucose), steps and
activity, sleep, weight, meals, medicines with dose logs, doctor prescriptions and notes, past and upcoming appointments, signed consultations,
issued documents, a chat thread (some unread), habit plans shared with the doctor, and past emergencies for the one in crisis.

It is DEVELOPMENT ONLY (it refuses otherwise), writes to whatever DATABASE_URL points at (check that first: a Neon URL is the live database),
and every name ends in "(demo)". The numbers are invented for the demo: never present them as results or real patients.
"""
import os
import random
import secrets
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app.auth.hashing import get_password_hash  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import SessionLocal, create_tables  # noqa: E402
from app.models.activity import SleepSession, WeightLog  # noqa: E402
from app.models.behavior import BehaviorAction, BehaviorNudge, BehaviorPlan, BehaviorSettings  # noqa: E402
from app.models.care_chat import DoctorMessage  # noqa: E402
from app.models.care_plan import DoctorAppointment, DoctorNote, Prescription  # noqa: E402
from app.models.caregiver import CaregiverRelationship, Doctor  # noqa: E402
from app.models.clinic import ClinicDocument, Consultation  # noqa: E402
from app.models.health import FoodLog, HealthData  # noqa: E402
from app.models.iot_device import IoTDevice, VitalReading  # noqa: E402
from app.models.safety import Medication, MedicationLog, SosEvent  # noqa: E402
from app.models.user import User, UserProfile  # noqa: E402

DOCTOR_ID = "DOC00001"
DOMAIN = "@hewal3.local"

# name, email slug, age, gender, conditions, height cm, weight kg, group target, vitals profile, medicines, adherence, steps range
PEOPLE = [
    dict(name="Abena Owusu (demo)", slug="demo.abena", age=58, gender="Female", conds=["Hypertension"], h=162, w=84, sys=(150, 176), dia=(94, 108), hr=(78, 98),
         spo2=(95, 97), gl=(92, 112), now=dict(sys=188, dia=122, hr=98, spo2=96), steps=(2200, 4800), adh=0.55,
         meds=[("Amlodipine", "10 mg", ["08:00"]), ("Losartan", "100 mg", ["20:00"])], sos=True, today_appt="15:30",
         complaint="Headache and blurred vision", dx=[("I10", "Essential hypertension")], hist=["Father had a stroke at 61"]),
    dict(name="Kofi Boateng (demo)", slug="demo.kofi", age=49, gender="Male", conds=["Type 2 diabetes"], h=175, w=92, sys=(124, 138), dia=(78, 88), hr=(70, 82),
         spo2=(96, 98), gl=(142, 226), now=dict(sys=146, dia=92, hr=78, spo2=97), steps=(4200, 8200), adh=0.8,
         meds=[("Metformin", "500 mg", ["08:00", "20:00"]), ("Gliclazide", "80 mg", ["08:00"])], sos=False, today_appt="16:30",
         complaint="Thirst and tiredness", dx=[("E11.9", "Type 2 diabetes mellitus")], hist=["Mother has diabetes"]),
    dict(name="Esi Quaye (demo)", slug="demo.esi", age=27, gender="Female", conds=[], h=165, w=61, sys=(108, 120), dia=(68, 78), hr=(64, 76),
         spo2=(98, 99), gl=(78, 98), now=dict(sys=114, dia=72, hr=68, spo2=99), steps=(7600, 11800), adh=0.96,
         meds=[("Ferrous sulphate", "200 mg", ["13:00"])], sos=False, today_appt=None,
         complaint="Routine check-up and tiredness", dx=[("Z00.0", "General medical examination")], hist=["No family history of note"]),
    dict(name="Yaw Darko (demo)", slug="demo.yaw", age=63, gender="Male", conds=["Hypertension", "Type 2 diabetes"], h=170, w=88, sys=(130, 146), dia=(80, 92), hr=(68, 84),
         spo2=(95, 97), gl=(120, 178), now=dict(sys=142, dia=88, hr=76, spo2=96), steps=(3000, 6400), adh=0.88,
         meds=[("Amlodipine", "5 mg", ["08:00"]), ("Metformin", "1000 mg", ["08:00", "20:00"]), ("Atorvastatin", "20 mg", ["21:00"])], sos=False, today_appt=None,
         complaint="Routine review of blood pressure and sugar", dx=[("I10", "Essential hypertension"), ("E11.9", "Type 2 diabetes mellitus")], hist=["Brother had a heart attack at 55"]),
    dict(name="Akosua Frimpong (demo)", slug="demo.akosua", age=41, gender="Female", conds=["Hypertension"], h=158, w=70, sys=(116, 130), dia=(74, 84), hr=(66, 80),
         spo2=(97, 99), gl=(82, 104), now=dict(sys=122, dia=78, hr=70, spo2=98), steps=(6200, 10400), adh=0.93,
         meds=[("Lisinopril", "10 mg", ["08:00"])], sos=False, today_appt=None,
         complaint="Follow-up after starting treatment", dx=[("I10", "Essential hypertension")], hist=["Mother has hypertension"]),
    dict(name="Nana Kwesi Appiah (demo)", slug="demo.nana", age=70, gender="Male", conds=["Hypertension", "Heart disease"], h=168, w=79, sys=(128, 148), dia=(76, 90), hr=(60, 92),
         spo2=(93, 96), gl=(88, 118), now=dict(sys=136, dia=84, hr=84, spo2=94), steps=(1800, 4200), adh=0.9,
         meds=[("Amlodipine", "5 mg", ["08:00"]), ("Aspirin", "75 mg", ["13:00"]), ("Bisoprolol", "2.5 mg", ["08:00"])], sos=False, today_appt=None,
         complaint="Breathlessness on stairs", dx=[("I10", "Essential hypertension"), ("I51.9", "Heart disease, unspecified")], hist=["No known family history"]),
]

MORE = [  # three more, so groups of five or more exist and the equity table on the Impact page can show figures
    dict(name="Efua Sarpong (demo)", slug="demo.efua", age=52, gender="Female", conds=["Hypertension", "Type 2 diabetes"], h=160, w=86, sys=(132, 150), dia=(82, 94),
         hr=(70, 86), spo2=(95, 97), gl=(130, 190), now=dict(sys=144, dia=90, hr=80, spo2=96), steps=(2800, 5600), adh=0.75,
         meds=[("Losartan", "50 mg", ["08:00"]), ("Metformin", "500 mg", ["08:00", "20:00"])], sos=False, today_appt=None,
         complaint="Swollen feet and tiredness", dx=[("I10", "Essential hypertension"), ("E11.9", "Type 2 diabetes mellitus")], hist=["Sister has diabetes"]),
    dict(name="Maame Serwaa (demo)", slug="demo.maame", age=35, gender="Female", conds=["Asthma"], h=166, w=64, sys=(106, 122), dia=(66, 78),
         hr=(68, 84), spo2=(96, 98), gl=(80, 100), now=dict(sys=112, dia=70, hr=74, spo2=97), steps=(6800, 10800), adh=0.92,
         meds=[("Salbutamol inhaler", "100 mcg", ["07:00", "19:00"])], sos=False, today_appt=None,
         complaint="Wheeze at night", dx=[("J45.9", "Asthma, unspecified")], hist=["Brother has asthma"]),
    dict(name="Kwabena Ofori (demo)", slug="demo.kwabena", age=55, gender="Male", conds=["Hypertension"], h=174, w=90, sys=(132, 148), dia=(82, 94),
         hr=(70, 86), spo2=(95, 97), gl=(92, 116), now=dict(sys=134, dia=84, hr=76, spo2=96), steps=(3400, 6800), adh=0.82,
         meds=[("Amlodipine", "5 mg", ["08:00"]), ("Hydrochlorothiazide", "12.5 mg", ["08:00"])], sos=False, today_appt=None,
         complaint="Routine blood pressure review", dx=[("I10", "Essential hypertension")], hist=["Father had hypertension"]),
]

EXTRA = [  # existing development accounts, filled so they do not show n/a either
    dict(name="Patient Demo", email="patient@gmail.com", age=28, gender="Female", conds=["Diabetes"], h=164, w=68, sys=(112, 126), dia=(70, 82), hr=(66, 80),
         spo2=(97, 99), gl=(98, 138), now=dict(sys=118, dia=76, hr=72, spo2=98), steps=(5200, 9400), adh=0.9,
         meds=[("Metformin", "500 mg", ["08:00", "20:00"])], sos=False, today_appt=None, complaint="Routine diabetes review",
         dx=[("E11.9", "Type 2 diabetes mellitus")], hist=["Grandmother had diabetes"]),
    dict(name="Patient Nii", email="nii@gmail.com", age=30, gender="Male", conds=["Hypertension"], h=178, w=82, sys=(126, 144), dia=(80, 92), hr=(68, 84),
         spo2=(96, 98), gl=(86, 106), now=dict(sys=128, dia=82, hr=74, spo2=97), steps=(4800, 9000), adh=0.84,
         meds=[("Amlodipine", "5 mg", ["08:00"])], sos=False, today_appt=None, complaint="Blood pressure follow-up",
         dx=[("I10", "Essential hypertension")], hist=["Father has hypertension"]),
]

MEALS = [("breakfast", "Oats porridge with banana", 320, 58, 9, 6, 90, 86), ("lunch", "Jollof rice with grilled chicken and salad", 610, 82, 34, 16, 780, 70),
         ("dinner", "Light soup with tilapia and boiled yam", 480, 52, 36, 14, 640, 82), ("lunch", "Waakye with egg and gari", 690, 104, 22, 20, 820, 58),
         ("breakfast", "Kenkey with grilled fish", 540, 88, 28, 9, 700, 74), ("dinner", "Banku with okro stew", 510, 84, 18, 12, 720, 66),
         ("breakfast", "Boiled plantain and egg", 380, 62, 14, 8, 210, 78), ("lunch", "Beans stew with gari and fish", 560, 78, 30, 12, 540, 80)]

CHAT = [("patient", "Good morning doctor, my reading was a bit high today."), ("doctor", "Good morning. Thank you for telling me. Did you take your medicines?"),
        ("patient", "Yes, this morning with breakfast."), ("doctor", "Good. Keep resting, drink water and measure again in the evening."),
        ("patient", "Thank you doctor. I will do that.")]

WIPE = (("vital_readings", "user_id"), ("health_data", "user_id"), ("medication_logs", "user_id"), ("food_logs", "user_id"), ("sleep_sessions", "user_id"),
        ("weight_logs", "user_id"), ("behavior_nudges", "user_id"), ("behavior_shares", "owner_id"), ("behavior_actions", "user_id"), ("behavior_plans", "user_id"), ("behavior_settings", "user_id"), ("sos_events", "user_id"),
        ("doctor_messages", "patient_id"), ("doctor_notes", "patient_id"), ("clinic_documents", "patient_id"),
        ("consultations", "patient_id"), ("doctor_appointments", "patient_id"), ("prescriptions", "patient_id"), ("medications", "user_id"), ("notifications", "user_id"))


def wipe(db, uid):
    """Remove what an earlier run (or the dev account itself) left, one table at a time: a table that cannot be cleared is reported and skipped, never undoing the rest."""
    for tbl, col in WIPE:
        try:
            with db.begin_nested():
                db.execute(text(f"DELETE FROM {tbl} WHERE {col} = :u"), {"u": uid})
        except Exception as e:
            print(f"  note: could not clear {tbl} for user {uid} ({type(e).__name__})")
    db.commit()


def ref():
    return f"HW-{datetime.now().strftime('%y')}-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))


def build(db, doctor, caregiver, p, password, idx):
    rnd = random.Random(7000 + idx)
    now = datetime.now(timezone.utc)
    local = datetime.now()
    today = date.today()
    email = p.get("email") or (p["slug"] + DOMAIN)
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(email=email, username=(p.get("slug") or p["email"].split("@")[0]).replace(".", "_"), hashed_password=get_password_hash(password), is_active=True, is_email_verified=True, is_caregiver=False)
        db.add(u); db.commit(); db.refresh(u)
    elif password:
        u.hashed_password = get_password_hash(password); db.commit()
    wipe(db, u.id)
    prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first() or UserProfile(user_id=u.id)
    bmi = round(p["w"] / ((p["h"] / 100) ** 2))
    prof.full_name, prof.age, prof.gender, prof.chronic_conditions = p["name"], p["age"], p["gender"], p["conds"]
    prof.family_history, prof.height, prof.weight, prof.bmi = p["hist"], p["h"], p["w"], bmi
    prof.blood_pressure, prof.heart_rate = f"{p['now']['sys']}/{p['now']['dia']}", p["now"]["hr"]
    prof.blood_glucose = int(sum(p["gl"]) / 2)
    prof.emergency_contact_name, prof.emergency_contact_phone, prof.emergency_contact_relationship = "Family contact (demo)", "+233 20 000 0000", "Relative"
    prof.doctor_id, prof.profile_completed = DOCTOR_ID, True
    db.add(prof)
    if caregiver and not db.query(CaregiverRelationship).filter_by(caregiver_id=caregiver.id, patient_id=u.id).first():
        db.add(CaregiverRelationship(caregiver_id=caregiver.id, patient_id=u.id, relationship_type="nurse", status="approved"))
    dev = db.query(IoTDevice).filter_by(device_id=f"demo-{u.id}").first()
    if not dev:
        dev = IoTDevice(user_id=u.id, device_id=f"demo-{u.id}", device_type="smartwatch", device_name="Demo watch", manufacturer="demo", model="demo",
                        connection_status="connected", last_sync=now)
        db.add(dev); db.flush()
    dev.last_sync = now
    diabetic = any("diabetes" in c.lower() for c in p["conds"])

    # ---- 100 days of vitals, steps, sleep, weight (enough to measure change since the habit plans began)
    DAYS = 100
    for back in range(DAYS - 1, -1, -1):
        day = today - timedelta(days=back)
        drift = (DAYS - 1 - back) / (DAYS - 1)                     # 0 long ago, 1 today
        early = (p["adh"] - 0.6) * 34 * (1 - drift)                # people who take their medicines improve, the others drift up
        for hour in (8, 14, 20):
            ts = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour, minutes=rnd.randint(0, 40))
            if ts > now - timedelta(minutes=30):
                continue
            lo, hi = p["sys"]
            sys_ = int(lo + (hi - lo) * (0.3 + 0.5 * rnd.random()) + early + rnd.randint(-3, 3))
            dia_ = int(p["dia"][0] + (p["dia"][1] - p["dia"][0]) * rnd.random())
            db.add(VitalReading(user_id=u.id, device_id=dev.id, heart_rate=rnd.randint(*p["hr"]), blood_pressure_systolic=sys_, blood_pressure_diastolic=dia_,
                                blood_oxygen=float(rnd.randint(*p["spo2"])), temperature=round(rnd.uniform(36.3, 36.9), 1),
                                glucose_level=float(rnd.randint(*p["gl"])) if (diabetic or hour == 8) else None, is_emergency=False, timestamp=ts))
        steps = rnd.randint(*p["steps"]) if back else int(p["steps"][0] + (p["steps"][1] - p["steps"][0]) * 0.55)
        hd = HealthData(user_id=u.id, date=datetime.combine(day, datetime.min.time()), steps=steps, heart_rate=rnd.randint(*p["hr"]),
                        blood_glucose=float(rnd.randint(*p["gl"])), calories_burned=int(steps * 0.045 + 90), active_minutes=max(12, int(steps / 140)),
                        distance_m=int(steps * 0.74), water_intake=rnd.randint(1200, 2400), blood_pressure=f"{p['now']['sys']}/{p['now']['dia']}",
                        sleep_time=rnd.randint(6, 8), steps_source="Demo data")
        db.add(hd)
        if back:
            total = rnd.randint(340, 480)
            start = datetime.combine(day - timedelta(days=1), datetime.min.time()) + timedelta(hours=22, minutes=rnd.randint(0, 55))
            deep, rem = int(total * .17), int(total * .21)
            db.add(SleepSession(user_id=u.id, start=start, end=start + timedelta(minutes=total + 14), stages=None, total_min=total, awake_min=14,
                                light_min=total - deep - rem, deep_min=deep, rem_min=rem, score=min(96, 42 + total // 8), source="demo"))
    for wk in range(14, -1, -1):
        db.add(WeightLog(user_id=u.id, kg=round(p["w"] + rnd.uniform(-0.6, 0.6) + (wk * 0.22 if p["adh"] >= 0.8 else -wk * 0.1), 1), at=local - timedelta(days=wk * 7)))
    # a fresh trace so the chart ends "just now" at the current picture
    n = p["now"]
    for m in (12, 6, 1):
        db.add(VitalReading(user_id=u.id, device_id=dev.id, heart_rate=n["hr"], blood_pressure_systolic=n["sys"], blood_pressure_diastolic=n["dia"], blood_oxygen=float(n["spo2"]),
                            temperature=36.6, glucose_level=float(rnd.randint(*p["gl"])), is_emergency=False, timestamp=now - timedelta(minutes=m)))
    for i, (kind, nm, kcal, carb, prot, fat, na, score) in enumerate(MEALS):
        at = local - timedelta(days=i // 2, hours=2 + 4 * (i % 2))
        nut = dict(calories=kcal, carbs=carb, protein=prot, fat=fat, fats=fat, sodium_mg=na)
        db.add(FoodLog(user_id=u.id, meal_type=kind, food_image_url=None, diet_score=score, nutrients=nut, created_at=at,
                       ai_analysis=dict(meal_type=kind, detected_food=nm, analysis=f"{nm}: about {kcal} kcal, {carb} g carbohydrate, {na} mg sodium.", description=f"{nm} (demo meal)", nutrients=nut, diet_score=score, analysis_source="demo",
                                        category="meal", timestamp=at.isoformat())))

    # ---- medicines, doses and the doctor's prescriptions
    created = now - timedelta(days=40)
    for nm, dose, times in p["meds"]:
        med = Medication(user_id=u.id, name=nm, dose=dose, times=times, notes="Prescribed by Dr. Mensah (demo)", active=True, created_at=created)
        db.add(med); db.flush()
        db.add(Prescription(doctor_pk=doctor.id, patient_id=u.id, medication_id=med.id, name=nm, dose=dose, times=times, instructions="Take with water after food.",
                            status="active", created_at=created))
        for back in range(29, -1, -1):
            for tm in times:
                if back == 0 and int(tm[:2]) > local.hour:
                    continue
                taken = rnd.random() < p["adh"]
                db.add(MedicationLog(medication_id=med.id, user_id=u.id, day=today - timedelta(days=back), time=tm, status="taken" if taken else "missed",
                                     logged_at=now - timedelta(days=back)))
    old = Prescription(doctor_pk=doctor.id, patient_id=u.id, medication_id=None, name="Paracetamol", dose="500 mg", times=["08:00", "20:00"], instructions="For headache, up to three times a day.",
                       status="stopped", stop_reason="Course finished", created_at=now - timedelta(days=60), stopped_at=now - timedelta(days=50))
    db.add(old)

    # ---- notes, appointments, signed consultations, documents
    db.add(DoctorNote(doctor_pk=doctor.id, patient_id=u.id, text="Discussed diet and salt intake. Encouraged a daily 20 minute walk.", shared=True, created_at=now - timedelta(days=9)))
    db.add(DoctorNote(doctor_pk=doctor.id, patient_id=u.id, text="Private: keep an eye on adherence at the next visit.", shared=False, created_at=now - timedelta(days=2)))
    past_appts = []
    for days_ago in (30, 9):
        a = DoctorAppointment(doctor_pk=doctor.id, patient_id=u.id, starts_at=local - timedelta(days=days_ago, hours=-1), duration_min=20, mode="in_person" if days_ago == 30 else "video",
                              reason="Review", status="completed", requested_by="doctor")
        db.add(a); db.flush(); past_appts.append(a)
    for a, days_ago in zip(past_appts, (30, 9)):
        v = dict(systolic=p["now"]["sys"] + rnd.randint(-8, 8), diastolic=p["now"]["dia"] + rnd.randint(-5, 5), heart_rate=p["now"]["hr"], spo2=float(p["now"]["spo2"]),
                 temperature=36.7, weight=float(p["w"]), glucose=float(rnd.randint(*p["gl"])))
        db.add(Consultation(doctor_pk=doctor.id, patient_id=u.id, appointment_id=a.id, status="signed", complaint=p["complaint"],
                            subjective=f"{p['complaint']}. Taking medicines most days. No chest pain or fainting.",
                            objective="Alert and comfortable. Chest clear. Heart sounds normal. No ankle swelling.",
                            assessment="; ".join(lab for _, lab in p["dx"]) + ". " + ("Not controlled, adjust treatment." if p["adh"] < 0.7 else "Reasonably controlled."),
                            plan="Continue medicines, reduce salt, daily walk, review in four weeks.", diagnoses=[dict(code=c, label=l) for c, l in p["dx"]],
                            clinic_vitals=v, follow_up_at=local + timedelta(days=28 - days_ago // 2), share_plan=True, addenda=[],
                            created_at=local - timedelta(days=days_ago), updated_at=local - timedelta(days=days_ago), signed_at=local - timedelta(days=days_ago)))
    wk = 2 + idx % 5                                              # a finished visit earlier this week, so the calendar is not empty
    db.add(DoctorAppointment(doctor_pk=doctor.id, patient_id=u.id,
                             starts_at=datetime.combine(today - timedelta(days=wk), datetime.min.time()).replace(hour=8, minute=30) + timedelta(minutes=45 * (idx % 6)),
                             duration_min=20, mode="in_person", reason="Check-up", status="completed", requested_by="doctor"))
    if p["today_appt"]:
        hh, mm = map(int, p["today_appt"].split(":"))
        db.add(DoctorAppointment(doctor_pk=doctor.id, patient_id=u.id, starts_at=datetime.combine(today, datetime.min.time()).replace(hour=hh, minute=mm), duration_min=20,
                                 mode="video", reason="Blood pressure review" if idx == 0 else "Diabetes review", status="confirmed", requested_by="patient"))
    db.add(DoctorAppointment(doctor_pk=doctor.id, patient_id=u.id, starts_at=local + timedelta(days=2 + idx, hours=1), duration_min=20, mode="video" if idx % 2 else "in_person",
                             reason="Follow-up visit", status="confirmed", requested_by="doctor"))
    if idx in (2, 4):
        db.add(DoctorAppointment(doctor_pk=doctor.id, patient_id=u.id, starts_at=local + timedelta(days=4 + idx, hours=2), duration_min=20, mode="video",
                                 reason="Would like a check-up", status="requested", requested_by="patient"))
    if idx == 0:
        db.add(ClinicDocument(ref=ref(), doctor_pk=doctor.id, patient_id=u.id, kind="referral", title="Referral letter", revoked=False, issued_at=local - timedelta(days=9),
                              body=dict(to="Cardiology clinic, Korle Bu Teaching Hospital", specialty="Cardiology", urgency="urgent",
                                        reason="Uncontrolled hypertension despite two medicines. Please assess for secondary causes and advise.",
                                        history="Hypertension for 8 years. Father had a stroke.", medicines="Amlodipine 10 mg, Losartan 100 mg")))
    if idx == 1:
        db.add(ClinicDocument(ref=ref(), doctor_pk=doctor.id, patient_id=u.id, kind="sick_note", title="Sick note", revoked=False, issued_at=local - timedelta(days=9),
                              body=dict(from_date=(today - timedelta(days=9)).isoformat(), to_date=(today - timedelta(days=7)).isoformat(), days=3, diagnosis="Type 2 diabetes mellitus",
                                        show_diagnosis=False, note="Needs rest while treatment is adjusted.")))
    if idx == 3:
        db.add(ClinicDocument(ref=ref(), doctor_pk=doctor.id, patient_id=u.id, kind="letter", title="Letter", revoked=False, issued_at=local - timedelta(days=9),
                              body=dict(to="To whom it may concern", text="This patient attends our clinic for long-term care of blood pressure and diabetes and is on regular treatment.")))

    from app.models.notification import Notification
    db.add(Notification(user_id=u.id, notification_type="doctor", title="From your doctor", message="Please keep taking your medicines and measure your blood pressure each morning.",
                        is_read=True, sender_id=doctor.id, sender_type="doctor", created_at=local - timedelta(days=3)))
    db.add(Notification(user_id=u.id, notification_type="doctor", title="Appointment reminder", message="Your next review is booked. Bring your readings if you can.",
                        is_read=False, sender_id=doctor.id, sender_type="doctor", created_at=local - timedelta(days=1)))

    # ---- chat (the last message from the patient stays unread for the first two)
    for k, (who, msg) in enumerate(CHAT):
        at = now - timedelta(hours=26 - k * 4)
        unread = (idx in (0, 1)) and who == "patient" and k == len(CHAT) - 1
        db.add(DoctorMessage(doctor_pk=doctor.id, patient_id=u.id, sender_role=who, content=msg, created_at=at, read_at=None if unread else at + timedelta(minutes=5)))

    # ---- habits shared with the doctor
    bs = db.query(BehaviorSettings).filter_by(user_id=u.id).first() or BehaviorSettings(user_id=u.id)
    bs.language, bs.notifications_enabled, bs.wearable_data_enabled, bs.gamification_enabled, bs.gentle_tone = "en", True, True, True, True
    bs.share_with_doctor, bs.max_nudges_per_week = True, 4
    db.add(bs)
    for beh, unit, base, goal, level in (("movement", "steps", p["steps"][0], p["steps"][0] + 3000, 3), ("sleep", "hours of sleep", 6.0, 7.5, 2)):
        plan = BehaviorPlan(user_id=u.id, behavior=beh, goal_text=f"Build up {beh}", baseline_value=float(base), goal_value=float(goal), unit=unit, level=level,
                            last_level_change=today - timedelta(days=6), active=True, start_date=today - timedelta(days=99), created_at=now - timedelta(days=99))
        db.add(plan); db.flush()
        for back in range(98, 0, -1):
            done = rnd.random() < (0.35 + 0.6 * p["adh"] * (1 - back / 160))
            if 40 <= back <= 44 or 72 <= back <= 77:
                continue                                           # no check-in for five days (a lapse), then the person comes back
            tgt = base + (goal - base) * (1 - back / 99) * 0.7
            db.add(BehaviorAction(plan_id=plan.id, user_id=u.id, action_date=today - timedelta(days=back), title=f"Reach {int(tgt) if beh == 'movement' else round(tgt, 1)} {unit}",
                                  detail="A small step for today.", technique="Goal setting", rationale="Small steps add up.", target_value=float(tgt), level=level,
                                  is_comeback=False, status="done" if done else "skipped", value_done=float(tgt * (1.05 if done else 0.5)), source="demo",
                                  completed_at=now - timedelta(days=back) if done else None))

        for k in range(4):                                                  # re-engagement messages after gaps, and whether the person came back
            when = today - timedelta(days=10 + k * 17)
            db.add(BehaviorNudge(user_id=u.id, plan_id=plan.id, kind="reengage_1", channel=("push", "in_app")[k % 2], lapse_start=when, sent_at=now - timedelta(days=10 + k * 17),
                                 hour=19, responded=rnd.random() < 0.7, responded_at=now - timedelta(days=9 + k * 17)))

    # ---- past emergencies for the one in crisis
    if p["sos"]:
        for days_ago, reason in ((14, "Blood pressure in the crisis range (190/122)"), (31, "SOS pressed by the patient")):
            db.add(SosEvent(user_id=u.id, trigger="vitals" if days_ago == 14 else "manual", reason=reason, severity="high", status="resolved",
                            vitals=dict(systolic=190, diastolic=122, heart_rate=102), created_at=now - timedelta(days=days_ago), attempts=1))
    db.commit()
    return u


def main(remove: bool, password: str | None):
    if settings.ENVIRONMENT != "development":
        raise SystemExit("Demo patients are for development only.")
    create_tables()
    db = SessionLocal()
    try:
        if remove:
            from app.services.privacy_service import delete_account
            for p in PEOPLE + MORE:
                u = db.query(User).filter(User.email == p["slug"] + DOMAIN).first()
                if u:
                    delete_account(db, u)
                    print("removed", p["name"])
            return
        doctor = db.query(Doctor).filter(Doctor.doctor_id == DOCTOR_ID).first()
        if not doctor:
            raise SystemExit(f"Doctor {DOCTOR_ID} is missing. Start the backend once in development mode first (it creates the demo doctor).")
        caregiver = db.query(User).filter(User.email == "caregiver@gmail.com").first()
        pw = password or secrets.token_urlsafe(18)             # unusable unless you passed --password
        for i, p in enumerate(PEOPLE + MORE + EXTRA):
            build(db, doctor, caregiver, p, pw, i)
            print("ready:", p["name"])
        print("\nOpen the doctor website, sign in as", DOCTOR_ID, "and look at Today, Patients, Messages, Schedule, Documents, Impact.")
    finally:
        db.close()


if __name__ == "__main__":
    pw = sys.argv[sys.argv.index("--password") + 1] if "--password" in sys.argv else None
    main("--remove" in sys.argv, pw)
