"""Meal photo identification without Azure.

Provider chain (first that works wins):
  1. Gemini vision (free tier), only if GEMINI_API is set and VISION_PROVIDER is not "off". It receives ONLY the
     photo plus the list of dish names, never any personal data. Free-tier requests may be used by Google to
     improve its products, so the app tells the user the photo is analysed by an external service.
  2. None: the app falls back to a searchable list. The user always confirms the dish, so a wrong guess is cheap.

No model is trained here. A locally trained Ghanaian-meal classifier is the planned replacement and can be added as
another provider without changing the API.
"""
import base64
import json
import logging
import os
from typing import Dict, List

import requests

from app.services.ghana_foods import FOODS

logger = logging.getLogger(__name__)
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _key() -> str:
    return os.getenv("GEMINI_API") or os.getenv("GEMINI_API_KEY") or ""      # both names are in use


def provider() -> str:
    if os.getenv("VISION_PROVIDER", "auto").lower() == "off":
        return "none"
    return "gemini" if _key() else "none"


def identify(image: bytes, mime: str) -> Dict:
    """Returns {"provider", "candidates": [{id, name, confidence}], "note"}. Never raises."""
    if provider() != "gemini":
        return {"provider": "none", "candidates": [], "note": "Photo analysis is not available right now. Choose your meal from the list."}
    model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    catalogue = "\n".join(f"{f['id']}: {f['name']}" for f in FOODS.values())
    prompt = ("You identify Ghanaian meals in photos. Choose up to 3 dishes from this list that best match the photo. "
              "Reply with JSON only: {\"candidates\":[{\"id\":\"<id from list>\",\"confidence\":0.0-1.0}]}. "
              "If nothing matches, return an empty list.\n\n" + catalogue)
    body = {"contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mime, "data": base64.b64encode(image).decode()}}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    try:
        r = requests.post(GEMINI_URL.format(model=model), json=body, headers={"x-goog-api-key": _key()}, timeout=25)
        if getattr(r, "status_code", 200) >= 400:
            logger.warning("vision provider HTTP %s: %s", r.status_code, " ".join(r.text[:200].split()))    # says why (retired model, bad key, quota)
            r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        raw: List[dict] = parsed if isinstance(parsed, list) else parsed.get("candidates", [])      # models sometimes return the bare list
        out = []
        for c in raw[:3]:
            f = FOODS.get(str(c.get("id")))
            if f:
                out.append({"id": f["id"], "name": f["name"], "confidence": max(0.0, min(1.0, float(c.get("confidence", 0.5))))})
        out.sort(key=lambda c: -c["confidence"])
        return {"provider": "gemini", "candidates": out, "note": "" if out else "We could not match this photo. Choose your meal from the list."}
    except Exception as e:
        logger.warning("vision provider failed: %s", type(e).__name__)
        return {"provider": "none", "candidates": [], "note": "Photo analysis is unavailable right now. Choose your meal from the list."}
