"""Activity maths: distance, per-kilometre pace, calories, plausibility checks, weight trends and sleep analysis.

Plausibility matters because leaderboards reward effort. A workout whose speed is beyond what a person can do on foot or
on a bicycle is stored for the owner but flagged, and flagged workouts never count on a leaderboard.
"""
import math
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

KINDS = ("run", "walk", "cycle")
MET = {"run": 9.8, "walk": 3.8, "cycle": 7.5}                      # metabolic equivalents (Compendium of Physical Activities)
MAX_SPEED_MS = {"run": 8.0, "walk": 3.6, "cycle": 18.0}            # about 28.8, 13 and 65 km/h
MAX_AVG_SPEED_MS = {"run": 6.5, "walk": 2.8, "cycle": 14.0}
MAX_STEPS_PER_MIN = {"run": 220, "walk": 170, "cycle": 30}
DEFAULT_KG = 70.0


def now() -> datetime:
    return datetime.now(timezone.utc)


def haversine_m(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def calories(kind: str, kg: Optional[float], duration_s: int) -> int:
    return round(MET[kind] * (kg or DEFAULT_KG) * duration_s / 3600.0)      # kcal = MET x kg x hours


def analyze_route(route: List[List[float]], kind: str) -> dict:
    """route = [[lat, lng, seconds], ...]. Returns distance, kilometre splits, fastest pace and a plausibility verdict."""
    dist, splits, fastest = 0.0, [], None
    next_km, km_start_t, km_start_d = 1, route[0][2], 0.0
    max_speed, window = 0.0, []
    for i in range(1, len(route)):
        a, b = (route[i - 1][0], route[i - 1][1]), (route[i][0], route[i][1])
        seg = haversine_m(a, b)
        dt = max(0.001, route[i][2] - route[i - 1][2])
        prev_d = dist
        dist += seg
        window.append((route[i][2], dist))
        window = [w for w in window if route[i][2] - w[0] <= 8]          # speed is judged over about 8 seconds, to ignore GPS jitter
        if len(window) >= 2 and window[-1][0] > window[0][0]:
            max_speed = max(max_speed, (window[-1][1] - window[0][1]) / (window[-1][0] - window[0][0]))
        while dist >= next_km * 1000.0:                                  # crossed a kilometre: interpolate the exact time
            frac = (next_km * 1000.0 - prev_d) / max(seg, 1e-6)
            t_cross = route[i - 1][2] + frac * dt
            pace = int(round(t_cross - km_start_t))
            splits.append({"km": next_km, "pace_s": pace, "partial": False})
            km_start_t, next_km = t_cross, next_km + 1
    remaining = dist - (next_km - 1) * 1000.0
    if remaining >= 200:                                                 # a final partial kilometre, expressed as pace per km
        t_total = route[-1][2] - km_start_t
        splits.append({"km": next_km, "pace_s": int(round(t_total / (remaining / 1000.0))), "partial": True, "distance_m": round(remaining)})
    full = [s["pace_s"] for s in splits if not s["partial"]]
    fastest = min(full) if full else None
    duration = max(1, route[-1][2] - route[0][2])
    avg_speed = dist / duration
    plausible = max_speed <= MAX_SPEED_MS[kind] and avg_speed <= MAX_AVG_SPEED_MS[kind]
    return {"distance_m": dist, "splits": splits, "fastest_pace_s_km": fastest, "plausible": plausible, "max_speed_ms": max_speed}


def plausible_without_route(kind: str, distance_m: float, duration_s: int, steps: Optional[int]) -> bool:
    if duration_s <= 0 or distance_m / duration_s > MAX_AVG_SPEED_MS[kind]:
        return False
    return not (steps and steps / (duration_s / 60.0) > MAX_STEPS_PER_MIN[kind])


def pace_s_km(distance_m: float, duration_s: int) -> Optional[int]:
    return int(round(duration_s / (distance_m / 1000.0))) if distance_m >= 100 else None


# ------------------------------------------------------------------ weight
def weight_stats(points: List[Tuple[datetime, float]], height_cm: Optional[float], target: Optional[float]) -> dict:
    if not points:
        return {"count": 0}
    points = sorted(points)
    first, latest = points[0][1], points[-1][1]
    days = max(1.0, (points[-1][0] - points[0][0]).total_seconds() / 86400.0)
    slope_per_week = None
    if len(points) >= 2:
        xs = [(p[0] - points[0][0]).total_seconds() / 86400.0 for p in points]
        ys = [p[1] for p in points]
        mx, my = statistics.mean(xs), statistics.mean(ys)
        den = sum((x - mx) ** 2 for x in xs)
        slope_per_week = round(7 * sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den, 2) if den > 0 else 0.0
    trend = None if slope_per_week is None else "steady" if abs(slope_per_week) < 0.1 else ("losing" if slope_per_week < 0 else "gaining")
    out = {"count": len(points), "first_kg": first, "latest_kg": latest, "change_kg": round(latest - first, 1), "days": round(days),
           "slope_kg_per_week": slope_per_week, "trend": trend}
    if height_cm and height_cm > 50:
        out["bmi"] = round(latest / ((height_cm / 100) ** 2), 1)
    if target:
        total = abs(first - target)
        done = abs(first - latest) if (first - target) * (first - latest) > 0 else 0.0
        out["target_kg"] = target
        out["to_go_kg"] = round(latest - target, 1)
        out["goal_progress"] = round(min(1.0, done / total), 2) if total > 0.05 else 1.0
    notes = []
    if slope_per_week is not None and slope_per_week < -1.0:
        notes.append("You are losing weight faster than the usual safe pace of 0.5 to 1 kg a week. Please speak to your clinician before going faster.")
    elif slope_per_week is not None and slope_per_week > 0.8:
        notes.append("Your weight is rising quickly. If your legs or ankles are swelling, tell your clinician, because that can be fluid and not fat.")
    elif trend == "losing":
        notes.append("A steady loss like this is a healthy pace. Keep going.")
    elif trend == "steady":
        notes.append("Your weight is steady. That is good if it is where you want to be.")
    out["notes"] = notes
    return out


def bucket_weight(points: List[Tuple[datetime, float]], mode: str) -> List[dict]:
    """Average per week (Monday start) or per calendar month."""
    groups: Dict[str, List[float]] = {}
    labels: Dict[str, str] = {}
    for at, kg in points:
        d = at.date()
        if mode == "month":
            key = f"{d.year}-{d.month:02d}"; labels[key] = d.strftime("%b %Y")
        else:
            monday = d - timedelta(days=d.weekday()); key = monday.isoformat(); labels[key] = monday.strftime("%d %b")
        groups.setdefault(key, []).append(kg)
    return [{"label": labels[k], "avg_kg": round(statistics.mean(v), 1), "n": len(v)} for k, v in sorted(groups.items())]


# ------------------------------------------------------------------ sleep
STAGES = ("awake", "light", "deep", "rem")


def sleep_summary(start: datetime, end: datetime, stages: Optional[List[dict]]) -> dict:
    total = int((end - start).total_seconds() // 60)
    mins = {s: 0 for s in STAGES}
    if stages:
        for seg in stages:
            a, b = seg["start"], seg["end"]
            mins[seg["stage"]] += max(0, int((b - a).total_seconds() // 60))
        asleep = mins["light"] + mins["deep"] + mins["rem"]
    else:
        asleep = total
    return {"total_min": total, "asleep_min": asleep, **{f"{s}_min": mins[s] for s in STAGES}}


def sleep_score(asleep_min: int, deep_min: int, rem_min: int, awake_min: int, has_stages: bool) -> Tuple[int, List[str]]:
    """0 to 100. Duration counts most; with stage data, deep, REM and time awake also count."""
    notes: List[str] = []
    hours = asleep_min / 60.0
    dur = 100 if 7 <= hours <= 9 else max(0, 100 - abs((7 if hours < 7 else 9) - hours) * 25)
    if not has_stages:
        return int(round(dur)), notes
    asleep = max(1, asleep_min)
    deep_pct, rem_pct = 100 * deep_min / asleep, 100 * rem_min / asleep
    awake_pct = 100 * awake_min / max(1, asleep_min + awake_min)
    deep = 100 if 13 <= deep_pct <= 23 else max(0, 100 - abs((13 if deep_pct < 13 else 23) - deep_pct) * 6)
    rem = 100 if 18 <= rem_pct <= 28 else max(0, 100 - abs((18 if rem_pct < 18 else 28) - rem_pct) * 5)
    awake = 100 if awake_pct <= 8 else max(0, 100 - (awake_pct - 8) * 6)
    return int(round(0.45 * dur + 0.2 * deep + 0.2 * rem + 0.15 * awake)), notes


def sleep_advice(avg_hours: Optional[float], deep_pct: Optional[float], awake_pct: Optional[float], bedtime_spread_min: Optional[float]) -> List[str]:
    out: List[str] = []
    if avg_hours is not None and avg_hours < 6.5:
        out.append("You are sleeping under 7 hours on average. Try going to bed 30 minutes earlier for a week. Most adults need 7 to 9 hours.")
    if avg_hours is not None and avg_hours > 9.5:
        out.append("You are sleeping a lot. If you still feel tired, mention it to your clinician.")
    if deep_pct is not None and deep_pct < 13:
        out.append("Deep sleep is on the low side. Regular exercise earlier in the day, a cool dark room and less alcohol and caffeine in the evening can help.")
    if awake_pct is not None and awake_pct > 10:
        out.append("You are awake a lot during the night. Avoid screens for 30 minutes before bed, and avoid large meals or lots of drinks late in the evening.")
    if bedtime_spread_min is not None and bedtime_spread_min > 60:
        out.append("Your bedtime changes a lot from night to night. A regular bedtime and wake time is one of the best things you can do for sleep.")
    if not out:
        out.append("Your sleep looks healthy. Keep your bedtime and wake time regular.")
    return out
