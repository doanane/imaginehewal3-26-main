"""The daily goals score is explained and honest, weight and sleep import from Apple Health without duplicates, and sessions last long. Offline."""
import os
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from test_doctor_portal import env  # noqa: F401,E402


def ago(**kw):
    return (datetime.now(timezone.utc) - timedelta(**kw)).replace(microsecond=0).isoformat()


def test_goals_score_is_explained_and_counts_only_tracked_goals(env):
    c = env["client"]
    d = c.get("/health/dashboard", headers=env["hp"])
    assert d.status_code == 200, d.text
    ds = d.json()["daily_score"]
    keys = [p["key"] for p in ds["breakdown"]]
    assert "steps" in keys
    assert "water" not in keys and "sleep" not in keys            # nothing logged for them: they must not drag the score to zero
    assert ds["score"] == round(sum(p["pct"] for p in ds["breakdown"]) / len(ds["breakdown"]))
    assert ds["trend_percentage"] is None                          # no invented "+0% this week"
    walking = next(t for t in d.json()["trends"] if t["category"] == "Walking")
    assert "Above average" not in walking["message"]               # the old text was made up


def test_sleep_import_feeds_the_score_once(env):
    c = env["client"]
    night = {"start": ago(hours=9), "end": ago(hours=1), "asleep_min": 420, "awake_min": 30, "deep_min": 80, "rem_min": 90, "light_min": 250}
    r = c.post("/activity/sleep/import", headers=env["hp"], json={"sessions": [night]})
    assert r.status_code == 200 and r.json()["added"] == 1
    assert c.post("/activity/sleep/import", headers=env["hp"], json={"sessions": [night]}).json()["added"] == 0      # sending it again adds nothing
    ds = c.get("/health/dashboard", headers=env["hp"]).json()["daily_score"]
    sleep = next(p for p in ds["breakdown"] if p["key"] == "sleep")
    assert sleep["pct"] == round(420 / 480 * 100) and "7 h" in sleep["detail"]
    shown = c.get("/activity/sleep?days=3", headers=env["hp"]).json()
    assert shown and any(s["source"] == "apple_health" for s in (shown if isinstance(shown, list) else shown.get("sessions", shown.get("nights", []))))
    bad = {"start": ago(hours=2), "end": ago(hours=1), "asleep_min": 10}                                               # too short to be a night
    assert c.post("/activity/sleep/import", headers=env["hp"], json={"sessions": [bad]}).json()["added"] == 0


def test_weight_import_is_idempotent_and_validated(env):
    c = env["client"]
    when = ago(days=2)
    r = c.post("/activity/weight/import", headers=env["hp"], json={"entries": [{"kg": 71.4, "at": when}, {"kg": 71.4, "at": when}]})
    assert r.status_code == 200 and r.json()["added"] == 1
    assert c.post("/activity/weight/import", headers=env["hp"], json={"entries": [{"kg": 71.4, "at": when}]}).json()["added"] == 0
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    assert c.post("/activity/weight/import", headers=env["hp"], json={"entries": [{"kg": 70, "at": future}]}).json()["added"] == 0
    assert c.post("/activity/weight/import", headers=env["hp"], json={"entries": [{"kg": 5, "at": when}]}).status_code == 422
    assert c.post("/activity/weight/import", json={"entries": []}).status_code in (401, 403)


def test_sessions_last_long_enough_not_to_log_people_out():
    from app.config import settings
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES >= 7 * 24 * 60
    assert settings.REFRESH_TOKEN_EXPIRE_DAYS >= 30


def test_sleep_import_keeps_the_stages_for_the_sleep_chart(env):
    c = env["client"]
    s0 = datetime.now(timezone.utc) - timedelta(days=3, hours=9)
    iso = lambda m: (s0 + timedelta(minutes=m)).replace(microsecond=0).isoformat()
    night = {"start": iso(0), "end": iso(480), "asleep_min": 430, "awake_min": 50,
             "stages": [{"stage": "light", "start": iso(0), "end": iso(200)}, {"stage": "deep", "start": iso(200), "end": iso(280)},
                        {"stage": "awake", "start": iso(280), "end": iso(330)}, {"stage": "rem", "start": iso(330), "end": iso(480)}]}
    assert c.post("/activity/sleep/import", headers=env["hp"], json={"sessions": [night]}).json()["added"] == 1
    rep = c.get("/activity/sleep?days=7", headers=env["hp"]).json()
    nights = rep.get("nights") or rep.get("sessions") or []
    mine = [n for n in nights if n.get("has_stages")]
    assert mine and mine[-1]["deep_min"] == 80 and mine[-1]["rem_min"] == 150 and mine[-1]["awake_min"] == 50
