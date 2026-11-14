"""Caregiver <-> patient linking, end to end. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User, UserProfile
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    mk = lambda n, **k: User(email=f"cl_{n}@example.com", username=f"cl_{n}", hashed_password=get_password_hash("Passw0rd!x1"), **k)
    pat, cg, cg2 = mk("pat"), mk("cg", is_caregiver=True), mk("cg2", is_caregiver=True)
    db.add_all([pat, cg, cg2]); db.commit()
    db.add(UserProfile(user_id=pat.id, full_name="Link Patient", age=40, gender="Female", chronic_conditions=[], profile_completed=True)); db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), pat=pat.id, cg=cg.id, cg2=cg2.id, pid=pat.patient_id, hp=tok(pat), hc=tok(cg), hc2=tok(cg2))
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for uid in (pat.id, cg.id, cg2.id):
        row = db2.query(User).filter(User.id == uid).first()
        if row:
            delete_account(db2, row)
    db2.close(); db.close()


def test_caregiver_connects_patient_approves_then_removes(env):
    c = env["client"]
    assert c.post("/caregivers/connect-patient", headers=env["hc"], json={"patient_caregiver_id": "   "}).status_code == 400
    assert c.post("/caregivers/connect-patient", headers=env["hc"], json={"patient_caregiver_id": "no-such-id"}).status_code == 404
    r = c.post("/caregivers/connect-patient", headers=env["hc"], json={"patient_caregiver_id": env["pid"]})
    assert r.status_code == 200, r.text
    req_id = r.json()["request_id"]
    assert c.post("/caregivers/connect-patient", headers=env["hc"], json={"patient_caregiver_id": env["pid"]}).status_code == 400   # duplicate

    # until the patient approves, the caregiver sees nothing
    assert c.get("/caregivers/patients", headers=env["hc"]).json() == []
    assert c.get(f"/caregivers/patients/{env['pat']}/overview", headers=env["hc"]).status_code == 404

    inc = c.get("/caregivers/requests/incoming", headers=env["hp"])
    assert inc.status_code == 200 and any(x["request_id"] == req_id for x in inc.json())
    assert c.post(f"/caregivers/requests/{req_id}/respond", headers=env["hc2"], json={"action": "approve"}).status_code == 404       # not theirs to answer
    assert c.post(f"/caregivers/requests/{req_id}/respond", headers=env["hp"], json={"action": "maybe"}).status_code == 400
    assert c.post(f"/caregivers/requests/{req_id}/respond", headers=env["hp"], json={"action": "approve"}).status_code == 200
    assert c.post(f"/caregivers/requests/{req_id}/respond", headers=env["hp"], json={"action": "approve"}).status_code == 400       # already processed

    mine = c.get("/caregivers/my-caregivers", headers=env["hp"])
    assert mine.status_code == 200 and [x["caregiver_id"] for x in mine.json()] == [env["cg"]]
    pats = c.get("/caregivers/patients", headers=env["hc"]).json()
    assert [p["id"] for p in pats] == [env["pat"]] and pats[0]["patient_name"] == "Link Patient"
    assert c.get(f"/caregivers/patients/{env['pat']}/overview", headers=env["hc"]).status_code == 200

    assert c.put("/caregivers/profile", headers=env["hc"], json={"phone_number": "+233201234567"}).status_code == 200
    assert c.get("/caregivers/profile", headers=env["hc"]).json()["phone_number"] == "+233201234567"
    assert c.get("/caregivers/my-id", headers=env["hc"]).json()["caregiver_id"].startswith("CG")

    assert c.delete(f"/caregivers/patients/{env['pat']}", headers=env["hc"]).status_code == 200
    assert c.delete(f"/caregivers/patients/{env['pat']}", headers=env["hc"]).status_code == 404
    assert c.get("/caregivers/patients", headers=env["hc"]).json() == []


def test_patient_invites_caregiver_and_request_access(env):
    c = env["client"]
    cid = c.get("/caregivers/my-id", headers=env["hc2"]).json()["caregiver_id"]
    assert c.post("/caregivers/connect-caregiver", headers=env["hp"], json={"caregiver_id": "CGNOPE000"}).status_code == 404
    r = c.post("/caregivers/connect-caregiver", headers=env["hp"], json={"caregiver_id": cid})
    assert r.status_code == 200, r.text
    assert c.post("/caregivers/connect-caregiver", headers=env["hp"], json={"caregiver_id": cid}).status_code == 400
    # request-access by numeric id for a caregiver who already has a pending request is refused too
    assert c.post("/caregivers/request-access", headers=env["hc2"], json={"patient_id": env["pat"], "relationship_type": "family"}).status_code == 400
    assert c.post("/caregivers/request-access", headers=env["hc"], json={"patient_id": 999999, "relationship_type": "family"}).status_code == 404
    ok = c.post("/caregivers/request-access", headers=env["hc"], json={"patient_id": env["pat"], "relationship_type": "family"})
    assert ok.status_code == 200 and ok.json()["status"] == "pending"
