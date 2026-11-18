"""Doctor and patient pictures: saved once, shown at every sign-in, and shown on the other person's call screen. Offline (the upload is faked)."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_care_chat import _auth, _tokens  # noqa: F401,E402
from test_doctor_portal import env, login  # noqa: F401,E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
URL = "https://res.cloudinary.com/demo/image/upload/v1/doctor_profiles/doctor_1.png"


def _fake_upload(monkeypatch):
    from app.services import storage_service as ss
    seen = {}

    async def fake(file, folder="general"):
        seen["folder"] = folder
        seen["name"] = file.filename
        return URL
    monkeypatch.setattr(ss.storage_service, "upload_file", fake)
    return seen


def test_only_real_pictures_are_accepted_and_the_address_is_kept(env, monkeypatch):
    c = env["client"]
    seen = _fake_upload(monkeypatch)
    _, hd = login(c)
    bad = c.post("/doctor-portal/me/photo", headers=hd, files={"file": ("x.png", b"<html>not a picture</html>", "image/png")})
    assert bad.status_code == 400                                                    # judged by its bytes, not by the file name
    big = c.post("/doctor-portal/me/photo", headers=hd, files={"file": ("big.png", PNG + b"0" * (5 * 1024 * 1024), "image/png")})
    assert big.status_code == 400
    assert c.post("/doctor-portal/me/photo", files={"file": ("a.png", PNG, "image/png")}).status_code in (401, 403)

    ok = c.post("/doctor-portal/me/photo", headers=hd, files={"file": ("me.png", PNG, "image/png")})
    assert ok.status_code == 200 and ok.json()["photo_url"] == URL and seen["folder"] == "doctor_profiles"

    # a brand new sign-in still has it
    again = c.post("/doctor-portal/login", json={"doctor_id": "DPT0001A", "password": "Passw0rd!x1"}).json()
    assert again["doctor"]["photo_url"] == URL
    assert c.get("/doctor-portal/me", headers=hd).json()["photo_url"] == URL
    assert c.get("/doctor-portal/overview", headers=hd).json()["doctor"]["photo_url"] == URL
    # the patient sees the picture of their own doctor
    assert c.get("/my-doctor", headers=env["hp"]).json()["doctor"]["photo_url"] == URL

    gone = c.delete("/doctor-portal/me/photo", headers=hd)
    assert gone.status_code == 200 and gone.json()["photo_url"] is None
    assert c.get("/doctor-portal/me", headers=hd).json()["photo_url"] is None


def test_a_call_carries_the_callers_picture_both_ways(env, monkeypatch):
    c = env["client"]
    _fake_upload(monkeypatch)
    _, hd = login(c)
    assert c.post("/doctor-portal/me/photo", headers=hd, files={"file": ("me.png", PNG, "image/png")}).status_code == 200
    from app.database import SessionLocal
    from app.models.user import UserProfile
    db = SessionLocal()
    try:
        p = db.query(UserProfile).filter(UserProfile.user_id == env["pat"]).first()
        p.profile_image_url = "https://res.cloudinary.com/demo/image/upload/v1/profile_images/patient.jpg"
        db.commit()
    finally:
        db.close()

    from app.services import photos
    photos._CACHE.clear()                                   # a picture changed behind the server's back in this test
    dtok, ptok, _ = _tokens(env)
    pid = env["pat"]
    with c.websocket_connect("/ws") as pws, c.websocket_connect("/ws") as dws:
        _auth(pws, ptok)
        ready = _auth(dws, dtok)
        # doctor calls the patient: the patient's screen gets the doctor's picture
        dws.send_json({"type": "call.invite", "to": pid, "call_id": "c1", "media": "audio"})
        got = pws.receive_json()
        while got["type"] != "call.invite":
            got = pws.receive_json()
        assert got["from_photo"] == URL and got["from_role"] == "doctor"
        # the patient answers: the doctor's screen gets the patient's picture
        pws.send_json({"type": "call.accept", "to": ready["user_id"], "call_id": "c1"})
        back = dws.receive_json()
        while back["type"] != "call.accept":
            back = dws.receive_json()
        assert back["from_photo"].endswith("patient.jpg")

    detail = c.get(f"/doctor-portal/patients/{pid}", headers=hd).json()
    assert detail["patient"]["photo_url"].endswith("patient.jpg")
