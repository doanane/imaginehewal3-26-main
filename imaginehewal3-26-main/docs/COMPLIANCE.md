# Privacy, security and health-data rules: where HEWAL3 stands

HEWAL3 is a working prototype. It is built with privacy and security controls that follow the technical parts of HIPAA, but it is **not HIPAA compliant, certified or approved by any authority**. (HIPAA has no certification. Compliance is also about contracts, policies, training and audits, which a prototype does not have yet.) This page says plainly what is in place and what is still missing.

## What is built (checked in code and tests)

| Safeguard | What HEWAL3 does |
|---|---|
| Unique user identification | Every patient, caregiver and doctor has their own account. No shared logins. |
| Access control and minimum necessary | A doctor sees only the patients who linked them. A caregiver sees only what the patient allowed. Habit data reaches a doctor only with the patient's consent. A workplace sees counts only, and never a count under 5. |
| Audit controls | The patient can read an access log of who opened their data. It now includes every doctor who opened their record (one entry per doctor every 10 minutes), as well as caregivers. |
| Automatic logoff | The doctor website signs out after 30 minutes with no activity. Sessions can be revoked. |
| Authentication | Passwords are stored hashed. Login lockout after 5 failures per address in 15 minutes. Login codes and reset tokens are stored hashed and expire. Rate limits on sensitive actions. |
| Transmission security | The live service is served over HTTPS. Security headers and a strict content security policy are set. |
| Integrity | Signed consultations are locked (changes are added as addenda). Documents carry a reference number and can be checked and withdrawn. |
| Patient rights | One-tap export of all data, and erase of the account and its records. A privacy centre shows who can see what, and lets the patient stop sharing. |
| Data minimisation and AI | AI is used only for wording and chat. Inputs are de-identified (age and conditions only). Emergency wording is answered with fixed text before any model runs. The product works with AI off. |
| Secrets | No secrets in code. Production refuses to start without a secret key. API documentation is off in production unless a switch is turned on. |
| Sharing between clinics | The patient hands over a short code that works for a limited time, every use is logged and shown to the patient, and the patient can cancel it. |

## What is not in place yet

These are real gaps. Do not describe HEWAL3 as compliant until they are closed.

- **No business associate agreements.** The service runs on Render, Neon, Cloudinary, SendGrid and Google. Under HIPAA a covered entity needs a signed agreement with each provider that handles patient data. Free tiers do not offer them.
- **Hosting is in the United States.** The UAE requires health data about UAE residents to be stored in the UAE, with limited exceptions. A UAE region is the next step.
- **No formal risk analysis, written policies, workforce training or breach-notification procedure.** These are required and are organisational, not code.
- **No two-factor sign-in for doctors.** Patient sign-in tokens last 30 days (silent renewal). Shorten them before a real launch.
- **No independent penetration test or security audit.**
- **Backups and disaster recovery are not tested.** Encryption at rest is provided by the database host, not by the application.
- **Not reviewed by any health authority.** That includes the Department of Health Abu Dhabi (ADHICS standard and Malaffi policy), UAE data protection and health-data law, and the Ghana Data Protection Act 2012.
- **HEWAL3 supports care and does not diagnose.** It is not a medical device.

## Before a real pilot

1. Move to hosting that offers signed agreements, in the UAE for a UAE pilot.
2. Complete a written risk analysis and security policies, and train staff.
3. Add two-factor sign-in for doctors and shorten patient session lifetimes.
4. Commission a penetration test and fix what it finds.
5. Agree the data-protection terms and the review route with the health authority and the pilot partner.
