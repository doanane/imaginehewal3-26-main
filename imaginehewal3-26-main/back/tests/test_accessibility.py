"""Accessibility preferences: saved per account, validated, and pushed live to the account's other devices. Offline."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_ac.db")

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
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    mk = lambda n: User(email=f"ax_{n}@example.com", username=f"ax_{n}", hashed_password=get_password_hash("Passw0rd!x1"))
    a, b = mk("a"), mk("b")
    db.add_all([a, b]); db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    out = dict(client=TestClient(app), a=a.id, ha=tok(a), hb=tok(b))
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for uid in (a.id, b.id):
        row = db2.query(User).filter(User.id == uid).first()
        if row:
            delete_account(db2, row)
    db2.close(); db.close()


FULL = dict(fontSize=2, contrast="dark", colorBlind="deuteranopia", grayscale=False, saturation=1, dimmer=2, zoom=1, hideImages=True,
            boldText=True, underlineLinks=True, highlightLinks=False, stopAnimations=True, readingGuide=True, keyboardNavigation=True,
            screenReader=True, language="tw")


def test_defaults_then_save_and_reload(env):
    c = env["client"]
    first = c.get("/accessibility/preferences", headers=env["ha"]).json()["settings"]
    assert first["contrast"] == "default" and first["fontSize"] == 0
    r = c.put("/accessibility/preferences", headers=env["ha"], json=FULL)
    assert r.status_code == 200, r.text
    assert c.get("/accessibility/preferences", headers=env["ha"]).json()["settings"] == FULL       # every option survives a round trip


def test_settings_belong_to_one_account(env):
    c = env["client"]
    c.put("/accessibility/preferences", headers=env["ha"], json=FULL)
    assert c.get("/accessibility/preferences", headers=env["hb"]).json()["settings"]["contrast"] == "default"


def test_bad_values_are_rejected(env):
    c = env["client"]
    for bad in ({"contrast": "neon"}, {"colorBlind": "x"}, {"language": "xx"}, {"fontSize": 9}, {"dimmer": 9}, {"zoom": 5}):
        assert c.put("/accessibility/preferences", headers=env["ha"], json={**FULL, **bad}).status_code == 422, bad
    assert c.get("/accessibility/preferences").status_code in (401, 403)


def test_a_change_is_pushed_live_to_the_account(env, monkeypatch):
    from app import realtime
    sent = []
    monkeypatch.setattr(realtime.hub, "send_from_thread", lambda uid, ev: sent.append((uid, ev)))
    env["client"].put("/accessibility/preferences", headers=env["ha"], json={**FULL, "contrast": "high"})
    assert sent and sent[0][0] == env["a"] and sent[0][1]["type"] == "accessibility.update" and sent[0][1]["settings"]["contrast"] == "high"


def test_every_language_the_app_offers_can_be_saved(env):
    """The phone sends all settings at once, so a language the server refused would make every other setting (dark mode too) fail to save."""
    c = env["client"]
    for code in ("en", "fr", "ar", "tw", "ee", "ha", "gaa"):
        assert c.put("/accessibility/preferences", headers=env["ha"], json={**FULL, "language": code}).status_code == 200, code
        assert c.get("/accessibility/preferences", headers=env["ha"]).json()["settings"]["language"] == code
