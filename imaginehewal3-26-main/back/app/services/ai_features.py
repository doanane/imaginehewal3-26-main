"""AI features that are not chat: meal photo analysis, the weekly insights for a patient, and the brief a clinician reads.

Rules shared by all of them:
  * Gemini is told ONLY the numbers we pass in and is told not to invent others. Everything it returns is checked and trimmed here.
  * Each has a plain fallback built from the same numbers, so a screen is never empty when the AI is unavailable.
  * Results are remembered for a while per person so opening a screen is instant and the free quota is not burned.
"""
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.services import gemini_service as g
from app.services.image_check import sniff_image

logger = logging.getLogger(__name__)
_cache: Dict[Any, Any] = {}


def cached(key, ttl: float, make):
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    val = make()
    _cache[key] = (time.monotonic(), val)
    if len(_cache) > 2000:
        for k in sorted(_cache, key=lambda k: _cache[k][0])[:500]:
            _cache.pop(k, None)
    return val


def forget(prefix: str, user_id: int) -> None:
    _cache.pop((prefix, user_id), None)


# ------------------------------------------------------------------ meal photo
MEAL_PROMPT = """You are a dietitian who knows Ghanaian and West African food. Look at the photo and describe the meal for a person with: {who}.
Return JSON only, with exactly these keys:
{{"is_food": true/false, "detected_food": "short dish name", "confidence": 0.0-1.0, "description": "one plain sentence",
 "nutrients": {{"calories": int, "protein": int, "carbs": int, "fat": int, "fiber": int, "sodium_mg": int}},
 "diet_score": 0-100 (how well this plate suits THIS person), "warning_level": "low"|"medium"|"high",
 "immediate_recommendation": "one practical sentence", "balancing_advice": "one sentence for the next meal",
 "chronic_disease_impact": "one sentence on how it affects their condition(s)", "portion_guidance": "one sentence",
 "healthier_alternative": "one sentence", "key_nutrients_to_watch": ["up to 3 words each"], "is_balanced": true/false}}
Nutrient values are estimates for the portion visible. If the photo is not food, set is_food false and keep the other fields short. Plain words, no markdown."""


def _int(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(round(float(v)))))
    except (TypeError, ValueError):
        return default


def analyze_meal_photo(data: bytes, conditions: List[str], age: Optional[int]) -> Dict[str, Any]:
    """Raises g.GeminiError when the model cannot be used, ValueError('not_food') when the photo is not a meal."""
    mime = sniff_image(data)
    if mime is None:
        raise ValueError("bad_image")
    who = ", ".join(x for x in (f"age {age}" if age else "", "conditions: " + ", ".join(conditions) if conditions else "no recorded conditions") if x)
    text = g.generate(None, [{"role": "user", "parts": [{"text": MEAL_PROMPT.format(who=who)}, g.image_part(data, mime)]}],
                      temperature=0.2, max_tokens=700, json_mode=True, timeout=30)
    try:
        d = g.parse_json(text)
    except ValueError:
        raise g.GeminiError("unreadable reply")
    if not isinstance(d, dict) or d.get("is_food") is False:
        raise ValueError("not_food")
    n = d.get("nutrients") or {}
    level = d.get("warning_level") if d.get("warning_level") in ("low", "medium", "high") else "medium"
    s = lambda k, fb="": str(d.get(k) or fb)[:240]          # noqa: E731
    return {
        "detected_food": s("detected_food", "Meal")[:60], "confidence": max(0.0, min(1.0, float(d.get("confidence") or 0.5))),
        "description": s("description"),
        "nutrients": {"calories": _int(n.get("calories"), 0, 3500, 0), "protein": _int(n.get("protein"), 0, 250, 0), "carbs": _int(n.get("carbs"), 0, 500, 0),
                      "fat": _int(n.get("fat"), 0, 250, 0), "fiber": _int(n.get("fiber"), 0, 100, 0), "sodium_mg": _int(n.get("sodium_mg"), 0, 8000, 0)},
        "diet_score": _int(d.get("diet_score"), 0, 100, 60), "warning_level": level,
        "immediate_recommendation": s("immediate_recommendation"), "balancing_advice": s("balancing_advice"),
        "chronic_disease_impact": s("chronic_disease_impact"), "portion_guidance": s("portion_guidance"),
        "healthier_alternative": s("healthier_alternative"),
        "key_nutrients_to_watch": [str(x)[:24] for x in (d.get("key_nutrients_to_watch") or [])][:3], "is_balanced": bool(d.get("is_balanced", True)),
    }


# ------------------------------------------------------------------ weekly insights for the patient
INSIGHT_SYSTEM = """You are a clinical health coach writing a weekly report for a person living with a chronic condition, in plain, warm, professional English (about a primary-school reading level, no jargon without a short explanation).
Use ONLY the numbers in the data. Never invent a reading, trend, cause or diagnosis. If a number is missing, do not mention it.
How to write it:
- Lead with the single most important finding and give its numbers. When "last week" figures exist, say whether this week is better, worse or about the same and by how much (for example "down from 148/92 last week").
- You may say how a figure compares with common general targets (blood pressure below 130/80 for most adults with hypertension or diabetes; heart rate at rest 60 to 100 (the readings are not necessarily taken at rest, so call them just "heart rate", never "resting heart rate"); oxygen 95% or higher; about 7,000 to 10,000 steps a day) but say "general target", never "your doctor's target".
- Mention medicine adherence, steps and meals only if present, with the number.
- Be honest about thin data: if there are only a few readings or days, say so and avoid strong claims.
- Never advise starting, stopping or changing a medicine or dose. If any reading is dangerous (blood pressure 180/120 or more, heart rate over 120 at rest or under 40, oxygen under 90), the first insight must tell them to contact their clinician today, and 112 if they feel unwell.
Return JSON only: {"headline": "one sentence stating the main finding with a number, at most 20 words",
"insights": [{"title": "2-5 words", "detail": "one or two sentences using real numbers and, where available, the change from last week", "tone": "good"|"watch"|"neutral"}] (3 to 4 items),
"next_step": "one specific, measurable action for the coming week, one sentence"}"""


def _change(now, before, unit="", lower_is_better=True):
    if now is None or before is None:
        return ""
    d = round(now - before)
    if d == 0:
        return " (about the same as last week)"
    better = (d < 0) == lower_is_better
    return f" ({'down' if d < 0 else 'up'} {abs(d)}{unit} from last week, {'better' if better else 'worse'})"


def based_on(d: Dict[str, Any]) -> str:
    parts = []
    if d.get("readings_total"):
        parts.append(f"{d['readings_total']} reading{'s' if d['readings_total'] != 1 else ''} on {d['days_with_readings']} day{'s' if d['days_with_readings'] != 1 else ''}")
    if d.get("step_days"):
        parts.append(f"steps on {d['step_days']} day{'s' if d['step_days'] != 1 else ''}")
    if d.get("meals_logged"):
        parts.append(f"{d['meals_logged']} logged meal{'s' if d['meals_logged'] != 1 else ''}")
    return "Based on " + ", ".join(parts) + "." if parts else "Not enough readings this week to say much."


def fallback_insights(d: Dict[str, Any]) -> Dict[str, Any]:
    items = []
    if d.get("avg_bp"):
        hi = d["avg_systolic"] >= 130 or d["avg_diastolic"] >= 80
        items.append({"title": "Blood pressure", "tone": "watch" if hi else "good",
                      "detail": f"Your average was {d['avg_bp']} mmHg over {d['bp_readings']} readings{(' (last week ' + d['avg_bp_last_week'] + ')') if d.get('avg_bp_last_week') else ''}. The general target for most adults is below 130/80."})
    if d.get("avg_steps") is not None:
        items.append({"title": "Steps", "tone": "good" if d["avg_steps"] >= 7000 else "neutral",
                      "detail": f"You averaged {d['avg_steps']:,} steps a day on {d['step_days']} days{_change(d['avg_steps'], d.get('avg_steps_last_week'), ' steps', lower_is_better=False)}."})
    if d.get("avg_hr") is not None:
        items.append({"title": "Heart rate", "tone": "neutral",
                      "detail": f"Your readings averaged {d['avg_hr']} bpm, ranging from {d['min_hr']} to {d['max_hr']}{_change(d['avg_hr'], d.get('avg_hr_last_week'), ' bpm')}."})
    if d.get("adherence") is not None:
        items.append({"title": "Medicine", "tone": "good" if d["adherence"] >= 80 else "watch", "detail": f"You took {d['adherence']}% of your scheduled doses."})
    if d.get("avg_meal_score") is not None and len(items) < 4:
        items.append({"title": "Meals", "tone": "good" if d["avg_meal_score"] >= 70 else "watch", "detail": f"Your {d['meals_logged']} logged meals scored {d['avg_meal_score']} out of 100 on average."})
    items = items[:4]
    return {"headline": (items[0]["detail"].split(". ")[0].rstrip(".") + ".") if items else "Not enough data yet this week.", "insights": items,
            "next_step": "Keep your watch connected and log your meals so next week's report can be more specific." if not items else "Pick the area marked 'watch' above and make one small change this week.",
            "source": "summary", "based_on": based_on(d)}


def weekly_insights(data: Dict[str, Any]) -> Dict[str, Any]:
    if not data.get("has_data"):
        return fallback_insights(data)
    if g.available():
        try:
            text = g.generate(INSIGHT_SYSTEM, [g.text_content("user", "Data for the last 7 days:\n" + json.dumps({k: v for k, v in data.items() if v is not None}))],
                              temperature=0.3, max_tokens=500, json_mode=True, timeout=25)
            d = g.parse_json(text)
            items = [{"title": str(i.get("title", ""))[:40], "detail": str(i.get("detail", ""))[:300],
                      "tone": i.get("tone") if i.get("tone") in ("good", "watch", "neutral") else "neutral"}
                     for i in (d.get("insights") or []) if isinstance(i, dict) and i.get("detail")][:4]
            if items and d.get("headline"):
                return {"headline": str(d["headline"])[:160], "insights": items, "next_step": str(d.get("next_step") or "")[:240], "source": "ai", "based_on": based_on(data)}
        except (g.GeminiError, ValueError, AttributeError, TypeError):
            pass
    return fallback_insights(data)


# ------------------------------------------------------------------ the clinician's brief
BRIEF_SYSTEM = """You write a brief for a doctor who is about to look at one patient's remote-monitoring data. Be factual and concise.
Use ONLY the data given. Never invent values, never diagnose, never recommend a specific drug or dose.
Return JSON only: {"summary": "2 to 3 sentences on the overall picture", "flags": ["up to 4 short items the doctor should notice, each with the number"],
"suggested_questions": ["up to 3 questions worth asking the patient"]}
If data is sparse, say what is missing in the summary."""


def fallback_brief(d: Dict[str, Any]) -> Dict[str, Any]:
    flags = list(d.get("reasons") or [])
    if d.get("adherence") is not None and d["adherence"] < 80:
        flags.append(f"Medicine taken on only {d['adherence']}% of doses this week")
    if d.get("avg_bp") and (d.get("avg_systolic", 0) >= 130 or d.get("avg_diastolic", 0) >= 80):
        flags.append(f"Average blood pressure {d['avg_bp']} over {d['bp_readings']} readings")
    return {"summary": f"Status: {d.get('status', 'no data')}. " + ("Recent readings are limited." if not d.get("has_data") else "See the figures below."),
            "flags": flags[:4], "suggested_questions": [], "source": "summary"}


def clinician_brief(data: Dict[str, Any]) -> Dict[str, Any]:
    if g.available() and data.get("has_data"):
        try:
            text = g.generate(BRIEF_SYSTEM, [g.text_content("user", "Patient data:\n" + json.dumps({k: v for k, v in data.items() if v is not None}))],
                              temperature=0.2, max_tokens=500, json_mode=True, timeout=25)
            d = g.parse_json(text)
            if isinstance(d, dict) and d.get("summary"):
                return {"summary": str(d["summary"])[:500], "flags": [str(x)[:160] for x in (d.get("flags") or [])][:4],
                        "suggested_questions": [str(x)[:160] for x in (d.get("suggested_questions") or [])][:3], "source": "ai"}
        except (g.GeminiError, ValueError, AttributeError, TypeError):
            pass
    return fallback_brief(data)
