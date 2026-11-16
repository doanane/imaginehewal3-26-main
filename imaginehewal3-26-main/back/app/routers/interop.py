"""Interoperability and transparency.

* GET /doctor-portal/patients/{id}/fhir  a HL7 FHIR R4 Bundle of one assigned patient's data, so a clinic's record system (Epic, Oracle Health,
  OpenMRS, a national HIE) can take it in. Doctor-only, only for patients assigned to that doctor. Real data only: nothing is invented, a field with
  no value is left out, and the bundle says where the data came from.
* GET /system/card  a plain-language system card: what is AI, what is deterministic, what is checked before anything reaches a person, which
  switches are on right now. No personal data. Meant for reviewers, hospital IT and the app's own "About" screens.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor
from app.config import settings
from app.database import get_db
from app.models.caregiver import Doctor
from app.models.iot_device import VitalReading
from app.models.safety import Medication
from app.models.user import User, UserProfile
from app.routers.doctor_portal import _owned_patient

router = APIRouter(tags=["interop"])
LOINC = "http://loinc.org"
UCUM = "http://unitsofmeasure.org"


def _obs(pid: int, vid: int, when: datetime, code: str, display: str, value: float, unit: str, ucum: str) -> Dict[str, Any]:
    return {"resourceType": "Observation", "id": f"vital-{vid}-{code}", "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
            "code": {"coding": [{"system": LOINC, "code": code, "display": display}]},
            "subject": {"reference": f"Patient/{pid}"}, "effectiveDateTime": when.isoformat(),
            "valueQuantity": {"value": value, "unit": unit, "system": UCUM, "code": ucum}}


def build_bundle(db: Session, user: User, profile: UserProfile, days: int = 30, limit: int = 200) -> Dict[str, Any]:
    pid = user.id
    patient: Dict[str, Any] = {"resourceType": "Patient", "id": str(pid), "active": bool(user.is_active),
                               "identifier": [{"system": "urn:hewal3:patient-id", "value": str(getattr(user, "patient_id", None) or pid)}]}
    if profile.full_name:
        patient["name"] = [{"text": profile.full_name}]
    g = (profile.gender or "").lower()
    if g in ("male", "female", "other"):
        patient["gender"] = g
    entries: List[Dict[str, Any]] = [{"resource": patient}]
    for i, c in enumerate(profile.chronic_conditions or []):
        entries.append({"resource": {"resourceType": "Condition", "id": f"cond-{pid}-{i}", "subject": {"reference": f"Patient/{pid}"},
                                     "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]},
                                     "code": {"text": str(c)}}})                                   # free text: we never guess a code
    for m in db.query(Medication).filter(Medication.user_id == pid, Medication.active == True).all():  # noqa: E712
        text = f"{m.name} {m.dose or ''}".strip()
        entries.append({"resource": {"resourceType": "MedicationStatement", "id": f"med-{m.id}", "status": "active",
                                     "medicationCodeableConcept": {"text": m.name}, "subject": {"reference": f"Patient/{pid}"},
                                     "dosage": [{"text": f"{text}; at {', '.join(m.times or [])}"}]}})
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (db.query(VitalReading).filter(VitalReading.user_id == pid, VitalReading.timestamp >= since)
            .order_by(VitalReading.timestamp.desc()).limit(limit).all())
    for v in rows:
        when = v.timestamp if v.timestamp.tzinfo else v.timestamp.replace(tzinfo=timezone.utc)
        if v.blood_pressure_systolic is not None and v.blood_pressure_diastolic is not None:
            o = _obs(pid, v.id, when, "85354-9", "Blood pressure panel", 0, "", "")
            o.pop("valueQuantity")
            o["component"] = [{"code": {"coding": [{"system": LOINC, "code": "8480-6", "display": "Systolic blood pressure"}]},
                               "valueQuantity": {"value": v.blood_pressure_systolic, "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"}},
                              {"code": {"coding": [{"system": LOINC, "code": "8462-4", "display": "Diastolic blood pressure"}]},
                               "valueQuantity": {"value": v.blood_pressure_diastolic, "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"}}]
            entries.append({"resource": o})
        if v.heart_rate is not None:
            entries.append({"resource": _obs(pid, v.id, when, "8867-4", "Heart rate", v.heart_rate, "beats/min", "/min")})
        if v.blood_oxygen is not None:
            entries.append({"resource": _obs(pid, v.id, when, "59408-5", "Oxygen saturation by pulse oximetry", v.blood_oxygen, "%", "%")})
        if v.temperature is not None:
            entries.append({"resource": _obs(pid, v.id, when, "8310-5", "Body temperature", v.temperature, "Cel", "Cel")})
    return {"resourceType": "Bundle", "type": "collection", "timestamp": datetime.now(timezone.utc).isoformat(),
            "meta": {"tag": [{"system": "urn:hewal3:source", "code": "patient-reported-and-device",
                              "display": "Collected by the HEWAL3 app and the patient's own devices. Not a hospital record."}]},
            "total": len(entries), "entry": entries}


@router.get("/doctor-portal/patients/{patient_id}/fhir")
def patient_fhir(patient_id: int, days: int = 30, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    user, profile = _owned_patient(db, doctor, patient_id)
    return build_bundle(db, user, profile, days=max(1, min(days, 365)))


def _on(name: str, default: str = "1") -> bool:
    return os.getenv(name, default) not in ("0", "off", "false", "")


@router.get("/system/card")
def system_card():
    ai = os.getenv("AI_PROVIDER", "auto")
    return {
        "name": "HEWAL3", "purpose": "Help people keep up healthy habits, notice when they have gone quiet, and bring them back kindly, "
                                      "while giving their clinician a trustworthy view.",
        "environment": settings.ENVIRONMENT,
        "agent": {
            "what": "A care agent that runs by itself: it senses check-ins, readings, the person's clock and week, decides with written rules, acts with one fitted message, hands off to a clinician only when needed, and measures whether the person came back.",
            "loop": ["sense", "decide", "act", "hand off", "measure"],
            "decides_with": "Written rules, unit tested. No language model makes any decision.",
            "explainable": "Every pass keeps a trace (what it noticed, why, what it did, who looks next). The person sees it in the app; a doctor sees habit detail only with the patient's consent.",
            "human_in_the_loop": "A clinician is asked only for a very high reading, or a long silence in a person with a condition. They approve, change or dismiss. The agent never changes a medicine or a treatment.",
            "when_wrong": "One tap stops all messages, makes the step smaller, or marks a message not helpful (which makes outreach quieter).",
            "try_it": "GET /agent/story (a simulated person run through the same rules); the doctor site page #/story needs no sign-in.",
        },
        "deterministic": [
            "The care agent's decisions (lapse, stage, send or wait, hand-off) and its trace (`care_agent`, unit tested).",
            "The habit loop: step size, level changes, lapse detection (3 or more days without a check-in) and the comeback step (engine, unit tested).",
            "Patient status for every role (one definition, `care_snapshot`) and Home alerts (`alert_rules`: needs repeated readings, never one).",
            "Medicine adherence counts only doses that were due; fewer than 3 due gives 'not enough data', never 0%.",
            "Impact statistics: retention, persistence, recovery, change against the person's own baseline, equity by group. Groups under 5 are hidden.",
        ],
        "ai": {"enabled": ai != "off", "used_for": ["plain-language wording and chat answers", "meal photo description", "a clinician brief that restates real numbers"],
               "never_used_for": ["diagnosis", "changing medicines", "choosing a step size", "deciding who is critical", "sending anything to a clinician without the person's consent"],
               "de_identified": "Only age, conditions and numbers are sent. Never name, phone or address.",
               "fallback": "Every AI feature has a plain version built from the same numbers, so the app works with AI off."},
        "safety_gates": [
            "A very high blood pressure reading (180/120 or more) or an open SOS holds the step at its size and tells the person to speak to a clinician.",
            "Emergency wording in chat is answered with fixed text before any model is called.",
            "Outreach after a gap: quiet hours, a weekly cap the person sets, one message a day, stops if messages do not help, adapts channel.",
            "The doctor sees habit progress only when the patient switches sharing on; individual behaviour data is never shown to employers or insurers.",
            "A doctor's note is private until shared; a signed consultation is locked and only amended by addenda.",
        ],
        "human_oversight": "Software suggestions never become clinical decisions. The doctor reviews, edits and signs; the patient controls sharing.",
        "audit": "Every look at a patient's data by a caregiver is logged and shown to the patient. Documents carry a verifiable reference.",
        "interoperability": {"fhir_export": "HL7 FHIR R4 Bundle per assigned patient (Patient, Condition, MedicationStatement, Observation with LOINC codes).",
                             "not_yet": ["Two-way exchange with a hospital record system", "SNOMED/ICD coding of conditions typed by the patient"]},
        "languages": ["English", "French (needs native review)", "Arabic (needs native review)"],
        "regions": ["Ghana", "United Arab Emirates (week, Ramadan, prayer times, heat, emergency numbers)"],
        "switches_now": {"guest_demo": _on("GUEST_MODE"), "outreach_worker": _on("REENGAGE_ENABLED"), "ai_assistant": ai != "off"},
        "limits": ["Not a medical device and not for diagnosis.", "Wearable figures come from the person's own phone or watch, not a clinical-grade source.",
                   "Impact numbers are only as strong as the number of real users; demo data is labelled and never counted as results.",
                   "Prayer times and Ramadan dates are approximate; heat is by season."],
    }
