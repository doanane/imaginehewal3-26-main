"""Measures how our two safety rules behave, with sensitivity, specificity and confidence intervals, and writes docs/VALIDATION.md.

WHAT THIS IS: a rule verification on SIMULATED people with a stated noise model. It runs the real functions (`alert_rules.confirmed`,
`alert_rules.bp_critical`, `behavior_engine.consecutive_missed_days`) so it shows how the rules behave when readings are noisy and when people are
busy. WHAT IT IS NOT: a clinical validation. Accuracy on real patients needs a labelled clinical dataset and ethics approval; until then we state that.

Run from back/:  py scripts/validate_rules.py      (seeded, so the numbers are the same every time)
"""
import math
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///./validate_tmp.db")

from app.services import alert_rules as ar            # noqa: E402
from app.services import behavior_engine as eng       # noqa: E402

SEED = 20260
N_BP = 20000
CRISIS_PREVALENCE = 0.10
SBP_NOISE, DBP_NOISE = 6.0, 4.0          # mmHg, typical cuff or wrist-device scatter (an assumption we state, not a measurement)
GLITCH = 0.02                            # share of readings that are wrong for no physical reason (movement, loose cuff)
GAP_MIN = 10                             # minutes between readings in an episode
READINGS = 3


def wilson(k: int, n: int, z: float = 1.96):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (c - h, c + h)


def pct(k, n):
    lo, hi = wilson(k, n)
    return f"{100 * k / n:.1f}% ({100 * lo:.1f} to {100 * hi:.1f})" if n else "n/a"


def episode(rng: random.Random, crisis: bool):
    """READINGS readings, newest first, for one person whose true state is crisis or not."""
    if crisis:
        s_true = max(180.0, rng.gauss(192, 10))
        d_true = rng.gauss(118, 10)
    else:
        s_true = min(179.0, rng.gauss(132, 16))
        d_true = min(119.0, rng.gauss(82, 9))
    now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
    out = []
    for i in range(READINGS):
        if rng.random() < GLITCH:
            s, d = rng.uniform(80, 250), rng.uniform(50, 140)
        else:
            s, d = rng.gauss(s_true, SBP_NOISE), rng.gauss(d_true, DBP_NOISE)
        out.append(SimpleNamespace(blood_pressure_systolic=round(s), blood_pressure_diastolic=round(d), timestamp=now - timedelta(minutes=GAP_MIN * i)))
    return out


def bp_study():
    rng = random.Random(SEED)
    res = {"single": [0, 0, 0, 0], "confirmed": [0, 0, 0, 0]}          # TP FP TN FN
    for _ in range(N_BP):
        truth = rng.random() < CRISIS_PREVALENCE
        rs = episode(rng, truth)
        flags = {"single": bool(ar.bp_critical(rs[0])), "confirmed": ar.confirmed(rs, ar.bp_critical) is not None}
        for k, f in flags.items():
            i = (0 if f else 3) if truth else (1 if f else 2)
            res[k][i] += 1
    return res


def lapse_study():
    """60 days. Busy people check in on each day with probability 1-p. Lapsed people stop for good after day 30. Rule: 3 missed days in a row."""
    rng = random.Random(SEED + 1)
    start, rows = date(2026, 1, 1), []
    for p_miss in (0.1, 0.2, 0.3, 0.4):
        busy_flagged, lapsed_found, delays, n = 0, 0, [], 3000
        for _ in range(n):
            status = {start + timedelta(days=d): ("done" if rng.random() >= p_miss else None) for d in range(30)}
            flagged = False
            for d in range(4, 31):
                if eng.consecutive_missed_days({k: v for k, v in status.items() if v}, start + timedelta(days=d), start) >= eng.LAPSE_DAYS:
                    flagged = True
                    break
            busy_flagged += flagged
        for _ in range(n):
            last = 29
            status = {start + timedelta(days=d): ("done" if rng.random() >= p_miss else None) for d in range(30)}
            status = {k: v for k, v in status.items() if v}
            if status:
                last = max((k - start).days for k in status)
            found = None
            for d in range(last + 1, 60):
                if eng.consecutive_missed_days(status, start + timedelta(days=d), start) >= eng.LAPSE_DAYS:
                    found = d - last
                    break
            if found is not None:
                lapsed_found += 1
                delays.append(found)
        delays.sort()
        rows.append((p_miss, busy_flagged, n, lapsed_found, n, delays[len(delays) // 2] if delays else None))
    return rows


def main():
    bp = bp_study()
    lines = ["# Rule verification (simulation, not a clinical validation)", "",
             "Produced by `back/scripts/validate_rules.py` (seeded, reproducible). It runs our real rule functions on simulated people with a stated noise model.",
             "It shows how the rules behave under noisy readings and busy lives. It does **not** show accuracy on real patients: that needs a labelled clinical",
             "dataset and ethics approval, which we do not have yet.", "",
             "## 1. Blood pressure alert: one reading against our rule (two readings at least 5 minutes apart)", "",
             f"Simulated: {N_BP:,} episodes, {int(CRISIS_PREVALENCE * 100)}% truly in crisis (180/120 or more), {READINGS} readings {GAP_MIN} minutes apart, "
             f"device scatter {SBP_NOISE:g}/{DBP_NOISE:g} mmHg, {int(GLITCH * 100)}% of readings wrong for no physical reason. Values are percentages with a 95% interval (Wilson).", "",
             "| Rule | Sensitivity | Specificity | Precision (PPV) | False alarms | Missed crises |", "|---|---|---|---|---|---|"]
    for name, label in (("single", "Alert on one reading"), ("confirmed", "Our rule: needs a repeat")):
        tp, fp, tn, fn = bp[name]
        lines.append(f"| {label} | {pct(tp, tp + fn)} | {pct(tn, tn + fp)} | {pct(tp, tp + fp)} | {fp:,} | {fn:,} |")
    s, c = bp["single"], bp["confirmed"]
    lines += ["", f"Reading: requiring a repeat cut false alarms from {s[1]:,} to {c[1]:,} ({100 * (1 - c[1] / max(1, s[1])):.0f}% fewer) at the cost of "
                 f"{c[3] - s[3]:,} more missed crises in {N_BP:,} episodes. The emergency pipeline (watch detection, SOS) is separate and keeps its own faster path; "
                 "this rule only governs the Home alert list.", "",
             "## 2. Lapse detection (3 or more days without a check-in)", "",
             "Simulated: 3,000 busy people per row who check in on most days but sometimes miss, and 3,000 people who stop for good after day 30.", "",
             "| Chance a busy person misses a day | Busy people wrongly flagged in 30 days | Real lapses found | Days from last check-in to detection (median) |", "|---|---|---|---|"]
    for p_miss, bf, n, lf, n2, med in lapse_study():
        lines.append(f"| {int(p_miss * 100)}% | {pct(bf, n)} | {pct(lf, n2)} | {med} |")
    lines += ["", "Reading: a person who really stops is always found, once three full days have passed with no check-in (day 4 counting from the last check-in). Someone who misses 3 days in a row by chance is flagged, and that is "
                  "acceptable because the response is one gentle message, not an alarm. The more often someone misses, the more often this happens, which is why the "
                  "weekly cap and the 'stop if messages do not help' rule exist.", "",
              "## 3. What is still unmeasured", "",
              "- Accuracy against real clinical outcomes (needs a labelled dataset and ethics approval).",
              "- Fairness of the alert rule across languages, ages and devices on real data. Fairness of habit outcomes by group is measured live on the Impact page, hidden for groups under 5 people.",
              "- Whether a message actually brings a person back: measured live as 'followed by a check-in within 48 hours', by channel, on the Impact page.", ""]
    out = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "VALIDATION.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
