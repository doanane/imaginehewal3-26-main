"""Meal photo recognition: both key names work, replies in either shape parse, failures say why and never raise. Offline."""
import json

from app.services import vision_service as vs


class FakeResp:
    def __init__(self, status, payload):
        self.status_code, self._p, self.text = status, payload, json.dumps(payload)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("http")

    def json(self):
        return self._p


def reply(text):
    return FakeResp(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})


def test_either_key_name_turns_it_on(monkeypatch):
    monkeypatch.delenv("VISION_PROVIDER", raising=False)
    monkeypatch.delenv("GEMINI_API", raising=False); monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert vs.provider() == "none"
    monkeypatch.setenv("GEMINI_API_KEY", "k"); assert vs.provider() == "gemini"
    monkeypatch.delenv("GEMINI_API_KEY"); monkeypatch.setenv("GEMINI_API", "k"); assert vs.provider() == "gemini"
    monkeypatch.setenv("VISION_PROVIDER", "off"); assert vs.provider() == "none"


def test_object_list_and_empty_replies_all_parse(monkeypatch):
    monkeypatch.delenv("VISION_PROVIDER", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    dish = next(iter(vs.FOODS))
    for text in (json.dumps({"candidates": [{"id": dish, "confidence": 0.9}]}), json.dumps([{"id": dish, "confidence": 0.9}])):
        monkeypatch.setattr(vs.requests, "post", lambda *a, **k: reply(text))
        out = vs.identify(b"x", "image/png")
        assert out["provider"] == "gemini" and out["candidates"][0]["id"] == dish
    monkeypatch.setattr(vs.requests, "post", lambda *a, **k: reply("[]"))
    assert vs.identify(b"x", "image/png")["candidates"] == []


def test_a_retired_model_or_bad_key_never_raises(monkeypatch):
    monkeypatch.delenv("VISION_PROVIDER", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setattr(vs.requests, "post", lambda *a, **k: FakeResp(404, {"error": {"message": "model retired"}}))
    out = vs.identify(b"x", "image/png")
    assert out["candidates"] == [] and "list" in out["note"].lower()
