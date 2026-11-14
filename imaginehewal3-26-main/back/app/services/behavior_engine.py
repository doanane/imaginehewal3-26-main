"""
Adaptive behaviour-change engine.

Pure Python, no cloud or network dependency: it works with no Azure access.
All functions take plain values (dates, dicts) so they are unit-testable.
"""
from collections import Counter
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from app.services import behavior_l10n as l10n

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
    # Minutes of any movement, so people who cannot or prefer not to count steps (wheelchair, limited mobility, seated work) are not left out.
    "activity": {"unit": "active minutes", "direction": "up", "step": 5,
                 "default_baseline": 10, "default_goal": 30},
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

# Behaviour Change Technique Taxonomy v1 (Michie et al., 2013, Annals of Behavioral Medicine). Evidence strength is a plain-language summary of how
# consistently these techniques help groups of people in research; it is NOT a promise for one person, which is why the app also measures
# what works for each individual (see learning_service) and shows it back.
TECHNIQUE_META: Dict[str, dict] = {
    "Small steps (graded tasks)": {"bct_code": "8.7", "bct_name": "Graded tasks", "evidence": "moderate"},
    "Habit stacking": {"bct_code": "8.3", "bct_name": "Habit formation", "evidence": "moderate"},
    "Implementation intention": {"bct_code": "1.4", "bct_name": "Action planning", "evidence": "strong"},
    "Self-monitoring": {"bct_code": "2.3", "bct_name": "Self-monitoring of behaviour", "evidence": "strong"},
    "Substitution": {"bct_code": "8.2", "bct_name": "Behaviour substitution", "evidence": "moderate"},
    "Coping planning": {"bct_code": "1.2", "bct_name": "Problem solving", "evidence": "moderate"},
    "Social support": {"bct_code": "3.1", "bct_name": "Social support (unspecified)", "evidence": "moderate"},
    "Self-compassion after setbacks": {"bct_code": "11.2", "bct_name": "Reduce negative emotions (closest match)", "evidence": "emerging"},
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
    "activity": [
        ("Be active for {t} minutes today",
         "Anything that gets you moving counts: walking, seated arm and leg exercises, stretching, dancing or housework. Short blocks are fine.",
         "Small steps (graded tasks)"),
        ("Move for {t} minutes today, in short blocks",
         "Decide when: for example after each meal. Five minutes three times adds up.", "Implementation intention"),
        ("Do something you enjoy that moves you for {t} minutes",
         "Music, a seated workout, a walk with someone, or helping at home. Pick what you like.", "Social support"),
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
        "nudge_1": "A very small step is waiting whenever you are ready. Nothing has been lost.",
        "nudge_2": "Thinking of you. Even one minute counts today, or tell us what got in the way.",
        "nudge_paused": "We will stop reminding you now. Your plan and progress are safe and will be here when you want them.",
        "supporter_prompt": "Someone you support could use a kind word today.",
        "safety_pause": "We held today's step at the same size while your health is checked.",
    },
    "ar": {
        "done": "أحسنت! هذا يُحتسب. الخطوات الصغيرة تتراكم.",
        "partial": "إنجاز جزئي هو تقدّم أيضًا. كل خطوة تُحسب.",
        "skipped": "لا بأس، تمر علينا أيام صعبة. تقدّمك محفوظ.",
        "level_up": "لقد كنت منتظمًا، لذا ستكون خطوة الغد أكبر قليلًا. يمكنك تغييرها في أي وقت.",
        "level_down": "سنجعل خطوة الغد أسهل قليلًا. لا ضغط، تقدّمك باقٍ.",
        "welcome_back": "أهلًا بعودتك! لم يُعاد ضبط أي شيء. لنبدأ بخطوة صغيرة جدًا.",
        "ask_barrier": "ما الذي أعاقك مؤخرًا؟ اختر سببًا لنعدّل خطتك.",
        "nudge_1": "خطوة صغيرة جدًا بانتظارك متى شئت. لم يضع شيء.",
        "nudge_2": "نفكر بك. دقيقة واحدة تكفي اليوم، أو أخبرنا بما أعاقك.",
        "nudge_paused": "سنتوقف عن التذكير الآن. خطتك وتقدّمك محفوظان وسيكونان في انتظارك.",
        "supporter_prompt": "شخص تدعمه قد يسعد بكلمة طيبة اليوم.",
        "safety_pause": "أبقينا خطوة اليوم بنفس الحجم ريثما تُراجَع حالتك الصحية.",
    },
    "fr": {
        "done": "Bravo ! Ça compte. Les petits pas s'additionnent.",
        "partial": "Un succès partiel reste un progrès. Chaque effort compte.",
        "skipped": "Ce n'est pas grave, certains jours sont difficiles. Vos progrès sont conservés.",
        "level_up": "Vous êtes régulier, l'étape de demain sera un peu plus grande. Vous pouvez la modifier à tout moment.",
        "level_down": "Nous allégerons un peu l'étape de demain. Pas de pression, vos progrès restent.",
        "welcome_back": "Bon retour ! Rien n'a été remis à zéro. Commençons par un tout petit pas.",
        "ask_barrier": "Qu'est-ce qui a gêné récemment ? Choisissez une raison pour adapter votre plan.",
        "nudge_1": "Un tout petit pas vous attend quand vous voulez. Rien n'est perdu.",
        "nudge_2": "Nous pensons à vous. Une minute suffit aujourd'hui, ou dites-nous ce qui a gêné.",
        "nudge_paused": "Nous arrêtons les rappels. Votre plan et vos progrès sont conservés et vous attendront.",
        "supporter_prompt": "Une personne que vous soutenez aimerait peut-être un mot gentil aujourd'hui.",
        "safety_pause": "Nous gardons l'étape d'aujourd'hui à la même taille pendant que votre santé est vérifiée.",
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
                 note: str = "", lang: str = "en") -> dict:
    """Return title/detail/technique/rationale/target for one day's action.
    `option_index` lets the learning engine choose the style; `note` explains that choice to the user."""
    target = target_for(behavior, baseline, goal, level, comeback)
    options = BASE_ACTIONS[behavior]
    idx = option_index if option_index is not None and 0 <= option_index < len(options) else day.toordinal() % len(options)
    title_t, detail, technique = options[idx]
    local = (l10n.ACTIONS.get(lang) or {}).get((behavior, idx))      # French or Arabic text when we have it; otherwise English
    if local:
        title_t, detail = local
    adaptation = None
    if comeback:
        technique = "Self-compassion after setbacks"
        detail = l10n.COMEBACK_PREFIX.get(lang, l10n.COMEBACK_PREFIX["en"]) + detail
    elif top_barrier in BARRIER_TWEAK:
        adaptation, technique = BARRIER_TWEAK[top_barrier]
        adaptation = l10n.pick(l10n.TWEAK, lang, top_barrier, adaptation)
        detail = f"{detail} {adaptation}"
    why, limits = l10n.tech(lang, technique) or TECHNIQUES[technique]
    limits_label = l10n.LIMITS_LABEL.get(lang, "Limits:")
    return {
        "title": title_t.format(t=int(target) if float(target).is_integer() else target),      # "2 servings", never "2.0 servings"
        "detail": detail,
        "technique": technique,
        "rationale": f"{why} {limits_label} {limits}" + (f" {note}" if note else ""),
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
                  start: date, last_change: Optional[date], slow: bool = False,
                  hold: bool = False) -> Tuple[int, Optional[str]]:
    """Return (new_level, reason) where reason is 'level_up'|'level_down'|None.
    `slow` (a person who is only thinking about change) needs a longer, steadier run before the step grows;
    `hold` (a health safety reason) never lets it grow."""
    if last_change and (today - last_change).days < 3:
        return level, None  # don't flip-flop
    window = 10 if slow else 7
    rate, n = adherence(day_status, today, window, start)
    if n >= (8 if slow else 5) and rate >= (0.9 if slow else 0.85) and level < 5 and not hold:
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
    # Sustained = kept going in most of the last eight weeks. It is only judged once there are eight weeks to judge.
    sustained = (persisted >= 6) if len(weeks) >= 8 else None
    longest_gap = 0
    gap = 0
    for d in all_days:
        gap = 0 if _engaged(day_status.get(d)) else gap + 1
        longest_gap = max(longest_gap, gap)
    return {
        "sustained": sustained,
        "recovery_rate": round(len(recoveries) / lapses, 2) if lapses else None,
        "longest_gap_days": longest_gap,
        "weeks_tracked": len(weeks),
        "weeks_persisted": persisted,
        "lapses": lapses,
        "recovered_lapses": len(recoveries),
        "avg_days_to_recover": round(sum(recoveries) / len(recoveries), 1) if recoveries else None,
        "behaviour_change_pct_vs_baseline": change_pct,
        "retained_last_7_days": bool(last_active and (today - last_active).days <= 7),
        "weekly_adherence": weeks,
    }



# ---------- circumstances, health context and chosen data ----------
TIME_LABEL = {"morning": "morning", "midday": "midday", "evening": "evening"}
SUPPORT_WORD = {"family": "a family member", "friend": "a friend", "workplace": "a colleague"}


def adapt_for_context(built: dict, behavior: str, ctx: Optional[dict], lang: str = "en") -> dict:
    """Fit one day's action to the person's life. Only wording and cues change; the size of the step is decided by the loop, never by this."""
    if not ctx:
        return built
    X = lambda k: l10n.pick(l10n.CONTEXT, lang, k) or l10n.CONTEXT["en"][k]          # noqa: E731
    b = dict(built)
    detail = b["detail"]
    extra: List[str] = []
    if ctx.get("work_pattern") in ("shift", "irregular"):
        extra.append(X("shift"))
    elif ctx.get("preferred_time") in TIME_LABEL:
        extra.append(X("time").format(x=X(ctx["preferred_time"])))
    if behavior in ("movement", "activity") and ctx.get("mobility") in ("limited", "wheelchair"):
        extra.append(X("chair") if behavior == "activity" else X("steps_hint"))
    who = ctx.get("support") if ctx.get("support") in SUPPORT_WORD else None
    if who and b.get("technique") in ("Social support", "Habit stacking", "Implementation intention"):
        extra.append(X("ask").format(who=X(who)))
    why = (ctx.get("motivation_text") or "").strip()
    if why and (b.get("technique") == "Self-compassion after setbacks" or b.get("adapted_for_barrier") == "motivation"):
        extra.append(X("reason").format(why=why[:120]))
    if extra:
        detail = f"{detail} {' '.join(extra)}"
    if ctx.get("literacy") == "simple":
        first = detail.split(". ")[0].rstrip(".") + "."
        detail = first
        b["rationale"] = b["rationale"].split(". ")[0].rstrip(".") + "."
    b["detail"] = detail
    return b


def safety_note(behavior: str, health: Optional[dict], lang: str = "en") -> dict:
    """Health guard rails. `hold_level` stops the step from growing; the note tells the person why in plain words.
    This is guidance to speak to a clinician, never a diagnosis."""
    health = health or {}
    S = lambda k: l10n.pick(l10n.SAFETY, lang, k) or l10n.SAFETY["en"][k]          # noqa: E731
    conditions = [str(c).lower() for c in (health.get("conditions") or [])]
    if behavior in ("movement", "activity"):
        if health.get("bp_crisis") or health.get("sos_active"):
            return {"hold_level": True, "reason": "safety", "note": S("bp")}
        if any(k in conditions for k in ("heart", "cardiac", "heart failure", "angina")):
            return {"hold_level": False, "reason": "condition", "note": S("heart")}
    if behavior == "nutrition" and any("diabet" in c for c in conditions):
        return {"hold_level": False, "reason": "condition", "note": S("diabetes")}
    if behavior == "smoking":
        return {"hold_level": False, "reason": "support", "note": S("smoking")}
    return {"hold_level": False, "reason": None, "note": None}


def infer_barrier_from_data(self_reported: Optional[str], sleep_hours: Optional[float], bp_crisis: bool = False) -> Tuple[Optional[str], Optional[str]]:
    """(barrier, source). What the person said always wins. Without it, the data they chose to share can suggest a likely barrier."""
    if self_reported:
        return self_reported, "self"
    if bp_crisis:
        return "pain_sick", "data"
    if sleep_hours is not None and sleep_hours < 5.5:
        return "tired", "data"
    return None, None


def recommend_behaviors(ctx: Optional[dict], profile: Optional[dict], sleep_hours: Optional[float], active: List[str]) -> List[dict]:
    """Turn who the person is into a short, ordered list of what to try, each with the reason. Never more than three."""
    ctx = ctx or {}
    profile = profile or {}
    conditions = [str(c).lower() for c in (profile.get("conditions") or [])]
    habits = [str(h).lower() for h in (profile.get("habits") or [])]
    out: List[dict] = []
    limited = ctx.get("mobility") in ("limited", "wheelchair")
    move = "activity" if limited else "movement"
    if any(k in conditions for k in ("hypertension", "high blood pressure", "diabetes", "type 2 diabetes", "heart", "obesity")):
        out.append({"behavior": move, "reason": "Regular movement helps blood pressure, blood sugar and the heart." + (" Minutes of any movement suit you, so steps are not required." if limited else "")})
    if sleep_hours is not None and sleep_hours < 6:
        out.append({"behavior": "sleep", "reason": f"You slept about {sleep_hours:g} hours last night, and short sleep makes every other change harder."})
    if any("smok" in h for h in habits):
        out.append({"behavior": "smoking", "reason": "You told us you smoke. Cutting down step by step is safer and more lasting than stopping all at once for most people."})
    if any(k in conditions for k in ("diabetes", "type 2 diabetes", "hypertension", "obesity")):
        out.append({"behavior": "nutrition", "reason": "More vegetables and fruit in meals you already eat supports blood pressure and weight."})
    if not out:
        out.append({"behavior": move, "reason": "Moving a little more each day is the most useful place to start for most people."})
    seen, final = set(), []
    for o in out:
        if o["behavior"] in active or o["behavior"] in seen:
            continue
        seen.add(o["behavior"])
        final.append(o)
    return final[:3]
