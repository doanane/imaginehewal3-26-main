"""The doctor's clinic workflow: today's workspace, schedule and hours, conversations, consultations, documents and the prescribing prompts. Offline."""
import os
import re
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env, login  # noqa: F401,E402


def at(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).replace(microsecond=0).isoformat()


def noon_offset() -> int:
    """A browser time-zone offset that puts 'now' at 12:00 local, so an appointment ten minutes ahead is always on the same local day."""
    n = datetime.now(timezone.utc)
    return n.hour * 60 + n.minute - 720


def test_patient_with_a_new_medicine_shows_no_adherence_figure_instead_of_zero(env):
    c = env["client"]
    _, hd = login(c)
    assert c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions", headers=hd, json={"name": "Amlodipine", "dose": "5 mg", "times": ["08:00", "20:00"]}).status_code == 200
    detail = c.get(f"/doctor-portal/patients/{env['pat']}", headers=hd).json()
    assert detail["patient"]["adherence"] is None                                 # prescribed a moment ago: nothing was due, so no 0%
    cohort = c.get("/doctor-portal/cohort", headers=hd).json()
    assert cohort["adherence"]["mean"] is None and cohort["adherence"]["measured"] == 0
    stats = c.get(f"/doctor-portal/patients/{env['pat']}/analytics?days=7", headers=hd).json()
    assert stats["medication"]["adherence_pct"] is None and stats["medication"]["due"] == 0


def test_today_workspace_lists_the_day_the_next_patient_and_the_counts(env):
    c = env["client"]
    _, hd = login(c)
    booked = c.post(f"/doctor-portal/patients/{env['pat']}/appointments", headers=hd, json={"starts_at": at(0.2), "duration_min": 20, "mode": "video", "reason": "Pressure review"})
    assert booked.status_code == 200, booked.text
    asked = c.post("/my-doctor/appointments", headers=env["hp"], json={"starts_at": at(30), "reason": "Headaches"})
    assert asked.status_code == 200
    t = c.get(f"/doctor-portal/today?offset={noon_offset()}", headers=hd).json()
    mine = [a for a in t["appointments"] if a["id"] == booked.json()["id"]]
    assert len(mine) == 1 and mine[0]["patient"] == "Ama Test" and mine[0]["group"] and mine[0]["reason"] == "Pressure review" and mine[0]["consultation"] is None
    assert t["next_up"]["id"] == booked.json()["id"]
    assert t["counts"]["waiting_requests"] >= 1 and t["counts"]["today"] >= 1 and t["hours"]["start"] == "08:00"
    _, hb = login(c, "DPT0001B")
    other = c.get(f"/doctor-portal/today?offset={noon_offset()}", headers=hb).json()
    assert all(a["patient_id"] != env["pat"] for a in other["appointments"])      # another doctor's day never shows this patient


def test_schedule_and_working_hours(env):
    c = env["client"]
    _, hd = login(c)
    s = c.get(f"/doctor-portal/schedule?offset={noon_offset()}", headers=hd).json()
    assert s["days"] == 7 and date.fromisoformat(s["start"]).weekday() == 0 and s["hours"]["days"] == [0, 1, 2, 3, 4]
    assert c.get("/doctor-portal/schedule?start=nonsense", headers=hd).status_code == 422
    ok = c.put("/doctor-portal/me/availability", headers=hd, json={"days": [0, 2, 4], "start": "09:00", "end": "15:30", "slot_min": 20})
    assert ok.status_code == 200 and ok.json() == {"days": [0, 2, 4], "start": "09:00", "end": "15:30", "slot_min": 20}
    assert c.get("/doctor-portal/me/availability", headers=hd).json()["slot_min"] == 20
    for bad in ({"days": [7], "start": "09:00", "end": "15:00", "slot_min": 30}, {"days": [1, 1], "start": "09:00", "end": "15:00", "slot_min": 30},
                {"days": [1], "start": "15:00", "end": "09:00", "slot_min": 30}, {"days": [1], "start": "09:00", "end": "15:00", "slot_min": 25},
                {"days": [1], "start": "9am", "end": "15:00", "slot_min": 30}):
        assert c.put("/doctor-portal/me/availability", headers=hd, json=bad).status_code == 422, bad
    _, hb = login(c, "DPT0001B")
    assert c.get("/doctor-portal/me/availability", headers=hb).json()["slot_min"] == 30        # hours belong to one doctor


def test_conversations_list_unread_first_and_clear_when_read(env):
    c = env["client"]
    _, hd = login(c)
    assert c.post("/my-doctor/thread", headers=env["hp"], json={"message": "My pressure is 150 over 95 this morning"}).status_code == 200
    conv = c.get("/doctor-portal/conversations", headers=hd).json()
    mine = next(x for x in conv["conversations"] if x["patient_id"] == env["pat"])
    assert mine["unread"] >= 1 and mine["patient"] == "Ama Test" and "150 over 95" in mine["last"] and conv["unread_total"] >= 1
    c.post(f"/doctor-portal/patients/{env['pat']}/thread/read", headers=hd)
    after = next(x for x in c.get("/doctor-portal/conversations", headers=hd).json()["conversations"] if x["patient_id"] == env["pat"])
    assert after["unread"] == 0
    _, hb = login(c, "DPT0001B")
    assert all(x["patient_id"] != env["pat"] for x in c.get("/doctor-portal/conversations", headers=hb).json()["conversations"])


def test_reference_lists_and_prescribing_prompts(env):
    c = env["client"]
    _, hd = login(c)
    assert any(d["code"] == "I10" for d in c.get("/doctor-portal/reference/diagnoses?q=hypert", headers=hd).json()["results"])
    assert any(m["name"] == "Metformin" for m in c.get("/doctor-portal/reference/medicines?q=metf", headers=hd).json()["results"])
    c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions", headers=hd, json={"name": "Lisinopril", "dose": "10 mg", "times": ["08:00"]})
    dup = c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions/check", headers=hd, json={"name": "Lisinopril"}).json()
    assert dup["known"] and any(w["level"] == "avoid" and "already prescribed" in w["text"] for w in dup["warnings"])
    arb = c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions/check", headers=hd, json={"name": "Losartan"}).json()
    assert any("ACE inhibitor and an ARB" in w["text"] for w in arb["warnings"])
    nsaid = c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions/check", headers=hd, json={"name": "Ibuprofen"}).json()
    assert any("raise blood pressure" in w["text"] for w in nsaid["warnings"])          # the profile lists hypertension
    unknown = c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions/check", headers=hd, json={"name": "Some herbal tonic"}).json()
    assert unknown["known"] is False and unknown["warnings"] == [] and "not checked" in unknown["note"]
    _, hb = login(c, "DPT0001B")
    assert c.post(f"/doctor-portal/patients/{env['pat']}/prescriptions/check", headers=hb, json={"name": "Aspirin"}).status_code == 404


def test_consultation_from_draft_to_signed_with_follow_up_and_shared_plan(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    appt = c.post(f"/doctor-portal/patients/{pid}/appointments", headers=hd, json={"starts_at": at(26), "reason": "Review"}).json()
    r = c.post(f"/doctor-portal/patients/{pid}/consultations", headers=hd, json={"appointment_id": appt["id"]})
    assert r.status_code == 200 and r.json()["status"] == "draft" and r.json()["complaint"] == "Review"
    cid = r.json()["id"]
    assert c.post(f"/doctor-portal/patients/{pid}/consultations", headers=hd, json={"appointment_id": appt["id"]}).json()["id"] == cid     # opening it again returns the same one

    assert c.post(f"/doctor-portal/consultations/{cid}/sign", headers=hd).status_code == 422                      # nothing to sign yet
    assert c.patch(f"/doctor-portal/consultations/{cid}", headers=hd, json={"clinic_vitals": {"systolic": 900}}).status_code == 422
    follow = at(24 * 14)
    ok = c.patch(f"/doctor-portal/consultations/{cid}", headers=hd, json={
        "subjective": "Headaches for two weeks", "objective": "Alert, no focal signs", "assessment": "Hypertension, not at target", "plan": "Add amlodipine, review in 2 weeks",
        "diagnoses": [{"code": "I10", "label": "Essential (primary) hypertension"}], "clinic_vitals": {"systolic": 158, "diastolic": 96, "heart_rate": 80, "weight": 82.5},
        "follow_up_at": follow, "share_plan": True})
    assert ok.status_code == 200, ok.text
    assert ok.json()["clinic_vitals"] == {"systolic": 158, "diastolic": 96, "heart_rate": 80, "weight": 82.5} and ok.json()["diagnoses"][0]["code"] == "I10"

    signed = c.post(f"/doctor-portal/consultations/{cid}/sign", headers=hd)
    assert signed.status_code == 200 and signed.json()["status"] == "signed" and signed.json()["signed_at"]
    done = next(a for a in c.get("/doctor-portal/appointments?scope=past", headers=hd).json()["appointments"] if a["id"] == appt["id"])
    assert done["status"] == "completed"                                                                         # the visit is marked done even though it was booked ahead
    mine = c.get("/my-doctor/appointments", headers=env["hp"]).json()["appointments"]
    assert any(a["reason"] == "Follow-up" and a["status"] == "confirmed" for a in mine)                          # the follow-up is booked for the patient
    notes = c.get("/my-doctor/notes", headers=env["hp"]).json()["notes"]
    assert any("Hypertension" in n["text"] or "hypertension" in n["text"] for n in notes) and any("Plan: Add amlodipine" in n["text"] for n in notes)

    assert c.patch(f"/doctor-portal/consultations/{cid}", headers=hd, json={"plan": "changed"}).status_code == 409   # locked
    assert c.delete(f"/doctor-portal/consultations/{cid}", headers=hd).status_code == 409
    add = c.post(f"/doctor-portal/consultations/{cid}/addendum", headers=hd, json={"text": "Result of fasting glucose: 5.6 mmol/L"})
    assert add.status_code == 200 and add.json()["addenda"][0]["text"].startswith("Result") and add.json()["plan"] == "Add amlodipine, review in 2 weeks"
    assert len(c.get(f"/doctor-portal/patients/{pid}/consultations", headers=hd).json()["consultations"]) >= 1

    _, hb = login(c, "DPT0001B")
    assert c.get(f"/doctor-portal/consultations/{cid}", headers=hb).status_code == 404
    assert c.get(f"/doctor-portal/consultations/{cid}", headers=env["hp"]).status_code in (401, 403)             # a patient cannot read a consultation note


def test_a_draft_can_be_deleted_and_an_empty_one_is_not_a_duplicate(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    a = c.post(f"/doctor-portal/patients/{pid}/consultations", headers=hd, json={}).json()
    assert c.post(f"/doctor-portal/patients/{pid}/consultations", headers=hd, json={}).json()["id"] == a["id"]     # one open draft per patient
    assert c.delete(f"/doctor-portal/consultations/{a['id']}", headers=hd).status_code == 200
    assert c.get(f"/doctor-portal/consultations/{a['id']}", headers=hd).status_code == 404


def test_documents_are_issued_checkable_by_anyone_and_can_be_withdrawn(env):
    c = env["client"]
    _, hd = login(c)
    pid = env["pat"]
    ref = c.post(f"/doctor-portal/patients/{pid}/documents", headers=hd, json={"kind": "referral", "body": {
        "to": "Dr Mensah, Cardiology, Korle Bu", "specialty": "Cardiology", "urgency": "urgent", "reason": "Resistant hypertension on three drugs"}})
    assert ref.status_code == 200, ref.text
    d = ref.json()
    assert re.fullmatch(r"HW-\d\d-[A-Z2-9]{6}", d["ref"]) and d["title"] == "Referral letter" and d["doctor"]["name"] == "Dr DPT0001A" and d["patient"] == "Ama Test"

    sick = c.post(f"/doctor-portal/patients/{pid}/documents", headers=hd, json={"kind": "sick_note", "body": {
        "from_date": "2026-11-16", "to_date": "2026-11-18", "show_diagnosis": False, "diagnosis": "Hypertension", "note": "Rest advised"}}).json()
    assert sick["body"]["days"] == 3
    for bad in ({"kind": "sick_note", "body": {"from_date": "2026-11-18", "to_date": "2026-11-16"}}, {"kind": "sick_note", "body": {"from_date": "x", "to_date": "y"}},
                {"kind": "referral", "body": {"to": "", "reason": "x"}}, {"kind": "referral", "body": {"to": "A", "reason": "B", "urgency": "whenever"}},
                {"kind": "prescription", "body": {}}, {"kind": "letter", "body": {"text": "x" * 4000}}):
        assert c.post(f"/doctor-portal/patients/{pid}/documents", headers=hd, json=bad).status_code == 422, bad

    public = c.get(f"/verify/document/{d['ref']}")                                                     # no sign-in: anyone with the paper can check it
    assert public.status_code == 200 and public.json()["valid"] is True and public.json()["doctor"] == "Dr DPT0001A" and public.json()["kind"] == "Referral letter"
    assert "Ama" not in public.text and "Cardiology" not in public.text and "hypertension" not in public.text.lower()      # never the patient or the contents
    assert c.get("/verify/document/HW-26-AAAAAA").json()["valid"] is False

    listed = c.get("/doctor-portal/documents", headers=hd).json()["documents"]
    assert {x["ref"] for x in listed} >= {d["ref"], sick["ref"]} and c.get(f"/doctor-portal/patients/{pid}/documents", headers=hd).json()["documents"]
    got = c.get(f"/doctor-portal/documents/{d['id']}", headers=hd).json()
    assert got["patient_info"]["age"] == 61 and got["body"]["urgency"] == "urgent"

    _, hb = login(c, "DPT0001B")
    assert c.get(f"/doctor-portal/documents/{d['id']}", headers=hb).status_code == 404
    assert c.post(f"/doctor-portal/documents/{d['id']}/revoke", headers=hb).status_code == 404
    assert c.post(f"/doctor-portal/documents/{d['id']}/revoke", headers=hd).status_code == 200
    again = c.get(f"/verify/document/{d['ref']}").json()
    assert again["valid"] is False and again["revoked"] is True and "withdrawn" in again["reason"]
