"""Assistant tests: emergency triage, stored history, privacy, rate limit. No network, no API key needed."""
import os

os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///./test_assistant.db")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def env():
    from app.main import app
    from app.database import Base, engine, SessionLocal
    from app.auth.security import create_access_token
    from app.models.user import User
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    a = User(email="asst_a@example.com", username="asst_a")
    b = User(email="asst_b@example.com", username="asst_b")
    db.add_all([a, b]); db.commit()
    tok = lambda u: {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, "patient")}
    yield dict(client=TestClient(app), ha=tok(a), hb=tok(b), a=a.id, b=b.id)
    db.execute(text("delete from assistant_messages where user_id in (:a,:b)"), dict(a=a.id, b=b.id))
    db.execute(text("delete from users where id in (:a,:b)"), dict(a=a.id, b=b.id)); db.commit(); db.close()


def test_requires_auth(env):
    assert env["client"].post("/assistant/message", json={"content": "hi"}).status_code in (401, 403)
    assert env["client"].get("/assistant/history").status_code in (401, 403)


def test_emergency_is_triaged_without_calling_the_model(env, monkeypatch):
    from app.services import assistant_service as svc
    monkeypatch.setattr(svc, "generate_reply", lambda *a, **k: (_ for _ in ()).throw(AssertionError("model must not be called")))
    r = env["client"].post("/assistant/message", json={"content": "I have chest pain and I cannot breathe"}, headers=env["ha"])
    assert r.status_code == 200, r.text
    out = r.json()["assistant"]
    assert out["emergency"] is True and out["source"] == "triage" and "112" in out["content"]


def test_normal_message_history_and_isolation(env, monkeypatch):
    from app.services import assistant_service as svc
    seen = {}
    def fake(history, context, lang):
        seen["history"] = history
        return "Try beans and kontomire.", "model"
    monkeypatch.setattr(svc, "generate_reply", fake)
    c = env["client"]
    assert c.post("/assistant/message", json={"content": "What should I eat?"}, headers=env["hb"]).status_code == 200
    r = c.post("/assistant/message", json={"content": "Any more ideas?"}, headers=env["hb"])
    assert r.json()["assistant"]["content"] == "Try beans and kontomire."
    assert [m["role"] for m in seen["history"]][-1] == "user" and seen["history"][0]["role"] == "user"
    hist_b = c.get("/assistant/history", headers=env["hb"]).json()
    assert len(hist_b) >= 4
    hist_a = c.get("/assistant/history", headers=env["ha"]).json()
    assert all("Any more ideas?" not in m["content"] for m in hist_a)          # user A never sees B's chat
    assert c.delete("/assistant/history", headers=env["hb"]).json()["deleted"] >= 4
    assert c.get("/assistant/history", headers=env["hb"]).json() == []


def test_input_validation_and_rate_limit(env, monkeypatch):
    from app.services import assistant_service as svc
    from app.routers import assistant as router_mod
    monkeypatch.setattr(svc, "generate_reply", lambda *a, **k: ("ok", "model"))
    c = env["client"]
    assert c.post("/assistant/message", json={"content": ""}, headers=env["ha"]).status_code == 422
    assert c.post("/assistant/message", json={"content": "x" * 2001}, headers=env["ha"]).status_code == 422
    router_mod._hits.clear()
    codes = [c.post("/assistant/message", json={"content": "hello"}, headers=env["ha"]).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429
    router_mod._hits.clear()


def test_offline_fallback_when_model_unavailable(monkeypatch):
    from app.services import assistant_service as svc
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("AI_PROVIDER", "off")
    text, source = svc.generate_reply([{"role": "user", "content": "tips for blood pressure?"}], {}, "en")
    assert source == "offline" and "salt" in text.lower()
