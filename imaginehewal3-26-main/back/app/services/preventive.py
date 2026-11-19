"""Preventive health: a type 2 diabetes risk questionnaire, an age-and-sex screening schedule and a workplace heat check.

Everything here is ordinary arithmetic and fixed tables (no AI), and every result says what it is based on and that it is general guidance, not a
diagnosis. The diabetes score is the published FINDRISC questionnaire (Finnish Diabetes Risk Score, Lindstrom and Tuomilehto 2003). The heat check uses
the US National Weather Service heat index (Rothfusz regression) and the usual work/rest guidance bands. None of it replaces a clinician.
"""
from __future__ import annotations

from typing import List, Optional

HIGH_RISK_CONDITIONS = ("hypertension", "heart", "diabet", "kidney", "asthma")


# ------------------------------------------------------------------ diabetes risk (FINDRISC)
def diabetes_risk(*, age: int, bmi: Optional[float], waist_cm: Optional[float], sex: str, active_30min_daily: bool, veg_fruit_daily: bool,
                  bp_medicine: bool, high_glucose_before: bool, family: str) -> dict:
    """family: 'none' | 'second_degree' | 'first_degree'. Returns the score (0 to 26), the band and what to do next."""
    parts: List[dict] = []

    def add(label: str, points: int, why: str):
        parts.append({"label": label, "points": points, "why": why})

    add("Age", 0 if age < 45 else 2 if age < 55 else 3 if age < 65 else 4, f"{age} years")
    if bmi is not None:
        add("Body mass index", 0 if bmi < 25 else 1 if bmi < 30 else 3, f"BMI {bmi:.1f}")
    if waist_cm is not None:
        male = (sex or "").lower().startswith("m")
        lo, hi = (94, 102) if male else (80, 88)
        add("Waist", 0 if waist_cm < lo else 3 if waist_cm <= hi else 4, f"{waist_cm:.0f} cm")
    add("Physical activity", 0 if active_30min_daily else 2, "30 minutes or more most days" if active_30min_daily else "less than 30 minutes most days")
    add("Fruit and vegetables", 0 if veg_fruit_daily else 1, "every day" if veg_fruit_daily else "not every day")
    add("Blood pressure medicine", 2 if bp_medicine else 0, "taking it" if bp_medicine else "not taking it")
    add("High blood sugar before", 5 if high_glucose_before else 0, "yes" if high_glucose_before else "no")
    add("Family with diabetes", {"none": 0, "second_degree": 3, "first_degree": 5}.get(family, 0), family.replace("_", " "))
    total = sum(p["points"] for p in parts)
    if total < 7:
        band, next_step = "low", "Keep up your habits. Repeat this check once a year."
    elif total < 12:
        band, next_step = "slightly_elevated", "Small steps help: more movement and fewer sugary drinks. Repeat the check in 6 months."
    elif total < 15:
        band, next_step = "moderate", "Ask a clinician about a fasting glucose or HbA1c test in the next few months."
    elif total < 21:
        band, next_step = "high", "Book a blood sugar test (fasting glucose or HbA1c) with a clinician soon."
    else:
        band, next_step = "very_high", "Book a blood sugar test with a clinician this week."
    answered = sum(1 for p in parts)
    return {"score": total, "max": 26, "band": band, "next_step": next_step, "parts": parts,
            "complete": answered == 8, "note": "A simplified, published questionnaire (FINDRISC). It estimates risk over about ten years. It is not a diagnosis."}


# ------------------------------------------------------------------ screening schedule
def screenings(age: int, sex: str, conditions: Optional[List[str]] = None) -> List[dict]:
    """General public-health screening reminders by age and sex. A clinician decides what applies to a person."""
    conds = " ".join(conditions or []).lower()
    female = (sex or "").lower().startswith("f")
    out: List[dict] = []

    def add(name: str, every: str, why: str):
        out.append({"name": name, "every": every, "why": why})

    if age >= 18:
        add("Blood pressure", "every year, or more often with hypertension", "High blood pressure often has no symptoms.")
    if age >= 40 or "diabet" in conds or "hypertension" in conds:
        add("Blood sugar (fasting glucose or HbA1c)", "every 1 to 3 years", "Finds diabetes and pre-diabetes early.")
    if age >= 40:
        add("Cholesterol", "every 5 years, or as advised", "Part of heart disease risk.")
    if female and 25 <= age <= 65:
        add("Cervical screening", "every 3 to 5 years", "Finds changes before they become cancer.")
    if female and age >= 40:
        add("Breast screening (mammogram)", "every 1 to 2 years", "Recommended from about 40 to 50 depending on the guideline.")
    if age >= 45:
        add("Bowel cancer screening", "as advised by your clinician", "Usually starts around 45 to 50.")
    if age >= 50 and not female:
        add("Prostate health discussion", "talk to a clinician", "Screening is a shared decision.")
    if age >= 65:
        add("Bone density and fall-risk review", "as advised", "Helps prevent fractures.")
        add("Flu and pneumonia vaccines", "flu every year", "Protects against serious illness.")
    add("Eye check", "every 1 to 2 years", "More often with diabetes.")
    add("Dental check", "every 6 to 12 months", "")
    return out


# ------------------------------------------------------------------ workplace heat
def _heat_index_c(temp_c: float, rh: float) -> float:
    """NWS heat index (Rothfusz regression). Below about 27 degrees C the air temperature is used."""
    t = temp_c * 9 / 5 + 32
    if t < 80:
        return temp_c
    hi = (-42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 6.83783e-3 * t * t - 5.481717e-2 * rh * rh
          + 1.22874e-3 * t * t * rh + 8.5282e-4 * t * rh * rh - 1.99e-6 * t * t * rh * rh)
    if rh < 13 and 80 <= t <= 112:
        hi -= ((13 - rh) / 4) * ((17 - abs(t - 95)) / 17) ** 0.5
    elif rh > 85 and 80 <= t <= 87:
        hi += ((rh - 85) / 10) * ((87 - t) / 5)
    return round((hi - 32) * 5 / 9, 1)


HI_CAP_C = 55.0
LEVELS = ["low", "caution", "extreme_caution", "danger", "extreme_danger"]
ADVICE = {
    "low": {"title": "Low heat risk", "water": "Drink when thirsty.", "rest": "Normal breaks.", "do": ["Stay hydrated through the day."]},
    "caution": {"title": "Caution", "water": "About a cup (250 ml) of water every 30 minutes.", "rest": "Take a short shaded break every hour.",
                "do": ["Watch for tiredness and cramps.", "Wear light, loose clothing and a hat."]},
    "extreme_caution": {"title": "Extreme caution", "water": "A cup (250 ml) every 20 minutes, even if not thirsty.", "rest": "Rest in the shade or cool air for 10 minutes each hour.",
                        "do": ["Start heavy tasks early in the day.", "Work in pairs and check on each other.", "Stop if dizzy, nauseous or with a headache."]},
    "danger": {"title": "Danger", "water": "A cup (250 ml) every 15 minutes.", "rest": "Rest 15 minutes in the cool for every 45 minutes of work.",
               "do": ["Move heavy outdoor work to early morning or evening.", "Someone should watch for signs of heat illness.", "Heat exhaustion: move to shade, cool the skin, sip water."]},
    "extreme_danger": {"title": "Extreme danger", "water": "A cup (250 ml) every 15 minutes, and do not wait for thirst.", "rest": "Avoid outdoor work in the heat of the day.",
                       "do": ["Do not work outdoors in direct sun if it can be avoided.", "Confusion, no sweating or fainting is an emergency: call emergency services and cool the person now."]},
}


def heat_check(*, temp_c: float, humidity_pct: float, effort: str = "light", direct_sun: bool = False, conditions: Optional[List[str]] = None,
               region: Optional[str] = None) -> dict:
    """Heat index from the entered temperature and humidity, raised one step for heavy effort, direct sun or a condition that makes heat harder."""
    raw = _heat_index_c(temp_c, humidity_pct)
    capped = raw > HI_CAP_C
    hi = min(raw, HI_CAP_C)                                        # the formula is only meant for ordinary weather: never show an absurd figure
    f = raw * 9 / 5 + 32                                           # the level still uses the raw value
    idx = 0 if f < 80 else 1 if f < 91 else 2 if f < 104 else 3 if f < 125 else 4
    raised: List[str] = []
    if effort == "heavy" and idx < 4:
        idx += 1; raised.append("heavy physical work")
    if direct_sun and idx < 4:
        idx += 1; raised.append("working in direct sun")
    conds = " ".join(conditions or []).lower()
    if any(c in conds for c in HIGH_RISK_CONDITIONS) and idx < 4 and idx >= 1:
        idx += 1; raised.append("a health condition that makes heat harder to handle")
    level = LEVELS[idx]
    a = ADVICE[level]
    extra = ["If you take medicines for blood pressure, heart or kidneys, ask a clinician how heat affects them."] if any(c in conds for c in HIGH_RISK_CONDITIONS) else []
    return {"heat_index_c": hi, "heat_index_capped": capped, "temp_c": temp_c, "humidity_pct": humidity_pct, "level": level, "title": a["title"], "water": a["water"], "rest": a["rest"],
            "do": a["do"] + extra, "raised_because": raised, "emergency_number": "998" if (region or "").lower() == "ae" else "112",
            "note": "General guidance from the heat index and usual work-rest bands. It does not replace your employer's safety plan or a clinician."}
