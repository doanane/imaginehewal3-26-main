"""The Gemini-powered features, with the model mocked: streaming chat, suggestions, weekly insights, the clinician brief, meal photos."""
import json
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
    from app.models.caregiver import Doctor
    from app.models.user import User, UserProfile
    from app.services import simple_limiter
    Base.metadata.create_all(bind=engine)
    simple_limiter.reset()
    db = SessionLocal()
    db.query(Doctor).filter(Doctor.doctor_id == "DAI0001A").delete()
    db.add(Doctor(doctor_id="DAI0001A", full_name="Dr AI Test", specialization="GP", hospital="T", is_active=True, hashed_password=get_password_hash("Passw0rd!x1")))
    db.commit()
    mk = lambda n: User(email=f"ai_{n}@example.com", username=f"ai_{n}", hashed_password=get_password_hash("Passw0rd!x1"))
    a, b = mk("a"), mk("b")
    db.add_all([a, b]); db.commit()
    db.add_all([UserProfile(user_id=a.id, full_name="Secret Name Ama", age=61, gender="Female", chronic_conditions=["Hypertension"], doctor_id="DAI0001A", profile_completed=True),
                UserProfile(user_id=b.id, full_name="Other", age=30, chronic_conditions=[], profile_completed=True)])
    db.commit()
    tok = lambda u, t="patient": {"Authorization": "Bearer " + create_access_token({"sub": str(u.id)}, t)}
    out = dict(client=TestClient(app), a=a.id, ha=tok(a), hb=tok(b),
               hd={"Authorization": "Bearer " + create_access_token({"sub": "DAI0001A"}, "doctor")})
    yield out
    from app.services.privacy_service import delete_account
    db2 = SessionLocal()
    for uid in (a.id, b.id):
        row = db2.query(User).filter(User.id == uid).first()
        if row:
            delete_account(db2, row)
    db2.query(Doctor).filter(Doctor.doctor_id == "DAI0001A").delete()
    db2.commit(); db2.close(); db.close()


def events(resp):
    return [json.loads(l[5:]) for l in resp.text.split("\n") if l.startswith("data:")]


def test_split_suggestions_variants():
    from app.services.assistant_service import split_suggestions
    assert split_suggestions("Drink water.\n[[suggestions: How much? | What else? | Why]]") == ("Drink water.", ["How much?", "What else?", "Why"])
    assert split_suggestions("No marker here") == ("No marker here", [])
    text, ideas = split_suggestions("Answer\n[[suggestions: only one")                  # a cut-off marker is never shown
    assert text == "Answer" and ideas == []


def test_stream_hides_the_marker_even_when_split_across_chunks_and_saves_clean_text(env, monkeypatch):
    from app.services import assistant_service as svc, simple_limiter
    simple_limiter.reset()
    chunks = ["Eat less salt. ", "Walk after dinner.\n[", "[sugges", "tions: Which foods? | How far? | Why?]]"]
    monkeypatch.setattr(svc, "stream_reply", lambda *a, **k: iter(chunks))
    r = env["client"].post("/assistant/stream", headers=env["ha"], json={"content": "How do I lower my pressure?"})
    ev = events(r)
    assert ev[0]["type"] == "meta" and ev[-1]["type"] == "done"
    streamed = "".join(e["text"] for e in ev if e["type"] == "token")
    assert "[[" not in streamed and "suggestions" not in streamed and streamed.startswith("Eat less salt.")
    done = ev[-1]
    assert done["assistant"]["content"] == "Eat less salt. Walk after dinner." and done["suggestions"] == ["Which foods?", "How far?", "Why?"]
    saved = env["client"].get("/assistant/history?limit=2", headers=env["ha"]).json()
    assert saved[-1]["content"] == "Eat less salt. Walk after dinner." and saved[-1]["role"] == "assistant"


def test_stream_falls_back_when_the_model_cannot_start(env, monkeypatch):
    from app.services import assistant_service as svc, gemini_service as g, simple_limiter
    simple_limiter.reset()
    def boom(*a, **k):
        raise g.GeminiError("down")
        yield  # noqa: unreachable, makes this a generator
    monkeypatch.setattr(svc, "stream_reply", boom)
    monkeypatch.setattr(svc, "generate_reply", lambda *a, **k: ("Here is general advice.", "offline"))
    ev = events(env["client"].post("/assistant/stream", headers=env["ha"], json={"content": "tips for blood pressure"}))
    assert ev[-1]["type"] == "done" and ev[-1]["assistant"]["content"] == "Here is general advice." and ev[-1]["assistant"]["source"] == "offline"


def test_emergency_is_instant_and_never_reaches_the_model(env, monkeypatch):
    from app.services import assistant_service as svc, simple_limiter
    simple_limiter.reset()
    monkeypatch.setattr(svc, "stream_reply", lambda *a, **k: (_ for _ in ()).throw(AssertionError("model called")))
    ev = events(env["client"].post("/assistant/stream", headers=env["ha"], json={"content": "I have chest pain and I cannot breathe"}))
    done = ev[-1]
    assert done["assistant"]["emergency"] is True and done["assistant"]["source"] == "triage" and "112" in done["assistant"]["content"]


def test_the_prompt_carries_real_data_and_never_the_name(env, monkeypatch):
    from app.services import assistant_service as svc, simple_limiter
    simple_limiter.reset()
    env["client"].post("/vitals/ingest", headers=env["ha"], json={"device_id": "ai-watch", "heart_rate": 90, "blood_pressure_systolic": 150, "blood_pressure_diastolic": 95})
    seen = {}
    def spy(history, context, lang="en"):
        seen["prompt"] = svc.build_system_prompt(context, lang)
        return iter(["ok"])
    monkeypatch.setattr(svc, "stream_reply", spy)
    from app.routers import assistant as ar
    ar._ctx_cache.clear()
    env["client"].post("/assistant/stream", headers=env["ha"], json={"content": "hello"})
    p = seen["prompt"]
    assert "150/95" in p and "Hypertension" in p and "age 61" in p and "Dr AI Test" in p
    assert "Secret Name" not in p and "ai_a@example.com" not in p


def test_suggestions_come_from_real_data(env):
    from app.routers import assistant as ar
    ar._ctx_cache.clear()
    s = env["client"].get("/assistant/suggestions", headers=env["ha"]).json()["suggestions"]
    assert len(s) == 4 and any("150/95" in x for x in s) and any("low-salt" in x.lower() for x in s)
    other = env["client"].get("/assistant/suggestions", headers=env["hb"]).json()["suggestions"]
    assert not any("150/95" in x for x in other)                                  # nobody sees another person's numbers


def test_weekly_insights_fallback_then_ai_and_no_personal_details_leave(env, monkeypatch):
    from app.services import ai_features, gemini_service as g
    ai_features._cache.clear()
    plain = env["client"].get("/ai/insights", headers=env["ha"]).json()
    assert plain["source"] == "summary" and plain["insights"]                      # AI is off in tests: a plain summary from the same numbers
    sent = {}
    monkeypatch.setenv("AI_PROVIDER", "auto"); monkeypatch.setenv("GEMINI_API_KEY", "k")
    def fake(system, contents, **k):
        sent["text"] = contents[0]["parts"][0]["text"]
        return json.dumps({"headline": "A steady week.", "insights": [{"title": "Pressure", "detail": "Your average was 150/95.", "tone": "watch"}], "next_step": "Walk after dinner."})
    monkeypatch.setattr(g, "generate", fake)
    out = env["client"].get("/ai/insights?refresh=true", headers=env["ha"]).json()
    assert out["source"] == "ai" and out["headline"] == "A steady week." and out["insights"][0]["tone"] == "watch"
    assert "Secret Name" not in sent["text"] and "example.com" not in sent["text"] and "150" in sent["text"]
    again = env["client"].get("/ai/insights", headers=env["ha"]).json()          # remembered: no second model call
    assert again["generated_at"] == out["generated_at"]


def test_doctor_brief_is_for_their_patient_only(env, monkeypatch):
    from app.services import ai_features, gemini_service as g
    ai_features._cache.clear()
    sent = {}
    monkeypatch.setenv("AI_PROVIDER", "auto"); monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setattr(g, "generate", lambda system, contents, **k: (sent.setdefault("t", contents[0]["parts"][0]["text"]) and json.dumps(
        {"summary": "Pressure runs high.", "flags": ["Average 150/95"], "suggested_questions": ["Any headaches?"]})))
    c = env["client"]
    ok = c.get(f"/doctor-portal/patients/{env['a']}/brief", headers=env["hd"])
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["source"] == "ai" and body["flags"] == ["Average 150/95"] and "avg_bp" in body["figures"]
    assert "Secret Name" not in sent["t"]
    other = c.get(f"/doctor-portal/patients/{env['a'] + 9999}/brief", headers=env["hd"])
    assert other.status_code == 404
    assert c.get(f"/doctor-portal/patients/{env['a']}/brief", headers=env["ha"]).status_code == 403   # a patient is not a doctor


def test_meal_photo_analysis(env, monkeypatch):
    from app.services import ai_features, gemini_service as g, simple_limiter
    simple_limiter.reset()
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    good = {"detected_food": "Jollof rice", "confidence": 0.8, "description": "Rice cooked in tomato stew.",
            "nutrients": {"calories": 520, "protein": 14, "carbs": 80, "fat": 16, "fiber": 4, "sodium_mg": 900}, "diet_score": 55, "warning_level": "medium",
            "immediate_recommendation": "Take a smaller portion.", "balancing_advice": "Add vegetables next meal.", "chronic_disease_impact": "Salty for blood pressure.",
            "portion_guidance": "Half a plate.", "healthier_alternative": "Brown rice with kontomire.", "key_nutrients_to_watch": ["Salt"], "is_balanced": False}
    monkeypatch.setattr(ai_features, "analyze_meal_photo", lambda data, conds, age: good)
    c = env["client"]
    r = c.post("/api/analyze-meal", headers=env["ha"], data={"meal_type": "lunch"}, files={"file": ("x", png, "application/octet-stream")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["detected_food"] == "Jollof rice" and body["nutrients"]["calories"] == 520 and body["nutrients"]["fats"] == 16 and body["coach"]["headline"]
    def not_food(*a): raise ValueError("not_food")
    monkeypatch.setattr(ai_features, "analyze_meal_photo", not_food)
    assert c.post("/api/analyze-meal", headers=env["ha"], data={"meal_type": "lunch"}, files={"file": ("x", png, "image/png")}).status_code == 422
    def down(*a): raise g.GeminiError("down")
    monkeypatch.setattr(ai_features, "analyze_meal_photo", down)
    assert c.post("/api/analyze-meal", headers=env["ha"], data={"meal_type": "lunch"}, files={"file": ("x", png, "image/png")}).status_code == 503


def test_the_real_photo_parser_cleans_what_the_model_returns(monkeypatch):
    from app.services import ai_features, gemini_service as g
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 50
    messy = "```json\n" + json.dumps({"is_food": True, "detected_food": "Banku " * 30, "confidence": 7, "nutrients": {"calories": "430.6", "sodium_mg": 999999},
                                      "diet_score": 140, "warning_level": "extreme", "key_nutrients_to_watch": ["a", "b", "c", "d"]}) + "\n```"
    monkeypatch.setenv("AI_PROVIDER", "auto"); monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setattr(g, "generate", lambda *a, **k: messy)
    out = ai_features.analyze_meal_photo(png, [], None)
    assert len(out["detected_food"]) <= 60 and out["confidence"] == 1.0 and out["nutrients"]["calories"] == 431 and out["nutrients"]["sodium_mg"] == 8000
    assert out["diet_score"] == 100 and out["warning_level"] == "medium" and len(out["key_nutrients_to_watch"]) == 3
    with pytest.raises(ValueError):
        ai_features.analyze_meal_photo(b"not an image", [], None)


def test_gemini_service_errors_never_leak_and_parse_json():
    from app.services import gemini_service as g
    assert g.parse_json('Sure! {"a": 1} hope that helps') == {"a": 1}
    assert g.parse_json("```json\n[1,2]\n```") == [1, 2]
    with pytest.raises(g.GeminiError):
        g.generate(None, [g.text_content("user", "hi")])            # AI is off in tests: refuses before any network call


def test_daily_tip_is_ai_written_remembered_and_falls_back(env, monkeypatch):
    from app.services import ai_features, gemini_service as g
    ai_features._cache.clear()
    c = env["client"]
    plain = c.get("/api/daily-tip", headers=env["ha"]).json()                   # AI is off in tests: a plain tip, never an error
    assert plain["success"] and plain["tip"]
    ai_features._cache.clear()
    calls = []
    monkeypatch.setenv("AI_PROVIDER", "auto"); monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setattr(g, "generate", lambda *a, **k: calls.append(1) or "Walk for ten minutes after dinner.")
    first = c.get("/api/daily-tip", headers=env["ha"]).json()
    again = c.get("/api/daily-tip", headers=env["ha"]).json()
    assert first["tip"] == again["tip"] == "Walk for ten minutes after dinner." and len(calls) == 1      # remembered for the day
