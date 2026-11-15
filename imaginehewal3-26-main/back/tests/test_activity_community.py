"""Activity, leaderboard and community. Offline: no network, no keys."""
import json
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


def _recent_start() -> str:
    """A run start that is recent but always inside today's date, even when the tests are run a few minutes after midnight."""
    midnight = datetime.combine(datetime.now().date(), datetime.min.time()).astimezone(timezone.utc)
    return max(datetime.now(timezone.utc) - timedelta(minutes=30), midnight + timedelta(seconds=5)).isoformat()



@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User, UserProfile
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    mk = lambda n, **k: User(email=f"ac_{n}@example.com", username=f"ac_{n}", hashed_password=get_password_hash("Passw0rd!x1"), **k)
    users = {n: mk(n, first_name=n.upper()) for n in ("a", "b", "c", "d", "e")}
    db.add_all(users.values()); db.commit()
    db.add(UserProfile(user_id=users["a"].id, full_name="A", age=40, gender="f", weight=80, height=170, chronic_conditions=[]))
    db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), ids={n: u.id for n, u in users.items()}, h={n: tok(u) for n, u in users.items()})
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for u in users.values():
        row = db2.query(User).filter(User.id == u.id).first()
        if row:
            delete_account(db2, row)
    db2.close(); db.close()


def _db():
    from app.database import SessionLocal
    return SessionLocal()


def _route(speed_ms, seconds, step_s=5):
    """A straight line heading north at a constant speed, one point every `step_s` seconds."""
    deg_per_m = 1 / 111195.0
    return [[5.6 + speed_ms * t * deg_per_m, -0.19, float(t)] for t in range(0, seconds + 1, step_s)]


# ======================================================================= maths
def test_route_distance_splits_and_fastest_pace():
    from app.services import activity_service as svc
    r = svc.analyze_route(_route(4.0, 330), "run")                 # 4 m/s for 330 s = 1320 m
    assert 1300 < r["distance_m"] < 1340 and r["plausible"]
    assert r["splits"][0]["km"] == 1 and abs(r["splits"][0]["pace_s"] - 250) <= 2 and r["splits"][0]["partial"] is False
    assert r["splits"][1]["partial"] is True and abs(r["splits"][1]["pace_s"] - 250) <= 5
    assert abs(r["fastest_pace_s_km"] - 250) <= 2


def test_implausible_speed_is_flagged():
    from app.services import activity_service as svc
    assert svc.analyze_route(_route(12.0, 120), "run")["plausible"] is False        # 43 km/h on foot
    assert svc.analyze_route(_route(10.0, 120), "cycle")["plausible"] is True
    assert svc.analyze_route(_route(10.0, 120), "walk")["plausible"] is False
    assert svc.plausible_without_route("run", 5000, 600, None) is False             # 5 km in 10 minutes
    assert svc.plausible_without_route("run", 5000, 1800, 20000) is False           # more steps a minute than a sprinter
    assert svc.calories("run", 70, 3600) == 686 and svc.calories("walk", None, 3600) == round(3.8 * 70)


# ======================================================================= steps, goals, workouts
def test_steps_only_go_up_and_are_bounded(env):
    c, h = env["client"], env["h"]["a"]
    assert c.post("/activity/steps", json={"steps": 5000}, headers=h).json()["steps"] == 5000
    assert c.post("/activity/steps", json={"steps": 3000}, headers=h).json()["steps"] == 5000      # a lower number never overwrites
    assert c.post("/activity/steps", json={"steps": 7200}, headers=h).json()["steps"] == 7200
    assert c.post("/activity/steps", json={"steps": 999999}, headers=h).status_code == 422
    tomorrow = (datetime.now().date() + timedelta(days=1)).isoformat()
    assert c.post("/activity/steps", json={"steps": 10, "date": tomorrow}, headers=h).status_code == 400
    assert c.post("/activity/steps", json={"steps": 10}).status_code in (401, 403)


def test_goals_and_summary_rings(env):
    c, h = env["client"], env["h"]["a"]
    assert c.get("/activity/goals", headers=h).json()["steps"] == 8000
    assert c.put("/activity/goals", json={"steps": 500}, headers=h).status_code == 422
    assert c.put("/activity/goals", json={"steps": 6000, "target_weight_kg": 72}, headers=h).json()["steps"] == 6000
    s = c.get("/activity/summary", headers=h).json()
    assert s["rings"]["steps"] == {"value": 7200, "goal": 6000} and s["rings"]["calories"]["value"] > 0 and s["rings"]["minutes"]["value"] > 0


def test_workout_server_recomputes_distance_and_flags_cheating(env):
    c, h = env["client"], env["h"]["a"]
    start = _recent_start()
    ok = c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 330, "distance_m": 99999, "route": _route(4.0, 330)}, headers=h).json()
    assert 1300 < ok["distance_m"] < 1340 and ok["flagged"] is False                  # the claimed 99,999 m is ignored
    assert ok["splits"][0]["km"] == 1 and "first_workout" in ok["new_achievements"]
    fake = c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 120, "route": _route(12.0, 120)}, headers=h).json()
    assert fake["flagged"] is True and "leaderboards" in fake["flag_note"]
    manual = c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 600, "distance_m": 5000, "source": "manual"}, headers=h).json()
    assert manual["flagged"] is True
    assert c.post("/activity/workouts", json={"kind": "swim", "started_at": start, "duration_s": 600}, headers=h).status_code == 422
    assert c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 600, "route": [[200, 0, 0], [0, 0, 5]]}, headers=h).status_code == 422
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert c.post("/activity/workouts", json={"kind": "run", "started_at": future, "duration_s": 600}, headers=h).status_code == 400
    lst = c.get("/activity/workouts", headers=h).json()
    assert len(lst) == 3 and all("route" not in w for w in lst)                       # the list is light; detail has the route
    assert c.get(f"/activity/workouts/{ok['id']}", headers=h).json()["route"]
    assert c.get(f"/activity/workouts/{ok['id']}", headers=env["h"]["b"]).status_code == 404   # not someone else's
    assert c.delete(f"/activity/workouts/{fake['id']}", headers=env["h"]["b"]).status_code == 404
    assert c.delete(f"/activity/workouts/{fake['id']}", headers=h).json()["deleted"]


# ======================================================================= weight and sleep
def test_weight_trends_goal_progress_and_safety_note(env):
    from app.models.activity import WeightLog
    c, h, db = env["client"], env["h"]["a"], _db()
    assert c.post("/activity/weight", json={"kg": 5}, headers=h).status_code == 422
    now = datetime.now(timezone.utc)
    for days_ago, kg in ((42, 84.0), (35, 83.2), (28, 82.1), (21, 81.0), (14, 79.8), (7, 78.5)):
        db.add(WeightLog(user_id=env["ids"]["a"], kg=kg, at=now - timedelta(days=days_ago)))
    db.commit(); db.close()
    c.post("/activity/weight", json={"kg": 77.4}, headers=h)
    r = c.get("/activity/weight?report=weekly", headers=h).json()
    st = r["stats"]
    assert st["trend"] == "losing" and st["change_kg"] == -6.6 and st["latest_kg"] == 77.4 and st["bmi"] == round(77.4 / 1.7 ** 2, 1)
    assert st["target_kg"] == 72 and 0 < st["goal_progress"] < 1 and st["to_go_kg"] == 5.4
    assert len(r["buckets"]) >= 5 and r["points"][0]["kg"] == 84.0
    assert any("healthy pace" in n or "safe pace" in n for n in st["notes"])
    assert c.get("/activity/weight?report=monthly", headers=h).json()["report"] == "monthly"


def test_sleep_stages_score_and_advice(env):
    from app.services import activity_service as svc
    c, h = env["client"], env["h"]["a"]
    end = datetime.now(timezone.utc) - timedelta(hours=1)
    start = end - timedelta(hours=7, minutes=30)
    def seg(stage, a, b): return {"stage": stage, "start": (start + timedelta(minutes=a)).isoformat(), "end": (start + timedelta(minutes=b)).isoformat()}
    stages = [seg("light", 0, 120), seg("deep", 120, 210), seg("light", 210, 300), seg("rem", 300, 380), seg("awake", 380, 395), seg("light", 395, 450)]
    r = c.post("/activity/sleep", json={"start": start.isoformat(), "end": end.isoformat(), "stages": stages, "source": "apple_health"}, headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert (s["deep_min"], s["rem_min"], s["awake_min"], s["light_min"]) == (90, 80, 15, 265) and s["asleep_min"] == 435 and s["has_stages"] and 60 <= s["score"] <= 100
    bad = [{"stage": "deep", "start": (start - timedelta(hours=3)).isoformat(), "end": (start + timedelta(minutes=10)).isoformat()}]
    assert c.post("/activity/sleep", json={"start": start.isoformat(), "end": end.isoformat(), "stages": bad}, headers=h).status_code == 422
    assert c.post("/activity/sleep", json={"start": start.isoformat(), "end": (start + timedelta(minutes=10)).isoformat()}, headers=h).status_code == 422
    rep = c.get("/activity/sleep", headers=h).json()
    assert rep["last"]["total_min"] == 450 and rep["avg_hours"] == round(435 / 60, 1) and rep["advice"]
    assert svc.sleep_advice(5.0, 8.0, 15.0, 90)[0].startswith("You are sleeping under 7 hours") and len(svc.sleep_advice(5.0, 8.0, 15.0, 90)) == 4
    assert svc.sleep_advice(8.0, 18.0, 5.0, 20) == ["Your sleep looks healthy. Keep your bedtime and wake time regular."]
    assert svc.sleep_score(300, 0, 0, 0, False)[0] < svc.sleep_score(450, 0, 0, 0, False)[0]       # short sleep scores lower
    assert len(c.get("/activity/knowledge", headers=h).json()["items"]) >= 5


# ======================================================================= leaderboard
def test_leaderboard_is_opt_in_ranked_private_and_cheat_resistant(env):
    c, H = env["client"], env["h"]
    start = _recent_start()
    assert c.post("/competition/join", json={"display_name": "Speedy"}, headers=H["b"]).status_code == 400            # rules not accepted
    assert c.post("/competition/join", json={"display_name": "ab@x.com", "accept_rules": True}, headers=H["b"]).status_code == 422
    assert c.post("/competition/join", json={"display_name": "0244123456", "accept_rules": True}, headers=H["b"]).status_code == 422
    for n, name in (("a", "Ama Runner"), ("b", "Kofi Fast"), ("c", "Efua Walks")):
        assert c.post("/competition/join", json={"display_name": name, "accept_rules": True}, headers=H[n]).json()["on_leaderboard"] is True
    # d syncs lots of steps but never joins, so must not appear anywhere
    c.post("/activity/steps", json={"steps": 40000}, headers=H["d"])
    c.post("/activity/steps", json={"steps": 12000}, headers=H["a"]); c.post("/activity/steps", json={"steps": 8000}, headers=H["b"]); c.post("/activity/steps", json={"steps": 8000}, headers=H["c"])
    b = c.get("/competition/board?category=steps&period=today", headers=H["b"]).json()
    assert [r["name"] for r in b["rows"]][0] == "Ama Runner" and b["participants"] == 3
    assert [r["rank"] for r in b["rows"]] == [1, 2, 2]                                  # ties share a rank
    assert b["me"]["name"] == "Kofi Fast" and b["me"]["rank"] == 2 and len(b["podium"]) == 3
    raw = json.dumps(b).lower()
    assert "user_id" not in raw and "@example.com" not in raw and "ac_d" not in raw      # no emails, no ids, and non-members are absent
    assert [r["name"] for r in c.get("/competition/board?category=steps&period=today&q=efua", headers=H["a"]).json()["rows"]] == ["Efua Walks"]
    assert c.get("/competition/board?category=bogus", headers=H["a"]).status_code == 422
    # a verified run counts for distance; a fake one does not
    c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 330, "route": _route(4.0, 330)}, headers=H["c"])
    c.post("/activity/workouts", json={"kind": "run", "started_at": start, "duration_s": 120, "route": _route(12.0, 120)}, headers=H["b"])
    dist = {r["name"]: r["value"] for r in c.get("/competition/board?category=distance&period=week", headers=H["a"]).json()["rows"]}
    assert 1.3 < dist["Efua Walks"] < 1.34 and dist["Kofi Fast"] == 0
    pts = {r["name"]: r["value"] for r in c.get("/competition/board?category=points&period=today", headers=H["a"]).json()["rows"]}
    assert pts["Ama Runner"] >= 120 and pts["Efua Walks"] > 80 and pts["Ama Runner"] > pts["Kofi Fast"]   # 12000 steps alone is 120 points; her earlier verified run adds more
    c.post("/competition/leave", headers=H["c"])
    assert "Efua Walks" not in [r["name"] for r in c.get("/competition/board?category=steps&period=today", headers=H["a"]).json()["rows"]]


def test_achievements_are_earned_from_real_data(env):
    c, H = env["client"], env["h"]
    assert c.post("/activity/steps", json={"steps": 4000}, headers=H["e"]).json()["new_achievements"] == []        # not yet
    assert "steps_10k" in c.post("/activity/steps", json={"steps": 10500}, headers=H["e"]).json()["new_achievements"]
    assert c.post("/activity/steps", json={"steps": 11000}, headers=H["e"]).json()["new_achievements"] == []      # awarded once only
    items = {a["key"]: a for a in c.get("/competition/achievements", headers=H["a"]).json()["items"]}
    assert items["steps_10k"]["earned"] and items["first_workout"]["earned"] and not items["km_100"]["earned"]
    mine = {a["key"]: a for a in c.get("/competition/achievements", headers=H["e"]).json()["items"]}
    assert mine["steps_10k"]["earned"] and not mine["first_workout"]["earned"]


def test_leaderboard_updates_are_pushed_live(env):
    c, H = env["client"], env["h"]
    from app.auth.security import create_access_token
    tok_a = create_access_token({"sub": str(env["ids"]["a"])}, "patient")
    import app.services.competition_service as cs
    with c.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": tok_a})
        assert ws.receive_json()["type"] == "ready"
        cs._last["t"] = 0.0
        c.post("/activity/steps", json={"steps": 13000}, headers=H["b"])             # b is on the board, so everyone is nudged
        assert ws.receive_json() == {"type": "leaderboard.update"}


# ======================================================================= community
def test_community_requires_joining_and_enforces_rules(env, monkeypatch):
    from app.services import simple_limiter
    from app.routers import community
    simple_limiter.reset()
    c, H = env["client"], env["h"]
    assert c.post("/community/posts", data={"category": "discussion", "body": "hello"}, headers=H["e"]).status_code == 403   # not joined
    assert c.post("/community/join", json={"accept_rules": False}, headers=H["e"]).status_code == 400
    assert c.post("/community/join", json={"display_name": "Esi Health", "accept_rules": True}, headers=H["e"]).json()["joined"]
    post = lambda **k: c.post("/community/posts", data=k, headers=H["e"])
    assert post(category="discussion", body="How do you cope with low salt cooking?", title="Low salt").status_code == 200
    assert post(category="nonsense", body="x").status_code == 422
    assert post(category="discussion", body="Selling my glucose strips for GHS 50").status_code == 422             # selling belongs in the marketplace
    assert post(category="discussion", body="see http://a.com and http://b.com").status_code == 422
    assert post(category="marketplace", body="Smart watch like new").status_code == 422                               # needs category and price
    assert post(category="marketplace", body="Insulin pens, cheap", product_category="Other health device", price="20").status_code == 422
    assert post(category="marketplace", body="Antibiotics for sale", product_category="Other health device", price="20").status_code == 422
    assert post(category="marketplace", body="Phone chargers", product_category="Electronics", price="20").status_code == 422
    ok = post(category="marketplace", body="Omron blood pressure monitor, barely used", product_category="Blood pressure monitor", price="180", contact_phone="+233 24 123 4567")
    assert ok.status_code == 200 and ok.json()["price"] == 180 and ok.json()["contact_phone"] == "+233241234567"
    assert post(category="marketplace", body="Scale", product_category="Weighing scale", price="30", contact_phone="abc").status_code == 422
    crisis = post(category="discussion", body="I feel hopeless and I want to end my life").json()
    assert "112" in crisis["support_notice"]                                                                         # kindly shown to the author, never blocked


def test_images_comments_likes_reports_and_deletion(env, monkeypatch):
    from app.services import simple_limiter
    from app.services.storage_service import storage_service
    simple_limiter.reset()
    c, H = env["client"], env["h"]
    for n, name in (("a", "Ama R"), ("b", "Kofi F"), ("c", "Efua W"), ("d", "Dede D")):
        c.post("/community/join", json={"display_name": name + " club", "accept_rules": True}, headers=H[n])
    async def fake_upload(file, folder="general"): return f"/uploads/{folder}/test.png"
    monkeypatch.setattr(storage_service, "upload_file", fake_upload)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    p = c.post("/community/posts", data={"category": "tip", "body": "Groundnut soup with less oil"}, files={"file": ("a.png", png, "image/png")}, headers=H["a"])
    assert p.status_code == 200 and p.json()["image_url"] == "/uploads/community/test.png"
    assert c.post("/community/posts", data={"category": "tip", "body": "x"}, files={"file": ("a.exe", b"MZ", "application/octet-stream")}, headers=H["a"]).status_code == 400
    # a phone often labels a real photo "application/octet-stream" or nothing at all: the file's own bytes decide
    for label in ("application/octet-stream", "image/png", ""):
        simple_limiter.reset()
        ok = c.post("/community/posts", data={"category": "tip", "body": "Photo labelled " + (label or "nothing")}, files={"file": ("shot", png, label)}, headers=H["a"])
        assert ok.status_code == 200, (label, ok.text)
    jpeg = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"0" * 50
    webp = b"RIFF" + bytes(4) + b"WEBP" + b"0" * 50
    for good in (jpeg, webp):
        simple_limiter.reset()                         # posting is rate limited; this test is about the file type
        assert c.post("/community/posts", data={"category": "tip", "body": "Another photo"}, files={"file": ("x", good, "application/octet-stream")}, headers=H["a"]).status_code == 200
    # a script renamed to .png and labelled image/png is still refused
    simple_limiter.reset()
    assert c.post("/community/posts", data={"category": "tip", "body": "x"}, files={"file": ("a.png", b"<?php echo 1; ?>", "image/png")}, headers=H["a"]).status_code == 400
    assert c.post("/community/posts", data={"category": "tip", "body": "x"}, files={"file": ("a.png", b"0" * (6 * 1024 * 1024), "image/png")}, headers=H["a"]).status_code == 400
    pid = p.json()["id"]

    assert c.post(f"/community/posts/{pid}/comments", json={"body": "Thanks, trying it tonight"}, headers=H["b"]).status_code == 200
    assert c.post(f"/community/posts/{pid}/like", headers=H["b"]).json() == {"liked": True, "likes": 1}
    assert c.post(f"/community/posts/{pid}/like", headers=H["c"]).json()["likes"] == 2
    assert c.post(f"/community/posts/{pid}/like", headers=H["b"]).json() == {"liked": False, "likes": 1}               # toggles
    d = c.get(f"/community/posts/{pid}", headers=H["c"]).json()
    assert d["likes"] == 1 and d["comments"] == 1 and d["comment_list"][0]["author"] == "Kofi F club" and d["liked"] is True and d["mine"] is False
    assert "email" not in json.dumps(d).lower() and "@" not in json.dumps(d)

    assert c.post(f"/community/posts/{pid}/report", json={"reason": "spam"}, headers=H["a"]).status_code == 400        # cannot report your own
    assert c.post(f"/community/posts/{pid}/report", json={"reason": "meh"}, headers=H["b"]).status_code == 422
    for n in ("b", "c"):
        assert c.post(f"/community/posts/{pid}/report", json={"reason": "unsafe_advice"}, headers=H[n]).json()["hidden"] is False
    assert c.post(f"/community/posts/{pid}/report", json={"reason": "unsafe_advice"}, headers=H["b"]).json()["hidden"] is False   # same person twice counts once
    assert c.post(f"/community/posts/{pid}/report", json={"reason": "unsafe_advice"}, headers=H["d"]).json()["hidden"] is True    # third person hides it
    ids = lambda who: [x["id"] for x in c.get("/community/posts", headers=H[who]).json()["items"]]
    assert pid not in ids("b") and pid in ids("a")                                                                    # hidden for others, still visible to the author
    assert c.get(f"/community/posts/{pid}", headers=H["b"]).status_code == 404

    assert c.delete(f"/community/posts/{pid}", headers=H["b"]).status_code == 404                                       # only the author can delete
    cid = d["comment_list"][0]["id"]
    assert c.delete(f"/community/comments/{cid}", headers=H["c"]).status_code == 404
    assert c.delete(f"/community/comments/{cid}", headers=H["b"]).json()["deleted"]
    assert c.delete(f"/community/posts/{pid}", headers=H["a"]).json()["deleted"]


def test_rate_limits_and_pagination(env):
    from app.services import simple_limiter
    simple_limiter.reset()
    c, H = env["client"], env["h"]
    codes = [c.post("/community/posts", data={"category": "discussion", "body": f"post {i}"}, headers=H["e"]).status_code for i in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
    page1 = c.get("/community/posts?limit=2", headers=H["a"]).json()
    assert len(page1["items"]) == 2 and page1["next_before_id"]
    page2 = c.get(f"/community/posts?limit=2&before_id={page1['next_before_id']}", headers=H["a"]).json()
    assert page2["items"] and max(i["id"] for i in page2["items"]) < page1["next_before_id"]
    cats = {i["category"] for i in c.get("/community/posts?category=marketplace", headers=H["a"]).json()["items"]}
    assert cats <= {"marketplace"}
    simple_limiter.reset()


def test_deleting_an_author_removes_other_peoples_comments_on_their_posts(env):
    from app.models.activity import CommunityPost, PostComment
    from app.models.user import User
    from app.services.privacy_service import delete_account
    c, H, db = env["client"], env["h"], _db()
    pid = c.post("/community/posts", data={"category": "discussion", "body": "A post that will outlive nobody"}, headers=H["d"]).json()["id"]
    c.post(f"/community/posts/{pid}/comments", json={"body": "nice"}, headers=H["a"])
    c.post(f"/community/posts/{pid}/like", headers=H["a"])
    uid = env["ids"]["d"]
    delete_account(db, db.query(User).filter(User.id == uid).first())
    assert db.query(CommunityPost).filter_by(user_id=uid).count() == 0 and db.query(PostComment).filter_by(post_id=pid).count() == 0
    db.close()


def test_workout_detail_fills_what_it_honestly_can(env):
    """A walk with no GPS: the detail gets a labelled steps estimate, a cadence, and heart rate from real readings taken during the walk."""
    from app.models.iot_device import VitalReading
    c, h, uid = env["client"], env["h"]["a"], env["ids"]["a"]
    start = datetime.now(timezone.utc) - timedelta(minutes=20)
    w = c.post("/activity/workouts", json={"kind": "walk", "started_at": start.isoformat(), "duration_s": 600, "steps": 800}, headers=h).json()
    d = c.get(f"/activity/workouts/{w['id']}", headers=h).json()
    assert d["distance_m"] == 0 and d["estimate"]["distance_m"] == round(800 * 0.415 * 1.70) and d["cadence_spm"] == 80   # height 170 cm from the profile
    assert d["avg_hr"] is None and d["hr_source"] is None                                  # nothing recorded: nothing invented
    db = _db()
    db.add_all([VitalReading(user_id=uid, heart_rate=hr, timestamp=start + timedelta(minutes=m)) for hr, m in ((100, 2), (110, 5), (120, 8))])
    db.add(VitalReading(user_id=uid, heart_rate=60, timestamp=start - timedelta(hours=3)))   # outside the walk: ignored
    db.commit(); db.close()
    d = c.get(f"/activity/workouts/{w['id']}", headers=h).json()
    assert d["avg_hr"] == 110 and d["max_hr"] == 120 and d["hr_source"] == "vitals"
    with_gps = c.post("/activity/workouts", json={"kind": "run", "started_at": _recent_start(), "duration_s": 330, "steps": 900, "route": _route(4.0, 330)}, headers=h).json()
    assert c.get(f"/activity/workouts/{with_gps['id']}", headers=h).json()["estimate"] is None   # real GPS distance: no estimate
    c.delete(f"/activity/workouts/{w['id']}", headers=h); c.delete(f"/activity/workouts/{with_gps['id']}", headers=h)
