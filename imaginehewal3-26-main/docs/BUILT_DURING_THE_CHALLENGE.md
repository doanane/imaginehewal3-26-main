# What was built for the challenge, and what it stands on

Written for the Future Health Digital Innovation Challenge reviewers. It separates the platform we already had from the work made for this challenge, and shows how to check each statement in the repository.

## 1. The foundation (before the challenge)
HEWAL3 started as a health platform built for an earlier competition. That part is visible in the older history of this repository (December 2025 to January 2026): accounts and sign-in, the patient and caregiver mobile apps, vital-sign tracking, meal photo analysis, the emergency flow, and the first doctor and caregiver dashboards. We say so plainly. We did not set out to hide it: it is the platform the challenge work runs on.

## 2. Built for this challenge: sustaining healthy habits, and bringing people back
The brief asks for a habit planner with personalised goals, adaptive reminders, and a comeback coach that supports people through lapses, with progress tracking and privacy central. This is what we built for it.

| Brief | What we built | Where | How to check it |
|---|---|---|---|
| Habit planner with personalised **activity** goals | Goals that start from the person's own average steps and active minutes, move toward public guidance in stages, and change with age, long-term conditions, work pattern, season and Ramadan. Every goal states its reason, its source and what measures it. | `back/app/services/goal_planner.py`, `GET /behavior/goals` | App: Habits, Today, "Goals made for you". Tests: `back/tests/test_challenge_features.py` |
| Personalised **nutrition** goals | Sodium, fibre and water targets compared with what the person actually logged (from the Ghanaian food database), with today's running total; vegetable and fruit servings as a habit. Lower salt target with high blood pressure; no fluid advice for heart or kidney conditions. | same | same |
| Habit plans from those goals | One tap turns chosen goals into habit plans that the engine then grows in small steps. | `POST /behavior/goals/apply`, `behavior_engine.py` | App: "Turn these into my habit plans" |
| **Adaptive reminders** | The reminder time follows when the person actually checks in (30 minutes before), avoids quiet hours, prayer time and Ramadan fasting hours, and judges itself: after a week it moves to the exact usual time, then to every other day, then pauses instead of nagging. The person can fix the time or switch it off. Scheduled on the phone, generic text only. | `back/app/services/reminder_plan.py`, `GET /behavior/reminder-plan`, `front-sdk58/services/habitReminders.ts` | App: Habits, You, "Smart reminders" |
| Lapse detection and gentle return | After 3 quiet days: one fitted message on the channel the person allowed, a smaller next step, quieter channels if messages are ignored, then silence. A visible agent loop (sense, decide, act, hand off, measure) with a clinician review queue. | `reengagement.py`, `care_agent.py` | Public page `/doctor/#/story` |
| **Comeback coach** | A short, blame-free guided flow: what got in the way, up to three ways back ordered for that cause, an if-then plan, a relapse-prevention plan. Choices are remembered and later counted (anonymously, groups of 5 or more) to show which options bring people back. Pain or illness always points to rest and a clinician first. | `back/app/services/comeback.py`, `GET/POST /behavior/comeback` | App: Habits, Today (after 3 days away). Doctor site: Impact, "Which way back works" |
| **Progress tracking** | Retention at day 7, 30 and 90, persistence, recovery after a lapse and how fast, change from the person's own baseline, fairness across audiences. | `behavior_impact.py`, doctor site Impact page | Doctor site: Impact |
| **Privacy controls** | Consent switches, quiet hours, weekly message cap, a one-tap stop, an access log, data export and erase (which also erases the coach and agent records). A doctor sees habit detail only if the patient shares it. | `behavior.py`, `behavior_support.py`, `/system/card` | Public page `/system/card` |
| Our own ideas | Five audiences (not only chronic disease); an Abu Dhabi and Gulf setting (UAE week, estimated Ramadan and prayer times, heat season, emergency numbers, Arabic right to left); HL7 FHIR export; doctor and patient linking in both directions. | `audience.py`, `gulf.py`, `interop.py`, `doctor_link.py` | See the README |

Everything above is rule-based and unit tested. A language model is used only for wording and chat, never for a decision.

## 3. Dated record of the recent work
Taken from `git log` (author doanane), so anyone can verify it. Earlier work was uploaded as a project snapshot on 14 November 2026 (the first commit of the personal repository), which is why the step-by-step history of the oldest habit code is not in git.

| Date | Commit | Change |
|---|---|---|
| 2026-11-16 | `8342e41` | Audience segments, Gulf setting, FHIR export, doctor site updates and docs |
| 2026-11-16 | `d4525bf` | Add the phone app (front-sdk58) as normal files |
| 2026-11-16 | `9c719cf` | Care agent: a visible sense, decide, act, hand off and measure loop with a doctor review queue, a public story and an in-app explanation |
| 2026-11-16 | `83dc7ae` | Doctors can ask a patient to link; the patient accepts or declines in the app |
| 2026-11-16 | `9851450` | Every emailed code and link lasts 10 minutes, and asking for a new one no longer cancels the earlier email |
| 2026-11-16 | `7f6e974` | Show the person's real name to the doctor instead of the word Patient |
| 2026-11-16 | `6cf3a73` | Calls wait up to ten seconds for the live connection instead of failing at once |
| 2026-11-16 | `2b4313c` | Doctor site: connect the live channel straight to the backend when the site is hosted where websockets cannot pass (for example Vercel) |
| 2026-11-18 | (this round) | Personalised goals, adaptive reminders and the comeback coach (the three items in the brief) |

Check it yourself: `git log --no-merges --since=2026-11-14 --format='%ad %h %s' --date=short`.

## 4. What is simulated, and what is not
- The Khalid story and the "(demo)" patients, doctors and hand-offs are simulated and labelled. They are never counted as results.
- Impact numbers come from real use. With no pilot yet they are empty or demo-only, and the pages say so.
- Rule behaviour is verified by simulation (`docs/VALIDATION.md`), not clinically validated. Ramadan dates, prayer times and heat are estimates and labelled.
