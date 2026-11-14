# HEWAL3 Doctor Web

React + TypeScript website for doctors. It reads from the HEWAL3 backend, so everything a patient's phone or watch records shows here.

## Run it

Production (what patients' doctors use): the build is served by the backend at `/doctor/`.

    cd doctor-web
    npm install
    npm run build          # writes into ../back/app/static/doctor
    # then start the backend (back/run-lan.cmd) and open http://localhost:8000/doctor/

Development with live reload:

    npm run dev            # http://localhost:5173/doctor/ , API calls proxy to localhost:8000

Sign in with a doctor ID and password. In development the backend creates `DOC00001` / `StrongPass1` at start.

## What the backend provides

| Endpoint | Purpose |
|---|---|
| `POST /doctor-portal/login` | sign in, 12 hour token |
| `GET /doctor-portal/overview` | the doctor's patients, triage groups, open emergencies (polled every 5 s) |
| `GET /doctor-portal/cohort?days=` | panel statistics: BP control rate, adherence, silent patients, review order |
| `GET /doctor-portal/patients/{id}` | profile, latest values, meals, emergencies, messages |
| `GET /doctor-portal/patients/{id}/analytics?days=` | per-measure statistics, fitted trends with p-values, outliers, adherence |
| `GET /doctor-portal/patients/{id}/brief` | optional AI written summary |
| `POST /doctor-portal/patients/{id}/message` | message the patient |

The statistics live in `back/app/services/clinical_analytics.py` and are tested in `back/tests/test_clinical_analytics.py`.
Method: least squares on daily means, trend reported only when p < 0.05 and the change is clinically noticeable; outliers by
modified z-score (median and MAD); time in range against AHA/ACC and standard resting ranges. Nothing is estimated by a model.
