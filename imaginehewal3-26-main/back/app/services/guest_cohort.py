"""A small, plain-named patient list for the reviewer doctor sandbox, so no page of the doctor website opens empty.

Used only inside the guest sandbox (`guest_sandbox._build`), rebuilt with it every few hours, and never anywhere else. Everything here is invented sample data,
told apart from real data by the reserved e-mail domain `@guest.hewal3.local` and the "Demo mode" banner. Six patients (the seventh is the sandbox's own Ama Mensah)
with a week of readings, medicines, sleep and steps; appointments today, waiting for an answer, coming up and finished; messages; prescriptions; signed
consultations and documents; one past emergency; a health record; habit progress that feeds the Impact page; and one workplace with heat readings.
"""
from __future__ import annotations

import random
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

DOMAIN = "@guest.hewal3.local"

PEOPLE = [
    dict(slug="kofi", name="Kofi Boateng", age=61, gender="Male", conds=["Hypertension"], sys=(140, 152), dia=(88, 96), hr=(70, 84), steps=(2800, 5200), adherence=.78, work="regular"),
    dict(slug="abena", name="Abena Owusu", age=58, gender="Female", conds=["Hypertension", "Type 2 diabetes"], sys=(150, 170), dia=(92, 108), hr=(74, 92), steps=(1800, 3600), adherence=.40, work="regular", critical=True),
    dict(slug="yaw", name="Yaw Darko", age=47, gender="Male", conds=["Pre-diabetes"], sys=(136, 146), dia=(84, 92), hr=(68, 80), steps=(3200, 6400), adherence=.85, work="desk"),
    dict(slug="esi", name="Esi Quaye", age=34, gender="Female", conds=["Asthma"], sys=(112, 124), dia=(70, 80), hr=(66, 80), steps=(5200, 9800), adherence=.92, work="regular"),
    dict(slug="akosua", name="Akosua Frimpong", age=29, gender="Female", conds=[], sys=(108, 120), dia=(66, 76), hr=(62, 76), steps=(6200, 11000), adherence=1.0, work="desk"),
    dict(slug="nana", name="Nana Kwesi Appiah", age=66, gender="Male", conds=["Type 2 diabetes", "Hypertension"], sys=(128, 140), dia=(78, 88), hr=(64, 76), steps=(2400, 4800), adherence=.88, work="not_working"),
]
EMAILS = [f"guest.{p['slug']}{DOMAIN}" for p in PEOPLE]


def wipe(db: Session, doctor) -> None:
    """Remove the previous cohort and the workplace, so a rebuild starts clean."""
    from app.models.user import User
    from app.models.workplace import SiteReading, Workplace, WorkplaceMember
    from app.services.privacy_service import delete_account
    for w in db.query(Workplace).filter(Workplace.doctor_pk == doctor.id).all():
        db.query(SiteReading).filter(SiteReading.workplace_id == w.id).delete(synchronize_session=False)
        db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == w.id).delete(synchronize_session=False)
        db.delete(w)
    db.commit()
    for u in db.query(User).filter(User.email.in_(EMAILS)).all():
        delete_account(db, u)


def exists(db: Session) -> bool:
    from app.models.user import User
    return db.query(User.id).filter(User.email == EMAILS[0]).first() is not None


def build(db: Session, doctor, sandbox_patient) -> None:
    from app.auth.hashing import get_password_hash
    from app.models.activity import SleepSession
    from app.models.behavior import BehaviorAction, BehaviorPlan, BehaviorSettings
    from app.models.care_chat import DoctorMessage
    from app.models.care_plan import DoctorAppointment, Prescription
    from app.models.clinic import ClinicDocument, Consultation
    from app.models.health import HealthData
    from app.models.iot_device import IoTDevice, VitalReading
    from app.models.records import CareVisit, Immunisation, LabResult, PatientAllergy
    from app.models.safety import Medication, MedicationLog, SosEvent
    from app.models.user import User, UserProfile
    from app.models.workplace import SiteReading, Workplace, WorkplaceMember
    from app.services import care_agent

    wipe(db, doctor)
    rnd = random.Random(7)
    now = datetime.now(timezone.utc)
    today = date.today()
    users = {}

    for idx, p in enumerate(PEOPLE):
        u = User(email=f"guest.{p['slug']}{DOMAIN}", username=f"guest_{p['slug']}", hashed_password=get_password_hash(secrets.token_urlsafe(24)),
                 is_active=True, is_email_verified=True, is_caregiver=False)
        db.add(u); db.flush()
        users[p["slug"]] = u
        db.add(UserProfile(user_id=u.id, full_name=p["name"], age=p["age"], gender=p["gender"], chronic_conditions=p["conds"], doctor_id=doctor.doctor_id,
                           height=170, weight=78, profile_completed=True))
        dev = IoTDevice(user_id=u.id, device_id=f"sandbox-{u.id}", device_type="smartwatch", device_name="Demo watch", manufacturer="demo", model="demo",
                        connection_status="connected", last_sync=now)
        db.add(dev); db.flush()
        for back in range(6, -1, -1):
            day = today - timedelta(days=back)
            steps = rnd.randint(*p["steps"]) if back else int(rnd.randint(*p["steps"]) * .5)
            db.add(HealthData(user_id=u.id, date=datetime.combine(day, datetime.min.time()), steps=steps, heart_rate=rnd.randint(*p["hr"]),
                              calories_burned=int(steps * .045), active_minutes=int(steps / 150), distance_m=int(steps * .72), steps_source="Demo data"))
            for hour in (8, 14, 20):
                ts = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour, minutes=rnd.randint(0, 40))
                if ts > now:
                    continue
                s, d = rnd.randint(*p["sys"]), rnd.randint(*p["dia"])
                db.add(VitalReading(user_id=u.id, device_id=dev.id, heart_rate=rnd.randint(*p["hr"]), blood_oxygen=float(rnd.randint(95, 98)),
                                    blood_pressure_systolic=s, blood_pressure_diastolic=d, is_emergency=False, timestamp=ts))
            if back:
                total = rnd.randint(340, 470)
                start = datetime.combine(day - timedelta(days=1), datetime.min.time()) + timedelta(hours=22, minutes=rnd.randint(0, 50))
                deep, rem = int(total * .17), int(total * .2)
                db.add(SleepSession(user_id=u.id, start=start, end=start + timedelta(minutes=total + 15), stages=None, total_min=total, awake_min=15,
                                    light_min=total - deep - rem, deep_min=deep, rem_min=rem, score=min(95, 45 + total // 8), source="demo"))
        # one fresh reading in the last two hours so every patient shows a current value (older than 24 h would show as no recent data)
        crit = p.get("critical")
        db.add(VitalReading(user_id=u.id, device_id=dev.id, heart_rate=rnd.randint(*p["hr"]), blood_oxygen=96.0,
                            blood_pressure_systolic=182 if crit else rnd.randint(*p["sys"]), blood_pressure_diastolic=116 if crit else rnd.randint(*p["dia"]),
                            is_emergency=False, timestamp=now - timedelta(minutes=40 + idx * 7)))
        # medicines and the doses taken
        meds = [Medication(user_id=u.id, name="Amlodipine" if "Hypertension" in p["conds"] else "Vitamin D", dose="5 mg" if "Hypertension" in p["conds"] else "1000 IU",
                           times=["08:00"], notes="Sample medicine", active=True, created_at=now - timedelta(days=12))]
        if "Type 2 diabetes" in p["conds"]:
            meds.append(Medication(user_id=u.id, name="Metformin", dose="500 mg", times=["20:00"], notes="Sample medicine", active=True, created_at=now - timedelta(days=12)))
        db.add_all(meds); db.flush()
        for m in meds:
            for back in range(7, 0, -1):
                db.add(MedicationLog(medication_id=m.id, user_id=u.id, day=today - timedelta(days=back), time=m.times[0],
                                     status="taken" if rnd.random() < p["adherence"] else "missed", logged_at=now - timedelta(days=back)))
        p["_meds"] = meds
        # habit progress, shared with the doctor, so the Habits tab and the Impact page have something to show (some active, some quiet)
        quiet = p["slug"] in ("abena", "yaw")
        plan = BehaviorPlan(user_id=u.id, behavior="movement", goal_text="Walk more", baseline_value=3000.0, goal_value=7000.0, unit="steps", level=3, active=True,
                            start_date=today - timedelta(days=62))
        db.add(plan); db.flush()
        last_active = 6 if quiet else 0
        for back in range(61, last_active - 1, -1):
            if rnd.random() < (.8 if not quiet else .7):
                db.add(BehaviorAction(plan_id=plan.id, user_id=u.id, action_date=today - timedelta(days=back), title="Reach 4,500 steps", detail="A small step for today.",
                                      technique="Goal setting", rationale="Small steps add up.", target_value=4500.0, level=3, is_comeback=False, status="done",
                                      value_done=4700.0, source="demo", completed_at=now - timedelta(days=back)))
        db.add(BehaviorSettings(user_id=u.id, language="en", notifications_enabled=True, wearable_data_enabled=False, share_with_doctor=True, max_nudges_per_week=2))
    db.commit()

    pk = doctor.id
    # ---- appointments: two today, two waiting for an answer, three coming up, three finished
    def appt(slug, when, status="confirmed", reason="Review", mode="video", by="doctor"):
        db.add(DoctorAppointment(doctor_pk=pk, patient_id=users[slug].id, starts_at=when, duration_min=20, mode=mode, reason=reason, status=status, requested_by=by))
    base = datetime.now() + timedelta(minutes=45)
    appt("abena", base, reason="Blood pressure review")
    appt("kofi", base + timedelta(hours=1), reason="Medicine check", mode="in_person")
    appt("esi", datetime.now() + timedelta(days=4, hours=1), status="requested", reason="Would like a check-up", by="patient")
    appt("akosua", datetime.now() + timedelta(days=6, hours=2), status="requested", reason="Would like a check-up", by="patient")
    appt("yaw", datetime.now() + timedelta(days=1, hours=2), reason="Diabetes risk review")
    appt("nana", datetime.now() + timedelta(days=2, hours=3), reason="Follow-up visit", mode="in_person")
    appt("esi", datetime.now() + timedelta(days=3, hours=1), reason="Asthma review")
    for slug, back, why in (("nana", 3, "Check-up"), ("abena", 5, "Blood pressure review"), ("yaw", 7, "Check-up")):
        appt(slug, datetime.now() - timedelta(days=back), status="completed", reason=why, mode="in_person")
    db.commit()

    # ---- messages: two waiting for the doctor, the rest answered
    def msg(slug, role, text_, ago_h, read=True):
        db.add(DoctorMessage(doctor_pk=pk, patient_id=users[slug].id, sender_role=role, content=text_, created_at=now - timedelta(hours=ago_h),
                             read_at=(now - timedelta(hours=ago_h - .2)) if read else None))
    msg("esi", "patient", "Hello doctor, my cough is better but I still use the inhaler at night. Is that fine?", 3, read=False)
    msg("kofi", "patient", "My blood pressure reading this morning was 150 over 94. Should I take another tablet?", 1.5, read=False)
    msg("yaw", "patient", "Thank you for the advice on walking.", 30)
    msg("yaw", "doctor", "You are welcome. Keep up the short walks after lunch.", 28)
    msg("nana", "doctor", "Your blood sugar results look steady. See you on the visit.", 20)
    db.commit()

    # ---- prescriptions
    for slug, med_idx, name, dose, times, note in (("kofi", 0, "Amlodipine", "5 mg", ["08:00"], "Take in the morning"), ("abena", 1, "Metformin", "500 mg", ["20:00"], "Take after the evening meal")):
        meds = next(p["_meds"] for p in PEOPLE if p["slug"] == slug)
        db.add(Prescription(doctor_pk=pk, patient_id=users[slug].id, medication_id=meds[min(med_idx, len(meds) - 1)].id, name=name, dose=dose, times=times,
                            instructions=note, status="active"))
    db.commit()

    # ---- signed consultations and documents
    def ref():
        return f"HW-{datetime.now().strftime('%y')}-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
    c1 = Consultation(doctor_pk=pk, patient_id=users["abena"].id, status="signed", complaint="Headache and high readings at home",
                      subjective="Headaches for three days. Missed several doses of her blood pressure medicine.", objective="Blood pressure 168/104 in the room.",
                      assessment="Uncontrolled hypertension, poor adherence.", plan="Restart the medicine daily, repeat readings, review in one week.",
                      diagnoses=[{"code": "I10", "label": "Essential hypertension"}], clinic_vitals={"systolic": 168, "diastolic": 104, "heart_rate": 88},
                      follow_up_at=now + timedelta(days=7), share_plan=True, created_at=now - timedelta(days=5), signed_at=now - timedelta(days=5))
    c2 = Consultation(doctor_pk=pk, patient_id=users["nana"].id, status="signed", complaint="Routine diabetes review", subjective="Feels well, no new symptoms.",
                      objective="Blood pressure 132/82. Weight stable.", assessment="Type 2 diabetes, stable.", plan="Continue the same medicines. Repeat blood sugar test in three months.",
                      diagnoses=[{"code": "E11", "label": "Type 2 diabetes mellitus"}], clinic_vitals={"systolic": 132, "diastolic": 82, "heart_rate": 70},
                      created_at=now - timedelta(days=3), signed_at=now - timedelta(days=3))
    db.add_all([c1, c2]); db.flush()
    db.add(ClinicDocument(ref=ref(), doctor_pk=pk, patient_id=users["abena"].id, consultation_id=c1.id, kind="referral", title="Referral to cardiology",
                          body={"to": "Cardiology clinic", "specialty": "Cardiology", "urgency": "soon", "reason": "Uncontrolled hypertension", "history": "Hypertension and type 2 diabetes.", "medicines": "Amlodipine, Metformin"}))
    db.add(ClinicDocument(ref=ref(), doctor_pk=pk, patient_id=users["kofi"].id, kind="sick_note", title="Sick note",
                          body={"from_date": (today - timedelta(days=2)).isoformat(), "to_date": today.isoformat(), "show_diagnosis": False, "diagnosis": "", "note": "Rest advised"}))
    db.add(ClinicDocument(ref=ref(), doctor_pk=pk, patient_id=users["nana"].id, consultation_id=c2.id, kind="letter", title="Letter",
                          body={"to": "To whom it may concern", "text": "Mr Appiah is under regular review for a long-term condition and is stable."}))
    db.commit()

    # ---- a past emergency
    db.add(SosEvent(user_id=users["abena"].id, trigger="auto_vitals", reason="Blood pressure 192/118", severity="critical", status="resolved",
                    created_at=now - timedelta(days=6), resolved_at=now - timedelta(days=6) + timedelta(minutes=14), dispatch_mode="simulate"))
    db.commit()

    # ---- health record: results, allergy, vaccine, visits
    db.add(LabResult(user_id=users["abena"].id, doctor_pk=pk, test="HbA1c", value="8.1", unit="%", ref_range="4.0 to 5.6", flag="high", taken_at=now - timedelta(days=5)))
    db.add(LabResult(user_id=users["abena"].id, doctor_pk=pk, test="Creatinine", value="82", unit="umol/L", ref_range="45 to 90", flag="normal", taken_at=now - timedelta(days=5)))
    db.add(LabResult(user_id=users["nana"].id, doctor_pk=pk, test="HbA1c", value="6.9", unit="%", ref_range="4.0 to 5.6", flag="high", taken_at=now - timedelta(days=3)))
    db.add(PatientAllergy(user_id=users["kofi"].id, substance="Penicillin", reaction="Rash", severity="moderate", source="doctor"))
    db.add(Immunisation(user_id=users["esi"].id, vaccine="Tetanus", dose="Booster", given_on=today - timedelta(days=200), facility="HEWAL3 demo clinic", source="doctor"))
    db.add(CareVisit(user_id=users["nana"].id, doctor_pk=pk, facility="HEWAL3 demo clinic", kind="clinic", reason="Diabetes review", checked_in_at=now - timedelta(days=3, hours=1),
                     checked_out_at=now - timedelta(days=3), summary="Medicines unchanged. Next blood sugar test in three months."))
    db.add(CareVisit(user_id=users["kofi"].id, doctor_pk=pk, facility="HEWAL3 demo clinic", kind="clinic", reason="Medicine check", checked_in_at=now - timedelta(minutes=25)))
    db.commit()

    # ---- the care agent's review queue: one safety hand-off, one long silence
    care_agent.demo_handoff(db, users["abena"], name="Abena Owusu", age=58, conditions=["Hypertension", "Type 2 diabetes"], doctor=doctor.full_name, kind="safety")
    care_agent.demo_handoff(db, users["yaw"], name="Yaw Darko", age=47, conditions=["Pre-diabetes"], doctor=doctor.full_name, kind="silent")
    db.commit()

    # ---- a workplace with heat readings; five of the patients joined, so the count is shown
    from app.routers.workplace import _h
    w = Workplace(doctor_pk=pk, name="Khalifa Port Terminal", region="ae", join_code_hash=_h(secrets.token_hex(3)), site_key_hash=_h(secrets.token_urlsafe(18)))
    db.add(w); db.flush()
    for ago, t, rh in ((6, 33.0, 52.0), (5, 35.5, 50.0), (4, 37.0, 48.0), (3, 38.5, 47.0), (2, 38.0, 49.0), (1, 36.5, 51.0)):
        db.add(SiteReading(workplace_id=w.id, temp_c=t, humidity_pct=rh, source="sensor" if ago % 2 else "manual", note=None if ago % 2 else "Container yard",
                           recorded_at=now - timedelta(hours=ago)))
    for slug in ("kofi", "yaw", "esi", "akosua", "nana"):
        db.add(WorkplaceMember(workplace_id=w.id, user_id=users[slug].id))
    db.commit()
