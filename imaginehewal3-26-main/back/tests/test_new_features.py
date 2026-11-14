"""Learning engine, privacy centre, wellbeing check-in and clinician summary. Offline."""
import json
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_new.db")
os.environ["VISION_PROVIDER"] = "off"

import random
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User, UserProfile
    from app.models.caregiver import CaregiverRelationship
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    mk = lambda n, **k: User(email=f"nf_{n}@example.com", username=f"nf_{n}", hashed_password=get_password_hash("Passw0rd!x1"), **k)
    p, cg, st, gone = mk("p", first_name="Ama", last_name="Boateng"), mk("cg", is_caregiver=True, first_name="Kofi"), mk("st"), mk("gone")
    db.add_all([p, cg, st, gone]); db.commit()
    db.add(UserProfile(user_id=p.id, full_name="Ama Boateng", age=57, gender="female", chronic_conditions=["hypertension"], weight=80, height=165, blood_pressure="142/92", blood_glucose=110))
    rel = CaregiverRelationship(caregiver_id=cg.id, patient_id=p.id, status="approved")
    rel2 = CaregiverRelationship(caregiver_id=cg.id, patient_id=gone.id, status="approved")
    db.add_all([rel, rel2]); db.commit()
    tok = lambda u, t="patient": {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, t)}
    out = dict(client=TestClient(app), p=p.id, cg=cg.id, st=st.id, gone=gone.id, rel=rel.id,
               hp=tok(p), hcg=tok(cg, "caregiver"), hst=tok(st), hgone=tok(gone))
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for uid in (p.id, cg.id, st.id, gone.id):
        u = db2.query(User).filter(User.id == uid).first()
        if u:
            delete_account(db2, u)           # also proves the generic eraser works on a messy database
    db2.close(); db.close()


def _db():
    from app.database import SessionLocal
    return SessionLocal()


# ============================================================ A. learning engine
def _plan_with_history(env, rule, days=35):
    from app.models.behavior import BehaviorAction, BehaviorPlan
    db = _db()
    db.query(BehaviorPlan).filter_by(user_id=env["p"]).update({"active": False})
    plan = BehaviorPlan(user_id=env["p"], behavior="movement", baseline_value=3000, goal_value=8000, unit="steps", level=3,
                        start_date=date.today() - timedelta(days=days + 5), active=True)
    db.add(plan); db.flush()
    today = date.today()
    for i in range(1, days + 1):
        d = today - timedelta(days=i)
        tech = "Habit stacking" if i % 2 == 0 else "Self-monitoring"
        db.add(BehaviorAction(plan_id=plan.id, user_id=env["p"], action_date=d, title="t", detail="d", technique=tech, rationale="r",
                              target_value=1, level=1, status=rule(d, tech)))
    db.commit(); db.refresh(plan)
    return db, plan


def test_learner_prefers_the_style_that_works_for_this_person(env):
    from app.services import learning_service as ls
    db, plan = _plan_with_history(env, lambda d, tech: "done" if tech == "Habit stacking" else "skipped")
    from app.services import behavior_engine as eng
    names, notes = [], []
    for seed in range(200):
        idx, note = ls.pick_option_index(db, plan, random.Random(seed))
        names.append(eng.BASE_ACTIONS["movement"][idx][2]); notes.append(note)
    assert names.count("Habit stacking") >= 0.85 * len(names)          # mostly what works for this person
    assert names.count("Self-monitoring") == 0                          # never the style that keeps failing for them
    assert names.count("Implementation intention") >= 1                 # but it still explores a style it has not tried
    assert any("worked on" in n for n in notes)
    db.close()


def test_learner_explores_with_little_data(env):
    from app.models.behavior import BehaviorPlan
    from app.services import learning_service as ls
    db = _db()
    db.query(BehaviorPlan).filter_by(user_id=env["p"]).update({"active": False})
    plan = BehaviorPlan(user_id=env["p"], behavior="movement", baseline_value=3000, goal_value=8000, unit="steps", level=2, start_date=date.today(), active=True)
    db.add(plan); db.commit()
    assert ls.pick_option_index(db, plan, random.Random(1)) == (None, "")          # not enough data: default rotation
    db.close()


def test_hard_weekday_gets_a_lighter_step_and_is_explained(env):
    from app.services import learning_service as ls
    db, plan = _plan_with_history(env, lambda d, tech: "skipped" if d.weekday() == 5 else "done")
    today = date.today()
    saturday = today + timedelta(days=(5 - today.weekday()) % 7)
    monday = today + timedelta(days=(0 - today.weekday()) % 7)
    assert ls.weak_weekday(db, plan, saturday)[0] is True
    assert ls.weak_weekday(db, plan, monday)[0] is False
    db.close()
    ins = env["client"].get("/behavior/insights", headers=env["hp"]).json()["plans"][0]
    assert ins["learning"] and any("hardest day" in s for s in ins["learned"]) and any("Saturday" in s for s in ins["learned"])
    assert len(ins["by_weekday"]) == 7 and ins["by_weekday"][5]["rate"] == 0.0


def test_heatmap_is_monday_aligned_and_scores_days(env):
    _plan_with_history(env, lambda d, tech: "skipped" if d.weekday() == 5 else "done", days=21)[0].close()
    h = env["client"].get("/behavior/heatmap?weeks=4", headers=env["hp"]).json()
    assert h["days"][0]["weekday"] == 0 and h["days"][-1]["date"] == date.today().isoformat()      # starts on a Monday, ends today
    scored = {d["date"]: d["score"] for d in h["days"]}
    yesterday = (date.today() - timedelta(days=1))
    assert scored[yesterday.isoformat()] == (0.0 if yesterday.weekday() == 5 else 1.0)
    assert scored[date.today().isoformat()] is None                                                    # today not checked in yet
    assert env["client"].get("/behavior/heatmap?weeks=500", headers=env["hp"]).json()["weeks"] == 26   # clamped


def test_generated_action_explains_what_was_learned(env):
    _plan_with_history(env, lambda d, tech: "done" if tech == "Habit stacking" else "skipped")[0].close()
    r = env["client"].get("/behavior/today", headers=env["hp"]).json()
    action = r["items"][0]["action"]
    assert "worked on" in action["rationale"] or "trying a new style" in action["rationale"].lower()


# ============================================================ C. privacy centre
def test_access_list_and_audit_log(env):
    c = env["client"]
    a = c.get("/privacy/access", headers=env["hp"]).json()
    assert [x["name"] for x in a["people"]] == ["Kofi"] and "wellbeing" in " ".join(a["never_shared"]).lower()
    assert "employers" in a["employers_and_insurers"].lower()
    assert c.get("/privacy/log", headers=env["hp"]).json()["items"] == []
    c.get("/risk/patients", headers=env["hcg"])                                         # the caregiver looks at the patient
    c.get("/risk/patients", headers=env["hcg"])                                         # and again straight away
    items = c.get("/privacy/log", headers=env["hp"]).json()["items"]
    assert len(items) == 1 and items[0]["viewer"] == "Kofi" and "risk" in items[0]["what"]   # logged once, not spammed
    assert c.get("/privacy/log", headers=env["hst"]).json()["items"] == []              # a stranger sees nobody's log
    assert c.get(f"/reports/clinician-summary/{env['p']}", headers=env["hcg"]).status_code == 200
    assert len(c.get("/privacy/log", headers=env["hp"]).json()["items"]) == 2           # summary access is logged too
    assert c.get(f"/reports/clinician-summary/{env['p']}", headers=env["hst"]).status_code == 404


def test_revoking_access_really_blocks_the_caregiver(env):
    c = env["client"]
    assert c.post(f"/privacy/access/{env['rel']}/revoke", headers=env["hcg"]).status_code == 404   # only the patient can revoke
    assert [p["patient_id"] for p in c.get("/risk/patients", headers=env["hcg"]).json()].count(env["p"]) == 1
    assert c.post(f"/privacy/access/{env['rel']}/revoke", headers=env["hp"]).json()["revoked"] is True
    assert env["p"] not in [p["patient_id"] for p in c.get("/risk/patients", headers=env["hcg"]).json()]
    assert c.get(f"/reports/clinician-summary/{env['p']}", headers=env["hcg"]).status_code == 404
    assert c.post(f"/privacy/access/{env['rel']}/revoke", headers=env["hp"]).status_code == 404   # already revoked


def test_export_contains_my_data_and_no_secrets(env):
    c = env["client"]
    c.post("/medications", json={"name": "Amlodipine", "times": ["08:00"]}, headers=env["hp"])
    c.post("/meals/log", json={"dish_id": "waakye", "portion": "regular", "meal_type": "lunch"}, headers=env["hp"])
    out = c.get("/privacy/export", headers=env["hp"]).json()
    raw = json.dumps(out).lower()
    assert out["account"]["email"] == "nf_p@example.com"
    assert "medications" in out["tables"] and "food_logs" in out["tables"] and out["tables"]["medications"][0]["name"] == "Amlodipine"
    assert "hashed_password" not in raw and "passw0rd" not in raw and "refresh_token" not in raw
    assert "nf_st@example.com" not in raw                                               # nobody else's account details


def test_delete_account_needs_password_and_removes_everything(env):
    from app.models.safety import SosEvent, SosLog
    from app.models.trust import WellbeingCheckin
    from app.models.assistant import AssistantMessage
    from sqlalchemy import text
    c, db, g = env["client"], _db(), env["gone"]
    c.post("/medications", json={"name": "Metformin", "times": ["08:00", "20:00"]}, headers=env["hgone"])
    c.post("/meals/log", json={"dish_id": "oats", "portion": "regular", "meal_type": "breakfast"}, headers=env["hgone"])
    db.add(AssistantMessage(user_id=g, role="user", content="hello")); db.add(WellbeingCheckin(user_id=g, answers=[1, 1, 0, 0], phq2=2, gad2=0))
    ev = SosEvent(user_id=g, trigger="manual", reason="test", status="resolved"); db.add(ev); db.flush(); ev_id = ev.id; db.add(SosLog(event_id=ev_id, kind="created", detail="x"))
    other = SosEvent(user_id=env["p"], trigger="manual", reason="other", status="resolved", acknowledged_by=g); db.add(other); db.commit()
    other_id = other.id

    assert c.post("/privacy/delete-account", json={"password": "wrong", "confirm": "DELETE"}, headers=env["hgone"]).status_code == 403
    assert c.post("/privacy/delete-account", json={"password": "Passw0rd!x1", "confirm": "delete"}, headers=env["hgone"]).status_code == 400
    done = c.post("/privacy/delete-account", json={"password": "Passw0rd!x1", "confirm": "DELETE"}, headers=env["hgone"])
    assert done.status_code == 200 and done.json()["deleted"] is True

    for sql in (f"select count(*) from users where id={g}", f"select count(*) from medications where user_id={g}",
                f"select count(*) from medication_logs where user_id={g}", f"select count(*) from food_logs where user_id={g}",
                f"select count(*) from assistant_messages where user_id={g}", f"select count(*) from wellbeing_checkins where user_id={g}",
                f"select count(*) from sos_events where user_id={g}", f"select count(*) from sos_logs where event_id={ev_id}",
                f"select count(*) from caregiver_relationships where patient_id={g}"):
        assert db.execute(text(sql)).scalar() == 0, sql
    assert db.execute(text(f"select acknowledged_by from sos_events where id={other_id}")).scalar() is None   # someone else's record kept, link removed
    assert c.get("/privacy/access", headers=env["hgone"]).status_code in (401, 403, 404)                     # the old token is useless
    db.close()


# ============================================================ B. wellbeing
def test_wellbeing_scoring_bands_and_safety(env):
    c, h = env["client"], env["hst"]
    q = c.get("/wellbeing/questionnaire", headers=h).json()
    assert len(q["items"]) == 4 and len(q["options"]) == 4 and q["cutoff"] == 3 and "not a diagnosis" in q["note"].lower()
    assert c.get("/wellbeing/due", headers=h).json()["due"] is True
    r = c.post("/wellbeing/checkin", json={"answers": [1, 1, 0, 0]}, headers=h).json()
    assert (r["phq2"], r["gad2"], r["band"], r["screen_positive"], r["crisis"]) == (2, 0, "low", False, False)
    assert c.get("/wellbeing/due", headers=h).json()["due"] is False
    assert c.post("/wellbeing/checkin", json={"answers": [3, 3, 0, 0]}, headers=h).status_code == 429       # not twice in 30 minutes


def test_wellbeing_validation_and_cutoffs():
    from app.services import wellbeing_service as ws
    for bad in ([1, 2, 3], [4, 0, 0, 0], [0, 0, 0, -1], [0, 0, 0, 1.5]):
        with pytest.raises(ValueError):
            ws.score(bad)
    assert ws.assess(2, 2, False)["screen_positive"] is False                         # 2 and 2 is below the cut-off on both
    a = ws.assess(3, 0, False)
    assert a["screen_positive"] and a["band"] == "elevated" and any(s["level"] == "primary_care" for s in a["next_steps"])
    assert ws.assess(3, 3, False)["band"] == "high" and "this week" in ws.assess(3, 3, False)["next_steps"][0]["text"]
    crisis = ws.assess(0, 0, True, "112")
    assert crisis["crisis"] and crisis["next_steps"][0]["level"] == "urgent" and "112" in crisis["next_steps"][0]["text"]
    assert crisis["screen_positive"] is False                                         # the safety question is not part of the score
    assert all(s["eligibility"] for s in a["next_steps"])                              # every step says why it was suggested


def test_wellbeing_is_private_and_asking_for_help_shares_no_scores(env):
    from app.models.trust import WellbeingCheckin
    from app.models.notification import Notification
    c, db = env["client"], _db()
    db.add(WellbeingCheckin(user_id=env["st"], answers=[3, 3, 3, 3], phq2=6, gad2=6, created_at=datetime.now(timezone.utc) - timedelta(days=9))); db.commit()
    own = c.get("/reports/clinician-summary?include_wellbeing=true", headers=env["hst"]).json()
    assert own["wellbeing"] and own["wellbeing"]["latest_phq2"] == 6                  # the owner can include it, on purpose
    assert c.get("/reports/clinician-summary", headers=env["hst"]).json()["wellbeing"] is None   # off by default
    # a stranger with no relationship cannot read it, and the caregiver endpoint never carries it
    assert "wellbeing" not in json.dumps(c.get("/risk/patients", headers=env["hcg"]).json())
    # patient `p` asks for support: only a request, no answers. (their link to the caregiver was revoked earlier, so reconnect it)
    from app.models.caregiver import CaregiverRelationship
    db.query(CaregiverRelationship).filter_by(id=env["rel"]).update({"status": "approved"}); db.commit()
    r = c.post("/wellbeing/ask-for-support", headers=env["hp"]).json()
    assert r["notified"] == 1
    note = db.query(Notification).filter_by(user_id=env["cg"], notification_type="support_request").order_by(Notification.id.desc()).first()
    assert note and "check in" in note.message.lower() and not any(ch.isdigit() for ch in note.message)   # no scores in the message
    none = c.post("/wellbeing/ask-for-support", headers=env["hst"]).json()
    assert none["notified"] == 0 and "no caregivers" in none["message"].lower()
    db.close()


def test_wellbeing_trend(env):
    from app.models.trust import WellbeingCheckin
    from app.services import wellbeing_service as ws
    db = _db()
    now = datetime.now(timezone.utc)
    for n, total in enumerate((6, 6, 5, 2)):                                           # getting better
        db.add(WellbeingCheckin(user_id=env["cg"], answers=[1, 1, 1, 1], phq2=total // 2, gad2=total - total // 2, created_at=now - timedelta(days=30 - n * 7)))
    db.commit()
    s = ws.summary(db, db.query(__import__("app.models.user", fromlist=["User"]).User).filter_by(id=env["cg"]).first())
    assert s["trend"] == "improving" and s["count"] == 4 and s["history"][-1]["total"] == 2
    db.close()


# ============================================================ D. clinician summary
def test_clinician_summary_is_complete_and_honest(env):
    c = env["client"]
    s = c.get("/reports/clinician-summary?days=30", headers=env["hp"]).json()
    assert s["patient"]["name"] and s["patient"]["conditions"] == ["hypertension"]
    assert s["risk"]["label"] and s["risk"]["reasons"] and "not a diagnosis" in s["risk"]["method"].lower()
    assert "Screening result" in s["text"] and "Ama" in s["text"] and "does not replace" in s["text"].lower() or "do not replace" in s["text"].lower()
    assert c.get("/reports/clinician-summary?days=5000", headers=env["hp"]).json()["period_days"] == 90       # clamped
    assert c.get("/reports/clinician-summary", headers=env["hp"]).json()["wellbeing"] is None
    assert c.get("/reports/clinician-summary").status_code in (401, 403)
