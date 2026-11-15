# HEWAL3 Doctor Site: Specification

Status: implemented (backend tested, site built into `back/app/static/doctor/`, served at `/doctor/`). Written for the product owner and for engineers who will extend it.

## 1. Purpose

A clinic-style workspace for a doctor who looks after patients who use the HEWAL3 phone app. The reference was a conventional clinic dashboard (overview, appointments, patients, schedule, documents, messages, medication, consult screen). HEWAL3's difference is that the doctor sees what the patient's phone and watch actually recorded between visits, so the consultation starts from evidence, not from memory.

Principles:
- Real data only. No invented vitals, trends or percentages. Missing data is shown as "n/a" or "not enough data yet".
- The doctor decides. Prescribing reminders never block a prescription.
- A patient belongs to a doctor only after the patient chose that doctor. A doctor never sees another doctor's patients.
- Everything a doctor would sign or print is traceable (reference, time, author) and nothing signed is silently edited.

## 2. Why the old page showed 0%

Medication adherence was `doses logged as taken / doses scheduled`, counted over the whole window, including doses not yet due today and days before the medicine was added. A new medicine or a new patient therefore always produced 0% (many "expected" doses, none taken yet).

New rule (`back/app/services/adherence.py`, one definition for the doctor site, risk score and analytics):
- A dose counts only when it was DUE: the medicine already existed, and the scheduled time plus a 60 minute grace has passed.
- Percentage = taken / due.
- Fewer than 3 due doses gives `null`, shown as "Not enough data yet". It is never shown as 0%.
- Counts are shown beside the figure: taken, skipped, not logged.

## 3. Screens

| Screen | Route | What it does |
|---|---|---|
| Today | `#/` | Greeting, four counters (today, waiting requests, patients to review, unread/unsigned), open emergencies, today's appointments table with Consult, "Up next" timeline with Begin consultation, review queue |
| Schedule | `#/schedule` | Week grid, shaded outside working hours, click a free slot to book, click an appointment to confirm, decline, cancel or consult |
| Patients | `#/patients`, `#/patient/{id}` | Existing list and chart; chart gains Start consultation, a Visits tab (consultations and documents), null-safe medication gauge |
| Consultation | `#/consult/{id}` | Reason, clinic vitals, SOAP note, ICD-10 diagnoses, prescribing with checks, follow-up, sign. Side panel: their app vitals, medicine taking, findings, earlier visits |
| Messages | `#/messages` | All conversations, unread, online, chat with calls |
| Appointments | `#/appointments` | Requests and upcoming list (existing) |
| Documents | `#/documents`, `#/doc/{id}`, `#/rx/{patientId}` | Issued referrals, sick notes, letters; printable sheets; prescription sheet |
| Panel health | `#/panel` | Panel-level blood pressure control and medicine taking (the old overview) |
| Impact | `#/impact` | Behaviour-change measurement (existing) |
| Emergencies | `#/alerts` | SOS events (existing) |
| Verify | `#/verify/{ref}` | Public, no sign in |
| Profile | `#/profile` | Details, password, working hours |

Global: Ctrl or Cmd + K search (patients, conditions, pages), notification bell (emergencies, requests, unread), light and dark themes.

## 4. Consultation workflow

1. Open from the Today timeline, an appointment, or a patient chart. Starting is idempotent: one draft per appointment, and one open draft per patient without an appointment.
2. Fields autosave as a draft (900 ms debounce, with a Saved, Saving or Not saved indicator; leaving the page flushes).
3. Sign requires at least one diagnosis or an assessment. Signing locks the note, marks the appointment completed (even if its time is in the future), books the follow-up (30 minutes) if one was chosen, tells the patient, and, if "send plan" is on, creates a shared note for the patient.
4. After signing: read-only. Corrections go in as addenda, each with its time. Documents can be created from the visit.
5. A draft can be deleted; a signed note cannot.

Clinic vitals (taken in the room) are stored in the note and never mixed into the patient's own device readings.

## 5. Prescribing checks

Source: `back/app/data/clinical_reference.py` (about 35 common medicines with class, usual doses and times; about 65 common ICD-10-CM diagnoses). It is a quick-pick list, not a complete formulary: any diagnosis or medicine can be typed in free text.

`check_prescription` raises reminders (caution or avoid) for: same class already taken, ACE inhibitor with ARB, NSAID with hypertension, kidney disease, heart failure or anticoagulant, metformin with kidney disease, sulfonylurea with insulin, beta blocker with asthma, and similar. They are reminders from the patient's recorded conditions and active medicines. The doctor can still prescribe.

A prescription creates the patient's own medicine entry, so reminders and adherence work on their phone.

## 6. Documents and verification

Kinds: referral, sick note (certificate), letter. Each gets a reference `HW-YY-XXXXXX`. The printed sheet carries a letterhead, the date, the doctor's name and ID, a signature line and the check address.

Public check `GET /verify/document/{ref}`: rate limited, never shows the patient or contents, only the kind, issue date and doctor. A doctor can withdraw a document; the check then says it is no longer valid. A sick note hides the diagnosis unless the doctor opts in.

## 7. API (all under `/doctor-portal`, doctor token required unless noted)

- `GET /today?offset=`, `GET /schedule?start&days&offset`, `GET|PUT /me/availability`
- `GET /conversations`
- `GET /reference/diagnoses?q=`, `GET /reference/medicines?q=`, `POST /patients/{id}/prescriptions/check`
- `POST|GET /patients/{id}/consultations`, `GET|PATCH|DELETE /consultations/{id}`, `POST /consultations/{id}/sign`, `POST /consultations/{id}/addendum`
- `POST|GET /patients/{id}/documents`, `GET /documents`, `GET /documents/{id}`, `POST /documents/{id}/revoke`
- Public: `GET /verify/document/{ref}`

Tables: `consultations`, `clinic_documents`; new column `doctors.working_hours` (JSON). Added to existing databases by `_ensure_columns`.

## 8. Security and privacy

- Ownership check on every patient route (`_owned_patient`); a consultation or document of another doctor returns 404.
- Public verify exposes no personal data and is rate limited.
- The site is served under `Content-Security-Policy: default-src 'self'`: no inline scripts or styles.
- Signed notes are immutable; addenda are append-only.

## 9. Known limits

- Quick-pick ICD and medicine lists are not exhaustive; the checks cover common interactions only and are not a substitute for a drug database.
- Appointment times use the doctor's browser offset for "today" and the server clock otherwise.
- English only.
- Visual layout has been built and type-checked but not reviewed on every screen size or in every browser; check in the real site.
- Printing relies on the browser's print to PDF.

## 10. Possible next steps

Lab and imaging orders with results, structured allergies, ICD-11, e-signature stamp image, waiting-room status, billing, multi-clinic staff accounts, SMS reminders for follow-ups, French and Arabic.
