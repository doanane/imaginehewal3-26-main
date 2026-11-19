"""Workplace heat safety, family-member entries and the primary-care summary. Offline."""
import os
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def test_workplace_flow_join_readings_alert_and_privacy(env):
    c, hp, hc = env["client"], env["hp"], env["hc"]
    _, hd = login(c)
    w = c.post("/doctor-portal/workplaces", headers=hd, json={"name": "Port Terminal", "region": "ae"})
    assert w.status_code == 200, w.text
    wid, code, key = w.json()["id"], w.json()["join_code"], w.json()["site_key"]
    assert w.json()["level"] is None and w.json()["latest"] is None                      # nothing is invented before a reading
    assert c.post("/doctor-portal/workplaces", headers=hd, json={"name": "X", "region": "mars"}).status_code == 422

    # staff join with the code (a wrong code is refused) and see no conditions until a reading exists
    assert c.post("/workplace/join", headers=hp, json={"code": "WRONG1"}).status_code == 404
    j = c.post("/workplace/join", headers=hp, json={"code": code.lower()})
    assert j.status_code == 200 and j.json()["level"] is None and j.json()["advice"] is None
    assert c.post("/workplace/join", headers=hp, json={"code": code}).status_code == 200   # joining twice does not duplicate
    # the employer-side card hides the head count while fewer than 5 people joined
    card = c.get("/doctor-portal/workplaces", headers=hd).json()["workplaces"][0]
    assert card["members"] is None and card["members_hidden"] is True

    # a manual reading: validated, and it sets the level
    assert c.post(f"/doctor-portal/workplaces/{wid}/readings", headers=hd, json={"temp_c": 99, "humidity_pct": 50}).status_code == 422
    r = c.post(f"/doctor-portal/workplaces/{wid}/readings", headers=hd, json={"temp_c": 44, "humidity_pct": 55, "note": "Yard, 2pm"})
    assert r.status_code == 200 and r.json()["level"] in ("danger", "extreme_danger")
    # staff were told, once
    from app.database import SessionLocal
    from app.models.notification import Notification
    db = SessionLocal()
    try:
        n1 = db.query(Notification).filter(Notification.user_id == env["pat"], Notification.title == "Heat alert at Port Terminal").count()
    finally:
        db.close()
    assert n1 == 1
    c.post(f"/doctor-portal/workplaces/{wid}/readings", headers=hd, json={"temp_c": 44.5, "humidity_pct": 55})      # same level: no second alert
    db = SessionLocal()
    try:
        assert db.query(Notification).filter(Notification.user_id == env["pat"], Notification.title == "Heat alert at Port Terminal").count() == 1
    finally:
        db.close()

    # the staff member sees advice for their own health (hypertension raises it), and the history lists both readings
    mine = c.get("/workplace", headers=hp).json()["workplaces"][0]
    assert mine["advice"]["level"] in ("danger", "extreme_danger") and mine["advice"]["do"]
    assert len(c.get(f"/doctor-portal/workplaces/{wid}/readings", headers=hd).json()["readings"]) == 2

    # a sensor posts with the site key; a wrong key is refused
    assert c.post("/workplace/ingest", headers={"X-Site-Key": "nope"}, json={"temp_c": 30, "humidity_pct": 40}).status_code == 401
    s = c.post("/workplace/ingest", headers={"X-Site-Key": key}, json={"temp_c": 30, "humidity_pct": 40})
    assert s.status_code == 200
    assert c.get("/doctor-portal/workplaces", headers=hd).json()["workplaces"][0]["latest"]["source"] == "sensor"

    # another doctor cannot see or change it; rotating the key stops the old one; leaving removes the person
    _, hd2 = login(c, "DPT0001B")
    assert c.get("/doctor-portal/workplaces", headers=hd2).json()["workplaces"] == []
    assert c.post(f"/doctor-portal/workplaces/{wid}/readings", headers=hd2, json={"temp_c": 30, "humidity_pct": 40}).status_code == 404
    new = c.post(f"/doctor-portal/workplaces/{wid}/rotate", headers=hd).json()
    assert c.post("/workplace/ingest", headers={"X-Site-Key": key}, json={"temp_c": 30, "humidity_pct": 40}).status_code == 401
    assert c.post("/workplace/ingest", headers={"X-Site-Key": new["site_key"]}, json={"temp_c": 30, "humidity_pct": 40}).status_code == 200
    assert c.delete(f"/workplace/{wid}", headers=hc).status_code == 404                 # not a member
    assert c.delete(f"/workplace/{wid}", headers=hp).status_code == 200
    assert c.get("/workplace", headers=hp).json()["workplaces"] == []
    assert c.delete(f"/doctor-portal/workplaces/{wid}", headers=hd).status_code == 200


def test_stale_reading_shows_no_level(env):
    c = env["client"]
    _, hd = login(c)
    wid = c.post("/doctor-portal/workplaces", headers=hd, json={"name": "Old site", "region": "gh"}).json()["id"]
    from app.database import SessionLocal
    from app.models.workplace import SiteReading
    db = SessionLocal()
    try:
        db.add(SiteReading(workplace_id=wid, temp_c=40, humidity_pct=50, source="manual", recorded_at=datetime.now(timezone.utc) - timedelta(hours=20)))
        db.commit()
    finally:
        db.close()
    card = c.get("/doctor-portal/workplaces", headers=hd).json()["workplaces"]
    mine = [x for x in card if x["id"] == wid][0]
    assert mine["latest"] is not None and mine["level"] is None                           # an old reading is not "now"
    c.delete(f"/doctor-portal/workplaces/{wid}", headers=hd)


def test_family_member_entries_are_private(env):
    c, hp, hc = env["client"], env["hp"], env["hc"]
    d = c.post("/records/dependents", headers=hp, json={"name": "Esi", "relationship": "child", "birth_date": "2021-01-02"}).json()
    did = d["id"]
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    ok = c.post(f"/records/dependents/{did}/entries", headers=hp, json={"kind": "vaccine", "title": "Measles", "detail": "Dose 1", "on_date": "2022-02-01"})
    assert ok.status_code == 200
    assert c.post(f"/records/dependents/{did}/entries", headers=hp, json={"kind": "vaccine", "title": "Future", "on_date": tomorrow}).status_code == 422
    assert c.post(f"/records/dependents/{did}/entries", headers=hp, json={"kind": "visit", "title": "Check-up booked", "on_date": tomorrow}).status_code == 200
    assert c.post(f"/records/dependents/{did}/entries", headers=hp, json={"kind": "dream", "title": "X", "on_date": "2022-02-01"}).status_code == 422
    assert [e["title"] for e in c.get(f"/records/dependents/{did}/entries", headers=hp).json()["entries"]][0] == "Check-up booked"
    # nobody else can read, add to or delete them
    assert c.get(f"/records/dependents/{did}/entries", headers=hc).status_code == 404
    assert c.post(f"/records/dependents/{did}/entries", headers=hc, json={"kind": "result", "title": "X", "on_date": "2022-02-01"}).status_code == 404
    assert c.delete(f"/records/dependents/{did}/entries/{ok.json()['id']}", headers=hc).status_code == 404
    assert c.delete(f"/records/dependents/{did}/entries/{ok.json()['id']}", headers=hp).status_code == 200
    # removing the person removes the entries with them
    assert c.delete(f"/records/dependents/{did}", headers=hp).status_code == 200
    assert c.get(f"/records/dependents/{did}/entries", headers=hp).status_code == 404


def test_primary_care_summary(env):
    c, hp = env["client"], env["hp"]
    _, hd = login(c)
    pc = c.get("/records/primary-care", headers=hp).json()
    assert pc["doctor"]["doctor_id"] == "DPT0001A" and pc["next_appointment"] is None
    when = (datetime.now(timezone.utc) + timedelta(days=3)).replace(microsecond=0).isoformat()
    a = c.post("/my-doctor/appointments", headers=hp, json={"starts_at": when, "duration_min": 30, "mode": "in_person", "reason": "Review"}).json()
    assert c.get("/records/primary-care", headers=hp).json()["pending_requests"] >= 1
    c.patch(f"/doctor-portal/appointments/{a['id']}", headers=hd, json={"status": "confirmed"})
    nxt = c.get("/records/primary-care", headers=hp).json()["next_appointment"]
    assert nxt and nxt["reason"] == "Review"
    # a person with no doctor gets an honest empty answer
    assert c.get("/records/primary-care", headers=env["hc"]).json()["doctor"] is None
