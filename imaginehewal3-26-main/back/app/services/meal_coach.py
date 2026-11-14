"""A short, honest coaching tip that joins what the person is about to eat with what their body is doing right now.

Rules, in order (the same order a clinician would use):
  1. A dangerous reading beats everything: no food advice, sit down and get help.
  2. High blood pressure plus a salty dish; fast heart rate plus a heavy dish; high starch for someone with diabetes.
  3. Otherwise a calm confirmation that quotes the reading.
The tip lists exactly which readings it used. With no recent reading it says so and does not pretend to know.
"""
from typing import Any, Dict, List, Optional

from app.services.care_snapshot import classify


def _bp(v: Dict[str, Any]) -> Optional[str]:
    return f"{v['systolic']}/{v['diastolic']}" if v.get("systolic") and v.get("diastolic") else None


def coach_tip(vitals: Dict[str, Any], nutrients: Dict[str, Any], assessment: Dict[str, Any], dish: str, conditions: List[str]) -> Dict[str, Any]:
    hr, spo2 = vitals.get("heart_rate"), vitals.get("blood_oxygen")
    sys, dia, bp = vitals.get("systolic"), vitals.get("diastolic"), _bp(vitals)
    used = [x for x in (f"heart rate {hr} bpm" if hr is not None else None, f"blood pressure {bp}" if bp else None,
                        f"oxygen {spo2:g}%" if spo2 is not None else None) if x]
    conds = " ".join(conditions).lower()
    level = classify(hr, spo2, sys, dia, False)["status"]
    salty = nutrients.get("sodium_mg", 0) > 600 or "salt" in " ".join(assessment.get("concerns", [])).lower()
    heavy = nutrients.get("kcal", 0) > 650
    starchy = nutrients.get("carbs", 0) > 70

    if level == "critical":
        return {"tone": "danger", "headline": "Sit down first, food can wait",
                "message": f"Your {', '.join(used)} {'is' if len(used) == 1 else 'are'} in a dangerous range right now. Do not eat yet: sit down and rest, tell your caregiver, and call 112 if you feel unwell or it does not settle.",
                "based_on": used}
    if not used:
        return {"tone": "info", "headline": "Add your watch for sharper tips",
                "message": f"{assessment.get('advice', '')} Connect your watch or log a reading and this tip will use your heart rate and blood pressure too.".strip(),
                "based_on": []}
    if (sys and (sys >= 140 or (dia or 0) >= 90) or "hypertens" in conds) and salty:
        return {"tone": "warning", "headline": "Go easy on the salt tonight",
                "message": f"Your blood pressure is {bp or 'on the higher side'} and {dish} is salty. Use less stock cube and salted fish, add vegetables, and keep tonight's meal light.",
                "based_on": used}
    if hr is not None and hr > 100 and (heavy or starchy):
        return {"tone": "warning", "headline": "Keep this one light",
                "message": f"Your heart rate is {hr} bpm, a little fast, and {dish} is a heavy meal. Eat a smaller portion, sit and rest after, and try {assessment.get('advice', 'a lighter choice next time').rstrip('.').lower()}.",
                "based_on": used}
    if starchy and ("diabet" in conds):
        return {"tone": "warning", "headline": "Watch the starch",
                "message": f"{dish} is high in starch, which raises blood sugar. Take a smaller portion, add vegetables, and walk for 10 to 15 minutes after.",
                "based_on": used}
    reading = ", ".join(used)
    return {"tone": "success", "headline": "Your readings look fine",
            "message": f"Your {reading} look normal, so {dish} is fine in a sensible portion. {assessment.get('advice', '')}".strip(),
            "based_on": used}
