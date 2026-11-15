"""The adaptive behaviour loop beyond the basics: circumstances, health safety, data-inferred barriers, outreach after a gap, supporters, groups,
consent for the doctor's view, and impact measurement. Offline."""
import os
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

import pytest

from app.services import behavior_engine as eng
from app.services import reengagement as rg
from test_doctor_portal import env, login  # noqa: F401,E402

T = date(2026, 11, 20)


def days(*pairs):
    return {T - timedelta(days=ago): s for ago, s in pairs}


# ------------------------------------------------------------------ pure engine
def test_activity_behaviour_exists_for_people_who_cannot_count_steps():
    t = eng.target_for("activity", 10, 30, 1)
    assert 10 < t < 30 and eng.BEHAVIORS["activity"]["unit"] == "active minutes"
    a = eng.build_action("activity", 10, 30, 2, T)
    assert "minutes" in a["title"] and "Limits:" in a["rationale"]


def test_circumstances_change_wording_not_the_size_of_the_step():
    base = eng.build_action("movement", 3000, 8000, 2, T, option_index=1)      # Implementation intention
    shift = eng.adapt_for_context(base, "movement", {"work_pattern": "shift", "support": "family", "mobility": "wheelchair"})
    assert "shift" in shift["detail"] and "family member" in shift["detail"] and "Be active" in shift["detail"]
    assert shift["target_value"] == base["target_value"]
    simple = eng.adapt_for_context(base, "movement", {"literacy": "simple"})
    assert len(simple["detail"]) < len(base["detail"]) + 5 and simple["detail"].count(". ") == 0
    why = eng.adapt_for_context(eng.build_action("movement", 3000, 8000, 2, T, comeback=True), "movement", {"motivation_text": "to dance at my daughter's wedding"})
    assert "my daughter" in why["detail"]
    assert eng.adapt_for_context(base, "movement", None) == base


def test_health_safety_holds_the_step_and_explains():
    held = eng.safety_note("movement", {"bp_crisis": True})
    assert held["hold_level"] and "clinician" in held["note"]
    assert eng.safety_note("activity", {"sos_active": True})["hold_level"]
    assert not eng.safety_note("sleep", {"bp_crisis": True})["hold_level"]                  # sleep is not made harder or easier by it
    assert "diabetes" in eng.safety_note("nutrition", {"conditions": ["Type 2 diabetes"]})["note"]
    start, great = T - timedelta(days=10), days(*[(i, "done") for i in range(1, 8)])
    assert eng.suggest_level(2, great, T, start, None) == (3, "level_up")
    assert eng.suggest_level(2, great, T, start, None, hold=True) == (2, None)             # never grows while health is checked


def test_slow_pace_for_someone_only_thinking_about_change():
    start = T - timedelta(days=14)
    week = days(*[(i, "done") for i in range(1, 8)])
    assert eng.suggest_level(2, week, T, start, None, slow=True) == (2, None)              # seven good days is not yet enough
    ten = days(*[(i, "done") for i in range(1, 11)])
    assert eng.suggest_level(2, ten, T, start, None, slow=True) == (3, "level_up")


def test_the_persons_own_words_beat_inference():
    assert eng.infer_barrier_from_data("time", 4.0, True) == ("time", "self")
    assert eng.infer_barrier_from_data(None, 4.5) == ("tired", "data")
    assert eng.infer_barrier_from_data(None, 7.0) == (None, None)
    assert eng.infer_barrier_from_data(None, None, True) == ("pain_sick", "data")


def test_recommendations_turn_the_person_into_a_short_reasoned_list():
    recs = eng.recommend_behaviors({"mobility": "wheelchair"}, {"conditions": ["Hypertension"], "habits": []}, 5.0, [])
    names = [r["behavior"] for r in recs]
    assert names[0] == "activity" and "sleep" in names and len(recs) <= 3 and all(r["reason"] for r in recs)
    assert "movement" not in names
    assert eng.recommend_behaviors({}, {}, None, ["movement"]) == []                       # nothing new to suggest when it is already active
    assert [r["behavior"] for r in eng.recommend_behaviors({}, {}, None, [])] == ["movement"]


def test_outcomes_say_when_change_has_lasted():
    start = T - timedelta(days=70)
    steady = {start + timedelta(days=i): "done" for i in range(70)}
    o = eng.outcomes(steady, {}, 3000, "up", start, T)
    assert o["sustained"] is True and o["lapses"] == 0 and o["recovery_rate"] is None
    young = eng.outcomes({T - timedelta(days=i): "done" for i in range(1, 15)}, {}, 3000, "up", T - timedelta(days=14), T)
    assert young["sustained"] is None                                                    # too early to say, so it does not say
    gap = {start + timedelta(days=i): "done" for i in range(70) if not 20 <= i < 30}
    g = eng.outcomes(gap, {}, 3000, "up", start, T)
    assert g["lapses"] == 1 and g["recovery_rate"] == 1.0 and g["longest_gap_days"] == 10


# ------------------------------------------------------------------ outreach decisions
class S:
    def __init__(self, **kw):
        self.notifications_enabled, self.reengage_channel, self.max_nudges_per_week = True, "push", 2
        self.quiet_hours_start, self.quiet_hours_end = 21, 7
        self.__dict__.update(kw)


class N:
    def __init__(self, kind, channel, days_ago, responded=False, lapse=None, hours_ago=None):
        self.kind, self.channel, self.responded = kind, channel, responded
        base = datetime(2026, 11, 20, 10, 0, tzinfo=timezone.utc)
        self.sent_at = base - (timedelta(hours=hours_ago) if hours_ago is not None else timedelta(days=days_ago))
        self.lapse_start = lapse or date(2026, 11, 14)


NOW = datetime(2026, 11, 20, 10, 0, tzinfo=timezone.utc)
KW = dict(lapse_start=date(2026, 11, 14), now=NOW, has_supporter=False, usual_hour=None)


def test_gap_length_decides_the_message_and_it_stops():
    assert rg.stage_for(2) is None and rg.stage_for(3) == "reengage_1" and rg.stage_for(7) == "reengage_2" and rg.stage_for(14) == "paused"
    assert rg.decide(settings=S(), missed_days=3, recent=[], **KW)["kind"] == "reengage_1"
    assert rg.decide(settings=S(), missed_days=7, recent=[], **KW)["kind"] == "reengage_2"
    p = rg.decide(settings=S(), missed_days=15, recent=[], **KW)
    assert p["kind"] == "paused" and p["channel"] == "in_app"                           # the last note is quiet


def test_the_person_controls_whether_and_when():
    assert not rg.decide(settings=S(notifications_enabled=False), missed_days=4, recent=[], **KW)["send"]
    assert not rg.decide(settings=S(reengage_channel="none"), missed_days=4, recent=[], **KW)["send"]
    assert not rg.decide(settings=S(max_nudges_per_week=0), missed_days=4, recent=[], **KW)["send"]
    assert rg.decide(settings=S(), missed_days=4, recent=[], **{**KW, "now": NOW.replace(hour=22)})["reason"] == "quiet hours"
    assert rg.decide(settings=S(), missed_days=4, recent=[], **{**KW, "now": NOW.replace(hour=6)})["reason"] == "quiet hours"
    assert rg.decide(settings=S(), missed_days=4, recent=[], **{**KW, "now": NOW.replace(hour=7)})["send"] is False        # awake, but before the daytime window
    # once we know their usual hour we only message near it
    assert not rg.decide(settings=S(), missed_days=4, recent=[], **{**KW, "usual_hour": 17})["send"]
    assert rg.decide(settings=S(), missed_days=4, recent=[], **{**KW, "usual_hour": 10})["send"]


def test_never_more_than_one_a_day_or_the_weekly_cap_and_never_twice_for_one_gap():
    assert rg.decide(settings=S(), missed_days=8, recent=[N("reengage_1", "push", 0, hours_ago=2)], **KW)["reason"] == "one message a day at most"
    two = [N("reengage_1", "push", 1, True), N("reengage_2", "push", 3, True, lapse=date(2026, 11, 1))]
    assert rg.decide(settings=S(), missed_days=9, recent=two, **KW)["reason"] == "weekly limit reached"
    assert rg.decide(settings=S(max_nudges_per_week=7), missed_days=4, recent=[N("reengage_1", "push", 2, True)], **KW)["reason"] == "already sent for this gap"


def test_when_messages_do_not_help_we_get_quieter_then_stop():
    ignored = [N("reengage_1", "push", 5), N("reengage_2", "push", 4)]
    s = S(max_nudges_per_week=7)
    kw = {**KW, "lapse_start": date(2026, 11, 1)}
    first = rg.decide(settings=s, missed_days=4, recent=ignored, **kw)
    assert first["send"] and first["channel"] == "in_app"                               # push becomes quiet in-app
    ladder = rg.decide(settings=S(max_nudges_per_week=7, reengage_channel="in_app"), missed_days=4, recent=ignored, **{**kw, "has_supporter": True})
    assert ladder["channel"] == "supporter" and ladder["kind"] == "supporter"            # a supporter THEY chose
    stop = rg.decide(settings=S(max_nudges_per_week=7, reengage_channel="in_app"), missed_days=4, recent=ignored, **kw)
    assert not stop["send"] and "not helping" in stop["reason"]                          # and then we stop, we do not push harder


def test_the_channel_that_has_worked_for_this_person_is_preferred():
    hist = [N("reengage_1", "push", 20 + i, False, lapse=date(2026, 10, 1) + timedelta(days=i)) for i in range(3)] + \
           [N("reengage_1", "in_app", 20 + i, True, lapse=date(2026, 9, 1) + timedelta(days=i)) for i in range(3)]
    d = rg.decide(settings=S(max_nudges_per_week=7), missed_days=4, recent=hist, **KW)
    assert d["send"] and d["channel"] == "in_app"


# ------------------------------------------------------------------ API
def _db():
    from app.database import SessionLocal
    return SessionLocal()


def _clean(env_):
    from app.models.behavior import (BehaviorAction, BehaviorCheer, BehaviorContext, BehaviorNudge, BehaviorPlan, BehaviorSettings, BehaviorShare)
    from app.models.iot_device import VitalReading
    db = _db()
    ids = [env_["pat"], env_["cg"], env_["other"]]
    db.query(VitalReading).filter(VitalReading.user_id.in_(ids), VitalReading.blood_pressure_systolic >= 180).delete(synchronize_session=False)   # a very high reading stays "recent" for 24 h
    for m, col in ((BehaviorNudge, BehaviorNudge.user_id), (BehaviorAction, BehaviorAction.user_id), (BehaviorCheer, BehaviorCheer.to_id),
                   (BehaviorShare, BehaviorShare.owner_id), (BehaviorContext, BehaviorContext.user_id), (BehaviorPlan, BehaviorPlan.user_id),
                   (BehaviorSettings, BehaviorSettings.user_id)):
        db.query(m).filter(col.in_(ids)).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_context_is_validated_and_fits_the_plan_and_safety_holds_the_step(env):
    c = env["client"]
    _clean(env)
    assert c.put("/behavior/context", headers=env["hp"], json={"mobility": "flying"}).status_code == 400
    ctx = c.put("/behavior/context", headers=env["hp"], json={"mobility": "limited", "work_pattern": "shift", "readiness": 2,
                                                              "motivation_text": "my grandchildren"}).json()
    assert ctx["mobility"] == "limited" and ctx["readiness"] == 2 and "never shared" in ctx["why"]
    recs = c.get("/behavior/recommendations", headers=env["hp"]).json()["recommendations"]
    assert recs[0]["behavior"] == "activity" and recs[0]["reason"]                       # Ama has hypertension and limited mobility

    from app.models.iot_device import VitalReading
    db = _db()
    db.add(VitalReading(user_id=env["pat"], blood_pressure_systolic=190, blood_pressure_diastolic=125, timestamp=datetime.now(timezone.utc)))
    db.commit()
    db.close()
    assert c.post("/behavior/plans", headers=env["hp"], json={"behavior": "activity"}).status_code == 200
    item = c.get("/behavior/today", headers=env["hp"]).json()["items"][0]
    assert item["step_held"] is True and "very high" in item["safety_note"]
    assert "Fitted to you" in item["action"]["rationale"] and "shift" in item["action"]["detail"]


def test_chosen_sleep_data_infers_a_barrier_and_completes_the_sleep_step(env):
    c = env["client"]
    _clean(env)
    from app.models.activity import SleepSession
    db = _db()
    end = datetime.now(timezone.utc) - timedelta(hours=2)
    db.add(SleepSession(user_id=env["pat"], start=end - timedelta(hours=4, minutes=30), end=end, total_min=270, awake_min=0, light_min=0, deep_min=0, rem_min=0, source="apple_health"))
    db.commit()
    db.close()
    assert c.put("/behavior/settings", headers=env["hp"], json={"wearable_data_enabled": False}).status_code == 200
    c.post("/behavior/plans", headers=env["hp"], json={"behavior": "sleep"})
    plain = c.get("/behavior/today", headers=env["hp"]).json()["items"][0]["action"]
    assert "Fitted to you" not in plain["rationale"]                                     # data is not used without permission
    _clean(env)
    c.put("/behavior/settings", headers=env["hp"], json={"wearable_data_enabled": True})
    c.post("/behavior/plans", headers=env["hp"], json={"behavior": "sleep"})
    fitted = c.get("/behavior/today", headers=env["hp"]).json()["items"][0]["action"]
    assert "hours of sleep" in fitted["rationale"] and "lightest version" in fitted["detail"]       # 'tired' adaptation, from sleep data
    # sleep completes the sleep step from the same data (4.5 h is below the target, so it is partial, never faked as done)
    r = c.post("/behavior/sync-wearable", headers=env["hp"])
    assert r.status_code == 200, r.text
    assert r.json()["updated"][0]["behavior"] == "sleep" and r.json()["updated"][0]["action"]["status"] in ("partial", "skipped")


def test_every_kind_of_support_shows_its_reason_and_limits_and_the_switches(env):
    c = env["client"]
    _clean(env)
    a = c.get("/behavior/approaches", headers=env["hp"]).json()
    kinds = {x["kind"] for x in a["approaches"]}
    assert {"technique", "gamification", "incentive", "peer", "workplace", "outreach"} <= kinds
    assert all(x["why_it_works"] and x["limits"] and x["bct_code"] for x in a["approaches"])
    assert any("insurers" in x["limits"] for x in a["approaches"]) and any("employers" in line for line in a["commitments"])
    on = {x["id"]: x["enabled"] for x in a["approaches"]}
    assert on["gamification"] is True
    c.put("/behavior/settings", headers=env["hp"], json={"gamification_enabled": False, "reengage_channel": "none"})
    off = {x["id"]: x["enabled"] for x in c.get("/behavior/approaches", headers=env["hp"]).json()["approaches"]}
    assert off["gamification"] is False and off["reminders"] is False
    assert c.put("/behavior/settings", headers=env["hp"], json={"reengage_channel": "carrier-pigeon"}).status_code == 400
    c.put("/behavior/settings", headers=env["hp"], json={"gamification_enabled": True, "reengage_channel": "push"})


def test_a_supporter_the_person_chose_can_cheer_and_sees_only_what_was_shared(env):
    c = env["client"]
    _clean(env)
    plan = c.post("/behavior/plans", headers=env["hp"], json={"behavior": "movement"}).json()
    assert [x["id"] for x in c.get("/behavior/supporters", headers=env["hp"]).json()["eligible"]] == [env["cg"]]
    # only an approved caregiver can be chosen; a stranger cannot
    assert c.post("/behavior/shares", headers=env["hp"], json={"plan_id": plan["id"], "supporter_id": env["other"]}).status_code == 403
    assert c.post("/behavior/shares", headers=env["hc"], json={"plan_id": plan["id"], "supporter_id": env["cg"]}).status_code == 404   # not their plan
    share = c.post("/behavior/shares", headers=env["hp"], json={"plan_id": plan["id"], "supporter_id": env["cg"], "level": "cheers"}).json()

    seen = c.get("/behavior/supporting", headers=env["hc"]).json()["people"]
    assert len(seen) == 1 and seen[0]["could_use_encouragement"] in (False, True) and "active_days_last_7" not in seen[0]
    assert not any(k in seen[0] for k in ("value", "values", "steps", "heart_rate", "blood_pressure", "target_value"))
    c.post("/behavior/shares", headers=env["hp"], json={"plan_id": plan["id"], "supporter_id": env["cg"], "level": "progress"})
    assert "active_days_last_7" in c.get("/behavior/supporting", headers=env["hc"]).json()["people"][0]

    assert c.post("/behavior/cheers", headers=env["hc"], json={"to_user_id": env["pat"], "kind": "free text pressure"}).status_code == 400
    ok = c.post("/behavior/cheers", headers=env["hc"], json={"to_user_id": env["pat"], "kind": "proud"})
    assert ok.status_code == 200 and "proud" in ok.json()["message"]
    assert c.post("/behavior/cheers", headers=env["hc"], json={"to_user_id": env["pat"], "kind": "keep_going"}).status_code == 429   # once a day
    assert any("proud" in x["text"] for x in c.get("/behavior/cheers", headers=env["hp"]).json()["cheers"])
    assert c.post("/behavior/cheers", headers=env["hp"], json={"to_user_id": env["cg"], "kind": "proud"}).status_code == 403          # not a supporter of anyone

    assert c.delete(f"/behavior/shares/{share['id']}", headers=env["hp"]).status_code == 200
    assert c.get("/behavior/supporting", headers=env["hc"]).json()["people"] == []                                                     # gone the moment they say so
    assert c.post("/behavior/cheers", headers=env["hc"], json={"to_user_id": env["pat"], "kind": "proud"}).status_code in (403, 429)


def _cleanup_seeded():
    """Remove the people these tests create, with all their behaviour data, so other tests see an untouched database."""
    from app.models.user import User
    from app.services.privacy_service import delete_account
    db = _db()
    for u in db.query(User).filter(User.email.like("bh_grp_%@example.com")).all():
        delete_account(db, u)
    from app.models.behavior import BehaviorGroup
    db.query(BehaviorGroup).filter(BehaviorGroup.created_by.is_(None)).delete(synchronize_session=False)
    db.commit()
    db.close()


@pytest.fixture(scope="module", autouse=True)
def _leave_no_trace():
    yield
    _cleanup_seeded()


def _extra_users(n):
    from app.auth.hashing import get_password_hash
    from app.auth.security import create_access_token
    from app.models.user import User
    db = _db()
    out = []
    for i in range(n):
        for stale in db.query(User).filter(User.email == f"bh_grp_{i}@example.com").all():
            from app.services.privacy_service import delete_account
            delete_account(db, stale)
        u = User(email=f"bh_grp_{i}@example.com", username=f"bh_grp_{i}", hashed_password=get_password_hash("Passw0rd!x1"))
        db.add(u)
        db.commit()
        db.refresh(u)
        out.append((u.id, {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}))
    db.close()
    return out


def test_groups_show_totals_only_and_only_when_enough_people_joined(env):
    c = env["client"]
    users = _extra_users(5)
    owner_id, owner_h = users[0]
    g = c.post("/behavior/groups", headers=owner_h, json={"name": "Korle Bu night shift", "kind": "workplace"}).json()
    assert len(g["join_code"]) == 6 and g["visible"] is False and g["members"] == 1
    assert c.post("/behavior/groups/join", headers=owner_h, json={"code": "ZZZZZZ"}).status_code == 404
    for uid, h in users[1:4]:
        r = c.post("/behavior/groups/join", headers=h, json={"code": g["join_code"].lower()}).json()
        assert r["visible"] is False and "or more people" in r["note"]                       # four people: still hidden
    uid5, h5 = users[4]
    for uid, h in users:
        c.post("/behavior/plans", headers=h, json={"behavior": "movement"})
    full = c.post("/behavior/groups/join", headers=h5, json={"code": g["join_code"]}).json()
    assert full["visible"] is True and full["with_a_plan"] == 5 and "No names" in full["privacy"]
    text = str(full)
    assert not any(str(uid) in full for uid, _ in users) and "bh_grp" not in text and "email" not in text   # totals, no people
    mine = c.get("/behavior/groups", headers=users[1][1]).json()["groups"][0]
    assert "join_code" not in mine and "join_code" in c.get("/behavior/groups", headers=owner_h).json()["groups"][0]
    c.delete(f"/behavior/groups/{g['id']}/membership", headers=h5)                              # leaving takes you out of the totals at once
    assert c.get("/behavior/groups", headers=owner_h).json()["groups"][0]["visible"] is False


def test_the_doctor_sees_habits_only_with_the_patients_consent(env):
    c = env["client"]
    _clean(env)
    c.post("/behavior/plans", headers=env["hp"], json={"behavior": "movement"})
    _, hd = login(c)
    _, hb = login(c, "DPT0001B")
    off = c.get(f"/doctor-portal/patients/{env['pat']}/behavior", headers=hd).json()
    assert off["shared"] is False and "not chosen to share" in off["message"] and "plans" not in off
    assert c.get(f"/doctor-portal/patients/{env['pat']}/behavior", headers=hb).status_code == 404          # another doctor: no
    c.put("/behavior/settings", headers=env["hp"], json={"share_with_doctor": True})
    on = c.get(f"/doctor-portal/patients/{env['pat']}/behavior", headers=hd).json()
    assert on["shared"] is True and on["plans"][0]["outcomes"]["weekly_adherence"] is not None
    panel = c.get("/doctor-portal/behavior/impact", headers=hd).json()
    assert panel["hidden"] is True and "5 or more" in panel["note"]                                          # one sharing patient: no panel figures
    c.put("/behavior/settings", headers=env["hp"], json={"share_with_doctor": False})
    assert c.get(f"/doctor-portal/patients/{env['pat']}/behavior", headers=hd).json()["shared"] is False


def test_outreach_reaches_a_quiet_person_once_and_learns_that_it_worked(env):
    c = env["client"]
    _clean(env)
    from app.models.behavior import BehaviorAction, BehaviorNudge, BehaviorPlan
    from app.models.notification import Notification
    db = _db()
    now = (datetime.now().astimezone() - timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    start = now.date() - timedelta(days=12)
    plan = BehaviorPlan(user_id=env["pat"], behavior="movement", baseline_value=3000, goal_value=8000, unit="steps", level=2, start_date=start, active=True)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    for i in range(1, 8):                                                       # active early on, then quiet for the last 4 days
        d = start + timedelta(days=i)
        db.add(BehaviorAction(plan_id=plan.id, user_id=env["pat"], action_date=d, title="x", target_value=4000, level=2, status="done"))
    db.commit()
    before = db.query(Notification).filter_by(user_id=env["pat"], notification_type="behavior_reengage").count()

    sent = [s for s in rg.run(db, now) if s["user_id"] == env["pat"]]
    assert len(sent) == 1 and sent[0]["kind"] == "reengage_1" and sent[0]["channel"] in ("push", "in_app")
    assert db.query(Notification).filter_by(user_id=env["pat"], notification_type="behavior_reengage").count() == before + 1
    note = db.query(Notification).filter_by(user_id=env["pat"], notification_type="behavior_reengage").order_by(Notification.id.desc()).first()
    assert "step" in note.message.lower() and not any(ch.isdigit() for ch in note.message)       # nothing private on a lock screen
    assert [s for s in rg.run(db, now) if s["user_id"] == env["pat"]] == []                         # not again the same day
    nudge = db.query(BehaviorNudge).filter_by(user_id=env["pat"]).first()
    assert nudge.responded is False
    db.close()

    # the person comes back by checking in: the message is recorded as having helped
    today = c.get("/behavior/today", headers=env["hp"]).json()["items"][0]
    assert today["action"]["is_comeback"] is True                                                    # a tiny welcome-back step, nothing reset
    back = c.post(f"/behavior/actions/{today['action']['id']}/checkin", headers=env["hp"], json={"status": "done"}).json()
    assert back["recognition"]["title"] == "You came back" and back["recognition"]["comebacks"] >= 1            # the return is recognised
    db = _db()
    assert db.query(BehaviorNudge).filter_by(user_id=env["pat"]).first().responded is True
    summary = c.get("/behavior/nudges", headers=env["hp"]).json()
    assert summary["recent"][0]["came_back"] is True and "stop if messages are not helping" in summary["limits"]
    db.close()


def test_export_and_erase_cover_everything_this_feature_holds(env):
    c = env["client"]
    _clean(env)
    c.put("/behavior/context", headers=env["hp"], json={"support": "family"})
    plan = c.post("/behavior/plans", headers=env["hp"], json={"behavior": "movement"}).json()
    c.post("/behavior/shares", headers=env["hp"], json={"plan_id": plan["id"], "supporter_id": env["cg"]})
    data = c.get("/behavior/my-data", headers=env["hp"]).json()
    assert data["context"]["support"] == "family" and data["plans"] and data["shared_with"] and "exported_at" in data
    assert c.delete("/behavior/my-data", headers=env["hp"]).json()["deleted"]
    after = c.get("/behavior/my-data", headers=env["hp"]).json()
    assert after["plans"] == [] and after["shared_with"] == [] and after["context"]["support"] == "alone"
    assert c.get("/behavior/supporting", headers=env["hc"]).json()["people"] == []


# ------------------------------------------------------------------ impact
def _seed_people(n, with_biomarkers=True):
    """n people, 12 weeks of history each: steady, with one lapse and a return for the first half."""
    from app.models.activity import WeightLog
    from app.models.behavior import BehaviorAction, BehaviorContext, BehaviorNudge, BehaviorPlan, BehaviorSettings
    from app.models.iot_device import VitalReading
    from app.models.user import UserProfile
    users = _extra_users(n)
    db = _db()
    today = date.today()
    start = today - timedelta(days=84)
    for k, (uid, _) in enumerate(users):
        db.add(UserProfile(user_id=uid, full_name=f"P{k}", age=30 + k * 4, gender="Female" if k % 2 else "Male", chronic_conditions=["Hypertension"], profile_completed=True))
        db.add(BehaviorContext(user_id=uid, mobility="wheelchair" if k < n // 2 else "full", work_pattern="shift", support="alone"))
        db.add(BehaviorSettings(user_id=uid, language="en" if k % 2 else "fr"))
        plan = BehaviorPlan(user_id=uid, behavior="movement", baseline_value=3000, goal_value=8000, unit="steps", level=2, start_date=start, active=True)
        db.add(plan)
        db.flush()
        for i in range(84):
            d = start + timedelta(days=i)
            if k < n // 2 and 30 <= i < 36:
                continue                                                    # a lapse that ends in a return
            if k >= n // 2 and i > 60 and k % 3 == 0:
                continue                                                    # a few who drifted away
            db.add(BehaviorAction(plan_id=plan.id, user_id=uid, action_date=d, title="x", target_value=4000, level=2, status="done", value_done=5200 + i))
        if with_biomarkers:
            for i in range(0, 14, 2):
                db.add(VitalReading(user_id=uid, blood_pressure_systolic=150, blood_pressure_diastolic=95, timestamp=datetime.now(timezone.utc) - timedelta(days=84 - i)))
                db.add(VitalReading(user_id=uid, blood_pressure_systolic=138, blood_pressure_diastolic=88, timestamp=datetime.now(timezone.utc) - timedelta(days=i)))
            db.add(WeightLog(user_id=uid, kg=82.0, at=datetime.now(timezone.utc) - timedelta(days=82)))
            db.add(WeightLog(user_id=uid, kg=79.5, at=datetime.now(timezone.utc) - timedelta(days=2)))
        db.add(BehaviorNudge(user_id=uid, plan_id=plan.id, kind="reengage_1", channel="push" if k % 2 else "in_app", lapse_start=today - timedelta(days=50),
                             sent_at=datetime.now(timezone.utc) - timedelta(days=50), responded=(k % 3 != 0)))
    db.commit()
    db.close()
    return [u for u, _ in users]


def test_impact_measures_persistence_recovery_biomarkers_outreach_and_equity():
    from app.services.behavior_impact import compute_impact
    ids = _seed_people(10)
    db = _db()
    res = compute_impact(db, user_ids=ids)
    assert res["people"] == 10 and "retention" in res and set(res["definitions"]) >= {"retention", "persistence", "recovery", "biomarker", "outreach", "equity"}
    assert res["retention"]["day_30"]["value"] >= 0.5 and res["retention"]["day_90"]["hidden"] is True       # nobody is 90 days in yet
    assert res["persistence"]["value"] is not None and 0 <= res["persistence"]["value"] <= 1
    assert res["recovery"]["lapses"] == 7 and res["recovery"]["recovered_share"] == round(5 / 7, 2) and res["recovery"]["median_days_to_return"] >= 3   # 2 who drifted away never returned
    bp = res["biomarkers"]["systolic_blood_pressure"]
    assert bp["n"] == 10 and bp["median_change"] == -12.0 and bp["good_direction"] == "down" and "Association" in res["biomarkers"]["note"]
    assert res["biomarkers"]["weight"]["median_change"] == -2.5
    assert res["change"]["movement"]["median_pct_change"] > 0
    assert set(res["outreach"]) >= {"push", "in_app"} and all(0 <= v["followed_by_check_in"] <= 1 for v in res["outreach"].values() if not v.get("hidden"))
    mob = res["equity"]["mobility"]["groups"]
    assert mob["wheelchair"]["n"] == 5 and mob["full"]["n"] == 5 and res["equity"]["mobility"]["gap"] is not None
    assert "equity_flags" in res
    text = str(res)
    assert "bh_grp" not in text and "@example" not in text                                                  # no identifiers anywhere
    db.close()


def test_small_groups_are_never_shown_so_no_one_can_be_picked_out():
    from app.services.behavior_impact import compute_impact
    ids = _seed_people(7)
    db = _db()
    res = compute_impact(db, user_ids=ids[:4])
    assert res["hidden"] is True and res["people"] == "<5" and "retention" not in res
    full = compute_impact(db, user_ids=ids, min_cell=5)
    assert full["equity"]["mobility"]["groups"]["wheelchair"]["n"] == 3 or full["equity"]["mobility"]["groups"]["wheelchair"].get("hidden")   # 3 and 4: hidden
    assert all(g.get("hidden") for g in full["equity"]["mobility"]["groups"].values())
    assert full["equity"]["mobility"]["gap"] is None
    db.close()


def test_programme_impact_endpoint_is_aggregate_only(env):
    c = env["client"]
    r = c.get("/behavior/impact", headers=env["hp"])
    assert r.status_code == 200 and "definitions" in r.json() and "privacy" in r.json()
    assert c.get("/behavior/impact").status_code in (401, 403)


# ------------------------------------------------------------------ the step in the person's own language
def test_the_daily_step_speaks_french_and_arabic_and_falls_back_to_english():
    fr = eng.build_action("movement", 3000, 8000, 2, T, option_index=0, lang="fr")
    assert "pas" in fr["title"] and "Limites :" in fr["rationale"] and "{" not in fr["title"]
    ar = eng.build_action("sleep", 5.5, 7.5, 2, T, option_index=0, lang="ar")
    assert "ساعات" in ar["title"] and "الحدود:" in ar["rationale"] and "{" not in ar["title"]
    tw = eng.build_action("movement", 3000, 8000, 2, T, option_index=0, lang="tw")            # no Twi text yet: English, never a crash or a blank
    assert tw["title"].startswith("Walk") and "Limits:" in tw["rationale"]
    assert eng.build_action("movement", 3000, 8000, 2, T, option_index=0, lang="fr")["target_value"] == eng.build_action("movement", 3000, 8000, 2, T, option_index=0)["target_value"]
    barrier = eng.build_action("activity", 10, 30, 2, T, top_barrier="tired", lang="ar")
    assert "النسخة الأخف" in barrier["detail"]
    comeback = eng.build_action("movement", 3000, 8000, 2, T, comeback=True, lang="fr")
    assert comeback["detail"].startswith("Un tout petit pas")
    assert "tension" in eng.safety_note("movement", {"bp_crisis": True}, "fr")["note"] and "ضغط" in eng.safety_note("activity", {"sos_active": True}, "ar")["note"]
    ctx = eng.adapt_for_context(fr, "movement", {"work_pattern": "shift", "mobility": "limited"}, "fr")
    assert "service" in ctx["detail"] and "Soyez actif" in ctx["detail"]


def test_every_translated_action_has_its_english_original_and_matching_placeholders():
    from app.services import behavior_l10n as L
    for lang, table in L.ACTIONS.items():
        for (behavior, idx), (title, detail) in table.items():
            en_title = eng.BASE_ACTIONS[behavior][idx][0]
            assert ("{t:g}" in title) == ("{t:g}" in en_title) and ("{t}" in title) == ("{t}" in en_title), (lang, behavior, idx)
            assert detail.strip()
    assert set(L.TWEAK["fr"]) == set(L.TWEAK["ar"]) == set(eng.BARRIER_TWEAK)
    assert set(L.TECHNIQUE["fr"]) == set(L.TECHNIQUE["ar"]) == set(eng.TECHNIQUES)


def test_the_stored_day_uses_the_language_the_person_chose(env):
    c = env["client"]
    _clean(env)
    c.put("/behavior/settings", headers=env["hp"], json={"language": "fr"})
    c.post("/behavior/plans", headers=env["hp"], json={"behavior": "movement"})
    a = c.get("/behavior/today", headers=env["hp"]).json()["items"][0]["action"]
    assert "pas" in a["title"] and "Limites :" in a["rationale"]
    ap = c.get("/behavior/approaches", headers=env["hp"]).json()["approaches"]
    assert "confiance" in ap[0]["why_it_works"]
    c.put("/behavior/settings", headers=env["hp"], json={"language": "en"})


def test_whole_numbers_are_written_without_a_decimal_point():
    a = eng.build_action("nutrition", 1.0, 5.0, 2, T, option_index=0)
    assert "2.0" not in a["title"] and "serving" in a["title"]
    assert "7.5" in eng.build_action("sleep", 5.5, 7.5, 5, T, option_index=0)["title"]            # a real half hour keeps its decimal
    assert "{" not in eng.build_action("nutrition", 1.0, 5.0, 2, T, option_index=0, lang="fr")["title"]
