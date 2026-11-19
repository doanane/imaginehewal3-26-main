<div align="center">

# HEWAL3

### Keeping people on track with their health, and bringing them back gently when they drift.

**A health platform prototype for patients, caregivers, and clinicians.** The product is in the prototype phase; UAE hosting and deployment are pending.

[![Watch the HEWAL3 demo](https://img.youtube.com/vi/C5Uk6uILL7I/hqdefault.jpg)](https://www.youtube.com/watch?v=C5Uk6uILL7I)

[Watch the demo on YouTube](https://www.youtube.com/watch?v=C5Uk6uILL7I)

![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square)
![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020?style=flat-square)
![React](https://img.shields.io/badge/React-18%20%2B%20Vite-61dafb?style=flat-square)

</div>

> **Status: prototype.** HEWAL3 includes a phone app for patients and caregivers, a doctor website, and a shared API. UAE hosting and deployment are still pending. The current demo and hosted services should not be treated as a UAE production or clinically validated service.

## Demo

Click the thumbnail above to watch the latest demo video.

## What the prototype includes

- Habit plans and personalised goals for activity, movement breaks, sleep, water, medicines, meals, and weight.
- Lapse detection and recovery prompts, with configurable outreach preferences, quiet hours, weekly limits, and follow-up measurement.
- Patient and caregiver phone app, plus a clinician-facing website with patient records, consultations, messages, appointments, documents, and impact reporting.
- Apple Health data support for selected health metrics.
- UAE/Gulf-oriented settings, including an estimated Ramadan calendar, approximate prayer-time-aware messaging, seasonal heat guidance, UAE emergency numbers, Arabic RTL layout, and French text.
- Emergency-flow prototype, guest reviewer mode with labelled demo data, consent controls, access log, data export and erase.
- FHIR R4 export and a public responsible-AI system card.

These are prototype capabilities, not a claim of clinical validation or readiness for clinical use.

## Architecture

This diagram uses GitHub-supported Mermaid syntax and plain-text node labels for reliable rendering.

```mermaid
flowchart LR
    subgraph Phone[Patient and caregiver phone app]
        App[Expo mobile app]
        Local[Offline queue]
        App --> Local
    end

    subgraph Services[HEWAL3 services]
        API[FastAPI backend]
        Rules[Habit and safety rules]
        Doctor[Doctor website]
        FHIR[FHIR export]
    end

    Data[(PostgreSQL or local SQLite)]
    Language[Language model for wording and chat]
    Health[Apple Health]

    App <--> API
    Doctor <--> API
    API --> Rules
    API --> Data
    Rules -. wording only .-> Language
    Health --> App
    API --> FHIR
```

AI is used for wording and chat; product decisions and safety rules are implemented as ordinary application logic. Health data integration and emergency features require platform permissions and configuration.

## Who it is for

The prototype has five audience segments: people with long-term conditions, desk-based workers, adults under 40, adults 40–59, and adults aged 60 and over. Segments affect default goals and wording, not safety rules.

## Gulf setting

The prototype includes Ghana and UAE region settings. UAE week conventions, estimated Ramadan dates, approximate Abu Dhabi prayer times, seasonal heat advice, and UAE emergency numbers are included. Calendar and prayer-time values are estimates and should be checked locally.

## Responsible AI, safety, and validation

- AI is limited to wording and chat; the system card describes intended use and limitations.
- AI inputs are de-identified, and consent controls govern access to patient information.
- Emergency handling defaults to simulation; it is not a substitute for emergency services.
- `docs/VALIDATION.md` reports rule verification by simulation. This is not clinical validation.
- UAE deployment, local review, and clinical validation remain outstanding.

## Technology

- **Mobile app:** Expo / React Native (`front-sdk58/`)
- **Doctor website:** React, Vite, TypeScript (`doctor-web/`)
- **API:** FastAPI (`back/`)
- **Data:** PostgreSQL in hosted configurations; SQLite for local development
- **Language model:** optional, used for wording and chat only

## Run locally

### Backend

```bash
cd back
python -m venv .venv
# Activate the virtual environment, then:
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0
```

### Phone app

```bash
cd front-sdk58
npm install
npx expo start
```

For a physical iPhone, configure the API base URL and the required iOS development permissions. Apple Health access requires a compatible iOS build and user authorization.

### Doctor website

```bash
cd doctor-web
npm install
npm run dev
```

See the project setup guides for environment variables and platform-specific requirements.

## Tests and verification

```bash
cd back
python -m pytest tests -q
python scripts/validate_rules.py
python scripts/load_test.py http://localhost:8000 --users 20 --seconds 15
```

```bash
cd front-sdk58
npm test
npx tsc --noEmit
```

The simulation and load-test results are engineering checks, not clinical evidence.

## Repository map

- `back/` — FastAPI backend, services, scripts, and tests
- `front-sdk58/` — patient and caregiver phone app
- `doctor-web/` — clinician website
- `iot/` — watch and Bluetooth wearable bridge
- `docs/` — architecture, validation, pilot, security, and setup documentation

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Rule validation](docs/VALIDATION.md)
- [Challenge build notes](docs/BUILT_DURING_THE_CHALLENGE.md)
- [Assessment map](docs/ASSESSMENT_MAP.md)
- [Pilot and commercial plan](docs/PILOT_AND_COMMERCIAL.md)
- [Doctor portal specification](docs/DOCTOR_PORTAL_SPEC.md)
- [Design and security](docs/DESIGN_AND_SECURITY.md)
- [Mobile development setup](docs/MOBILE_DEV_SETUP.md)

## Roadmap and limitations

- UAE hosting and deployment are pending.
- Clinical validation and local clinical/regulatory review are pending.
- FHIR export is available; importing records from clinic systems is future work.
- Ramadan and prayer-time data are estimates.
- The current service is a prototype and must not be represented as a UAE production deployment.
