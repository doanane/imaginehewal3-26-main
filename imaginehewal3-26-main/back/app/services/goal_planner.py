"""Personalised goals for activity and nutrition, from what we know about the person and what they actually do.

Why: a fixed "10,000 steps" or "5 servings" ignores who the person is. This proposes goals that start from THEIR measured baseline (steps, active
minutes, logged meals, water) and move toward a public-guidance target, in stages, adjusted for age, long-term conditions, body size, work
pattern, season and Ramadan. Every goal says why, where the number comes from, and what is measured. It never prescribes: for a long-term
condition the clinician sets the targets, and the text says so.

Targets are starting points taken from public guidance, labelled as such:
  * Activity: about 150 minutes of moderate activity a week for adults (WHO 2020), staged up from the person's own level.
  * Fruit and vegetables: at least 400 g a day, about 5 portions (WHO healthy diet).
  * Sodium: under 2,000 mg a day (WHO); 1,500 mg is a common clinical target with high blood pressure, set by the person's clinician.
  * Fibre: about 25 g a day for women and 30 g for men (public dietary guidance).
  * Water: about 32 ml per kg of body weight a day, more in extreme heat. Not pushed for people with heart or kidney conditions.
  * Sleep: 7 to 9 hours for adults, 7 to 8 from age 65.
Everything here is an estimate for general guidance and is labelled that way in the app.
"""
from datetime import date
from typing import Any, Dict, List, Optional

from app.services import audience as aud
from app.services import gulf

LIMITS = ("These are starting points from public guidance, calculated for you. They are estimates, not medical advice. "
          "If you live with a long-term condition, your clinician sets your targets, and these should follow theirs.")


def _has(conditions: List[str], *words: str) -> bool:
    low = [str(c).lower() for c in (conditions or [])]
    return any(w in c for c in low for w in words)


def _stage(now: Optional[float], goal: float, share: float = 0.3, minimum: float = 0.0, up: bool = True) -> float:
    """The first goal to aim for: a fraction of the way from where the person is to the long-term target."""
    if now is None:
        return goal
    gap = (goal - now) if up else (now - goal)
    if gap <= 0:
        return goal
    step = max(gap * share, minimum)
    return round(min(goal, now + step), 1) if up else round(max(goal, now - step), 1)


def propose(f: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    """f: age, gender, weight_kg, height_cm, conditions, segment, region, work_pattern, and measured baselines:
    steps_avg, active_min_avg (per day), sodium_avg, fibre_avg, water_avg_ml, plus today's totals sodium_today, fibre_today, water_today_ml.
    Any baseline may be None (we say "no data yet" and start from a gentle default)."""
    today = today or date.today()
    age = f.get("age")
    conds = f.get("conditions") or []
    seg = f.get("segment")
    region = f.get("region")
    heart = _has(conds, "heart", "cardiac", "angina", "failure")
    kidney = _has(conds, "kidney", "renal")
    htn = _has(conds, "hypertension", "blood pressure")
    diabetes = _has(conds, "diabet")
    older = bool(age and age >= 65)
    ctx = gulf.context(__import__("datetime").datetime.combine(today, __import__("datetime").time(12)).replace(tzinfo=__import__("datetime").timezone.utc), region) if region else None
    ramadan = bool(ctx and ctx["ramadan"]["is_ramadan"])
    heat = ctx["heat"] if ctx else "mild"
    items: List[dict] = []
    notes: List[str] = []

    # ---------------- activity
    b_steps, g_steps = aud.goals_for(seg, "movement", 3000, 8000)
    steps_now = f.get("steps_avg")
    g_steps = 6000 if (older or heart) else g_steps
    items.append({
        "id": "steps", "area": "activity", "label": "Daily steps", "unit": "steps", "behavior": "movement",
        "now": None if steps_now is None else round(steps_now), "goal": g_steps,
        "first_goal": round(_stage(steps_now, g_steps, 0.3, 500), -2) if steps_now is not None else round(b_steps + 0.3 * (g_steps - b_steps), -2),
        "why": ("Starts from your own average of %d steps a day and moves up in stages." % round(steps_now)) if steps_now is not None
               else "No step data yet, so we start from a gentle default and learn from your first days.",
        "source": "Public guidance: more daily steps is linked to lower risk. The target is lowered for people 65+ and with heart conditions.",
        "measured_by": "Apple Health or your phone", "today": None})
    am_now = f.get("active_min_avg")
    g_am = 30 if not heart else 20
    items.append({
        "id": "active_minutes", "area": "activity", "label": "Active minutes a day", "unit": "minutes", "behavior": "activity",
        "now": None if am_now is None else round(am_now), "goal": g_am,
        "first_goal": round(_stage(am_now, g_am, 0.35, 5)) if am_now is not None else 10,
        "why": "About 150 minutes of moderate activity a week is the adult guideline (30 minutes, 5 days). You start from %s." % (
            ("your %d minutes a day" % round(am_now)) if am_now is not None else "10 minutes and build up"),
        "source": "WHO 2020 physical activity guidelines", "measured_by": "Apple Health, your watch or what you log", "today": None})
    if (f.get("work_pattern") == "desk") or seg == "sedentary":
        items.append({"id": "breaks", "area": "activity", "label": "Movement breaks in the working day", "unit": "breaks", "behavior": "breaks",
                      "now": None, "goal": 8, "first_goal": 3, "why": "Sitting for long periods is a risk of its own. A 2 to 3 minute break each hour breaks it up.",
                      "source": "WHO 2020: limit sedentary time", "measured_by": "Your check-ins", "today": None})
    if diabetes:
        notes.append("A 10 minute walk after your biggest meal helps many people with blood sugar. Ask your clinician how it fits your treatment.")
    if heart:
        notes.append("You live with a heart condition: keep activity light to moderate and ask your clinician before raising intensity.")
    if heat in ("extreme", "hot"):
        notes.append("It is %s season where you are: move early, in the evening or indoors, and drink water before you go out." % ("the extreme heat" if heat == "extreme" else "hot"))
    if ramadan:
        notes.append("It is probably Ramadan (an estimate): move lightly after iftar, and split your water between iftar and suhoor.")

    # ---------------- nutrition
    veg_goal = 5
    items.append({"id": "veg", "area": "nutrition", "label": "Vegetable and fruit servings", "unit": "servings", "behavior": "nutrition",
                  "now": None, "goal": veg_goal, "first_goal": 3,
                  "why": "At least 400 g a day (about 5 portions) lowers the risk of long-term disease.", "source": "WHO healthy diet",
                  "measured_by": "Your meal logs and check-ins", "today": None})
    sod_goal = 1500 if (htn or heart or kidney) else 2000
    sod_now = f.get("sodium_avg")
    items.append({"id": "sodium", "area": "nutrition", "label": "Sodium (salt) a day, at most", "unit": "mg", "behavior": None,
                  "now": None if sod_now is None else round(sod_now, -1), "goal": sod_goal,
                  "first_goal": round(_stage(sod_now, sod_goal, 0.25, 100, up=False), -1) if sod_now is not None else sod_goal,
                  "why": ("Your logged meals average about %d mg a day. We lower it in stages." % round(sod_now, -1)) if sod_now is not None
                         else "Log your meals and we will compare them with this limit.",
                  "source": "WHO: under 2,000 mg sodium (5 g salt). %s" % ("1,500 mg is a common target with high blood pressure; your clinician may choose another." if sod_goal == 1500 else ""),
                  "measured_by": "Your meal logs (the Ghanaian food database)", "today": f.get("sodium_today"), "direction": "down"})
    fib_goal = 30 if (f.get("gender") or "").lower().startswith("m") else 25
    fib_now = f.get("fibre_avg")
    items.append({"id": "fibre", "area": "nutrition", "label": "Fibre a day", "unit": "g", "behavior": None,
                  "now": None if fib_now is None else round(fib_now), "goal": fib_goal,
                  "first_goal": round(_stage(fib_now, fib_goal, 0.3, 2)) if fib_now is not None else fib_goal,
                  "why": "Fibre helps blood sugar, cholesterol and digestion. Beans, vegetables, whole grains and fruit are the main sources.",
                  "source": "Public dietary guidance (about 25 g for women, 30 g for men)", "measured_by": "Your meal logs", "today": f.get("fibre_today")})

    # ---------------- hydration
    kg = f.get("weight_kg")
    if kidney or heart:
        notes.append("With a heart or kidney condition, do not raise your water on your own: ask your clinician how much is right for you.")
        water_goal = None
    else:
        water_goal = int(round((32 * kg if kg else 2000) / 100.0) * 100)
        water_goal += 500 if heat == "extreme" else 250 if heat == "hot" else 0
        water_goal = max(1500, min(3500, water_goal))
    if water_goal:
        w_now = f.get("water_avg_ml")
        items.append({"id": "water", "area": "hydration", "label": "Water a day", "unit": "ml", "behavior": None,
                      "now": None if w_now is None else round(w_now, -2), "goal": water_goal,
                      "first_goal": round(_stage(w_now, water_goal, 0.4, 250), -2) if w_now is not None else water_goal,
                      "why": "About 32 ml for each kg of your weight%s." % (", more in extreme heat" if heat == "extreme" else ""),
                      "source": "General hydration guidance, adjusted for your weight and the season", "measured_by": "Your water log", "today": f.get("water_today_ml")})

    # ---------------- sleep
    items.append({"id": "sleep", "area": "sleep", "label": "Sleep", "unit": "hours", "behavior": "sleep",
                  "now": f.get("sleep_avg"), "goal": 7.5 if older else 8 if not f.get("sleep_avg") or f.get("sleep_avg") < 7 else 7.5,
                  "first_goal": round(_stage(f.get("sleep_avg"), 7.5, 0.4, 0.5) * 2) / 2 if f.get("sleep_avg") else 7,
                  "why": "7 to 9 hours for adults, 7 to 8 from age 65.", "source": "Public sleep guidance", "measured_by": "Your watch or phone, if you share it", "today": None})

    for it in items:
        if it["now"] is None:
            it["state"] = "no_data"
        elif it.get("direction") == "down":
            it["state"] = "met" if it["now"] <= it["goal"] else "working"
        else:
            it["state"] = "met" if it["now"] >= it["goal"] else "working"
    return {"as_of": today.isoformat(), "segment": seg, "items": items, "notes": notes, "limits": LIMITS,
            "personalised_from": [k for k in ("age", "weight_kg", "conditions", "segment", "region", "work_pattern", "steps_avg", "active_min_avg", "sodium_avg", "fibre_avg", "water_avg_ml") if f.get(k) not in (None, [], "")]}


# ---------------------------------------------------------------- facts from the database
def gather(db, user) -> Dict[str, Any]:
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func
    from app.models.health import FoodLog, HealthData
    from app.models.user import UserProfile
    from app.services import behavior_data as bdata

    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    cx = bdata.context_for(db, user.id)
    health = bdata.health_context(db, user)
    since = datetime.now(timezone.utc) - timedelta(days=14)
    rows = db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= since.replace(tzinfo=None)).all()
    steps = [r.steps for r in rows if r.steps]
    mins = [r.active_minutes for r in rows if r.active_minutes]
    water = [r.water_intake for r in rows if r.water_intake]
    logs = db.query(FoodLog).filter(FoodLog.user_id == user.id, FoodLog.created_at >= since).all()
    per_day: Dict[date, Dict[str, float]] = {}
    for lg in logs:
        n = lg.nutrients or {}
        d = (lg.created_at.date() if lg.created_at else date.today())
        acc = per_day.setdefault(d, {"sodium": 0.0, "fibre": 0.0})
        acc["sodium"] += float(n.get("sodium_mg") or 0)
        acc["fibre"] += float(n.get("fiber") or n.get("fibre") or 0)
    sod = [v["sodium"] for v in per_day.values() if v["sodium"] > 0]
    fib = [v["fibre"] for v in per_day.values() if v["fibre"] > 0]
    today_row = per_day.get(date.today(), {})
    t = db.query(HealthData).filter(HealthData.user_id == user.id).order_by(HealthData.date.desc()).first()
    avg = lambda xs: (sum(xs) / len(xs)) if xs else None          # noqa: E731
    return {"age": health.get("age"), "gender": health.get("gender"), "weight_kg": prof.weight if prof and prof.weight else None,
            "height_cm": prof.height if prof and prof.height else None, "conditions": health.get("conditions") or [], "segment": bdata.resolved_segment(cx, health),
            "region": cx.get("region"), "work_pattern": cx.get("work_pattern"), "steps_avg": avg(steps), "active_min_avg": avg(mins),
            "sodium_avg": avg(sod), "fibre_avg": avg(fib), "water_avg_ml": avg(water), "sleep_avg": health.get("sleep_hours"),
            "sodium_today": round(today_row.get("sodium", 0)) if today_row else None, "fibre_today": round(today_row.get("fibre", 0)) if today_row else None,
            "water_today_ml": t.water_intake if t and t.date and t.date.date() == date.today() else None}
