"""The care agent: the visible loop (sense, decide, act, hand off, measure), the story, consent and the doctor's review queue. Offline."""
import os
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from app.services import behavior_engine as eng
from app.services import care_agent as ca
from app.services import gulf
from app.services import reengagement as rg
from test_doctor_portal import env, login  # noqa: F401,E402


def _inp(**kw):
    now = datetime(2026, 9, 15, 7, 30, tzinfo=timezone.utc)            # Tuesday 11:30 in Abu Dhabi
    today = now.date()
    start = today - timedelta(days=21)
    base = {"now": now, "today": today, "name": "Test", "age": 47, "segment": "sedentary", "region": "ae", "respect_prayer": True, "lang": "en",
            "conditions": [], "behavior": "breaks", "level": 3, "baseline": 1, "goal": 8, "start_date": start,
            "day_status": {start + timedelta(days=i): "done" for i in range(0, 17)},      # then four quiet days
            "settings": SimpleNamespace(notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7),
            "recent": [], "has_supporter": False, "usual_hour": None, "doctor": None, "bp": None, "bp_crisis": False, "sos_active": False}
    base.update(kw)
    return base


# ------------------------------------------------------------------ the loop
def test_a_lapse_is_noticed_and_answered_with_one_fitted_message_and_a_smaller_step():
    t = ca.trace(_inp())
    assert t["state"] == "lapse" and t["missed_days"] == 4
    assert t["decide"]["send"]["send"] and t["decide"]["send"]["channel"] == "push"
    assert t["act"]["status"] == "send" and t["act"]["message"] == eng.msg("nudge_1")
    plan = t["decide"]["plan"]
    assert plan["smaller"] and plan["next_step"] < plan["usual_step"]
    assert [s["code"] for s in t["sense"]][:2] == ["quiet_days", "week"]
    assert all(s["source"] for s in t["sense"])                          # every signal says where it came from
    assert not t["handoff"]["needed"] and "No clinician is needed" in t["handoff"]["note"]
    assert t["decide"]["method"].startswith("Written rules")


def test_nothing_is_sent_to_someone_who_is_on_track():
    start = date(2026, 9, 15) - timedelta(days=21)
    t = ca.trace(_inp(day_status={start + timedelta(days=i): "done" for i in range(0, 21)}))
    assert t["state"] == "ok" and t["act"]["status"] == "nothing_to_do" and t["act"]["message"] is None


def test_it_waits_at_prayer_time_and_says_why():
    d = date(2026, 9, 15)
    dhuhr = gulf.prayer_times(d, "ae")["dhuhr"]                           # hours, local
    now = datetime(2026, 9, 15, 0, 0, tzinfo=timezone.utc) + timedelta(hours=dhuhr - 4)      # exactly at prayer, UTC+4
    t = ca.trace(_inp(now=now, usual_hour=None))
    assert not t["decide"]["send"]["send"] and t["act"]["status"] == "waiting"
    assert any("prayer" in r["text"] for r in t["decide"]["reasons"])
    off = ca.trace(_inp(respect_prayer=False, now=now))
    assert off["decide"]["send"]["send"]                                  # the person's own switch decides


def test_it_respects_an_outreach_off_switch():
    s = SimpleNamespace(notifications_enabled=False, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7)
    t = ca.trace(_inp(settings=s))
    assert not t["decide"]["send"]["send"] and "turned outreach off" in t["decide"]["send"]["reason"]


def test_a_very_high_reading_holds_the_step_and_asks_a_clinician_whatever_the_habit_says():
    t = ca.trace(_inp(bp=(186, 124), bp_crisis=True, conditions=["Hypertension"], segment="chronic", doctor="Dr Test"))
    assert t["decide"]["safety"]["hold_level"] and any(r["code"] == "safety_hold" for r in t["decide"]["reasons"])
    assert t["handoff"]["needed"] and t["handoff"]["to"] == "Dr Test" and t["handoff"]["reasons"][0]["code"] == "safety"


def test_a_long_silence_reaches_a_clinician_only_for_someone_with_a_condition():
    start = date(2026, 9, 15) - timedelta(days=30)
    status = {start + timedelta(days=i): "done" for i in range(0, 12)}      # then 18 quiet days
    with_condition = ca.trace(_inp(day_status=status, start_date=start, conditions=["Diabetes"], segment="chronic"))
    without = ca.trace(_inp(day_status=status, start_date=start))
    assert with_condition["handoff"]["needed"] and with_condition["handoff"]["reasons"][0]["code"] == "silent_condition"
    assert not without["handoff"]["needed"]


def test_the_languages_are_used_for_the_message():
    assert ca.trace(_inp(lang="fr"))["act"]["message"] == eng.msg("nudge_1", "fr") != eng.msg("nudge_1", "en")
    assert ca.trace(_inp(lang="ar"))["act"]["message"] == eng.msg("nudge_1", "ar")


def test_the_trace_can_be_stored_as_json():
    import json
    json.dumps(ca._jsonable(ca.trace(_inp())))


# ------------------------------------------------------------------ the story
def test_the_story_runs_the_same_rules_and_is_labelled_simulated():
    st = ca.story()
    assert "Simulated" in st["label"] and "(demo)" in st["moments"][1]["trace"]["person"]["name"]
    before, lapse, after = (m["trace"] for m in st["moments"])
    assert before["state"] == "ok" and lapse["state"] == "lapse" and lapse["decide"]["send"]["send"]
    assert after["missed_days"] == 0 and after["act"]["status"] == "nothing_to_do"            # back, and the agent goes quiet again
    assert [b["id"] for b in st["beats"]] == ["problem", "user", "solution", "outcome"]
    assert st["without_agent"]["text"] and st["safeguards"]
    safety = ca.story("safety")["moments"][1]["trace"]
    assert safety["handoff"]["needed"] and safety["decide"]["safety"]["hold_level"]


def test_the_story_is_public(env):
    c = env["client"]
    r = c.get("/agent/story")
    assert r.status_code == 200 and r.json()["scenario"] == "lapse"
    assert c.get("/agent/story?scenario=safety").json()["scenario"] == "safety"
    assert c.get("/agent/story?scenario=nope").status_code == 422


# ------------------------------------------------------------------ the person's and the doctor's views
def test_patient_loop_one_tap_answers_and_consented_doctor_queue(env):
    c, hp = env["client"], env["hp"]
    assert c.get("/agent/loop").status_code in (401, 403)
    assert c.get("/agent/loop", headers=hp).json()["has_plan"] is False
    assert c.post("/behavior/plans", headers=hp, json={"behavior": "movement"}).status_code in (200, 201)
    loop = c.get("/agent/loop", headers=hp).json()
    assert loop["has_plan"] and loop["state"] in ("ok", "lapse", "declining") and loop["if_wrong"] and loop["decide"]["method"]
    # one-tap answers act at once
    assert c.post("/agent/act", headers=hp, json={"action": "bogus"}).status_code == 422
    assert c.post("/agent/act", headers=hp, json={"action": "not_helpful"}).json()["ok"]
    assert c.get("/behavior/settings", headers=hp).json()["reengage_channel"] == "in_app"
    assert c.post("/agent/act", headers=hp, json={"action": "stop_messages"}).json()["ok"]
    assert c.get("/behavior/settings", headers=hp).json()["reengage_channel"] == "none"

    # a hand-off saved for this patient (61, hypertension, silent 20 days)
    from app.database import SessionLocal
    from app.models.behavior import AgentRun, BehaviorNudge
    from app.models.user import User
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == env["pat"]).first()
        inp = ca.gather(db, user)
        inp["day_status"] = {}
        inp["start_date"] = inp["today"] - timedelta(days=30)
        run = ca.record(db, user, inp, "review")
        assert run.handoff_needed and run.review_status == "pending"
        assert ca.record(db, user, inp, "review").id == run.id               # one open hand-off per gap, never a flood
        run_id = run.id
    finally:
        db.close()

    r, hd = login(c)
    assert c.get("/doctor-portal/agent/queue", headers=hd).json()["pending"] == []               # not shared: a habit-only hand-off is hidden
    assert c.get(f"/doctor-portal/patients/{env['pat']}/agent", headers=hd).json()["shared"] is False
    assert c.put("/behavior/settings", headers=env["hp"], json={"share_with_doctor": True}).status_code == 200
    q = c.get("/doctor-portal/agent/queue", headers=hd).json()["pending"]
    assert len(q) == 1 and q[0]["patient"] == "Ama Test" and q[0]["shared"] and q[0]["trace"]["handoff"]["reasons"][0]["code"] == "silent_condition"
    live = c.get(f"/doctor-portal/patients/{env['pat']}/agent", headers=hd).json()
    assert live["shared"] and live["sense"]

    # only this patient's own doctor may review
    _, other = login(c, "DPT0001B")
    assert c.post(f"/doctor-portal/agent/runs/{run_id}/review", headers=other, json={"decision": "approve"}).status_code == 404
    assert c.post(f"/doctor-portal/agent/runs/{run_id}/review", headers=hd, json={"decision": "bogus"}).status_code == 422
    ok = c.post(f"/doctor-portal/agent/runs/{run_id}/review", headers=hd, json={"decision": "override", "note": "I will call them", "message": "Hello, how are you finding things?"})
    assert ok.status_code == 200 and ok.json()["review_status"] == "overridden"
    d = c.get("/doctor-portal/agent/queue", headers=hd).json()
    assert d["pending"] == [] and d["reviewed"][0]["review_status"] == "overridden" and d["reviewed"][0]["review_note"] == "I will call them"
    assert any("how are you" in m["content"] for m in c.get(f"/doctor-portal/patients/{env['pat']}/thread", headers=hd).json()["messages"])

    # a check-in within 48 hours marks the message as having worked
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        n = BehaviorNudge(user_id=env["pat"], plan_id=inp["plan_id"], kind="reengage_1", channel="push", lapse_start=now.date() - timedelta(days=4), sent_at=now - timedelta(hours=5))
        db.add(n)
        db.add(AgentRun(user_id=env["pat"], plan_id=inp["plan_id"], kind="nudge", trace={}, created_at=now - timedelta(hours=5)))
        db.commit()
        assert rg.mark_responses(db, env["pat"], inp["plan_id"], now) >= 1
        assert db.query(AgentRun).filter(AgentRun.user_id == env["pat"], AgentRun.kind == "nudge", AgentRun.returned == True).count() >= 1  # noqa: E712
    finally:
        db.close()
    c.delete("/behavior/my-data", headers=hp)
    db = SessionLocal()
    try:
        assert db.query(AgentRun).filter(AgentRun.user_id == env["pat"]).count() == 0            # erase removes the agent's notes too
    finally:
        db.close()


def test_the_guest_doctor_sees_a_simulated_handoff_and_the_guest_patient_has_a_live_loop(env):
    c = env["client"]
    gd = c.post("/auth/guest", json={"role": "doctor"}).json()
    hd = {"Authorization": "Bearer " + gd["access_token"]}
    gp = c.post("/auth/guest", json={"role": "patient"}).json()
    hp = {"Authorization": "Bearer " + gp["access_token"]}
    q = c.get("/doctor-portal/agent/queue", headers=hd).json()["pending"]
    assert q and q[0]["trace"]["simulated"] and "(demo)" in q[0]["patient"] and q[0]["trace"]["handoff"]["reasons"][0]["code"] == "safety"
    loop = c.get("/agent/loop", headers=hp).json()
    assert loop["has_plan"] and loop["state"] == "lapse" and loop["missed_days"] == 4 and not loop["handoff"]["needed"]
