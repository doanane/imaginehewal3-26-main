"""Learns what works for each person. Explainable, personal, no training data needed.

1. Technique choice: a Thompson-sampling bandit. For every behaviour-change technique we keep a Beta(1+wins, 1+losses)
   belief from THIS person's own history (done=1, partial=0.5, skipped=0). Each day we sample from each belief and use the
   best draw, so we mostly use what works for them and still explore new styles now and then.
2. Hard days: if one weekday is clearly weaker than the person's average (at least 3 samples, under 40% and 20 points
   below their overall rate), that day's step is made one level lighter. Nobody is blamed for it.
3. Insights: the same statistics are turned into plain sentences so the user can see what the system has learned.
Everything the system learns is shown back to the user and nothing leaves their account.
"""
import random
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.behavior import BehaviorAction, BehaviorPlan
from app.services import behavior_engine as eng

SCORE = {"done": 1.0, "partial": 0.5, "skipped": 0.0}
MIN_OBS_FOR_LEARNING = 4      # before this we simply rotate styles, which also gathers data
MIN_DAYS_FOR_INSIGHTS = 14
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _resolved(db: Session, plan: BehaviorPlan, limit: int = 120) -> List[BehaviorAction]:
    return (db.query(BehaviorAction).filter(BehaviorAction.plan_id == plan.id, BehaviorAction.status.in_(tuple(SCORE)))
            .order_by(BehaviorAction.action_date.desc()).limit(limit).all())


def technique_stats(rows: List[BehaviorAction]) -> Dict[str, Tuple[int, float]]:
    stats: Dict[str, List[float]] = defaultdict(lambda: [0, 0.0])
    for r in rows:
        if r.is_comeback or not r.technique:
            continue
        stats[r.technique][0] += 1
        stats[r.technique][1] += SCORE[r.status]
    return {k: (int(v[0]), v[1]) for k, v in stats.items()}


def pick_option_index(db: Session, plan: BehaviorPlan, rng: Optional[random.Random] = None) -> Tuple[Optional[int], str]:
    """Return (index into BASE_ACTIONS[behavior], explanation). (None, "") means use the default rotation."""
    rng = rng or random.Random()
    stats = technique_stats(_resolved(db, plan))
    if sum(n for n, _ in stats.values()) < MIN_OBS_FOR_LEARNING:
        return None, ""
    options = eng.BASE_ACTIONS[plan.behavior]
    draws = []
    for i, (_, _, technique) in enumerate(options):
        n, wins = stats.get(technique, (0, 0.0))
        draws.append((rng.betavariate(1 + wins, 1 + max(0.0, n - wins)), i))
    best = max(draws)[1]
    technique = options[best][2]
    n, wins = stats.get(technique, (0, 0.0))
    if n >= 3:
        return best, f"We chose this style because it worked on {round(wins, 1):g} of your last {n} days."
    return best, "We are trying a new style to learn what works for you."


def weekday_rates(rows: List[BehaviorAction]) -> Tuple[Dict[int, Tuple[int, float]], float, int]:
    per: Dict[int, List[float]] = defaultdict(lambda: [0, 0.0])
    for r in rows:
        per[r.action_date.weekday()][0] += 1
        per[r.action_date.weekday()][1] += SCORE[r.status]
    total_n = sum(v[0] for v in per.values())
    overall = sum(v[1] for v in per.values()) / total_n if total_n else 0.0
    return {d: (int(v[0]), v[1] / v[0]) for d, v in per.items()}, overall, total_n


def weak_weekday(db: Session, plan: BehaviorPlan, day: date) -> Tuple[bool, Optional[float]]:
    rates, overall, total = weekday_rates(_resolved(db, plan, 60))
    if total < MIN_DAYS_FOR_INSIGHTS or day.weekday() not in rates:
        return False, None
    n, rate = rates[day.weekday()]
    return (n >= 3 and rate < 0.4 and overall - rate >= 0.2), rate


def insights(db: Session, user_id: int) -> dict:
    out: List[dict] = []
    for plan in db.query(BehaviorPlan).filter_by(user_id=user_id, active=True).all():
        rows = _resolved(db, plan)
        rates, overall, total = weekday_rates(rows)
        learned: List[str] = []
        by_day = [{"day": DAYS[d][:3], "n": rates[d][0], "rate": round(rates[d][1], 2)} if d in rates else {"day": DAYS[d][:3], "n": 0, "rate": None}
                  for d in range(7)]
        if total >= MIN_DAYS_FOR_INSIGHTS:
            ranked = sorted(((r, d) for d, (n, r) in rates.items() if n >= 3), reverse=True)
            if len(ranked) >= 2:
                best, worst = ranked[0], ranked[-1]
                if best[0] - worst[0] >= 0.2:
                    learned.append(f"You do best on {DAYS[best[1]]}s ({round(best[0] * 100)}% of the step done).")
                    learned.append(f"{DAYS[worst[1]]} is your hardest day ({round(worst[0] * 100)}%). We make the step lighter then, so it is easier to keep going.")
        tech = sorted(((wins / n, t, n) for t, (n, wins) in technique_stats(rows).items() if n >= 3), reverse=True)
        by_tech = [{"technique": t, "n": n, "rate": round(r, 2)} for r, t, n in tech]
        if len(tech) >= 2 and tech[0][0] - tech[-1][0] >= 0.2:
            learned.append(f"'{tech[0][1]}' works best for you ({round(tech[0][0] * 100)}%), so we use it more often.")
        barriers = Counter(r.barrier for r in rows if r.barrier).most_common(3)
        if barriers:
            from app.constants_labels import BARRIER_LABELS
            learned.append("What gets in the way most: " + ", ".join(f"{BARRIER_LABELS.get(b, b).lower()} ({c}x)" for b, c in barriers) + ". We plan around it.")
        out.append({"plan_id": plan.id, "behavior": plan.behavior, "days_of_data": total,
                    "learning": total >= MIN_OBS_FOR_LEARNING, "learned": learned, "by_weekday": by_day,
                    "by_technique": by_tech, "overall_rate": round(overall, 2) if total else None})
    return {"plans": out, "min_days_for_insights": MIN_DAYS_FOR_INSIGHTS,
            "how": "We keep simple counts of what you did on which day and with which style. The system favours the styles that worked "
                   "for you and still tries new ones. It never uses other people's data to judge you, and you can delete it any time."}
