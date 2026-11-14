# Demo screenshots (S1 to S6): how to produce each one for real

Everything below runs on the real app and the real backend. Nothing is mocked on screen. Do the one-time setup, then follow each step.

## One-time setup

1. **Backend in development mode** (`ENVIRONMENT=development` in `back/.env`, the default). This enables the demo tools and the demo accounts.
2. **Meal photo recognition (S2)** needs a free Gemini key. Without it the app cannot recognise a photo and tells you to pick the dish from the list.
   Get a key at https://aistudio.google.com/apikey and add `GEMINI_API=<your key>` to `back/.env`, then restart the backend.
3. **Faster emergency demo (S6)**: add `EMERGENCY_ACK_WAIT_SECONDS=20` and `EMERGENCY_GRACE_SECONDS=10` to `back/.env` so the caregiver step and the escalation to 112 happen within a minute. `EMERGENCY_DISPATCH_MODE` stays `simulate`: HEWAL3 records the 112 call and the location but never dials a real number.
4. **Three demo patients for the clinician screen (S4)**: from `back`, run `python scripts/seed_demo_patients.py`. It adds "Ama Critical (demo)", "Kofi Stable (demo)" and "Esi Healthy (demo)" with fresh readings. Run it just before the screenshot. `--remove` deletes them.
5. Start the backend, `ngrok http --url=extraprofessional-brendan-palest.ngrok-free.dev 8000`, and the app (`npx expo start -c`).

Accounts (development only): patient `patient@gmail.com`, caregiver `caregiver@gmail.com`, doctor `DOC00001`. Password for all: `StrongPass1`.

## The six screens

| ID | What to capture | How |
|----|-----------------|-----|
| **S1** Sign in and sync | Home with the watch connected and live vitals | Sign in as the patient. The app signs in with email and password (a PIN login is **not built**; say so, or ask for it). Open **Me > ... > Connected devices**, connect Apple Health, tap **Sync now**. Return to **Home**: the hero card shows heart rate, steps, and "Apple Health synced". The Devices screen lists HUAWEI Health / oraimo health under "Data comes from". |
| **S2** Scan a meal | Camera on a plate, recognised dish, calories | Home > **Scan meal**. Take a photo of the plate. With `GEMINI_API` set, the likely dishes appear; tap one. The card shows calories, carbs, salt, and a meal score. |
| **S3** Get coaching | The tip that joins the meal with heart rate and blood pressure | On the same dish screen, the **coaching card** under the nutrition card. It quotes your latest readings ("Based on your heart rate 74 bpm, blood pressure 150/95") and changes with them: high pressure plus a salty dish gives a salt warning; a dangerous reading says to sit down first. To show both, take the shot once with normal readings and once after S5. |
| **S4** Clinician triage | Doctor website with Critical, Stable and Healthy | Open `https://extraprofessional-brendan-palest.ngrok-free.dev/doctor/` (or `http://<laptop>:8000/doctor/`), sign in as `DOC00001`. The tiles and filter tabs show Critical, Monitor, Stable, Healthy. |
| **S5** Spike detected | The alert after a simulated blood pressure spike | In the app: **Me > Demo tools > Simulate a blood pressure spike** (190/125). The app opens the emergency screen. The caregiver app's **Emergencies** screen and the doctor website's **Active emergencies** panel show it within seconds. |
| **S6** Emergency action | SOS screen: caregiver call, then 112 with GPS | Stay on the emergency screen. It counts down, alerts the caregiver (step ticks), and if nobody taps "I am responding" within the wait, it escalates: "Emergency number 112 contacted" with the shared location link. Allow location for HEWAL3 first so GPS is attached. In simulate mode the screen says so. |

## What is real and what is simulated

- Real: the heart rate, steps, blood pressure and oxygen read from Apple Health; the meal photo analysis (Gemini); the database; the doctor, caregiver and patient views; the escalation timing; the live location.
- Simulated on purpose: the actual phone call to 112 and the SMS/call to the caregiver (`EMERGENCY_DISPATCH_MODE=simulate`). The system records exactly what it would send. Switching to live needs a telephony provider, which is not configured.
- Demo only: the "Demo tools" screen and the three demo patients, available only when the backend runs in development mode.
