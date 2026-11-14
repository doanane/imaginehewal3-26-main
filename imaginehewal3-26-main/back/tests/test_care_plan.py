"""Appointments, doctor notes, prescriptions, push tokens, TURN credentials and calls to a phone whose app is closed. Offline."""
import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def at(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).replace(microsecond=0).isoformat()


def test_appointment_request_confirm_and_conflicts(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    r = c.post("/my-doctor/appointments", headers=env["hp"], json={"starts_at": at(48), "duration_min": 30, "mode": "video", "reason": "Pressure check"})
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    assert r.json()["status"] == "requested"

    # the doctor sees it, confirms it, and the patient sees the new status
    up = c.get("/doctor-portal/appointments", headers=hd).json()["appointments"]
    assert any(a["id"] == aid and a["status"] == "requested" and a["patient"] for a in up)
    ok = c.patch(f"/doctor-portal/appointments/{aid}", headers=hd, json={"status": "confirmed"})
    assert ok.status_code == 200 and ok.json()["status"] == "confirmed"
    mine = c.get("/my-doctor/appointments", headers=env["hp"]).json()["appointments"]
    assert next(a for a in mine if a["id"] == aid)["status"] == "confirmed"

    # an overlapping booking by the doctor is refused; a later one works
    clash = c.post(f"/doctor-portal/patients/{pid}/appointments", headers=hd, json={"starts_at": at(48.25), "duration_min": 30})
    assert clash.status_code == 409
    free = c.post(f"/doctor-portal/patients/{pid}/appointments", headers=hd, json={"starts_at": at(72), "mode": "phone"})
    assert free.status_code == 200 and free.json()["status"] == "confirmed"

    # bad input
    assert c.post("/my-doctor/appointments", headers=env["hp"], json={"starts_at": at(-3)}).status_code == 422
    assert c.post("/my-doctor/appointments", headers=env["hp"], json={"starts_at": at(50), "mode": "teleport"}).status_code == 422
    assert c.patch(f"/doctor-portal/appointments/{aid}", headers=hd, json={"status": "completed"}).status_code == 422   # still in the future

    # the patient can cancel, and cannot touch another patient's appointment
    assert c.post(f"/my-doctor/appointments/{aid}/cancel", headers=env["hp"]).json()["status"] == "cancelled"
    assert c.post(f"/my-doctor/appointments/{aid}/cancel", headers=env["hp"]).status_code == 409
    assert c.post(f"/my-doctor/appointments/{free.json()['id']}/cancel", headers=env["hc"]).status_code in (403, 404)


def test_other_doctor_cannot_touch_appointments_or_notes(env):
    c = env["client"]
    _, ha = login(c)
    _, hb = login(c, "DPT0001B")
    aid = c.post(f"/doctor-portal/patients/{env['pat']}/appointments", headers=ha, json={"starts_at": at(100)}).json()["id"]
    assert c.patch(f"/doctor-portal/appointments/{aid}", headers=hb, json={"status": "cancelled"}).status_code == 404
    assert c.get(f"/doctor-portal/patients/{env['pat']}/notes", headers=hb).status_code == 404
    assert c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions", headers=hb, json={"name": "Amlodipine", "times": ["08:00"]}).status_code == 404


def test_notes_private_until_shared(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    priv = c.post(f"/doctor-portal/patients/{pid}/notes", headers=hd, json={"text": "Suspect poor adherence; ask about cost.", "shared": False}).json()
    shared = c.post(f"/doctor-portal/patients/{pid}/notes", headers=hd, json={"text": "Reduce salt. Walk 20 minutes daily.", "shared": True}).json()
    seen = [n["text"] for n in c.get("/my-doctor/notes", headers=env["hp"]).json()["notes"]]
    assert "Reduce salt. Walk 20 minutes daily." in seen
    assert all("adherence" not in t for t in seen)
    assert len(c.get(f"/doctor-portal/patients/{pid}/notes", headers=hd).json()["notes"]) >= 2
    assert c.post(f"/doctor-portal/patients/{pid}/notes", headers=hd, json={"text": "   "}).status_code == 422
    assert c.delete(f"/doctor-portal/notes/{priv['id']}", headers=hd).status_code == 200
    assert c.delete(f"/doctor-portal/notes/{shared['id']}", headers=hd).status_code == 200


def test_prescription_creates_and_stops_the_patients_medicine(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    r = c.post(f"/doctor-portal/patients/{pid}/prescriptions", headers=hd,
               json={"name": "Amlodipine", "dose": "5 mg", "times": ["20:00", "08:00"], "instructions": "After food"})
    assert r.status_code == 200, r.text
    rx = r.json()
    assert rx["times"] == ["08:00", "20:00"] and rx["status"] == "active"
    meds = c.get("/medications", headers=env["hp"]).json()
    names = [m["name"] for m in (meds if isinstance(meds, list) else meds.get("medications", []))]
    assert "Amlodipine" in names                                                       # shows in the patient's own list
    assert c.post(f"/doctor-portal/patients/{pid}/prescriptions", headers=hd, json={"name": "amlodipine", "times": ["08:00"]}).status_code == 409
    assert c.post(f"/doctor-portal/patients/{pid}/prescriptions", headers=hd, json={"name": "X-drug", "times": ["25:99"]}).status_code == 422

    mine = c.get("/my-doctor/prescriptions", headers=env["hp"]).json()["prescriptions"]
    assert any(p["name"] == "Amlodipine" and p["doctor"] for p in mine)

    stop = c.post(f"/doctor-portal/prescriptions/{rx['id']}/stop", headers=hd, json={"reason": "Ankle swelling"})
    assert stop.status_code == 200 and stop.json()["status"] == "stopped"
    meds = c.get("/medications", headers=env["hp"]).json()
    names = [m["name"] for m in (meds if isinstance(meds, list) else meds.get("medications", []))]
    assert "Amlodipine" not in names                                                   # no longer reminds the patient
    assert c.post(f"/doctor-portal/prescriptions/{rx['id']}/stop", headers=hd, json={}).status_code == 409


def test_push_token_registration(env):
    c = env["client"]
    tok = "ExponentPushToken[abcdefghijklmnopqrstuv]"
    assert c.post("/push/register", headers=env["hp"], json={"token": "not-a-token-at-all"}).status_code == 422
    assert c.post("/push/register", headers=env["hp"], json={"token": tok, "platform": "ios"}).status_code == 200
    assert c.post("/push/register", headers=env["hc"], json={"token": tok, "platform": "ios"}).status_code == 200   # phone changed hands
    from app.database import SessionLocal
    from app.models.care_plan import PushToken
    db = SessionLocal()
    rows = db.query(PushToken).filter(PushToken.token == tok).all()
    assert len(rows) == 1 and rows[0].user_id == env["cg"]
    db.close()
    assert c.post("/push/unregister", headers=env["hc"], json={"token": tok}).status_code == 200
    assert c.post("/push/register", json={"token": tok}).status_code in (401, 403)


def test_ice_servers_and_turn_credentials(env, monkeypatch):
    c = env["client"]
    _, hd = login(c)
    r = c.get("/rtc/ice", headers=env["hp"]).json()
    assert r["relay"] is False and "stun:" in r["iceServers"][0]["urls"][0]
    monkeypatch.setenv("TURN_URLS", "turn:relay.example.com:3478?transport=udp")
    monkeypatch.setenv("TURN_SECRET", "s3cret")
    r = c.get("/rtc/ice", headers=hd).json()
    turn = r["iceServers"][-1]
    assert r["relay"] is True and turn["urls"] == ["turn:relay.example.com:3478?transport=udp"]
    want = base64.b64encode(hmac.new(b"s3cret", turn["username"].encode(), hashlib.sha1).digest()).decode()
    assert turn["credential"] == want                                                   # the coturn shared-secret scheme
    assert int(turn["username"].split(":")[0]) > datetime.now(timezone.utc).timestamp()
    assert c.get("/rtc/ice").status_code in (401, 403)


def test_call_to_a_closed_app_rings_on_open(env, monkeypatch):
    from app.services import push
    sent = []
    monkeypatch.setattr(push, "notify_users", lambda ids, title, body, data=None, urgent=False: sent.append((list(ids), title, urgent)) or 1)
    c = env["client"]
    r = c.post("/doctor-portal/login", json={"doctor_id": "DPT0001A", "password": "Passw0rd!x1"})
    dtok = r.json()["access_token"]
    ptok = env["hp"]["Authorization"].split()[1]
    with c.websocket_connect("/ws") as dws:
        dws.send_json({"type": "auth", "token": dtok})
        dkey = dws.receive_json()["user_id"]
        dws.send_json({"type": "call.invite", "to": env["pat"], "call_id": "closed1", "media": "audio"})
        got = dws.receive_json()
        while got["type"] != "call.ringing":
            got = dws.receive_json()
        assert got["via"] == "push" and sent and sent[0][2] is True and sent[0][0] == [env["pat"]]
        # the patient opens the app: the waiting invitation arrives right after "ready"
        with c.websocket_connect("/ws") as pws:
            pws.send_json({"type": "auth", "token": ptok})
            assert pws.receive_json()["type"] == "ready"
            inv = pws.receive_json()
            while inv["type"] != "call.invite":
                inv = pws.receive_json()
            assert inv["call_id"] == "closed1" and inv["from_user_id"] == dkey
            pws.send_json({"type": "call.end", "to": dkey, "call_id": "closed1"})


def test_hosted_relay_with_fixed_credentials(env, monkeypatch):
    c = env["client"]
    monkeypatch.delenv("TURN_SECRET", raising=False)
    monkeypatch.setenv("TURN_URLS", "turn:relay.example.com:443?transport=tcp")
    monkeypatch.setenv("TURN_USERNAME", "acct-user")
    monkeypatch.setenv("TURN_CREDENTIAL", "acct-pass")
    r = c.get("/rtc/ice", headers=env["hp"]).json()
    assert r["relay"] is True
    assert r["iceServers"][-1] == {"urls": ["turn:relay.example.com:443?transport=tcp"], "username": "acct-user", "credential": "acct-pass"}


def test_care_log_and_team_between_patient_and_caregiver(env):
    c, pid = env["client"], env["pat"]
    # the approved caregiver writes; the patient reads but cannot write; a stranger sees nothing
    r = c.post(f"/care-notes/{pid}", headers=env["hc"], json={"text": "Took all morning medicines. Slept badly."})
    assert r.status_code == 200 and r.json()["mine"] is True
    mine = c.get(f"/care-notes/{pid}", headers=env["hc"]).json()
    assert mine["can_write"] is True and any(n["text"].startswith("Took all") for n in mine["notes"])
    seen = c.get(f"/care-notes/{pid}", headers=env["hp"]).json()
    assert seen["can_write"] is False and any(n["text"].startswith("Took all") and n["mine"] is False for n in seen["notes"])
    assert c.post(f"/care-notes/{pid}", headers=env["hp"], json={"text": "I write my own"}).status_code == 403
    assert c.get(f"/care-notes/{env['other']}", headers=env["hc"]).status_code == 404           # not their patient
    assert c.post(f"/care-notes/{env['other']}", headers=env["hc"], json={"text": "x"}).status_code == 403
    assert c.post(f"/care-notes/{pid}", headers=env["hc"], json={"text": "  "}).status_code in (422, 400)

    team = c.get(f"/care-team/{pid}", headers=env["hp"]).json()
    assert team["doctor"]["name"] and [m["me"] for m in team["caregivers"]] == [False]
    assert c.get(f"/care-team/{env['other']}", headers=env["hc"]).status_code == 404

    assert c.delete(f"/care-notes/{r.json()['id']}", headers=env["hp"]).status_code == 404       # only the author deletes
    assert c.delete(f"/care-notes/{r.json()['id']}", headers=env["hc"]).status_code == 200


def test_deleting_an_account_removes_everything_the_care_features_stored(env):
    """A person who deletes their account must not leave messages, appointments, prescriptions, notes or phone tokens behind."""
    from app.auth.hashing import get_password_hash
    from app.database import SessionLocal
    from app.models.care_chat import DoctorMessage
    from app.models.care_plan import CareNote, DoctorAppointment, DoctorNote, Prescription, PushToken
    from app.models.caregiver import Doctor
    from app.models.safety import Medication
    from app.models.user import User
    from app.services.privacy_service import delete_account

    db = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.doctor_id == "DPT0001A").first()
    for stale in db.query(User).filter(User.email == "dp_gone@example.com").all():
        delete_account(db, stale)
    u = User(email="dp_gone@example.com", username="dp_gone", hashed_password=get_password_hash("Passw0rd!x1"))
    db.add(u)
    db.commit()
    med = Medication(user_id=u.id, name="Test", times=["08:00"], active=True)
    db.add(med)
    db.flush()
    db.add_all([
        DoctorMessage(doctor_pk=doc.id, patient_id=u.id, sender_role="patient", content="hello"),
        DoctorAppointment(doctor_pk=doc.id, patient_id=u.id, starts_at=datetime.now(timezone.utc) + timedelta(days=3), status="requested"),
        DoctorNote(doctor_pk=doc.id, patient_id=u.id, text="n", shared=True),
        Prescription(doctor_pk=doc.id, patient_id=u.id, medication_id=med.id, name="Test", times=["08:00"]),
        CareNote(patient_id=u.id, author_id=env["cg"], text="care"),
        PushToken(user_id=u.id, token="ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]"),
    ])
    db.commit()
    uid = u.id
    delete_account(db, db.query(User).filter(User.id == uid).first())
    for model, col in ((DoctorMessage, DoctorMessage.patient_id), (DoctorAppointment, DoctorAppointment.patient_id), (DoctorNote, DoctorNote.patient_id),
                       (Prescription, Prescription.patient_id), (CareNote, CareNote.patient_id), (PushToken, PushToken.user_id), (Medication, Medication.user_id)):
        assert db.query(model).filter(col == uid).count() == 0, model.__name__
    db.close()


def test_every_notification_type_reaches_the_list(env):
    from app.database import SessionLocal
    from app.models.notification import Notification
    db = SessionLocal()
    kinds = ["system", "caregiver", "doctor", "appointment", "prescription", "emergency", "risk_alert", "something_new"]
    for k in kinds:
        db.add(Notification(user_id=env["pat"], notification_type=k, title=f"t-{k}", message="m", sender_type="system"))
    db.commit()
    db.close()
    g = env["client"].get("/notifications/", headers=env["hp"]).json()
    shown = {n["title"] for grp in ("system", "caregiver", "doctor") for n in g[grp]}
    for k in kinds:
        assert f"t-{k}" in shown, k
