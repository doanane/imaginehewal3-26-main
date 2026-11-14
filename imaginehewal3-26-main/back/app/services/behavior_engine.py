"""
Adaptive behaviour-change engine.

Pure Python, no cloud or network dependency: it works with no Azure access.
All functions take plain values (dates, dicts) so they are unit-testable.
"""
from collections import Counter
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

# Share of the gap (baseline -> goal) asked per day at each level.
LEVEL_FRACTION = {1: 0.15, 2: 0.30, 3: 0.50, 4: 0.75, 5: 1.0}
COMEBACK_FRACTION = 0.10  # deliberately tiny "welcome back" step

LAPSE_DAYS = 3  # consecutive days with no check-in

BEHAVIORS: Dict[str, dict] = {
    "movement": {"unit": "steps", "direction": "up", "step": 100,
                 "default_baseline": 3000, "default_goal": 8000},
    "nutrition": {"unit": "vegetable/fruit servings", "direction": "up", "step": 1,
                  "default_baseline": 1, "default_goal": 5},
    "sleep": {"unit": "hours of sleep", "direction": "up", "step": 0.5,
              "default_baseline": 5.5, "default_goal": 7.5},
    "smoking": {"unit": "cigarettes per day", "direction": "down", "step": 1,
                "default_baseline": 10, "default_goal": 0},
}

BARRIERS = ["time", "tired", "forgot", "motivation", "weather", "access",
            "pain_sick", "stress", "craving", "other"]

# technique name -> (why it works, its limits). Shown to the user.
TECHNIQUES: Dict[str, Tuple[str, str]] = {
    "Small steps (graded tasks)": (
        "Starting with an easy version builds confidence, and difficulty only rises once you are consistent.",
        "Progress can feel slow. You can change the pace yourself at any time."),
    "Habit stacking": (
        "Linking a new action to something you already do daily makes it easier to remember.",
        "Works best for steady routines; shift work or travel may need a different cue."),
    "Implementation intention": (
        "Deciding exactly when and where you will act ('after lunch, at the gate') makes follow-through more likely.",
        "Needs a fairly predictable day."),
    "Self-monitoring": (
        "Seeing your own numbers helps you notice patterns and gives you a sense of progress.",
        "Counting can feel stressful for some people; turn it off if it does."),
    "Substitution": (
        "Swapping an unhelpful habit for a similar, healthier one is easier than just removing it.",
        "Does not replace medical advice, and cravings may still need support."),
    "Coping planning": (
        "Planning for a known obstacle ahead of time (stress, cravings, bad weather) helps you keep going.",
        "Only helps for obstacles you can predict."),
    "Social support": (
        "Sharing a goal with someone you trust can raise commitment and make setbacks easier to handle.",
        "Only share if you want to; this app never shares your data without your choice."),
    "Self-compassion after setbacks": (
        "Treating a lapse as normal, not as failure, makes people more likely to return.",
        "Not a substitute for professional support if you are struggling."),
}

BARRIER_TWEAK: Dict[str, Tuple[str, str]] = {
    "time": ("Split it into two or three short blocks (5 minutes each).", "Implementation intention"),
    "tired": ("Choose the lightest version, even half of it counts.", "Small steps (graded tasks)"),
    "forgot": ("Set a reminder tied to a daily routine, e.g. after breakfast or prayer.", "Habit stacking"),
    "motivation": ("Do it with a friend or family member, or reward yourself afterwards.", "Social support"),
    "weather": ("Do an indoor version: walk around the house, stretch, or prepare food indoors.", "Coping planning"),
    "access": ("Use what you already have nearby: your compound, a market walk, home-cooked options.", "Coping planning"),
    "pain_sick": ("Go gently. If pain or sickness continues, speak to your clinician.", "Small steps (graded tasks)"),
    "stress": ("Take 3 slow breaths before you start; keep it very small.", "Coping planning"),
    "craving": ("When a craving hits, wait 10 minutes, drink water or chew gum, then decide.", "Substitution"),
}

BASE_ACTIONS = {
    "movement": [
        ("Walk {t} steps today",
         "Try a 10-minute walk after a meal, then add more as you go.", "Habit stacking"),
        ("Reach {t} steps today",
         "Decide now when you will walk, e.g. 'after lunch, around the compound or market'.",
         "Implementation intention"),
        ("Check your step count twice today and aim for {t}",
         "Look at your count at midday and evening.", "Self-monitoring"),
    ],
    "nutrition": [
        ("Have {t} serving(s) of vegetables or fruit today",
         "e.g. kontomire, garden eggs, okro, cabbage, oranges or pawpaw added to a meal you already eat.",
         "Substitution"),
        ("Add {t} serving(s) of vegetables or fruit to your meals",
         "Plan which meal gets them: 'with lunch'.", "Implementation intention"),
    ],
    "sleep": [
        ("Aim for {t:g} hours of sleep tonight",
         "Pick a bedtime now and keep screens away for 30 minutes before it.",
         "Implementation intention"),
        ("Be in bed in time for {t:g} hours of sleep",
         "Do the same wind-down step each night, e.g. wash, then lights down.", "Habit stacking"),
    ],
    "smoking": [
        ("Keep to {t} cigarette(s) or fewer today",
         "Delay the first one by 30 minutes and note when cravings come.", "Self-monitoring"),
        ("No more than {t} cigarette(s) today",
         "Swap one cigarette for water, a short walk or chewing gum.", "Substitution"),
    ],
}

MESSAGES = {
    "en": {
        "done": "Nice work. That counts. Small steps add up.",
        "partial": "Partly done is still progress. Every bit counts.",
        "skipped": "That's okay, tough days happen. Your progress is kept.",
        "level_up": "You've been consistent, so tomorrow's step is slightly bigger. You can change it any time.",
        "level_down": "We'll make tomorrow's step a little easier. No pressure, your progress stays.",
        "welcome_back": "Welcome back! Nothing has been reset. Let's start with a very small step.",
        "ask_barrier": "What got in the way recently? Tap one so we can adjust your plan.",
    },
    "ar": {
        "done": "أحسنت! هذا يُحتسب. الخطوات الصغيرة تتراكم.",
        "partial": "إنجاز جزئي هو تقدّم أيضًا. كل خطوة تُحسب.",
        "skipped": "لا بأس، تمر علينا أيام صعبة. تقدّمك محفوظ.",
        "level_up": "لقد كنت منتظمًا، لذا ستكون خطوة الغد أكبر قليلًا. يمكنك تغييرها في أي وقت.",
        "level_down": "سنجعل خطوة الغد أسهل قليلًا. لا ضغط، تقدّمك باقٍ.",
        "welcome_back": "أهلًا بعودتك! لم يُعاد ضبط أي شيء. لنبدأ بخطوة صغيرة جدًا.",
        "ask_barrier": "ما الذي أعاقك مؤخرًا؟ اختر سببًا لنعدّل خطتك.",
    },
    "fr": {
        "done": "Bravo ! Ça compte. Les petits pas s'additionnent.",
        "partial": "Un succès partiel reste un progrès. Chaque effort compte.",
        "skipped": "Ce n'est pas grave, certains jours sont difficiles. Vos progrès sont conservés.",
        "level_up": "Vous êtes régulier, l'étape de demain sera un peu plus grande. Vous pouvez la modifier à tout moment.",
        "level_down": "Nous allégerons un peu l'étape de demain. Pas de pression, vos progrès restent.",
        "welcome_back": "Bon retour ! Rien n'a été remis à zéro. Commençons par un tout petit pas.",
        "ask_barrier": "Qu'est-ce qui a gêné récemment ? Choisissez une raison pour adapter votre plan.",
    },
}

# Local languages are accepted now; any string not yet translated falls back to English.
for _code in ("tw", "ee", "ha", "gaa"):
    MESSAGES.setdefault(_code, {})


def msg(key: str, lang: str = "en") -> str:
    return MESSAGES.get(lang, MESSAGES["en"]).get(key, MESSAGES["en"][key])


def _round_to(value: float, step: float) -> float:
    r = round(value / step) * step
    return int(r) if step >= 1 else round(r, 1)


def target_for(behavior: str, baseline: float, goal: float, level: int,
               comeback: bool = False) -> float:
    cfg = BEHAVIORS[behavior]
    frac = COMEBACK_FRACTION if comeback else LEVEL_FRACTION[max(1, min(5, level))]
    if cfg["direction"] == "up":
        raw = baseline + (goal - baseline) * frac
        t = max(_round_to(raw, cfg["step"]), baseline + cfg["step"])  # always a step up
        return min(t, goal) if goal >= baseline else t
    raw = baseline - (baseline - goal) * frac
    t = min(_round_to(raw, cfg["step"]), baseline - cfg["step"])  # always a step down
    return max(t, goal)


def build_action(behavior: str, baseline: float, goal: float, level: int,
                 day: date, comeback: bool = False,
                 top_barrier: Optional[str] = None, option_index: Optional[int] = None,
                 note: str = "") -> dict:
    """Return title/detail/technique/rationale/target for one day's action.
    `option_index` lets the learning engine choose the style; `note` explains that choice to the user."""
    target = target_for(behavior, baseline, goal, level, comeback)
    options = BASE_ACTIONS[behavior]
    idx = option_index if option_index is not None and 0 <= option_index < len(options) else day.toordinal() % len(options)
    title_t, detail, technique = options[idx]
    adaptation = None
    if comeback:
        technique = "Self-compassion after setbacks"
        detail = "A very small step to get going again. " + detail
    elif top_barrier in BARRIER_TWEAK:
        adaptation, technique = BARRIER_TWEAK[top_barrier]
        detail = f"{detail} {adaptation}"
    why, limits = TECHNIQUES[technique]
    return {
        "title": title_t.format(t=target),
        "detail": detail,
        "technique": technique,
        "rationale": f"{why} Limits: {limits}" + (f" {note}" if note else ""),
        "target_value": target,
        "adapted_for_barrier": top_barrier if adaptation else None,
    }


def status_from_value(behavior: str, value: float, target: float,
                      baseline: float) -> str:
    """Derive status when the user logs a number."""
    if BEHAVIORS[behavior]["direction"] == "up":
        if value >= target:
            return "done"
        return "partial" if value > baseline * 0.5 and value > 0 else "skipped"
    if value <= target:
        return "done"
    return "partial" if value < baseline else "skipped"


# ---------- history analysis ----------
# day_status: {date: "done"|"partial"|"skipped"}. A day absent from the map = no check-in.

def _score(s: Optional[str]) -> float:
    return {"done": 1.0, "partial": 0.5}.get(s or "", 0.0)


def _engaged(s: Optional[str]) -> bool:
    return s in ("done", "partial", "skipped")  # reporting a skip is still engagement


def adherence(day_status: Dict[date, str], today: date, window: int = 7,
              start: Optional[date] = None) -> Tuple[float, int]:
    """Adherence over the last `window` completed days (excludes today)."""
    days = [today - timedelta(days=i) for i in range(1, window + 1)]
    if start:
        days = [d for d in days if d >= start]
    if not days:
        return 0.0, 0
    return sum(_score(day_status.get(d)) for d in days) / len(days), len(days)


def consecutive_missed_days(day_status: Dict[date, str], today: date,
                            start: date) -> int:
    n, d = 0, today - timedelta(days=1)
    while d >= start and not _engaged(day_status.get(d)):
        n += 1
        d -= timedelta(days=1)
    return n


def detect_lapse(day_status: Dict[date, str], today: date, start: date) -> dict:
    missed = consecutive_missed_days(day_status, today, start)
    if missed >= LAPSE_DAYS:
        return {"state": "lapse", "missed_days": missed}
    this_week, n1 = _engagement_rate(day_status, today, 1, 7, start)
    prev_week, n2 = _engagement_rate(day_status, today, 8, 14, start)
    if n1 >= 5 and n2 >= 5 and prev_week - this_week >= 0.3:
        return {"state": "declining", "missed_days": missed}
    return {"state": "ok", "missed_days": missed}


def _engagement_rate(day_status, today, from_ago, to_ago, start):
    days = [today - timedelta(days=i) for i in range(from_ago, to_ago + 1)]
    days = [d for d in days if d >= start]
    if not days:
        return 0.0, 0
    return sum(1 for d in days if _engaged(day_status.get(d))) / len(days), len(days)


def infer_barrier(recent_barriers: List[str],
                  missed_weekdays: List[int]) -> Optional[str]:
    """Most common self-reported barrier; else None (the app then asks)."""
    if recent_barriers:
        return Counter(recent_barriers).most_common(1)[0][0]
    return None


def suggest_level(level: int, day_status: Dict[date, str], today: date,
                  start: date, last_change: Optional[date]) -> Tuple[int, Optional[str]]:
    """Return (new_level, reason) where reason is 'level_up'|'level_down'|None."""
    if last_change and (today - last_change).days < 3:
        return level, None  # don't flip-flop
    rate, n = adherence(day_status, today, 7, start)
    if n >= 5 and rate >= 0.85 and level < 5:
        return level + 1, "level_up"
    if n >= 3 and rate < 0.35 and level > 1:
        return level - 1, "level_down"
    return level, None


def streaks(day_status: Dict[date, str], today: date) -> dict:
    """Streak that tolerates one missed day (two in a row breaks it).
    Lifetime active days and best streak are never reset."""
    active_days = sorted(d for d, s in day_status.items() if s in ("done", "partial"))
    total = len(active_days)
    best = cur = 0
    prev = None
    for d in active_days:
        cur = cur + 1 if prev and (d - prev).days <= 2 else 1
        best = max(best, cur)
        prev = d
    current = cur if prev and (today - prev).days <= 2 else 0
    return {"current": current, "best": best, "total_active_days": total}


def outcomes(day_status: Dict[date, str], values: Dict[date, float],
             baseline: float, direction: str, start: date, today: date) -> dict:
    """Persistence, recovery after lapses, and change in the target behaviour."""
    all_days = [start + timedelta(days=i) for i in range((today - start).days)]
    # lapses and how long each took to recover from
    lapses, recoveries, run = 0, [], 0
    for d in all_days:
        if _engaged(day_status.get(d)):
            if run >= LAPSE_DAYS:
                recoveries.append(run)
            run = 0
        else:
            run += 1
            if run == LAPSE_DAYS:
                lapses += 1
    # weekly adherence
    weeks = []
    for w in range(8):
        wend = today - timedelta(days=7 * w)
        days = [wend - timedelta(days=i) for i in range(1, 8)]
        days = [d for d in days if d >= start]
        if days:
            weeks.append({
                "week_ending": (wend - timedelta(days=1)).isoformat(),
                "adherence": round(sum(_score(day_status.get(d)) for d in days) / len(days), 2),
            })
    weeks.reverse()
    persisted = sum(1 for w in weeks if w["adherence"] >= 0.4)
    recent_vals = [values[d] for d in sorted(values) if d >= today - timedelta(days=7)]
    change_pct = None
    if recent_vals and baseline:
        avg = sum(recent_vals) / len(recent_vals)
        delta = (avg - baseline) if direction == "up" else (baseline - avg)
        change_pct = round(100 * delta / baseline, 1)
    last_active = max((d for d, s in day_status.items() if s in ("done", "partial")), default=None)
    return {
        "weeks_tracked": len(weeks),
        "weeks_persisted": persisted,
        "lapses": lapses,
        "recovered_lapses": len(recoveries),
        "avg_days_to_recover": round(sum(recoveries) / len(recoveries), 1) if recoveries else None,
        "behaviour_change_pct_vs_baseline": change_pct,
        "retained_last_7_days": bool(last_active and (today - last_active).days <= 7),
        "weekly_adherence": weeks,
    }
