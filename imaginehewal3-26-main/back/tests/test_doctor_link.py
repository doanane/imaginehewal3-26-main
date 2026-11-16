"""A doctor asks to follow a patient and the patient decides. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def _headers(uid):
    from app.auth.security import create_access_token
    return {"Authorization": "Bearer " + create_access_token({"sub": str(uid)}, "patient")}


def _codes(env):
    from app.database import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    try:
        return {k: (db.query(User).filter(User.id == env[k]).first().patient_id, db.query(User).filter(User.id == env[k]).first().email) for k in ("pat", "other", "cg")}
    finally:
        db.close()


def test_doctor_finds_by_exact_id_or_email_only_and_sees_a_name_and_nothing_else(env):
    c = env["client"]
    _, ha = login(c, "DPT0001A")
    codes = _codes(env)
    assert c.get("/doctor-portal/find?q=ab", headers=ha).json()["found"] is False                # too short to be a lookup
    assert c.get("/doctor-portal/find?q=Not", headers=ha).json()["found"] is False               # no partial names: nobody can browse
    r = c.get("/doctor-portal/find?q=" + codes["other"][0], headers=ha).json()
    assert r["found"] and r["state"] == "available" and set(r["patient"]) == {"user_id", "name", "patient_id"} and r["patient"]["name"] == "Not Mine"
    assert c.get("/doctor-portal/find?q=" + codes["other"][1].upper(), headers=ha).json()["found"]
    assert c.get("/doctor-portal/find?q=" + codes["pat"][1], headers=ha).json()["state"] == "yours"
    assert c.get("/doctor-portal/find?q=" + codes["cg"][1], headers=ha).json()["found"] is False   # a caregiver is not a patient
    assert c.get("/doctor-portal/find?q=" + codes["other"][0]).status_code in (401, 403)


def test_request_accept_decline_and_the_patient_always_decides(env):
    c = env["client"]
    _, ha = login(c, "DPT0001A")
    _, hb = login(c, "DPT0001B")
    ho = _headers(env["other"])
    # nothing is shared before the patient answers
    sent = c.post("/doctor-portal/link-requests", headers=ha, json={"patient_user_id": env["other"], "message": "We met at the clinic on Monday."})
    assert sent.status_code == 200 and sent.json()["status"] == "pending"
    rid = sent.json()["id"]
    assert c.post("/doctor-portal/link-requests", headers=ha, json={"patient_user_id": env["other"]}).json()["already"]          # no duplicates
    assert c.get(f"/doctor-portal/patients/{env['other']}", headers=ha).status_code == 404                                       # still not their patient
    assert c.get("/doctor-portal/find?q=" + _codes(env)["other"][0], headers=ha).json()["state"] == "pending"
    mine = c.get("/doctor-portal/link-requests", headers=ha).json()["requests"]
    assert mine[0]["status"] == "pending" and mine[0]["message"].startswith("We met")

    # the patient sees it, with who is asking
    seen = c.get("/my-doctor/requests", headers=ho).json()["requests"]
    assert len(seen) == 1 and seen[0]["doctor"]["doctor_id"] == "DPT0001A" and seen[0]["message"].startswith("We met")
    assert c.get("/my-doctor/requests", headers=env["hp"]).json()["requests"] == []                                               # someone else's request is invisible
    assert c.post(f"/my-doctor/requests/{rid}", headers=env["hp"], json={"accept": True}).status_code == 404                     # and cannot be answered by them
    assert c.get("/notifications/", headers=ho).status_code == 200

    # decline leaves everything as it was
    other_before = c.get("/my-doctor", headers=ho).json()["doctor"]["doctor_id"]
    assert c.post(f"/my-doctor/requests/{rid}", headers=ho, json={"accept": False}).json()["status"] == "declined"
    assert c.get("/my-doctor", headers=ho).json()["doctor"]["doctor_id"] == other_before == "DPT0001B"
    assert c.get("/doctor-portal/link-requests", headers=ha).json()["requests"][0]["status"] == "declined"
    assert c.post(f"/my-doctor/requests/{rid}", headers=ho, json={"accept": True}).status_code == 404                              # an answered request cannot be reopened

    # a new request, accepted: the doctor now sees the patient, the old doctor does not
    rid2 = c.post("/doctor-portal/link-requests", headers=ha, json={"patient_user_id": env["other"]}).json()["id"]
    acc = c.post(f"/my-doctor/requests/{rid2}", headers=ho, json={"accept": True}).json()
    assert acc["status"] == "accepted" and acc["replaced_previous_doctor"] and acc["doctor"]["doctor_id"] == "DPT0001A"
    assert c.get(f"/doctor-portal/patients/{env['other']}", headers=ha).status_code == 200
    assert c.get(f"/doctor-portal/patients/{env['other']}", headers=hb).status_code == 404
    assert c.post("/doctor-portal/link-requests", headers=ha, json={"patient_user_id": env["other"]}).status_code == 409           # already theirs
    # habit progress is a separate switch the patient controls
    assert c.get(f"/doctor-portal/patients/{env['other']}/behavior", headers=ha).json()["shared"] is False


def test_a_doctor_can_withdraw_and_a_caregiver_cannot_be_asked(env):
    c = env["client"]
    _, hb = login(c, "DPT0001B")
    assert c.post("/doctor-portal/link-requests", headers=hb, json={"patient_user_id": env["cg"]}).status_code == 404
    rid = c.post("/doctor-portal/link-requests", headers=hb, json={"patient_user_id": env["other"]}).json()["id"]
    assert c.delete(f"/doctor-portal/link-requests/{rid}", headers=hb).json()["ok"]
    assert c.get("/my-doctor/requests", headers=_headers(env["other"])).json()["requests"] == []
    assert c.delete(f"/doctor-portal/link-requests/{rid}", headers=hb).status_code == 404


def test_the_demo_doctor_cannot_look_up_real_people(env):
    c = env["client"]
    gd = c.post("/auth/guest", json={"role": "doctor"}).json()
    hd = {"Authorization": "Bearer " + gd["access_token"]}
    assert c.get("/doctor-portal/find?q=" + _codes(env)["other"][0], headers=hd).status_code == 403
    assert c.post("/doctor-portal/link-requests", headers=hd, json={"patient_user_id": env["other"]}).status_code in (403, 404)


def test_a_doctor_sees_the_persons_name_not_the_word_patient(env):
    from app.database import SessionLocal
    from app.models.user import User, UserProfile
    from app.services import names
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == env["other"]).first()
        p = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        assert names.person_name(u, p) == "Not Mine"                                   # the profile name first
        p.full_name = None
        assert names.person_name(u, p) == u.username                                   # then the username
        u.username = None
        assert names.person_name(u, p) == u.email.split("@")[0]                        # then the email before the @
        assert names.person_name(None, None) == "Patient"                              # only when nothing is known
        db.rollback()
    finally:
        db.close()
