"""Authenticated, near-real-time vitals from a wearable (via a phone/laptop bridge).

POST /vitals/ingest  - bridge pushes a reading (heart rate / SpO2 / steps) as the logged-in user
GET  /vitals/live    - latest reading + last N minutes, for the app to poll every few seconds
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.health import HealthData
from app.models.iot_device import IoTDevice, VitalReading
from app.models.caregiver import CaregiverRelationship
from app.models.emergency import EmergencyEvent
from app.models.user import User
from app.realtime import hub

router = APIRouter(prefix="/vitals", tags=["vitals"])

LIVE_SECONDS = 30  # a reading newer than this counts as "live"


class VitalIn(BaseModel):
    device_id: str = Field(..., max_length=64)           # e.g. watch MAC address
    device_name: Optional[str] = Field(None, max_length=80)
    heart_rate: Optional[int] = Field(None, ge=25, le=230)
    blood_oxygen: Optional[float] = Field(None, ge=50, le=100)
    steps: Optional[int] = Field(None, ge=0, le=200000)  # day total from the watch
    blood_pressure_systolic: Optional[int] = Field(None, ge=50, le=260)
    blood_pressure_diastolic: Optional[int] = Field(None, ge=30, le=180)
    temperature: Optional[float] = Field(None, ge=25, le=45)
    measured_at: Optional[datetime] = None      # when the watch took the reading (Apple Health keeps this)
    calories: Optional[int] = Field(None, ge=0, le=12000)       # active energy so far today (kcal)
    active_minutes: Optional[int] = Field(None, ge=0, le=1440)  # exercise minutes so far today
    distance_m: Optional[int] = Field(None, ge=0, le=300000)    # walking and running distance so far today
    steps_source: Optional[str] = Field(None, max_length=60)    # the app or device the day totals came from


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.post("/ingest")
def ingest(body: VitalIn, db: Session = Depends(get_db),
           user: User = Depends(get_current_active_user)):
    if all(value is None for value in (body.heart_rate, body.blood_oxygen, body.steps,
                                        body.blood_pressure_systolic, body.blood_pressure_diastolic,
                                        body.temperature, body.calories, body.active_minutes, body.distance_m)):
        raise HTTPException(400, "Send at least one vital sign")
    now = datetime.now(timezone.utc)
    # A reading synced from a watch app may be hours old. Keep its real time, and never let an old reading raise an alarm.
    taken_at = now
    if body.measured_at is not None:
        taken_at = min(now, max(now - timedelta(hours=48), _utc(body.measured_at)))
    is_fresh = (now - taken_at) <= timedelta(minutes=10)
    device = db.query(IoTDevice).filter_by(device_id=body.device_id).first()
    if device and device.user_id != user.id:
        raise HTTPException(403, "This device is registered to another account")
    if not device:
        device = IoTDevice(user_id=user.id, device_id=body.device_id, device_type="smartwatch",
                           device_name=body.device_name or "Smartwatch", manufacturer="oraimo",
                           model="OSW-812", connection_status="connected", last_sync=now)
        db.add(device)
        db.flush()
    device.connection_status, device.last_sync = "connected", now

    alert_reasons = []
    if not is_fresh:
        pass
    elif body.heart_rate is not None and (body.heart_rate >= 120 or body.heart_rate <= 40):
        alert_reasons.append("heart_rate")
    if is_fresh and body.blood_oxygen is not None and body.blood_oxygen < 90:
        alert_reasons.append("blood_oxygen")
    if is_fresh and ((body.blood_pressure_systolic is not None and body.blood_pressure_systolic >= 180) or (
        body.blood_pressure_diastolic is not None and body.blood_pressure_diastolic >= 120
    )):
        alert_reasons.append("blood_pressure")
    if any(value is not None for value in (body.heart_rate, body.blood_oxygen,
                                            body.blood_pressure_systolic,
                                            body.blood_pressure_diastolic)):
        duplicate = db.query(VitalReading.id).filter(VitalReading.user_id == user.id, VitalReading.device_id == device.id,
                                                      VitalReading.timestamp == taken_at).first() if body.measured_at is not None else None
        if not duplicate:
            db.add(VitalReading(device_id=device.id, user_id=user.id, heart_rate=body.heart_rate,
                                blood_oxygen=body.blood_oxygen,
                                blood_pressure_systolic=body.blood_pressure_systolic,
                                blood_pressure_diastolic=body.blood_pressure_diastolic,
                                temperature=body.temperature, is_emergency=bool(alert_reasons), timestamp=taken_at))

    # keep today's HealthData row in sync so dashboards and the behaviour loop see real data
    start = datetime.combine(datetime.now().date(), datetime.min.time())
    hd = (db.query(HealthData).filter(HealthData.user_id == user.id, HealthData.date >= start)
          .order_by(HealthData.date.desc()).first())
    if not hd:
        hd = HealthData(user_id=user.id, steps=0)
        db.add(hd)
    if body.heart_rate is not None and is_fresh:       # an old reading must not overwrite a newer one
        hd.heart_rate = body.heart_rate
    # Day totals only grow during a day (a person cannot un-walk), so a late or partial upload can never lower what is already recorded.
    if body.steps is not None and body.steps >= (hd.steps or 0):
        hd.steps = body.steps
        if body.steps_source:
            hd.steps_source = body.steps_source
    if body.calories is not None:
        hd.calories_burned = max(hd.calories_burned or 0, body.calories)
    if body.active_minutes is not None:
        hd.active_minutes = max(hd.active_minutes or 0, body.active_minutes)
    if body.distance_m is not None:
        hd.distance_m = max(hd.distance_m or 0, body.distance_m)
    if alert_reasons:
        recent_event = (db.query(EmergencyEvent)
                        .filter(EmergencyEvent.user_id == user.id,
                                EmergencyEvent.status == "active")
                        .order_by(EmergencyEvent.triggered_at.desc()).first())
        if not recent_event:
            db.add(EmergencyEvent(
                user_id=user.id,
                event_type="wearable_anomaly",
                severity="critical",
                description=f"Abnormal wearable reading: {', '.join(alert_reasons)}",
                status="active",
            ))
    db.commit()

    # push to the patient's own open apps and to approved caregivers, in real time
    event = {"type": "vitals.update", "user_id": user.id, "heart_rate": body.heart_rate,
             "blood_oxygen": body.blood_oxygen, "steps": body.steps,
             "blood_pressure_systolic": body.blood_pressure_systolic,
             "blood_pressure_diastolic": body.blood_pressure_diastolic,
             "alert_reasons": alert_reasons, "timestamp": taken_at.isoformat()}
    watchers = [r.caregiver_id for r in db.query(CaregiverRelationship).filter(
        CaregiverRelationship.patient_id == user.id, CaregiverRelationship.status == "approved").all()]
    for uid in [user.id, *watchers]:
        hub.send_from_thread(uid, event)
    from app.services.care_chat import refresh_doctor
    refresh_doctor(db, user.id, "vitals")

    # critical readings start the emergency protocol (never allowed to break the ingest itself)
    try:
        from app.services.emergency_service import check_and_trigger
        if is_fresh:
            check_and_trigger(db, user, body.heart_rate, body.blood_oxygen,
                              systolic=body.blood_pressure_systolic, diastolic=body.blood_pressure_diastolic)
        from app.services.risk_service import check_alerts
        check_alerts(db, user)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("emergency check failed")
    return {"ok": True, "received_at": now.isoformat(), "alert_reasons": alert_reasons}


@router.get("/live")
def live(minutes: int = 10, db: Session = Depends(get_db),
         user: User = Depends(get_current_active_user)):
    minutes = max(1, min(minutes, 120))
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    rows = (db.query(VitalReading).filter(VitalReading.user_id == user.id,
                                          VitalReading.timestamp >= since)
            .order_by(VitalReading.timestamp.asc()).limit(1000).all())
    latest = rows[-1] if rows else (db.query(VitalReading).filter_by(user_id=user.id)
                                    .order_by(VitalReading.timestamp.desc()).first())
    age = None
    if latest and latest.timestamp:
        age = round((datetime.now(timezone.utc) - _utc(latest.timestamp)).total_seconds())
    return {
        "is_live": age is not None and age <= LIVE_SECONDS,
        "age_seconds": age,
        "latest": None if not latest else {
            "heart_rate": latest.heart_rate, "blood_oxygen": latest.blood_oxygen,
            "blood_pressure_systolic": latest.blood_pressure_systolic,
            "blood_pressure_diastolic": latest.blood_pressure_diastolic,
            "is_emergency": bool(latest.is_emergency),
            "timestamp": _utc(latest.timestamp).isoformat()},
        "history": [{"t": _utc(r.timestamp).isoformat(), "hr": r.heart_rate, "spo2": r.blood_oxygen,
                     "bp_sys": r.blood_pressure_systolic, "bp_dia": r.blood_pressure_diastolic,
                     "is_emergency": bool(r.is_emergency)}
                    for r in rows],
    }


@router.get("/summary")
def vitals_summary(days: int = 7, db: Session = Depends(get_db),
                   user: User = Depends(get_current_active_user)):
    days = max(1, min(days, 30))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (db.query(VitalReading).filter(VitalReading.user_id == user.id,
                                          VitalReading.timestamp >= since)
            .order_by(VitalReading.timestamp.asc()).limit(5000).all())
    return {
        "days": days,
        "readings": [{
            "timestamp": _utc(row.timestamp).isoformat(),
            "heart_rate": row.heart_rate,
            "blood_oxygen": row.blood_oxygen,
            "blood_pressure_systolic": row.blood_pressure_systolic,
            "blood_pressure_diastolic": row.blood_pressure_diastolic,
            "temperature": row.temperature,
            "is_emergency": bool(row.is_emergency),
        } for row in rows],
        "alert_count": sum(1 for row in rows if row.is_emergency),
    }
