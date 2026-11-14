"""Wellbeing hub: challenges, score, library, groups and reviews. Offline: no network, no keys."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.auth.hashing import get_password_hash
    from app.models.user import User
    from app.services import simple_limiter
    from app.services.privacy_service import delete_account
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    for n in ("a", "b", "c"):
        old = db.query(User).filter_by(email=f"ex_{n}@example.com").first()
        if old:
            delete_account(db, old)
    users = {n: User(email=f"ex_{n}@example.com", username=f"ex_{n}", hashed_password=get_password_hash("Passw0rd!x1"), first_name=n.upper()) for n in ("a", "b", "c")}
    db.add_all(users.values()); db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), ids={n: u.id for n, u in users.items()}, h={n: tok(u) for n, u in users.items()}, db=db)
    yield out
    db2 = SessionLocal()
    for n in users:
        u = db2.query(User).filter_by(email=f"ex_{n}@example.com").first()
        if u:
            delete_account(db2, u)
    db2.close(); db.close()


def _join(env, who, name):
    r = env["client"].post("/community/join", json={"display_name": name, "accept_rules": True}, headers=env["h"][who])
    assert r.status_code == 200, r.text


def test_score_needs_two_areas_then_renormalises(env):
    c, h, db, uid = env["client"], env["h"]["a"], env["db"], env["ids"]["a"]
    r = c.get("/explore/score", headers=h).json()
    assert r["score"] is None and r["parts_used"] == 0 and r["message"]
    from app.models.health import HealthData
    from app.models.activity import SleepSession
    db.add(HealthData(user_id=uid, date=datetime.now(), steps=9000)); db.commit()
    assert c.get("/explore/score", headers=h).json()["score"] is None          # one area is not enough for a number
    now = datetime.now(timezone.utc)
    db.add(SleepSession(user_id=uid, start=now - timedelta(hours=9), end=now - timedelta(hours=1), total_min=480)); db.commit()
    r = c.get("/explore/score", headers=h).json()
    assert r["parts_used"] == 2 and r["score"] == 100 and r["band"] == "Excellent"        # steps above the default goal, 8 hours of sleep
    missing = [d["key"] for d in r["domains"] if not d["has_data"]]
    assert set(missing) == {"nutrition", "mind", "habits"} and all(d["value"] is None for d in r["domains"] if not d["has_data"])
    assert "not a diagnosis" in r["note"]


def test_challenge_progress_comes_from_real_data(env):
    c, h = env["client"], env["h"]["a"]
    items = c.get("/explore/challenges", headers=h).json()["items"]
    assert all(not i["joined"] and "value" not in i for i in items)
    r = c.post("/explore/challenges/steps/join", headers=h).json()
    steps = next(i for i in r["items"] if i["key"] == "steps")
    assert steps["joined"] and steps["value"] == 9000 and steps["percent"] == 18 and not steps["done"]
    c.post("/explore/challenges/steps/join", headers=h)                              # joining twice changes nothing
    c.post("/explore/challenges/mind/join", headers=h)
    mind = next(i for i in c.get("/explore/challenges", headers=h).json()["items"] if i["key"] == "mind")
    assert mind["value"] == 0 and mind["percent"] == 0
    assert c.post("/explore/challenges/nope/join", headers=h).status_code == 404
    left = c.post("/explore/challenges/mind/leave", headers=h).json()
    assert not next(i for i in left["items"] if i["key"] == "mind")["joined"]


def test_board_shows_only_people_who_opted_in(env):
    c = env["client"]
    _join(env, "a", "Ama Test")
    assert c.post("/competition/join", json={"display_name": "Ama Test", "accept_rules": True}, headers=env["h"]["a"]).status_code == 200
    c.post("/explore/challenges/steps/join", headers=env["h"]["b"])               # b joined but never opted in to leaderboards
    b = c.get("/explore/challenges/steps", headers=env["h"]["a"]).json()["board"]
    assert [r["name"] for r in b["rows"]] == ["Ama Test"] and b["rows"][0]["is_me"] and b["rows"][0]["value"] == 9000
    assert b["members"] == 2
    assert c.get("/explore/challenges/steps", headers=env["h"]["a"]).json()["challenge"]["members"] is None          # a count under 5 is not published


def test_library_read_is_idempotent_and_counts_for_the_challenge(env):
    c, h = env["client"], env["h"]["a"]
    lib = c.get("/explore/library", headers=h).json()
    assert len(lib["items"]) >= 8 and "not personal medical advice" in lib["notice"]
    assert {i["category"] for i in lib["items"]} == {"physical", "mental", "nutrition", "sleep"}
    assert all(i["key"] for i in c.get("/explore/library?category=sleep", headers=h).json()["items"])
    assert [i["key"] for i in c.get("/explore/library?q=salt", headers=h).json()["items"]] == ["salt"]
    art = c.get("/explore/library/salt", headers=h).json()
    assert art["body"] and not art["read"]
    c.post("/explore/challenges/learn/join", headers=h)
    c.post("/explore/library/salt/read", headers=h); c.post("/explore/library/salt/read", headers=h)
    learn = next(i for i in c.get("/explore/challenges", headers=h).json()["items"] if i["key"] == "learn")
    assert learn["value"] == 1                                                      # reading the same article twice counts once
    assert c.post("/explore/library/salt/save", headers=h).json()["saved"] is True
    assert c.post("/explore/library/salt/save", headers=h).json()["saved"] is False
    assert c.get("/explore/library/missing", headers=h).status_code == 404


def test_group_posts_stay_in_their_group(env):
    c = env["client"]
    ha, hb = env["h"]["a"], env["h"]["b"]
    _join(env, "b", "Kofi Test")
    assert c.post("/explore/groups/walking/join", headers=env["h"]["c"]).status_code == 403          # must join the community first
    assert c.post("/explore/groups/walking/join", headers=ha).status_code == 200
    r = c.post("/community/posts", data={"category": "discussion", "body": "Morning walk at the park", "group_key": "walking"}, headers=ha)
    assert r.status_code == 200, r.text
    assert c.post("/community/posts", data={"category": "discussion", "body": "I should not post here", "group_key": "walking"}, headers=hb).status_code == 403
    assert c.post("/community/posts", data={"category": "discussion", "body": "Hello everyone", "group_key": "bogus"}, headers=ha).status_code == 403
    in_group = c.get("/community/posts?group=walking", headers=hb).json()["items"]
    assert [p["body"] for p in in_group] == ["Morning walk at the park"]
    assert "Morning walk at the park" not in [p["body"] for p in c.get("/community/posts", headers=hb).json()["items"]]
    groups = c.get("/explore/groups", headers=ha).json()["items"]
    walking = next(g for g in groups if g["key"] == "walking")
    assert walking["joined"] and walking["members"] is None
    left = c.post("/explore/groups/walking/leave", headers=ha).json()["items"]
    assert not next(g for g in left if g["key"] == "walking")["joined"]


def test_reviews_one_per_member_with_average(env):
    c = env["client"]
    ha, hb = env["h"]["a"], env["h"]["b"]
    base = c.get("/community/reviews", headers=ha).json()
    assert c.post("/community/reviews", json={"title": "Great", "body": "Helps me walk every day", "rating": 5}, headers=env["h"]["c"]).status_code == 403
    r = c.post("/community/reviews", json={"title": "Great app", "body": "Helps me walk every day", "rating": 5}, headers=ha)
    assert r.status_code == 200 and r.json()["author"] == "Ama Test" and r.json()["mine"]
    c.post("/community/reviews", json={"title": "Great app", "body": "Still helping me walk daily", "rating": 4}, headers=ha)       # edits, does not add
    c.post("/community/reviews", json={"title": "Useful", "body": "The library articles are clear", "rating": 2}, headers=hb)
    after = c.get("/community/reviews", headers=ha).json()
    assert after["count"] == base["count"] + 2
    mine = after["mine"]
    assert mine["rating"] == 4 and mine["edited"] and mine["body"].startswith("Still")
    assert sum(after["distribution"].values()) == after["count"]
    assert c.post("/community/reviews", json={"title": "Spam", "body": "visit https://example.com now", "rating": 5}, headers=hb).status_code == 422
    assert c.post("/community/reviews", json={"title": "x", "body": "too short", "rating": 5}, headers=hb).status_code == 422
    assert c.post("/community/reviews", json={"title": "Fine", "body": "A long enough body here", "rating": 6}, headers=hb).status_code == 422
    assert c.delete("/community/reviews/mine", headers=hb).json()["deleted"]
    assert c.get("/community/reviews", headers=hb).json()["mine"] is None
