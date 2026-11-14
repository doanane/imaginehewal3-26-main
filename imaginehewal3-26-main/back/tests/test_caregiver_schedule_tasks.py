"""Caregiver appointments and tasks, saved and read back. These crashed with 500 (`'str' object has no attribute 'value'`) because the
status, priority and type columns are strings once a row is reloaded. Offline."""
import os
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env  # noqa: F401,E402


def iso(hours):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).replace(microsecond=0).isoformat()


def test_caregiver_appointment_roundtrip(env):
    c, h, pid = env["client"], env["hc"], env["pat"]
    r = c.post("/caregiver/schedule/", headers=h, json={"patient_id": pid, "title": "Blood pressure visit", "appointment_type": "checkup",
                                                        "start_time": iso(3), "end_time": iso(3.5), "location": "At home"})
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["appointment_type"] == "checkup" and a["status"] == "scheduled" and a["patient_id"] == pid

    listed = c.get("/caregiver/schedule/", headers=h)
    assert listed.status_code == 200, listed.text
    assert any(x["id"] == a["id"] and x["status"] == "scheduled" for x in listed.json())
    assert c.get("/caregiver/schedule/upcoming", headers=h).status_code == 200
    assert c.get("/caregiver/schedule/today", headers=h).status_code == 200

    done = c.post(f"/caregiver/schedule/{a['id']}/complete", headers=h)
    assert done.status_code == 200, done.text
    other = c.post("/caregiver/schedule/", headers=h, json={"patient_id": pid, "title": "Therapy", "appointment_type": "therapy",
                                                            "start_time": iso(30), "end_time": iso(31)}).json()
    cancelled = c.post(f"/caregiver/schedule/{other['id']}/cancel", headers=h)
    assert cancelled.status_code == 200, cancelled.text


def test_caregiver_cannot_schedule_for_a_stranger(env):
    c = env["client"]
    r = c.post("/caregiver/schedule/", headers=env["hc"], json={"patient_id": env["other"], "title": "x", "appointment_type": "checkup",
                                                                "start_time": iso(3), "end_time": iso(4)})
    assert r.status_code == 403
    assert c.post("/caregiver/schedule/", headers=env["hp"], json={"patient_id": env["pat"], "title": "x", "appointment_type": "checkup",
                                                                   "start_time": iso(3), "end_time": iso(4)}).status_code == 403   # a patient is not a caregiver


def test_caregiver_task_roundtrip(env):
    c, h, pid = env["client"], env["hc"], env["pat"]
    r = c.post("/caregiver/tasks", headers=h, json={"patient_id": pid, "title": "Check pressure", "task_type": "checkup", "priority": "high",
                                                    "due_date": iso(-2)})
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["priority"] == "high" and t["status"] == "pending"

    assert any(x["id"] == t["id"] for x in c.get("/caregiver/tasks", headers=h).json())
    assert c.get("/caregiver/tasks/overdue", headers=h).status_code == 200
    assert c.get("/caregiver/tasks/today", headers=h).status_code == 200
    upd = c.put(f"/caregiver/tasks/{t['id']}", headers=h, json={"priority": "low"})
    assert upd.status_code == 200, upd.text
    done = c.post(f"/caregiver/tasks/{t['id']}/complete", headers=h)
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"


def test_caregiver_dashboard_and_analytics_read_saved_rows(env):
    c, h = env["client"], env["hc"]
    d = c.get("/caregivers/dashboard", headers=h)
    assert d.status_code == 200, d.text
    assert "stats" in d.json()
    a = c.get(f"/caregiver/analytics/patient/{env['pat']}?period=week", headers=h)
    assert a.status_code == 200, a.text
