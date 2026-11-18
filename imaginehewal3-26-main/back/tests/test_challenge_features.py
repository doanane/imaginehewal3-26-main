"""The three features added for the Future Health challenge: personalised goals, adaptive reminders, and the comeback coach. Offline."""
import os
from datetime import date, datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from app.services import comeback as cb
from app.services import goal_planner as gp
from app.services import reminder_plan as rp
from test_doctor_portal import env, login  # noqa: F401,E402

D = date(2026, 9, 15)             # a Tuesday outside Ramadan


def facts(**kw):
    base = {"age": 45, "gender": "Female", "weight_kg": 70, "conditions": [], "segment": "adult", "region": "gh", "work_pattern": "regular",
            "steps_avg": 3000, "active_min_avg": 10, "sodium_avg": 3200, "fibre_avg": 14, "water_avg_ml": 1200, "sleep_avg": 6.0,
            "sodium_today": 900, "fibre_today": 5, "water_today_ml": 600}
    base.update(kw)
    return base


# ------------------------------------------------------------------ personalised goals
def test_goals_start_from_the_persons_own_baseline_and_say_why():
    p = gp.propose(facts(), D)
    by = {i["id"]: i for i in p["items"]}
    assert by["steps"]["now"] == 3000 and 3000 < by["steps"]["first_goal"] < by["steps"]["goal"]            # staged, never a jump
    assert by["active_minutes"]["goal"] == 30 and by["active_minutes"]["first_goal"] > 10
    assert by["sodium"]["goal"] == 2000 and by["sodium"]["now"] == 3200 and by["sodium"]["first_goal"] < 3200 and by["sodium"]["direction"] == "down"
    assert by["water"]["goal"] == 2200 and by["sodium"]["today"] == 900                                       # 32 ml x 70 kg, and today's real total
    assert all(i["why"] and i["source"] and i["measured_by"] for i in p["items"])
    assert "not medical advice" in p["limits"] and "steps_avg" in p["personalised_from"]


def test_conditions_age_and_heat_change_the_goals():
    htn = {i["id"]: i for i in gp.propose(facts(conditions=["Hypertension"]), D)["items"]}
    assert htn["sodium"]["goal"] == 1500 and "clinician" in htn["sodium"]["source"]
    old = {i["id"]: i for i in gp.propose(facts(age=72, steps_avg=2000), D)["items"]}
    assert old["steps"]["goal"] == 6000                                                                      # gentler for people 65 and over
    heart = gp.propose(facts(conditions=["Heart failure"]), D)
    ids = {i["id"] for i in heart["items"]}
    assert "water" not in ids and any("clinician" in n for n in heart["notes"])                              # no fluid advice for heart or kidney conditions
    assert {i["id"]: i for i in heart["items"]}["active_minutes"]["goal"] == 20
    hot = gp.propose(facts(region="ae"), D)
    assert {i["id"]: i for i in hot["items"]}["water"]["goal"] == 2200 + 500 and any("extreme heat" in n for n in hot["notes"])
    desk = {i["id"] for i in gp.propose(facts(work_pattern="desk", segment="sedentary"), D)["items"]}
    assert "breaks" in desk


def test_no_data_is_said_plainly_not_invented():
    p = gp.propose(facts(steps_avg=None, active_min_avg=None, sodium_avg=None, fibre_avg=None, water_avg_ml=None, sleep_avg=None), D)
    by = {i["id"]: i for i in p["items"]}
    assert by["steps"]["now"] is None and by["steps"]["state"] == "no_data" and "No step data" in by["steps"]["why"]
    assert by["sodium"]["now"] is None and "Log your meals" in by["sodium"]["why"]


# ------------------------------------------------------------------ adaptive reminders
def ck(days_ago_to_minutes):
    return [(D - timedelta(days=d), m) for d, m in days_ago_to_minutes]


def inp(**kw):
    base = {"checkins": [], "today": D, "plan_start": D - timedelta(days=20), "segment": "adult", "region": "gh", "respect_prayer": True,
            "quiet_start": 21, "quiet_end": 7, "state": {"mode": "auto", "stage": 0, "stage_on": None}}
    base.update(kw)
    return base


def test_the_reminder_comes_before_the_time_the_person_already_acts():
    c = ck([(d, 19 * 60) for d in range(1, 12)])                                   # always checks in at 19:00
    plan = rp.evaluate(inp(checkins=c))
    assert plan["time"] == "18:30" and plan["frequency"] == "daily" and any("19:00" in w for w in plan["why"])
    new = rp.evaluate(inp())                                                       # nothing known yet: a sensible default, said so
    assert new["time"] == "18:00" and any("do not know your usual time" in w for w in new["why"])


def test_it_avoids_quiet_hours_and_prayer_time():
    late = ck([(d, 22 * 60) for d in range(1, 12)])                                # someone who checks in at 22:00
    plan = rp.evaluate(inp(checkins=late))
    assert plan["time"] <= "20:30"                                                 # never in the evening quiet hours
    dhuhr = __import__("app.services.gulf", fromlist=["x"]).prayer_times(D, "ae")["dhuhr"]
    c = ck([(d, int(dhuhr * 60) + 30) for d in range(1, 12)])                      # habit time right after midday prayer: reminder would land in the window
    p = rp.evaluate(inp(checkins=c, region="ae"))
    h, m = map(int, p["time"].split(":"))
    assert not rp._clear_of_rules(D, h * 60 + m, "ae", True, 21, 7)                # the chosen time is clear of the rules


def test_it_learns_then_slows_then_pauses_and_the_person_can_override():
    # check-ins at very different times (06:00 and 22:00): the median is mid-afternoon, where no check-in ever lands, so the reminder is never answered
    never = [(D - timedelta(days=d), 6 * 60 if d % 2 else 22 * 60) for d in range(1, 15)]
    s0 = rp.evaluate(inp(checkins=never, state={"mode": "auto", "stage": 0, "stage_on": D - timedelta(days=10)}))
    assert s0["observed"]["answered"] == 0 and s0["changed_stage"] == 1 and "moved" in " ".join(s0["why"])
    s1 = rp.evaluate(inp(checkins=never, state={"mode": "auto", "stage": 1, "stage_on": D - timedelta(days=8)}))
    assert s1["changed_stage"] == 2 and s1["frequency"] == "every_other_day" and len(s1["fire_dates"]) < 7
    s2 = rp.evaluate(inp(checkins=never, state={"mode": "auto", "stage": 2, "stage_on": D - timedelta(days=8)}))
    assert s2["changed_stage"] == 3 and s2["frequency"] == "paused" and s2["fire_dates"] == [] and not s2["enabled"]
    # less than a week of evidence: no change yet
    early = rp.evaluate(inp(checkins=never, state={"mode": "auto", "stage": 0, "stage_on": D - timedelta(days=3)}))
    assert early["changed_stage"] is None
    off = rp.evaluate(inp(state={"mode": "off", "stage": 0}))
    assert not off["enabled"] and off["time"] is None
    fixed = rp.evaluate(inp(checkins=never, state={"mode": "fixed", "hour": 9, "stage": 0, "stage_on": D - timedelta(days=10)}))
    assert fixed["time"] == "09:00" and fixed["changed_stage"] is None                                              # the person's own time is never changed


def test_a_reminder_that_works_is_left_alone():
    good = [(D - timedelta(days=d), 18 * 60 + 40) for d in range(1, 15)]
    p = rp.evaluate(inp(checkins=good))
    assert p["changed_stage"] is None and p["observed"]["share"] == 1.0 and any("stays as it is" in w for w in p["why"])


# ------------------------------------------------------------------ the comeback coach
def test_the_coach_opens_without_blame_and_orders_options_for_the_cause():
    c = cb.build(None, "movement", missed_days=4)
    assert "not a failure" in c["opening"] or "part of change" in c["opening"]
    assert len(c["barriers"]) == 10 and "options" not in c
    t = cb.build("time", "movement", segment="sedentary")
    assert [o["id"] for o in t["options"]][0] == "retime" and t["options"][0]["recommended"]
    sick = cb.build("pain_sick", "movement")
    assert sick["options"][0]["id"] == "rest" and "medical help" in sick["safety"]
    assert "If" in t["if_then"] and "then" in t["if_then"] and len(t["relapse_plan"]) == 3
    held = cb.build("time", "movement", safety_hold=True)
    assert held["options"][0]["id"] == "rest"                                      # a very high reading puts rest and a clinician first


def test_evidence_appears_only_with_five_or_more_people_and_reorders_options():
    rates = {"tiny": {"n": 8, "returned": 6}, "retime": {"n": 6, "returned": 2}, "swap": {"n": 3, "returned": 3}}
    out = cb.build("time", "movement", rates=rates)
    ids = [o["id"] for o in out["options"]]
    assert ids[0] == "tiny" and out["options"][0]["evidence"].startswith("6 of 8")                                  # better-performing option first
    assert [o for o in out["options"] if o["id"] == "swap"][0]["evidence"] is None                                  # 3 people: not shown
    assert cb.build("time", "movement", rates={"tiny": {"n": 4, "returned": 4}})["options"][0]["id"] == "retime"   # too few: the written order stands


# ------------------------------------------------------------------ end to end through the API
def test_goals_reminders_and_coach_through_the_api(env):
    c, hp = env["client"], env["hp"]
    g = c.get("/behavior/goals", headers=hp).json()
    assert g["items"] and g["limits"] and {"steps", "sodium"} <= {i["id"] for i in g["items"]}
    assert {i["id"]: i for i in g["items"]}["sodium"]["goal"] == 1500                                               # the test patient has hypertension
    done = c.post("/behavior/goals/apply", headers=hp, json={"ids": ["steps", "sodium"]}).json()
    assert [m["behavior"] for m in done["created"]] == ["movement"] and done["skipped"][0]["id"] == "sodium"
    plans = c.get("/behavior/plans", headers=hp).json()
    assert plans and plans[0]["behavior"] == "movement" and plans[0]["goal_value"] > plans[0]["baseline_value"]

    r = c.get("/behavior/reminder-plan", headers=hp).json()
    assert r["enabled"] and r["time"] and r["why"] and r["frequency"] == "daily" and "health" not in r["text"].lower()
    assert c.put("/behavior/reminder-settings", headers=hp, json={"mode": "fixed"}).status_code == 422
    fixed = c.put("/behavior/reminder-settings", headers=hp, json={"mode": "fixed", "hour": 7}).json()
    assert fixed["time"] == "07:00" and fixed["settings"]["mode"] == "fixed"
    assert not c.put("/behavior/reminder-settings", headers=hp, json={"mode": "off"}).json()["enabled"]
    assert c.put("/behavior/reminder-settings", headers=hp, json={"mode": "auto"}).json()["settings"]["mode"] == "auto"

    # on track: the coach says so; after a lapse it appears
    assert c.get("/behavior/comeback", headers=hp).json()["needed"] is False
    assert c.post("/behavior/comeback", headers=hp, json={"barrier": "time", "option": "tiny"}).status_code == 409
    from app.database import SessionLocal
    from app.models.behavior import BehaviorAction, BehaviorPlan, ComebackSession
    db = SessionLocal()
    try:
        plan = db.query(BehaviorPlan).filter_by(user_id=env["pat"], active=True).first()
        plan.start_date = date.today() - timedelta(days=12)
        for back in range(11, 4, -1):
            db.add(BehaviorAction(plan_id=plan.id, user_id=env["pat"], action_date=date.today() - timedelta(days=back), title="t", target_value=1.0, level=1, status="done", value_done=1.0))
        db.commit()
        plan_id = plan.id
    finally:
        db.close()
    co = c.get("/behavior/comeback", headers=hp).json()
    assert co["needed"] and co["missed_days"] >= 3 and co["opening"] and len(co["barriers"]) == 10
    co2 = c.get("/behavior/comeback?barrier=forgot", headers=hp).json()
    assert co2["options"][0]["id"] == "retime" and co2["if_then"] and co2["relapse_plan"]
    assert c.post("/behavior/comeback", headers=hp, json={"barrier": "forgot", "option": "retime"}).status_code == 422          # needs a time
    ok = c.post("/behavior/comeback", headers=hp, json={"barrier": "forgot", "option": "retime", "when": "morning"}).json()
    assert ok["reminder_hour"] == 8 and ok["if_then"]
    assert c.get("/behavior/reminder-plan", headers=hp).json()["time"] == "08:00"                                                 # the coach moved the reminder
    tiny = c.post("/behavior/comeback", headers=hp, json={"barrier": "tired", "option": "tiny"}).json()
    assert tiny["option"] == "tiny"

    # a check-in afterwards marks the choices as having worked, and the impact report counts them (hidden under 5 people)
    from app.services import reengagement as rg
    db = SessionLocal()
    try:
        assert db.query(ComebackSession).filter_by(user_id=env["pat"], returned=False).count() == 2
        rg.mark_responses(db, env["pat"], plan_id, datetime.now(timezone.utc))
        assert db.query(ComebackSession).filter_by(user_id=env["pat"], returned=True).count() == 2
    finally:
        db.close()
    c.delete("/behavior/my-data", headers=hp)
    db = SessionLocal()
    try:
        assert db.query(ComebackSession).filter_by(user_id=env["pat"]).count() == 0                                                 # erase removes it too
    finally:
        db.close()


def test_the_reviewer_account_shows_all_three_on_real_logged_data(env):
    """The guest sandbox has 14 days of steps and meals and a habit that went quiet 4 days ago, so every card has something real to show."""
    c = env["client"]
    gp_ = c.post("/auth/guest", json={"role": "patient"}).json()
    h = {"Authorization": "Bearer " + gp_["access_token"]}
    g = c.get("/behavior/goals", headers=h).json()
    by = {i["id"]: i for i in g["items"]}
    assert by["steps"]["now"] is not None and by["sodium"]["now"] is not None and by["sodium"]["goal"] == 1500       # from the demo meals, hypertension
    assert c.get("/behavior/reminder-plan", headers=h).json()["time"]
    co = c.get("/behavior/comeback", headers=h).json()
    assert co["needed"] and co["missed_days"] == 4 and co["behavior"] == "movement"
