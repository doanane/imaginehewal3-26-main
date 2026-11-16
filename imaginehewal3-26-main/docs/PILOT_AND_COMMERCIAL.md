# Path to pilot and commercial model

Written for the Future Health Digital Innovation Challenge reviewers. Everything below is a **proposal and an assumption** unless it says "built". We have no customers yet and no real-world outcome data, and we say so. Prices are deliberately left open: they depend on the pilot partner and on costs we have not yet measured.

## 1. The problem we address
Programmes lose most people soon after they start. When someone goes quiet, today's systems either say nothing or send the same reminder to everyone. HEWAL3 notices a lapse (3 or more days without a check-in), reaches the person in a way that fits their life, shrinks the next step, and measures whether that worked. It serves five audiences, not only chronic disease: people with long-term conditions, desk-based workers, adults under 40, adults 40 to 59, and adults 60 and over.

## 2. Who would use it first (proposed, to be confirmed with partners)
| Partner type | What they get | Why they would join a pilot |
|---|---|---|
| A primary-care clinic or outpatient programme | A doctor site showing who is quiet, who needs review, and habit progress for patients who consent; a standard FHIR export | Patients drop out between visits; clinicians have no view of that |
| An employer wellness programme (desk-based staff) | Anonymous group results only, groups under 5 hidden, never individual data | Sedentary work; needs evidence a programme keeps people engaged |
| A public-health or insurer-funded programme | Retention, recovery and equity measures by group | Needs proof that a programme works for everyone, not on average |

Individual behaviour data is never shown to employers or insurers. The product does not have a way to do it.

## 3. Pilot design (proposal): 12 weeks, one site
| Phase | Weeks | What happens |
|---|---|---|
| Prepare | 1 to 3 | Agree data location, consent wording and ethics review with the partner; move hosting to a UAE region; native review of Arabic text by clinicians; connect the doctor site to the partner's staff |
| Run | 4 to 11 | 50 to 150 consenting participants across at least two audiences; the system runs as built; weekly review of safety flags with a clinician |
| Evaluate | 12 | Report on the measures below, with the limits stated |

Participant numbers are a planning range, not a statistical power calculation. A proper sample size needs the partner's baseline dropout rate.

## 4. What the pilot measures (all already computed by the product)
These come from the Impact page (`GET /doctor-portal/behavior/impact`):
- Retention at day 7, 30 and 90.
- Persistence: share of plans kept up in at least 6 of the last 8 weeks.
- Recovery after a lapse: share who came back and how many days it took, by audience.
- Change against each person's own starting point.
- Whether a message worked: share followed by a check-in within 48 hours, by channel.
- Fairness: the same outcomes by audience, gender, age band, language, mobility, work pattern and region; a gap of 15 points or more is flagged.
- Blood pressure, weight and sleep change, labelled as association, not cause.

**Success criteria must be set with the partner before the pilot starts.** We do not claim a target here because we have no real data to base one on.

## 5. Safety and governance during the pilot
- Participants give consent; they can switch sharing off or erase their data in the app at any time.
- The doctor sees habit data only when the patient allows it. Software suggestions never become clinical decisions; the clinician reviews and signs.
- A very high blood pressure reading or an open emergency holds the step size and points the person to a clinician.
- Outreach limits are set by the person: quiet hours, weekly cap, channel, off switch.
- Rule behaviour under noise: `VALIDATION.md`. It is a simulation, not clinical validation.
- Facts for reviewers and hospital IT: `GET /system/card`.

## 6. Compliance: what we have not done
We have not assessed Abu Dhabi Department of Health requirements, UAE data-protection law, or health-information-exchange rules. Hosting is currently in the United States. The product is **not a medical device** and is not for diagnosis. Before any pilot with real patients, the partner and an ethics board must approve it, and we will need advice from someone who knows these rules.

## 7. Integration plan
- Built: HL7 FHIR R4 Bundle per patient (Patient, Condition, MedicationStatement, Observation with LOINC codes) for doctor use.
- Next: receive data from the clinic's record system, code conditions with a standard vocabulary, and sign in through the clinic's identity provider. Not built.

## 8. Business model (proposal, not tested)
- **Who pays:** the organisation that benefits from people staying engaged: a clinic or programme, an employer wellness budget, or a public-health or insurer-funded programme. Not the individual.
- **How:** a licence per active participant per month for the participant app and doctor site, plus a one-off setup fee for hosting region, integration and clinician onboarding. **Prices will be set after the pilot**, when we know our real costs and the partner's budget.
- **What it costs us (the variables we will measure in the pilot):** hosting and database, push and SMS messages, AI usage for wording and the assistant, clinician support, and the native-language review. AI can be switched off and the product still works, which gives a lower-cost tier.
- **Why this can scale:** the API is stateless, the heavy logic is ordinary code that costs little to run, and one deployment serves many programmes once multi-tenant separation is added (not built).

## 9. Risks we know about
| Risk | What we do |
|---|---|
| No real outcome evidence yet | The pilot is designed to produce it; demo data is labelled and never counted |
| Free-tier hosting sleeps and is slow | Keep-alive during the challenge; move to paid hosting in a UAE region for the pilot |
| Arabic and French text not reviewed by natives | Review by clinicians who speak the language before any participant sees it |
| Messages could annoy people | The person controls quiet hours, cap, channel; the system stops when messages do not help |
| Cultural fit (Ramadan, prayer, heat, weekend) | Built as estimates and labelled; to be confirmed with local clinicians |
