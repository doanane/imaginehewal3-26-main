"""Audience segments and the Gulf setting: who the habit system is for beyond chronic disease, and the regional rules. Offline."""
import os
from datetime import date, datetime, timezone
from types import SimpleNamespace

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from app.services import audience as aud
from app.services import behavior_engine as eng
from app.services import gulf
from app.services import reengagement as rg
from test_doctor_portal import env, login  # noqa: F401,E402


def utc(y, m, d, h=0, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


# ------------------------------------------------------------------ segments
def test_segment_is_suggested_from_facts_and_the_person_wins():
    assert aud.suggest(30, ["Hypertension"], None) == "chronic"                 # a condition decides the safety framing first
    assert aud.suggest(30, [], "desk") == "sedentary"
    assert aud.suggest(25, [], "regular") == "young_adult"
    assert aud.suggest(45, [], "regular") == "adult"
    assert aud.suggest(70, [], "regular") == "older_adult"
    assert aud.suggest(None, [], "regular") is None                             # no facts, no guess
    assert aud.resolve("sedentary", 70, [], "regular") == "sedentary"
    assert aud.resolve("bogus", 70, [], "regular") == "older_adult"


def test_older_adults_grow_slower_and_get_a_safety_line_young_adults_get_a_social_one():
    normal = eng.target_for("movement", 3000, 8000, 3)
    slow = eng.target_for("movement", 3000, 8000, 3, grow=aud.grow_factor("older_adult"))
    fast = eng.target_for("movement", 3000, 8000, 3, grow=aud.grow_factor("young_adult"))
    assert 3000 < slow < normal < fast <= 8000                                   # always a step up, never past the goal
    d = date(2026, 11, 16)
    assert "chest pain" in " ".join(aud.notes_for("older_adult", "movement", "gh", d))
    assert "Challenge a friend" in " ".join(aud.notes_for("young_adult", "movement", "gh", d))
    assert aud.goals_for("older_adult", "movement", 3000, 8000) == (2500, 6000)
    assert aud.goals_for("chronic", "movement", 3000, 8000) == (3000, 8000)


def test_sedentary_workers_get_movement_breaks_not_a_step_count():
    assert eng.BEHAVIORS["breaks"]["unit"] == "movement breaks"
    a = eng.build_action("breaks", 1, 8, 2, date(2026, 11, 16), option_index=0)
    assert "break" in a["title"].lower() and a["target_value"] > 1
    fr = eng.build_action("breaks", 1, 8, 2, date(2026, 11, 16), option_index=0, lang="fr")
    ar = eng.build_action("breaks", 1, 8, 2, date(2026, 11, 16), option_index=0, lang="ar")
    assert fr["title"] != a["title"] and ar["title"] != a["title"]
    recs = eng.recommend_behaviors({"segment_resolved": "sedentary"}, {"conditions": []}, None, [])
    assert recs[0]["behavior"] == "breaks"
    assert eng.safety_note("breaks", {"bp_crisis": True})["hold_level"]            # health safety applies to everyone
    assert aud.send_window("sedentary", "ae", 1, None) == (10, 16)                  # reached in work hours on a workday
    assert aud.send_window("sedentary", "ae", 5, None) == (9, 18)                   # not on the weekend
    assert aud.send_window("sedentary", "ae", 1, 14) == (13, 15)                    # the person's own usual hour wins


# ------------------------------------------------------------------ the Gulf
def test_islamic_calendar_matches_the_known_start_of_ramadan_1447():
    assert gulf.hijri(date(2026, 2, 18)) == (1447, 9, 1)
    assert gulf.ramadan(date(2026, 3, 1))["is_ramadan"] and not gulf.ramadan(date(2026, 11, 16))["is_ramadan"]


def test_week_heat_and_emergency_numbers_by_region():
    assert gulf.day_kind(date(2026, 11, 14), "ae") == "weekend"                    # Saturday
    assert gulf.day_kind(date(2026, 11, 13), "ae") == "short_friday"
    assert gulf.heat_level(date(2026, 7, 10), "ae") == "extreme" and gulf.heat_level(date(2026, 7, 10), "gh") == "mild"
    assert gulf.emergency_numbers("ae")["ambulance"] == "998" and gulf.emergency_numbers("gh")["all"] == "112"
    assert gulf.emergency_numbers("zz")["all"] == "112"                             # unknown region falls back safely
    assert "ramadan" in " ".join(aud.notes_for("adult", "movement", "ae", date(2026, 3, 1))).lower()
    assert "very hot" in " ".join(aud.notes_for("adult", "movement", "ae", date(2026, 7, 10)))
    assert "very hot" not in " ".join(aud.notes_for("adult", "movement", "gh", date(2026, 7, 10)))      # no Gulf rules outside the Gulf


def test_prayer_times_are_sane_and_messages_avoid_prayer_and_fasting_hours():
    pt = gulf.prayer_times(date(2026, 11, 16), "ae")
    assert 4.5 < pt["fajr"] < 6 < pt["sunrise"] < 7 and 11 < pt["dhuhr"] < 13 and 17 < pt["maghrib"] < 18.5 and pt["isha"] > pt["maghrib"]
    assert gulf.prayer_times(date(2026, 11, 16), "gh") is None
    h = pt["dhuhr"] - 4                                                             # local to UTC
    assert "prayer" in gulf.nudge_gate(utc(2026, 11, 16, int(h), int((h % 1) * 60)), "ae")
    assert gulf.nudge_gate(utc(2026, 11, 16, 7, 30), "ae") is None                  # 11:30 local, an ordinary moment
    assert gulf.nudge_gate(utc(2026, 3, 2, 8, 0), "ae").startswith("Ramadan")       # midday while fasting
    assert gulf.nudge_gate(utc(2026, 3, 2, 17, 0), "ae") is None                    # 21:00 local, after iftar
    assert gulf.nudge_gate(utc(2026, 3, 2, 8, 0), "gh") is None                     # no fasting rule for other regions
    assert gulf.nudge_gate(utc(2026, 3, 2, 8, 0), "ae", respect_prayer=False) is None


def test_reengagement_uses_the_persons_clock_and_regional_gate():
    s = SimpleNamespace(notifications_enabled=True, reengage_channel="push", max_nudges_per_week=2, quiet_hours_start=21, quiet_hours_end=7)
    kw = dict(settings=s, missed_days=4, lapse_start=date(2026, 11, 12), recent=[], has_supporter=False, usual_hour=None)
    assert rg.decide(now=utc(2026, 11, 16, 7, 0), region="ae", **kw)["send"]        # 11:00 in the UAE
    assert not rg.decide(now=utc(2026, 11, 16, 17, 0), region="ae", **kw)["send"]   # 21:00 in the UAE: quiet hours
    r = rg.decide(now=utc(2026, 3, 2, 8, 0), region="ae", **kw)                     # fasting hours
    assert not r["send"] and "Ramadan" in r["reason"]
    assert rg.decide(now=utc(2026, 11, 16, 10, 0), **kw)["send"]                    # unchanged when no region is given


# ------------------------------------------------------------------ over HTTP
def test_context_api_accepts_segment_and_region_and_suggests(env):  # noqa: F811
    c, h = env["client"], env["hp"]
    got = c.get("/behavior/context", headers=h).json()
    assert got["region"] in ("gh", "ae") and "today" in got
    assert c.put("/behavior/context", headers=h, json={"segment": "nobody"}).status_code == 400
    assert c.put("/behavior/context", headers=h, json={"region": "mars"}).status_code == 400
    r = c.put("/behavior/context", headers=h, json={"segment": "sedentary", "region": "ae", "work_pattern": "desk"}).json()
    assert r["segment_resolved"] == "sedentary" and r["today"]["emergency"]["ambulance"] == "998" and r["today"]["prayer_times"]
    recs = c.get("/behavior/recommendations", headers=h).json()["recommendations"]
    assert recs[0]["behavior"] == "breaks" and recs[0]["goal_value"] == 8
    plan = c.post("/behavior/plans", headers=h, json={"behavior": "breaks", "goal_text": "Move at work"}).json()
    assert plan["goal_value"] == 8 and plan["unit"] == "movement breaks"
    assert c.put("/behavior/context", headers=h, json={"segment": "", "region": "gh", "work_pattern": "regular"}).json()["segment"] is None


def test_emergency_config_follows_the_persons_region(env):  # noqa: F811
    c, h = env["client"], env["hp"]
    c.put("/behavior/context", headers=h, json={"region": "gh"})
    assert c.get("/emergency/config", headers=h).json()["emergency_number"] == "112"
    c.put("/behavior/context", headers=h, json={"region": "ae"})
    r = c.get("/emergency/config", headers=h).json()
    assert r["emergency_number"] == "998" and r["numbers"]["police"] == "999" and r["region"] == "ae"
    c.put("/behavior/context", headers=h, json={"region": "gh"})
