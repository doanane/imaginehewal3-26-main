# Where each assessment criterion is met, and how to check it

For reviewers. Each row names the evidence and how to see it. Limits are stated in the last column, not hidden.

| Criterion | Evidence | How to check | Honest limit |
|---|---|---|---|
| **Health impact and clinical relevance** | A visible care agent (sense, decide, act, hand off, measure; the doctor site "Care agent" page and the public `#/story`) and lapse detection and gentle return for five audiences (long-term condition, desk-based, under 40, 40 to 59, 60 and over); doctor site shows who is quiet and who needs review, habit progress only with consent; Gulf setting (week, Ramadan, prayer times, heat, emergency numbers) | Demo: "Continue as Reviewer" in the app and on the doctor site; Impact page on the doctor site | Outcome numbers need a pilot; sample data is marked by the "Demo mode" banner and reserved email domains |
| **Working solution and demonstration quality** | Phone app (patient and caregiver), doctor website, real-time updates over one channel, guest sandbox with no sign-up, seeded doctor cohort | `https://imaginehewal3-26-main.onrender.com/doctor/` and the guest button; `/ping` for health | Free-tier hosting can take about a minute to wake after idle |
| **Technical depth and architecture** | Deterministic engines for habits, status, alerts and statistics, with AI used only for wording; a care agent loop with a stored, explainable trace and a clinician review queue; one shared definition of patient status; Thompson-sampling choice of technique; realtime hub; emergency state machine; about 280 automated tests | `back/tests/`; `docs/ARCHITECTURE.md` | The hub and worker run in one process |
| **Responsible AI, safety and data governance** | `GET /system/card` (what is AI, what is not, safety gates, limits, switches now); consent enforced in the API; access log shown to the patient; one-tap export and erase; no secrets in code; de-identified AI input; emergency wording answered with fixed text before any model | `/system/card`; Privacy centre in the app; `docs/VALIDATION.md` | Hosting is in the US today; no UAE data-residency; no formal DoH review. See `docs/COMPLIANCE.md` for the full list |
| **Scalability and deployment readiness** | Stateless API; HL7 FHIR R4 export (`/doctor-portal/patients/{id}/fhir`); load test script; keep-alive; production switches (`ENVIRONMENT`, docs off, secrets required) | `back/scripts/load_test.py`; measured results below | Single instance; free tier; no multi-tenant separation |
| **Commercial viability and path to pilot** | `docs/PILOT_AND_COMMERCIAL.md`: partners, 12-week pilot, measures the product already computes, safety, compliance gaps, business model | Read it | No customers yet; prices intentionally not set |

## Rule behaviour under noise (simulation)
See `docs/VALIDATION.md`. Short version: requiring a repeat reading cuts false blood-pressure alerts by about 90% at a small cost in sensitivity; a person who truly stops is always found three missed days later, and a busy person is occasionally flagged, which triggers one gentle message, not an alarm. It is a simulation with a stated noise model, not a clinical validation.

## Measured load (run on 2026-11-16, standard-library script `back/scripts/load_test.py`)
| Where | Users | Result |
|---|---|---|
| One local process, SQLite | 20 concurrent for 15 s | 86 requests per second, 0 errors. Median / 95th percentile: `/ping` 52 / 88 ms, context 170 / 310 ms, plans 143 / 249 ms, dashboard 428 / 643 ms |
| Live service (free tier, remote database), gentle probe | 4 concurrent for 10 s | 32 requests, 0 errors. Median: `/ping` 0.6 s, context 1.0 s, plans 0.7 s, dashboard 2.5 s |

These are small tests. They show the service is stable at pilot-scale load, not that it handles thousands of users. The built-in rate limit (60 requests per minute per address) and the guest-session limit (20 per network per 10 minutes) are protections; a load test from one machine hits them unless they are raised.

## Interoperability check on the live service
Doctor sign-in, patient list and a FHIR Bundle (Patient, Condition, MedicationStatement and 120 Observations) were fetched from the deployed backend on 2026-11-16 using the demo doctor.
