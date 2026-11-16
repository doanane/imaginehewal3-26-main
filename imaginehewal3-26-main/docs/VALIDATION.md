# Rule verification (simulation, not a clinical validation)

Produced by `back/scripts/validate_rules.py` (seeded, reproducible). It runs our real rule functions on simulated people with a stated noise model.
It shows how the rules behave under noisy readings and busy lives. It does **not** show accuracy on real patients: that needs a labelled clinical
dataset and ethics approval, which we do not have yet.

## 1. Blood pressure alert: one reading against our rule (two readings at least 5 minutes apart)

Simulated: 20,000 episodes, 10% truly in crisis (180/120 or more), 3 readings 10 minutes apart, device scatter 6/4 mmHg, 2% of readings wrong for no physical reason. Values are percentages with a 95% interval (Wilson).

| Rule | Sensitivity | Specificity | Precision (PPV) | False alarms | Missed crises |
|---|---|---|---|---|---|
| Alert on one reading | 92.8% (91.5 to 93.8) | 98.5% (98.3 to 98.7) | 87.7% (86.2 to 89.0) | 264 | 147 |
| Our rule: needs a repeat | 91.4% (90.1 to 92.6) | 99.9% (99.8 to 99.9) | 98.6% (98.0 to 99.1) | 26 | 174 |

Reading: requiring a repeat cut false alarms from 264 to 26 (90% fewer) at the cost of 27 more missed crises in 20,000 episodes. The emergency pipeline (watch detection, SOS) is separate and keeps its own faster path; this rule only governs the Home alert list.

## 2. Lapse detection (3 or more days without a check-in)

Simulated: 3,000 busy people per row who check in on most days but sometimes miss, and 3,000 people who stop for good after day 30.

| Chance a busy person misses a day | Busy people wrongly flagged in 30 days | Real lapses found | Days from last check-in to detection (median) |
|---|---|---|---|
| 10% | 2.4% (1.9 to 3.0) | 100.0% (99.9 to 100.0) | 4 |
| 20% | 16.2% (14.9 to 17.6) | 100.0% (99.9 to 100.0) | 4 |
| 30% | 43.7% (42.0 to 45.5) | 100.0% (99.9 to 100.0) | 4 |
| 40% | 72.4% (70.8 to 74.0) | 100.0% (99.9 to 100.0) | 4 |

Reading: a person who really stops is always found, once three full days have passed with no check-in (day 4 counting from the last check-in). Someone who misses 3 days in a row by chance is flagged, and that is acceptable because the response is one gentle message, not an alarm. The more often someone misses, the more often this happens, which is why the weekly cap and the 'stop if messages do not help' rule exist.

## 3. What is still unmeasured

- Accuracy against real clinical outcomes (needs a labelled dataset and ethics approval).
- Fairness of the alert rule across languages, ages and devices on real data. Fairness of habit outcomes by group is measured live on the Impact page, hidden for groups under 5 people.
- Whether a message actually brings a person back: measured live as 'followed by a check-in within 48 hours', by channel, on the Impact page.
