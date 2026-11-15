"""Doctor <-> patient chat and call signalling over the real websocket. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest
from test_doctor_portal import env, login  # noqa: F401  (shared fixture: doctor A owns the patient, doctor B owns someone else)


def _auth(ws, token):
    ws.send_json({"type": "auth", "token": token})
    return ws.receive_json()


def _tokens(env):
    r = env["client"].post("/doctor-portal/login", json={"doctor_id": "DPT0001A", "password": "Passw0rd!x1"})
    doc = r.json()["access_token"]
    return doc, env["hp"]["Authorization"].split()[1], env["hc"]["Authorization"].split()[1]


def test_thread_roundtrip_and_realtime(env):
    c = env["client"]
    _, hd = login(c)
    dtok, ptok, _ = _tokens(env)
    pid = env["pat"]
    with c.websocket_connect("/ws") as pws, c.websocket_connect("/ws") as dws:
        assert _auth(pws, ptok)["role"] == "patient"
        ready = _auth(dws, dtok)
        assert ready["role"] == "doctor" and ready["user_id"] < 0

        r = c.post(f"/doctor-portal/patients/{pid}/thread", headers=hd, json={"message": "How is your pressure today?"})
        assert r.status_code == 200
        got = pws.receive_json()
        while got["type"] != "doctor_message.new":      # presence frames may arrive first
            got = pws.receive_json()
        assert got["message"]["content"] == "How is your pressure today?" and got["message"]["sender_role"] == "doctor"

        r = c.post("/my-doctor/thread", headers=env["hp"], json={"message": "A bit high, 150 over 95"})
        assert r.status_code == 200
        got = dws.receive_json()
        while got["type"] != "doctor_message.new":
            got = dws.receive_json()
        assert got["patient_id"] == pid and "150" in got["message"]["content"]

    msgs = c.get(f"/doctor-portal/patients/{pid}/thread", headers=hd).json()["messages"]
    assert [m["sender_role"] for m in msgs][-2:] == ["doctor", "patient"]
    assert c.get("/doctor-portal/inbox", headers=hd).json()["unread"][str(pid)] >= 1
    assert c.post(f"/doctor-portal/patients/{pid}/thread/read", headers=hd).json()["read"] >= 1
    assert c.get("/doctor-portal/inbox", headers=hd).json()["unread"].get(str(pid), 0) == 0
    mine = c.get("/my-doctor/thread", headers=env["hp"]).json()
    assert mine["doctor"]["doctor_id"] == "DPT0001A" and len(mine["messages"]) >= 2


def test_thread_is_private(env):
    c = env["client"]
    _, hd = login(c)
    assert c.get(f"/doctor-portal/patients/{env['other']}/thread", headers=hd).status_code == 404
    assert c.post(f"/doctor-portal/patients/{env['other']}/thread", headers=hd, json={"message": "hi"}).status_code == 404
    assert c.get("/doctor-portal/inbox").status_code in (401, 403)
    assert c.get("/my-doctor/thread", headers=env["hc"]).status_code == 403          # caregivers have no doctor
    assert c.post("/my-doctor/thread", headers=env["hp"], json={"message": "   "}).status_code in (400, 422)


def test_call_signalling(env):
    c = env["client"]
    dtok, ptok, ctok = _tokens(env)
    pid = env["pat"]
    with c.websocket_connect("/ws") as pws, c.websocket_connect("/ws") as dws, c.websocket_connect("/ws") as cws:
        _auth(pws, ptok); _auth(dws, dtok); _auth(cws, ctok)
        # find the doctor key from the ready frame of a fresh connection
        with c.websocket_connect("/ws") as probe:
            dkey = _auth(probe, dtok)["user_id"]

        def drain_until(ws, kind):
            for _ in range(10):
                m = ws.receive_json()
                if m["type"] == kind:
                    return m
            raise AssertionError(kind)

        # doctor calls the patient
        dws.send_json({"type": "call.invite", "to": pid, "call_id": "c1", "media": "video"})
        inv = drain_until(pws, "call.invite")
        assert inv["from_user_id"] == dkey and inv["media"] == "video" and inv["from_role"] == "doctor"
        pws.send_json({"type": "call.accept", "to": dkey, "call_id": "c1"})
        assert drain_until(dws, "call.accept")["call_id"] == "c1"
        dws.send_json({"type": "call.signal", "to": pid, "call_id": "c1", "data": {"sdp": "v=0", "type": "offer"}})
        assert drain_until(pws, "call.signal")["data"]["type"] == "offer"

        # a second caller hears busy; the doctor is not reachable by a stranger
        cws.send_json({"type": "call.invite", "to": pid, "call_id": "c2", "media": "audio"})
        assert drain_until(cws, "call.unavailable")["reason"] == "busy"
        cws.send_json({"type": "call.invite", "to": dkey, "call_id": "c3", "media": "audio"})   # caregiver has no link to the doctor
        dws.send_json({"type": "ping"})
        assert drain_until(dws, "pong")["type"] == "pong"

        dws.send_json({"type": "call.end", "to": pid, "call_id": "c1"})
        assert drain_until(pws, "call.end")["call_id"] == "c1"


def test_doctor_profile_edit_and_password(env):
    c = env["client"]
    _, hd = login(c)
    me = c.get("/doctor-portal/me", headers=hd).json()
    assert me["doctor_id"] == "DPT0001A" and me["patients"] >= 1
    r = c.patch("/doctor-portal/me", headers=hd, json={"hospital": "Korle Bu Teaching Hospital", "email": "a@clinic.org"})
    assert r.status_code == 200 and r.json()["hospital"] == "Korle Bu Teaching Hospital"
    assert c.patch("/doctor-portal/me", headers=hd, json={"full_name": " "}).status_code == 422
    assert c.patch("/doctor-portal/me", headers=hd, json={"email": "nope"}).status_code == 422
    assert c.get("/doctor-portal/me").status_code in (401, 403)
    bad = c.post("/doctor-portal/me/password", headers=hd, json={"current_password": "wrong", "new_password": "Another1pass"})
    assert bad.status_code == 400
    assert c.post("/doctor-portal/me/password", headers=hd, json={"current_password": "Passw0rd!x1", "new_password": "onlyletters"}).status_code == 422
    ok = c.post("/doctor-portal/me/password", headers=hd, json={"current_password": "Passw0rd!x1", "new_password": "Another1pass"})
    assert ok.status_code == 200
    assert login(c, password="Passw0rd!x1")[0].status_code == 401
    r2, h2 = login(c, password="Another1pass")
    assert r2.status_code == 200
    c.post("/doctor-portal/me/password", headers=h2, json={"current_password": "Another1pass", "new_password": "Passw0rd!x1"})   # put it back for other tests


def test_call_on_two_devices_of_the_same_doctor(env):
    """The same doctor signed in on a laptop and a phone: both ring, the one that answers gets the audio signalling, the other is told to stop."""
    c = env["client"]
    dtok, ptok, _ = _tokens(env)
    pid = env["pat"]
    with c.websocket_connect("/ws") as pws, c.websocket_connect("/ws") as laptop, c.websocket_connect("/ws") as phone:
        _auth(pws, ptok); dkey = _auth(laptop, dtok)["user_id"]; _auth(phone, dtok)

        def drain_until(ws, kind):
            for _ in range(12):
                m = ws.receive_json()
                if m["type"] == kind:
                    return m
            raise AssertionError(kind)

        pws.send_json({"type": "call.invite", "to": dkey, "call_id": "m1", "media": "audio"})
        drain_until(laptop, "call.invite"); drain_until(phone, "call.invite")             # both devices ring
        phone.send_json({"type": "call.accept", "to": pid, "call_id": "m1"})
        assert drain_until(pws, "call.accept")["call_id"] == "m1"
        assert drain_until(laptop, "call.handled")["reason"] == "answered_elsewhere"      # the laptop stops ringing
        pws.send_json({"type": "call.signal", "to": dkey, "call_id": "m1", "data": {"type": "offer", "sdp": "v=0"}})
        assert drain_until(phone, "call.signal")["data"]["type"] == "offer"               # only the answering device gets the audio signalling
        laptop.send_json({"type": "ping"})
        assert drain_until(laptop, "pong")["type"] == "pong"                              # and nothing else was queued for the laptop
        phone.send_json({"type": "call.end", "to": pid, "call_id": "m1"})
        assert drain_until(pws, "call.end")["call_id"] == "m1"
