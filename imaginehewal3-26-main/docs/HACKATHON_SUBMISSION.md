# HEWAL3 · Sustaining Healthy Behaviors (Future Health Challenge, Wellbeing)

Submission draft. Prototype due 20 Nov 2026. Edit the bracketed items before submitting.

## 1. What it does
An adaptive behaviour-change loop on top of HEWAL3's tracking features:

plan (small steps) → daily action → check-in → adapt → measure sustained change

| Challenge requirement | Implementation |
|---|---|
| Adaptive personal plans | `behavior_engine.target_for`: each day asks a fraction of the gap between the user's baseline and goal (15% to 100% across 5 levels). Behaviours: movement, nutrition (Ghanaian foods), sleep, smoking reduction. |
| Lapse detection and re-engagement | `detect_lapse`: 3+ days without check-in = lapse, falling engagement = "declining". After a lapse the user gets a tiny "welcome back" step (10% of the gap), the level drops by one, and **nothing is reset**: lifetime active days and best streak persist; streak tolerates one missed day. |
| Barrier-aware adjustment | User taps a barrier (time, tired, weather, craving...). The next actions are rewritten for it (e.g. indoor version, split into short blocks). |
| Evidence-based, visible rationale | Every action shows its technique, why it works and its limits ("Why this?"). `GET /behavior/techniques` lists all. |
| Autonomy and inclusion | Per-user settings enforced server-side: reminders, quiet hours, wearable data opt-in (off by default), streaks/points off switch, language (en/ar/fr for coaching messages). One-tap erase of all data. No sharing with employers or insurers: there is no such endpoint. |
| Sustained outcomes | `GET /behavior/outcomes`: weeks persisted, lapses, average days to recover, change vs baseline, 7-day retention, weekly adherence. `GET /behavior/equity`: adherence by gender / age band / language, small groups (<5) suppressed. |

## 2. Runs without cloud services
The behaviour engine is rule-based Python with no network or LLM calls. Azure SDKs are optional imports: with no Azure keys the backend boots, food analysis uses the built-in mock/fallback analysis, and SQLite is used if `DATABASE_URL` is empty. For the demo: `POST /behavior/demo/seed` (or "Load demo data" in the app's behaviour settings) creates 6 weeks of history with a 6-day lapse and recovery.

## 3. Demo script (about 3 minutes)
1. Open the app, tap **My daily step**, choose "Move more". A small step for today appears; open "Why this?".
2. Tap **Not today**, then pick a barrier (e.g. "Weather"). Show the no-blame message.
3. Load demo data. Show the progress chart: steady weeks, a gap, a recovery. Point out the lapse count and "came back after N days".
4. Show settings: turn reminders off, switch language to Arabic, show the privacy statement and the delete button.

## 4. Assumptions
- Users self-report or opt in to wearable step data; accuracy depends on the device.
- Level thresholds (>=85% adherence over 7 days to step up, <35% to step down, 3 missed days = lapse) are reasoned defaults, **not clinically validated**.
- Targets are fractions of the user's own baseline-to-goal gap; the goal is user-chosen with defaults.

## 5. Limitations
- No clinical validation or pilot yet. Outcome metrics are computed on one user's data and on demo data; equity reporting needs a real cohort (>=5 per group).
- Re-engagement nudges are created when the app is opened. There is no background scheduler or push delivery yet.
- Action titles are English only; coaching messages are en/ar/fr (Arabic and French strings need native-speaker review). No Twi, Ga, Ewe or Hausa yet.
- Smoking support is a reduction plan only; it does not replace cessation services or medication.
- Food photo analysis in offline mode returns a generic mock result.
- Not a medical device; it gives no diagnosis or treatment advice and tells users to speak to a clinician for pain or sickness.

## 6. Responsible AI and data governance
- Explainable by design: every suggestion shows its technique, rationale and limits. No black-box model.
- Data minimisation: only plan, daily action outcome and optional barrier are stored.
- Consent is granular, revocable and enforced in the API (wearable sync returns 403 unless enabled).
- Anti-manipulation: no loss framing, streaks forgive single misses, the user can switch gamification and reminders off.
- Fairness: equity endpoint with k-anonymity (k=5).
- Hosting today: API on Render and PostgreSQL on Neon, both in the United States (US East). **This does not meet a requirement to keep data inside the UAE.** A UAE or Gulf cloud region is the first step of any Abu Dhabi pilot (see `PILOT_AND_COMMERCIAL.md`).
- Retention: data stays until the person deletes it (one-tap export and full erase are built). A fixed retention period will be set with the pilot partner and its ethics board.
- Access: only the database administrator and the API. Doctors see only patients assigned to them, caregivers only people who approved them, and every caregiver view is logged and shown to the patient. Secrets live in environment variables, not in code.
- Transparency: `GET /system/card` lists what is AI and what is deterministic, the safety gates, the limits and the switches that are on right now. Rule behaviour under noise is in `VALIDATION.md`.

## 7. Scalability and path to pilot
Target and plan: `PILOT_AND_COMMERCIAL.md`. Interoperability: HL7 FHIR R4 export per patient (`GET /doctor-portal/patients/{id}/fhir`, also a button on the doctor site). Load: `scripts/load_test.py`; a measured run is in `ASSESSMENT_MAP.md`. The Postgres schema and FastAPI service are stateless and deployable on any cloud; the in-process realtime hub and worker need Redis and a job queue before running more than one instance.

---

## The care agent: the story in four beats

**One sentence.** For people who sit all day and drift away from a healthy routine, our agent notices the gap in a few days, sends one message that fits their day and prayer times, and shrinks the next step so they come back, with a clinician looking only where it matters.

| Beat | In the product |
|---|---|
| 1. Problem | People go quiet after a week or two. Generic reminders are swiped away and nobody on the care team sees the drift. |
| 2. Person | Khalid, 47, an office worker in Abu Dhabi. He feels fine. His movement breaks stopped on Friday. (A simulated person, labelled "(demo)".) |
| 3. Solution | On the fourth quiet day the agent notices, picks a time that is not prayer time and is inside his working hours, sends one kind line, and shrinks the next step. |
| 4. Outcome | Measured by the product: share of lapsed people who check in again within 48 hours, days to return, retention at day 7, 30 and 90, and the same results by audience, gender, age band, language and region. |

**Watch it:** the doctor site page `#/story` needs no sign-in. It replays the same moment with and without the agent, then the safety case. Everything on it is produced by the same rules the live service runs, on simulated facts.

**Why an agent and not a chatbot.** A chatbot waits to be asked. This agent runs by itself and shows its loop: it *senses* (check-ins, readings, the person's clock, Ramadan and prayer times), *decides* (written rules), *acts* (one fitted message, a smaller step, one-tap answers), *hands off* (a clinician is asked only for a very high reading, or a long silence in someone with a condition) and *measures* (did a check-in follow within 48 hours). Every pass keeps a trace that the person can read in the app under Habits, Today, "Your care agent".

## Six questions, answered

| Question | Answer |
|---|---|
| Who exactly is this for? | People who start a routine and drift: desk-based workers, adults under 40, 40 to 59, 60 and over, and people with long-term conditions. One person, one moment: Khalid on his fourth quiet day. |
| Why an agent, not a chatbot? | It acts without being asked and shows what it senses, decides and does (`/agent/loop`, the Care agent page). |
| Does it run end to end? | Yes, live: phone app, doctor site and API; guest sandbox with a seeded lapse and a hand-off waiting in the doctor's queue. |
| What happens when it is wrong? | One tap stops messages or makes the step smaller; "not helpful" makes outreach quieter; a clinician can approve, change or dismiss any hand-off; the agent never changes a medicine or treatment; a very high reading holds the step and points to a clinician. |
| What would it take to deploy? | Data: the person's own check-ins and readings. Integration: HL7 FHIR R4 export today; clinic record import next. Who operates it: a clinician reviews the hand-off queue. Hosting in a UAE region for a UAE partner. |
| What happens after you submit? | A 12-week pilot with one partner, using the measures above (see `PILOT_AND_COMMERCIAL.md`). The partner and an ethics board approve it first. |

## Update: how each judging criterion is covered

| Criterion | What we built (all real, with tests) |
|---|---|
| Health impact and clinical relevance | Adaptive behaviour loop that learns what works per person; guideline-based risk screening with reasons; validated PHQ-2 and GAD-2 wellbeing check-in with stepped support; one-page clinician summary for coordinated care. |
| Technical depth and architecture | Thompson-sampling bandit over behaviour-change techniques and a hard-weekday detector (`learning_service.py`); authenticated realtime hub; emergency escalation state machine; generic schema-walking data export and erasure; offline-first queue. |
| Working solution and demo quality | Phone app and web from one codebase, real data throughout, simulation mode for emergencies, 55 backend tests, iOS and web builds verified. |
| Responsible AI, safety and data governance | Privacy centre: who can see what, one-tap revoke, audit log of every view, full data download, right to erase. Wellbeing answers never reach caregivers or the clinician summary unless the owner includes them. Crisis path is human-led and never automatic. Every risk and learning result explains itself. Emergency dispatch defaults to simulation. |
| Scalability and deployment readiness | Stateless API on PostgreSQL, free-tier stack today, cloud mapping in `ARCHITECTURE.md`, in-process hub and worker with a stated path to Redis and a job queue. |
| Commercial viability and path to pilot | Clinician summary and the caregiver risk list are the value to clinics and programmes. Pilot metrics already measured: 8-week persistence, recovery time after setbacks, equity by group with small groups hidden. |

### What the judges' brief asked for, and where it is
- **Continuous learning and re-engagement:** `GET /behavior/insights`, technique choice and lighter step on a person's hard day, shown to them in plain sentences ("What works for you").
- **User autonomy and no manipulative or punitive use by employers or insurers:** Privacy centre states it and enforces it: there is no endpoint that shares data with either.
- **Stepped, local support navigation and human-led escalation (wellbeing):** self-help, community, primary care, urgent, each with a stated reason; the safety question shows emergency guidance and offers, never forces, contact with a person.
- **Coordinated physical and mental care:** clinician summary combines vitals, medicines, meals, behaviour and, only if the patient opts in, wellbeing.

### Honest limits to state in the pitch
- The risk check and the learner are explainable statistics, not a trained deep model. There is no labelled dataset yet; the pilot produces it.
- PHQ-2 and GAD-2 are used in English wording. Validated translations are needed before clinical use in other languages.
- Local-language UI (Twi, Ewe, Hausa, Ga) is wired but not translated.
- Evidence of benefit (outcomes) needs a pilot; today's numbers come from demo and development use.

## Activity, leaderboard and community (added)
- **Activity hub** (`front-sdk58/app/(patient)/activity/`): activity rings (steps, calories, active minutes), live run/walk/ride tracker with GPS pace, route and voice reminders, workout details (trajectory and per-km pace chart), weight reports (weekly/monthly), sleep stages with advice, health knowledge.
- **Leaderboard**: opt-in, display names only, realtime via the `/ws` `leaderboard.update` event; ranks by steps, distance, active minutes or points; flagged (implausible) workouts never count.
- **Community** tab replaces Care in the tab bar: discussions, tips and a health-and-fitness marketplace with image attach, report and auto-hide. Care messaging remains reachable from the Community header, Home and Profile.
- Honest limits: daily phone steps come from the iPhone motion sensor only (Android needs a watch or Health app); GPS tracking is foreground-only; the route is drawn without map tiles; sleep stages need Apple Health or a watch (manual entries have duration only); watch call and message mirroring is not implemented.


## Care team: patient, caregiver and doctor (one data source)

- **Doctor website** (`/doctor/`, plain HTML/JS served by the API, so no build and no CORS): sign in with a Doctor ID, see only patients who linked that doctor, live status (critical / monitor / stable / no data), open emergencies with status and live location, 24 h heart-rate chart, steps, medicines taken, meals, emergency history, and send a message that reaches the patient's app at once. Refreshes every 5 s while the tab is visible.
- **Caregiver app**: home with live patient status, patient page (vitals, medicines, doctor, emergency actions), emergencies screen (I am responding / resolve / call / live location), live vitals board, messaging with the patient. Updates over the websocket.
- **One rule for status** (`back/app/services/care_snapshot.py`): the patient app, caregiver app and doctor website all classify a patient the same way, from the same readings. An open SOS always means critical.
- **Consent**: only the patient can link or unlink a doctor (Me > My doctor). Caregivers need the patient's approval. A doctor can watch emergencies but cannot clear them; the patient or an approved caregiver does.
- Tests: `back/tests/test_doctor_portal.py` runs patient vitals -> caregiver and doctor views -> emergency acknowledge -> resolve.
