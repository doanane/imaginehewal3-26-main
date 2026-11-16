"""Who the habit system is for. Not only people with a chronic disease.

Five audiences ("segments"). A segment is suggested from facts the person already gave (age, conditions, desk work) and the person always has the
last word. A segment changes four things only: what is recommended first, the default goals, how fast the step grows, and the wording and timing of
nudges. It never changes the health safety rules (see behavior_engine.safety_note), which apply to everyone.

  chronic       lives with a long-term condition: steady, clinician-aware, the doctor can follow progress if they choose
  sedentary     sits most of the working day: movement breaks and work-hour cues instead of a big step count
  young_adult   under 40, no condition: bigger goals, social and challenge-style support
  adult         40 to 59, no condition: standard pace
  older_adult   60 and over, no condition: gentler goals and slower growth, plus a "stop and get advice" note

The goals below are starting points that match common public-health guidance (about 150 minutes of moderate activity a week, and breaking up
long sitting). They are not a prescription for one person; the loop adjusts to what the person actually does.
"""
from datetime import date
from typing import Dict, List, Optional

from app.services import gulf

SEGMENTS = ("chronic", "sedentary", "young_adult", "adult", "older_adult")

# goal_overrides: behaviour -> (default_baseline, default_goal). grow: share of each growth step that is applied (1 = normal, below 1 = slower).
PROFILE: Dict[str, dict] = {
    "chronic": {"goals": {}, "grow": 1.0, "first": [], "style": None},          # health-driven order is kept
    "sedentary": {"goals": {"movement": (3000, 7000), "breaks": (1, 8)}, "grow": 1.0, "first": ["breaks", "movement", "sleep"], "style": None},
    "young_adult": {"goals": {"movement": (4000, 10000), "activity": (15, 40)}, "grow": 1.25, "first": ["movement", "sleep", "nutrition"], "style": "Social support"},
    "adult": {"goals": {}, "grow": 1.0, "first": [], "style": None},
    "older_adult": {"goals": {"movement": (2500, 6000), "activity": (10, 25)}, "grow": 0.75, "first": ["activity", "movement", "sleep"], "style": "Small steps (graded tasks)"},
}

LABELS = {
    "en": {"chronic": "I live with a long-term condition", "sedentary": "I sit most of my working day", "young_adult": "Adult under 40",
           "adult": "Adult aged 40 to 59", "older_adult": "Adult aged 60 or over"},
    "fr": {"chronic": "Je vis avec une maladie chronique", "sedentary": "Je suis assis presque toute la journée de travail", "young_adult": "Adulte de moins de 40 ans",
           "adult": "Adulte de 40 à 59 ans", "older_adult": "Adulte de 60 ans ou plus"},
    "ar": {"chronic": "أعيش مع حالة مزمنة", "sedentary": "أجلس معظم يوم عملي", "young_adult": "بالغ دون الأربعين",
           "adult": "بالغ بين 40 و59 عامًا", "older_adult": "بالغ بعمر 60 عامًا فأكثر"},
}


def suggest(age: Optional[int], conditions: Optional[List[str]], work_pattern: Optional[str]) -> Optional[str]:
    """A starting suggestion only. A long-term condition comes first (it decides the safety framing), then desk work, then age."""
    if conditions:
        return "chronic"
    if work_pattern == "desk":
        return "sedentary"
    if age is None:
        return None
    return "young_adult" if age < 40 else "adult" if age < 60 else "older_adult"


def resolve(stored: Optional[str], age: Optional[int], conditions: Optional[List[str]], work_pattern: Optional[str]) -> Optional[str]:
    """What the person chose wins; otherwise the suggestion; otherwise None (the standard plan)."""
    return stored if stored in SEGMENTS else suggest(age, conditions, work_pattern)


def goals_for(segment: Optional[str], behavior: str, default_baseline: float, default_goal: float):
    g = (PROFILE.get(segment or "") or {}).get("goals", {}).get(behavior)
    return g if g else (default_baseline, default_goal)


def grow_factor(segment: Optional[str]) -> float:
    return (PROFILE.get(segment or "") or {}).get("grow", 1.0)


def preferred_style(segment: Optional[str]) -> Optional[str]:
    return (PROFILE.get(segment or "") or {}).get("style")


def order_first(segment: Optional[str], recs: List[dict]) -> List[dict]:
    """Put what suits the audience first without dropping anything the health rules recommended."""
    first = (PROFILE.get(segment or "") or {}).get("first", [])
    rank = {b: i for i, b in enumerate(first)}
    if "movement" in rank:
        rank.setdefault("activity", rank["movement"])                 # minutes of movement is the same idea for someone who cannot count steps
    return sorted(recs, key=lambda r: rank.get(r["behavior"], 99))     # stable: recommendations of equal rank keep the health-driven order


# ---------- wording ----------
TEXT: Dict[str, Dict[str, str]] = {
    "en": {
        "sedentary": "At your desk, set a timer for every hour and stand, stretch or walk for 2 to 3 minutes. Breaks add up.",
        "young_adult": "Challenge a friend or a colleague to do this with you today.",
        "older_adult": "Go at an easy pace. Stop and get medical advice if you feel chest pain, dizziness or unusual breathlessness.",
        "ramadan": "In Ramadan, keep movement light and do it after iftar. Drink water between iftar and suhoor.",
        "heat_extreme": "It is very hot outside at this time of year. Move indoors, in a mall or at home, or after sunset. Carry water.",
        "heat_hot": "It is hot outside. Choose early morning or the evening for a walk outdoors, and drink water.",
        "weekend": "It is your weekend: a longer walk with family or friends counts the same.",
        "friday": "Friday prayer is at midday. Fit your movement before or after it.",
    },
    "fr": {
        "sedentary": "À votre bureau, réglez une minuterie toutes les heures et levez-vous, étirez-vous ou marchez 2 à 3 minutes. Les pauses s'additionnent.",
        "young_adult": "Défiez un ami ou un collègue de le faire avec vous aujourd'hui.",
        "older_adult": "Allez à un rythme tranquille. Arrêtez-vous et demandez un avis médical en cas de douleur à la poitrine, de vertiges ou d'essoufflement inhabituel.",
        "ramadan": "Pendant le Ramadan, gardez un mouvement léger et faites-le après l'iftar. Buvez de l'eau entre l'iftar et le suhoor.",
        "heat_extreme": "Il fait très chaud dehors à cette période. Bougez à l'intérieur ou après le coucher du soleil. Emportez de l'eau.",
        "heat_hot": "Il fait chaud dehors. Marchez tôt le matin ou le soir, et buvez de l'eau.",
        "weekend": "C'est votre week-end : une plus longue marche en famille ou entre amis compte tout autant.",
        "friday": "La prière du vendredi a lieu à midi. Placez votre mouvement avant ou après.",
    },
    "ar": {
        "sedentary": "عند مكتبك، اضبط منبهًا كل ساعة وقف أو تمدّد أو امشِ من دقيقتين إلى ثلاث. الاستراحات القصيرة تتراكم فائدتها.",
        "young_adult": "تحدَّ صديقًا أو زميلًا ليقوم بذلك معك اليوم.",
        "older_adult": "سر بوتيرة هادئة. توقف واطلب المشورة الطبية إذا شعرت بألم في الصدر أو دوار أو ضيق تنفس غير معتاد.",
        "ramadan": "في رمضان، اجعل الحركة خفيفة وبعد الإفطار. اشرب الماء بين الإفطار والسحور.",
        "heat_extreme": "الجو شديد الحرارة في هذا الوقت من السنة. تحرّك في الداخل أو بعد الغروب، وخذ معك الماء.",
        "heat_hot": "الجو حار في الخارج. اختر الصباح الباكر أو المساء للمشي، واشرب الماء.",
        "weekend": "إنها عطلتك: المشي لمدة أطول مع العائلة أو الأصدقاء يُحتسب بالقدر نفسه.",
        "friday": "صلاة الجمعة عند الظهر. اجعل حركتك قبلها أو بعدها.",
    },
}

ALL_TEXT_KEYS = tuple(TEXT["en"])


def notes_for(segment: Optional[str], behavior: str, region: Optional[str], day: date, lang: str = "en") -> List[str]:
    """Short extra lines for one day's step. Wording only: the size of the step is never changed here."""
    T = TEXT.get(lang) or TEXT["en"]
    out: List[str] = []
    if segment == "sedentary" and behavior in ("breaks", "movement", "activity"):
        out.append(T["sedentary"])
    elif segment == "young_adult" and behavior in ("movement", "activity"):
        out.append(T["young_adult"])
    elif segment == "older_adult" and behavior in ("movement", "activity", "breaks"):
        out.append(T["older_adult"])
    if behavior in ("movement", "activity") and region and region in gulf.REGIONS and gulf.region_info(region)["city"]:
        if gulf.ramadan(day)["is_ramadan"]:
            out.append(T["ramadan"])
        else:
            h = gulf.heat_level(day, region)
            if h != "mild":
                out.append(T["heat_extreme" if h == "extreme" else "heat_hot"])
        kind = gulf.day_kind(day, region)
        if kind == "weekend":
            out.append(T["weekend"])
        elif day.weekday() == 4:
            out.append(T["friday"])
    return out[:3]


def send_window(segment: Optional[str], region: Optional[str], now_local_weekday: int, usual_hour: Optional[int]):
    """(first_hour, last_hour) in which a message may go. Desk workers on a workday are reached in work hours, when they are sitting."""
    if usual_hour is not None:
        return usual_hour - 1, usual_hour + 1
    if segment == "sedentary" and now_local_weekday not in gulf.region_info(region)["weekend"]:
        return 10, 16
    return 9, 18
