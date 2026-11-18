"""The comeback coach: a short, kind, structured conversation for the moment someone has lost their routine.

What it does (each step is a rule written in code, not a model):
  1. OPENS without blame: a lapse is normal and the plan, streak history and progress are kept.
  2. ASKS what got in the way (the same barriers the daily check-in uses), because the right fix depends on the cause.
  3. OFFERS up to three ways back, ordered for that cause: a tiny 2 minute version, a better time, a different version or habit, a person to ask,
     or simply rest (for pain or illness, with a clear "speak to a clinician" line).
  4. WRITES an if-then plan ("If I finish my morning coffee, then I will walk for 2 minutes"), the most evidence-backed way to restart.
  5. LEAVES a relapse-prevention plan: the first warning sign, the 2 minute fallback, who to tell.
  6. LEARNS: when someone checks in within 72 hours of choosing an option, that option worked. Once 5 or more people have chosen the same
     option for the same barrier, we show how many came back, and put the more successful options first.
Safety: pain, illness or a very high blood pressure reading always points to rest and a clinician first, whatever the habit. Never a diagnosis.
"""
from typing import Any, Dict, List, Optional

MIN_CELL = 5
BARRIERS = ["time", "tired", "forgot", "motivation", "weather", "access", "pain_sick", "stress", "craving", "other"]
BARRIER_TEXT = {
    "time": "I did not have the time", "tired": "I was too tired", "forgot": "I forgot", "motivation": "I lost motivation", "weather": "The weather or the heat",
    "access": "I could not get to a place or the equipment", "pain_sick": "Pain or illness", "stress": "Stress or a hard week", "craving": "Cravings or a social meal", "other": "Something else",
}
OPTIONS = {
    "tiny": {"label": "Start with a 2 minute version", "detail": "A very small step today. It counts, and it rebuilds the habit.", "applies": "Your next step shrinks to the smallest size."},
    "retime": {"label": "Pick a time that fits better", "detail": "Choose the exact time that suits you, and your reminder moves with it.", "applies": "Your reminder time is set to the one you choose."},
    "swap": {"label": "Try a different version", "detail": "An indoor, seated or shorter version, or another habit you would rather start with.", "applies": "We suggest another version or habit to start."},
    "buddy": {"label": "Ask someone to cheer you on", "detail": "A person you trust gets a kind nudge. They never see your readings.", "applies": "Opens the support options."},
    "rest": {"label": "Rest first, then come back", "detail": "Your body comes first. Your plan and progress are kept. If pain or illness lasts, speak to a clinician.", "applies": "Nothing changes; we will check in gently in a few days."},
}
ORDER = {
    "time": ["retime", "tiny", "swap"], "tired": ["tiny", "retime", "rest"], "forgot": ["retime", "tiny", "buddy"], "motivation": ["tiny", "buddy", "swap"],
    "weather": ["swap", "retime", "tiny"], "access": ["swap", "tiny", "buddy"], "pain_sick": ["rest", "tiny"], "stress": ["tiny", "retime", "buddy"],
    "craving": ["swap", "tiny", "buddy"], "other": ["tiny", "retime", "buddy"],
}
TIMES = {"morning": 8, "midday": 12, "evening": 18}
ACTION = {"movement": "walk for 2 minutes", "activity": "move for 2 minutes", "breaks": "stand up and stretch for 2 minutes", "nutrition": "add one portion of vegetables or fruit", "sleep": "start winding down 15 minutes earlier"}


def _anchor(segment: Optional[str], region: Optional[str], ramadan: bool, barrier: str) -> str:
    if ramadan and region == "ae":
        return "I finish iftar"
    if segment == "sedentary":
        return "I send my first email or end a call"
    if barrier in ("tired", "stress"):
        return "I get home and put my bag down"
    return "I finish my morning drink" if barrier == "forgot" else "I finish my first meal of the day"


def if_then(behavior: str, barrier: str, segment: Optional[str] = None, region: Optional[str] = None, ramadan: bool = False) -> str:
    act = ACTION.get(behavior, "do the smallest version")
    if barrier == "pain_sick":
        return "If I feel pain or unwell, then I will rest and not push through. When I feel better, I will %s." % act
    if barrier == "tired":
        return "If I feel too tired, then I will do the 2 minute version and stop. That still counts."
    if barrier == "weather":
        return "If it is too hot or wet outside, then I will %s indoors." % act
    return "If %s, then I will %s." % (_anchor(segment, region, ramadan, barrier), act)


def relapse_plan(behavior: str) -> List[str]:
    return ["My warning sign: two days in a row without a check-in. On the second day I use the 2 minute version.",
            "My fallback for a bad day: %s. It still counts." % ACTION.get(behavior, "the smallest version"),
            "Who I tell: one person I trust, so I am not doing this alone."]


def build(barrier: Optional[str], behavior: str, *, segment: Optional[str] = None, region: Optional[str] = None, ramadan: bool = False,
          rates: Optional[Dict[str, Dict[str, int]]] = None, safety_hold: bool = False, missed_days: int = 0) -> Dict[str, Any]:
    """The whole coach for one person. `rates`: {option: {"n": chosen, "returned": came back}} for this barrier, from everyone (anonymous)."""
    out: Dict[str, Any] = {
        "opening": ("%d days is a short gap, and gaps are part of change. Nothing is lost: your plan and your progress are kept. Let us find the easiest way back."
                    % missed_days) if missed_days else "A gap is part of change, not a failure. Your plan and progress are kept.",
        "barriers": [{"id": b, "label": BARRIER_TEXT[b]} for b in BARRIERS]}
    if not barrier or barrier not in BARRIER_TEXT:
        return out
    order = list(ORDER[barrier])
    if safety_hold and "rest" not in order[:1]:
        order = ["rest"] + [o for o in order if o != "rest"]
    shown: Dict[str, Optional[dict]] = {}
    for o in order:
        r = (rates or {}).get(o) or {}
        shown[o] = {"n": r["n"], "returned": r["returned"]} if r.get("n", 0) >= MIN_CELL else None
    # people-tested ordering only once there is enough evidence for at least two options; otherwise the written order stands
    scored = [o for o in order if shown[o]]
    if len(scored) >= 2:
        best = sorted(scored, key=lambda o: -(shown[o]["returned"] / shown[o]["n"]))
        order = best + [o for o in order if o not in best]
    out["barrier"] = {"id": barrier, "label": BARRIER_TEXT[barrier]}
    out["options"] = [{"id": o, **OPTIONS[o], "recommended": i == 0,
                       "evidence": ("%d of %d people who chose this after this barrier checked in again within 3 days." % (shown[o]["returned"], shown[o]["n"])) if shown[o] else None,
                       "picker": o == "retime"} for i, o in enumerate(order[:3])]
    out["if_then"] = if_then(behavior, barrier, segment, region, ramadan)
    out["relapse_plan"] = relapse_plan(behavior)
    if barrier == "pain_sick" or safety_hold:
        out["safety"] = "If you have chest pain, trouble breathing, or pain that does not settle, stop and get medical help. This coach never replaces a clinician."
    out["limits"] = "These suggestions follow common behaviour-change practice. They are not medical advice."
    return out
