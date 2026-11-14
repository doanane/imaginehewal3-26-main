"""One definition of "how is this patient doing", shared by the doctor website and the caregiver app so they never disagree.
Everything is read from what the patient's phone/watch wrote: VitalReading, HealthData, EmergencyEvent, Medication."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.caregiver import CaregiverRelationship
from app.models.safety import SosEvent
from app.services.emergency_service import OPEN
from app.models.health import HealthData
from app.models.iot_device import VitalReading
from app.models.user import User, UserProfile
from app.services.risk_service import med_adherence

FRESH_HOURS = 24          # a reading older than this is shown as "no recent data", not as a current value


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    dt = aware(dt)
    return dt.isoformat() if dt else None


def parse_bp(text: Optional[str]):
    try:
        a, b = str(text).split("/")
        return int(a), int(b)
    except Exception:
        return None, None


def classify(hr, spo2, sys, dia, active_alert) -> Dict[str, Any]:
    """One rule set for the whole product: critical beats monitor beats stable."""
    critical, monitor = [], []
    if hr is not None:
        if hr >= 120 or hr <= 40:
            critical.append(f"Heart rate {hr} bpm")
        elif hr > 100:
            monitor.append(f"Heart rate {hr} bpm")
    if spo2 is not None:
        if spo2 < 90:
            critical.append(f"Oxygen {spo2:g}%")
        elif spo2 < 94:
            monitor.append(f"Oxygen {spo2:g}%")
    if sys is not None and dia is not None:
        if sys >= 180 or dia >= 120:
            critical.append(f"Blood pressure {sys}/{dia}")
        elif sys >= 140 or dia >= 90:
            monitor.append(f"Blood pressure {sys}/{dia}")
    if active_alert:
        critical.append("Active emergency")
    if critical:
        return {"status": "critical", "reasons": critical + monitor}
    if monitor:
        return {"status": "monitor", "reasons": monitor}
    return {"status": "stable", "reasons": []}


def latest_vitals(db: Session, user_id: int) -> Dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=FRESH_HOURS)
    v = (db.query(VitalReading).filter(VitalReading.user_id == user_id)
         .order_by(VitalReading.timestamp.desc()).first())
    hd = (db.query(HealthData).filter(HealthData.user_id == user_id)
          .order_by(HealthData.date.desc()).first())
    out = {"heart_rate": None, "blood_oxygen": None, "systolic": None, "diastolic": None,
           "steps": None, "glucose": None, "at": None}
    if v and aware(v.timestamp) and aware(v.timestamp) >= cutoff:
        out.update(heart_rate=v.heart_rate, blood_oxygen=v.blood_oxygen, systolic=v.blood_pressure_systolic,
                   diastolic=v.blood_pressure_diastolic, at=iso(v.timestamp))
    if hd and aware(hd.date) and aware(hd.date) >= cutoff:
        if out["heart_rate"] is None:
            out["heart_rate"] = hd.heart_rate
        if out["systolic"] is None:
            out["systolic"], out["diastolic"] = parse_bp(hd.blood_pressure)
        out["steps"], out["glucose"] = hd.steps, hd.blood_glucose
        out["at"] = out["at"] or iso(hd.date)
    return out


def _group(status: str, conditions: list) -> str:
    """The clinician's triage group: critical, monitor (readings drifting), stable (a condition, readings in range), healthy (no condition, in range)."""
    if status in ("critical", "monitor", "no_data"):
        return status
    return "stable" if conditions else "healthy"


def snapshot(db: Session, user: User, profile: Optional[UserProfile]) -> Dict[str, Any]:
    vit = latest_vitals(db, user.id)
    active = db.query(SosEvent).filter(SosEvent.user_id == user.id, SosEvent.status.in_(OPEN)).count()
    cls = classify(vit["heart_rate"], vit["blood_oxygen"], vit["systolic"], vit["diastolic"], active > 0)
    has_data = any(vit[k] is not None for k in ("heart_rate", "blood_oxygen", "systolic")) or active > 0
    carers = (db.query(User).join(CaregiverRelationship, CaregiverRelationship.caregiver_id == User.id)
              .filter(CaregiverRelationship.patient_id == user.id, CaregiverRelationship.status == "approved").all())
    adherence = med_adherence(db, user.id)
    return {
        "patient_id": user.id,
        "identifier": user.patient_id,
        "name": (profile.full_name if profile else None) or user.username or user.email,
        "age": profile.age if profile else None, "gender": profile.gender if profile else None,
        "conditions": (profile.chronic_conditions if profile else None) or [],
        "vitals": vit,
        "status": cls["status"] if has_data else "no_data",
        "group": _group(cls["status"] if has_data else "no_data", (profile.chronic_conditions if profile else None) or []),
        "reasons": cls["reasons"],
        "active_alerts": active,
        "caregivers": [c.username or c.email for c in carers],
        "adherence": None if adherence is None else round(adherence * 100),
    }


