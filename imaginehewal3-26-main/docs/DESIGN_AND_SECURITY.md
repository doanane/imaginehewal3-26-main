# HEWAL3 design system, structure and security

## Design principles
- **Calm and clinical.** Clinical teal as the single brand color. Red is reserved for danger and emergencies only.
- **Accessible.** Every text and button color pair meets WCAG AA (4.5:1), checked numerically. Minimum touch target 44 px. Labels on all icon buttons.
- **Consistent.** One UI kit (`front-sdk58/components/ui`) and one set of tokens (`constants/theme.ts`). Spacing 4/8/16/24/32, radii 12 and 16, one type scale. No emojis, no decorative gradients.
- **Keyboard-safe.** Chat and forms use one `Screen keyboard` wrapper and a `Composer` that sits above the keyboard and grows as you type.

| Token | Value | Use |
|---|---|---|
| primary | #0B6E6E | Actions, links, active tab |
| success / warning / danger / info | #17724A / #8A5A00 / #B42318 / #1D4ED8 | Status only |
| background / card | #F4F7FA / #FFFFFF | Surfaces |
| text | #10202F / #435468 / #5A6B7E | Primary / secondary / tertiary |

## Information architecture (patient app)
Bottom tabs: **Today** (the day's one adaptive action, live vitals, care messages, emergency) / **Health** (live heart rate, progress, trends, logging) / **Care** (care-team conversations, real time) / **Assistant** (health assistant) / **Profile** (details, privacy, devices, sign out).
Stack screens: message thread, devices, caregivers, emergency contacts, goals and privacy, nutrition, fitness.

## Realtime
One authenticated WebSocket (`/ws`): first frame is `{type:"auth", token}`, never in the URL. Events: `message.new`, `typing`, `presence`, `vitals.update`, `notification.new`, `alert`. Single instance (in-process hub); use Redis pub/sub to scale out.

## OWASP Top 10 (2021) status
| # | Risk | Done | Still open |
|---|---|---|---|
| A01 | Broken access control | `/iot/devices/{id}` and other IoT routes now need login and ownership; webhook needs a shared secret and a registered device (no hardcoded user); debug and test routes removed; messaging and WebSocket now require an authenticated user (the old sockets trusted the user id in the URL); typing and presence only between approved contacts | Audit remaining caregiver, doctor and admin routes for ownership checks one by one |
| A02 | Cryptographic failures | The public default JWT secret was replaced with a random one; the app refuses to start outside development with a missing or default secret; bcrypt used directly | Serve only over HTTPS in production; rotate every secret that was pasted into chat |
| A03 | Injection | `eval()` on an environment variable removed; all queries go through the ORM | Review the few remaining raw SQL uses in scripts |
| A04 | Insecure design | Consent and delete controls; emergency triage before the AI model; per-user rate limit on the assistant | Threat model for caregiver sharing |
| A05 | Security misconfiguration | API docs hidden outside development; unused OAuth and test routers deleted; raw exception text no longer returned to users in 7 places | Review CORS origins and headers for the production host |
| A06 | Vulnerable components | None | Old pinned Python packages and 50+ npm advisories: run `pip-audit` and `npm audit`, then upgrade |
| A07 | Authentication failures | Login lockout (5 per account and IP, 20 per account, 15 minutes), generic login errors | MFA, refresh-token rotation review |
| A08 | Integrity failures | None | Pin CI actions; verify the dependency lockfiles in CI |
| A09 | Logging and monitoring | Failed logins logged without secrets | Central audit log and alerting |
| A10 | SSRF | No server-side fetch of user-supplied URLs found | Re-check when adding image-by-URL features |

Tests: `back/tests/test_security.py`, `test_assistant.py`, `test_behavior.py` (24 tests, offline).

## Responsible AI
The assistant never diagnoses or changes medication, checks messages for emergencies first and shows the emergency number, stores history on the server so the user can delete it, and shares only "emergency guidance was shown" with approved caregivers, never the message text. The AI key is server-side only. If the model is unavailable it answers in a clearly labelled basic mode.
