"""Emergency Auto-Response System.

Flow
  1. Detection: a critical reading from the watch (sustained over two readings) or a manual SOS creates an event.
  2. Grace period (default 15 s auto, 5 s manual): the patient's phone shows a countdown and can cancel a false alarm.
  3. Caregiver alert, attempt 1 and attempt 2 (realtime push + in-app notification + SMS), each followed by an
     acknowledgement window (default 60 s). Any approved caregiver can acknowledge, which stops escalation.
  4. If nobody acknowledged after two attempts: escalate. The patient's phone is told to dial the national emergency
     number, live location is shared with caregivers and emergency contacts, and everything is logged.

Safety: EMERGENCY_DISPATCH_MODE defaults to "simulate". In simulate mode the server records what it would do and the
app shows a clear SIMULATION banner; nothing can reach real emergency services by accident during demos or tests.
A server cannot place a phone call to 112 by itself; in "live" mode the patient's phone opens the dialer.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import anyio
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.caregiver import CaregiverRelationship
from app.models.emergency import EmergencyContact
from app.models.iot_device import VitalReading
from app.models.notification import Notification
from app.models.safety import SosEvent, SosLog
from app.models.user import User, UserProfile
from app.realtime import hub

logger = logging.getLogger(__name__)

OPEN = ("pending", "active", "acknowledged", "escalated")
MAX_ATTEMPTS = 2


def cfg() -> dict:
    return {
        "grace_auto": int(os.getenv("EMERGENCY_GRACE_SECONDS", "15")),
        "grace_manual": int(os.getenv("EMERGENCY_MANUAL_GRACE_SECONDS", "5")),
        "ack_wait": int(os.getenv("EMERGENCY_ACK_WAIT_SECONDS", "60")),
        "cooldown_min": int(os.getenv("EMERGENCY_AUTO_COOLDOWN_MINUTES", "10")),
        "number": os.getenv("EMERGENCY_NUMBER", "112"),
        "mode": os.getenv("EMERGENCY_DISPATCH_MODE", "simulate"),
    }


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_bp(bp: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    try:
        s, d = str(bp).split("/")
        return int(s), int(d)
    except Exception:
        return None, None


# ---------------------------------------------------------------- detection
def evaluate_vitals(hr=None, spo2=None, systolic=None, diastolic=None) -> Optional[Tuple[str, dict]]:
    """Return (reason, snapshot) if a single reading is in the critical range, else None."""
    snap = {k: v for k, v in dict(heart_rate=hr, blood_oxygen=spo2, systolic=systolic, diastolic=diastolic).items() if v is not None}
    if spo2 is not None and spo2 < 88:
        return f"Blood oxygen is critically low ({round(spo2)}%)", snap
    if (systolic is not None and systolic >= 180) or (diastolic is not None and diastolic >= 120):
        return f"Blood pressure is in the crisis range ({systolic}/{diastolic})", snap
    if hr is not None and (hr >= 150 or hr <= 35):
        return f"Heart rate is dangerous ({hr} bpm)", snap
    return None


def _critical(vr: VitalReading) -> bool:
    return evaluate_vitals(vr.heart_rate, vr.blood_oxygen, vr.blood_pressure_systolic, vr.blood_pressure_diastolic) is not None


def check_and_trigger(db: Session, user: User, hr=None, spo2=None, force: bool = False, systolic=None, diastolic=None) -> Optional[SosEvent]:
    """Called after each watch reading. Triggers only when this and the previous reading (within 3 minutes)
    are both critical, to avoid acting on a single sensor glitch. `force` skips that confirmation (simulation)."""
    verdict = evaluate_vitals(hr, spo2, systolic, diastolic)
    if not verdict:
        return None
    if not force:
        since = _now() - timedelta(minutes=3)
        recent = (db.query(VitalReading).filter(VitalReading.user_id == user.id, VitalReading.timestamp >= since)
                  .order_by(VitalReading.timestamp.desc()).limit(2).all())
        if len(recent) < 2 or not all(_critical(r) for r in recent):
            return None
    reason, snap = verdict
    return create_event(db, user, "auto_vitals", reason, "critical", vitals=snap)


# ---------------------------------------------------------------- event lifecycle
def _log(db: Session, event: SosEvent, kind: str, detail: str = "") -> None:
    db.add(SosLog(event_id=event.id, kind=kind, detail=detail))


def _name(user: Optional[User]) -> str:
    if not user:
        return "Someone"
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or user.email or "A patient"


def location_url(event: SosEvent) -> Optional[str]:
    return f"https://maps.google.com/?q={event.lat},{event.lng}" if event.lat is not None and event.lng is not None else None


def event_dict(db: Session, event: SosEvent, with_logs: bool = False) -> dict:
    patient = db.query(User).filter(User.id == event.user_id).first()
    c = cfg()
    d = {
        "id": event.id, "user_id": event.user_id, "patient_name": _name(patient), "trigger": event.trigger,
        "reason": event.reason, "severity": event.severity, "status": event.status, "attempts": event.attempts,
        "max_attempts": MAX_ATTEMPTS, "vitals": event.vitals,
        "created_at": _utc(event.created_at).isoformat() if event.created_at else None,
        "grace_until": _utc(event.grace_until).isoformat() if event.grace_until else None,
        "next_action_at": _utc(event.next_action_at).isoformat() if event.next_action_at else None,
        "acknowledged_by": event.acknowledged_by, "escalated_at": _utc(event.escalated_at).isoformat() if event.escalated_at else None,
        "lat": event.lat, "lng": event.lng, "location_url": location_url(event),
        "dispatch_mode": event.dispatch_mode, "emergency_number": c["number"],
        "patient_phone": getattr(patient, "phone_number", None),
    }
    if with_logs:
        logs = db.query(SosLog).filter_by(event_id=event.id).order_by(SosLog.id.asc()).all()
        d["timeline"] = [{"at": _utc(l.at).isoformat() if l.at else None, "kind": l.kind, "detail": l.detail} for l in logs]
    return d


def active_event_for(db: Session, user_id: int) -> Optional[SosEvent]:
    return (db.query(SosEvent).filter(SosEvent.user_id == user_id, SosEvent.status.in_(OPEN))
            .order_by(SosEvent.id.desc()).first())


def create_event(db: Session, user: User, trigger: str, reason: str, severity: str = "critical",
                 vitals: Optional[dict] = None, grace: Optional[int] = None) -> SosEvent:
    existing = active_event_for(db, user.id)
    if existing:
        return existing
    c = cfg()
    if trigger == "auto_vitals":
        cutoff = _now() - timedelta(minutes=c["cooldown_min"])
        recent = db.query(SosEvent).filter(SosEvent.user_id == user.id, SosEvent.trigger == "auto_vitals",
                                           SosEvent.created_at >= cutoff).first()
        if recent:
            return recent
    grace_s = c["grace_auto"] if grace is None and trigger == "auto_vitals" else (c["grace_manual"] if grace is None else grace)
    now = _now()
    ev = SosEvent(user_id=user.id, trigger=trigger, reason=reason, severity=severity, vitals=vitals,
                  status="pending" if grace_s > 0 else "active", grace_until=now + timedelta(seconds=grace_s),
                  next_action_at=now + timedelta(seconds=grace_s), dispatch_mode=c["mode"])
    db.add(ev)
    db.flush()
    _log(db, ev, "created", f"{trigger}: {reason}. Grace period {grace_s}s.")
    db.commit()
    db.refresh(ev)
    hub.send_from_thread(user.id, {"type": "emergency.started", "auto": trigger == "auto_vitals",
                                   "grace_seconds": grace_s, "event": event_dict(db, ev)})
    from app.services.care_chat import refresh_doctor
    refresh_doctor(db, user.id, "emergency")
    if grace_s == 0:
        advance(db, ev)
    return ev


def _recipients(db: Session, patient_id: int) -> Tuple[List[User], List[EmergencyContact]]:
    rels = db.query(CaregiverRelationship).filter(CaregiverRelationship.patient_id == patient_id,
                                                  CaregiverRelationship.status == "approved").all()
    caregivers = [u for u in (db.query(User).filter(User.id == r.caregiver_id).first() for r in rels) if u]
    contacts = db.query(EmergencyContact).filter(EmergencyContact.user_id == patient_id).all()
    return caregivers, contacts


def _sms(phone: Optional[str], text: str) -> None:
    if not phone:
        return
    try:
        from app.services.sms_service import SMSService
        SMSService().send_sms(phone, text)
    except Exception as e:  # SMS is best-effort; never block the escalation
        logger.warning("SMS failed: %s", type(e).__name__)


def _notify_caregivers(db: Session, event: SosEvent, patient: User, attempt: int, escalated: bool = False) -> int:
    caregivers, contacts = _recipients(db, event.user_id)
    loc = location_url(event)
    headline = f"{_name(patient)} needs help" if not escalated else f"Emergency services contacted for {_name(patient)}"
    body = f"{event.reason}." + (f" Location: {loc}" if loc else " Location is being shared.")
    payload = {"type": "alert", "kind": "emergency", "attempt": attempt, "escalated": escalated,
               "message": f"{headline}. {event.reason}", "event": event_dict(db, event)}
    from app.services import push
    push.notify_users([c.id for c in caregivers], f"Emergency: {headline}", "Open HEWAL3 now to respond.", {"type": "emergency", "event_id": event.id}, urgent=True)
    for cg in caregivers:
        db.add(Notification(user_id=cg.id, notification_type="emergency", title=headline, message=body, sender_type="system"))
        hub.send_from_thread(cg.id, payload)
        _sms(getattr(cg, "phone_number", None), f"HEWAL3 EMERGENCY: {headline}. {body}")
    for ct in contacts:
        _sms(ct.phone_number, f"HEWAL3 EMERGENCY: {headline}. {body}")
    db.commit()
    return len(caregivers) + len(contacts)


def advance(db: Session, event: SosEvent, now: Optional[datetime] = None) -> Optional[str]:
    """Move the event forward if its next step is due. Returns what happened, or None."""
    now = now or _now()
    if event.status not in ("pending", "active"):
        return None
    due = _utc(event.next_action_at)
    if due and now < due:
        return None
    c = cfg()
    patient = db.query(User).filter(User.id == event.user_id).first()
    if event.status == "pending":
        event.status = "active"
    if event.attempts < MAX_ATTEMPTS:
        reached = _notify_caregivers(db, event, patient, event.attempts + 1)
        event.attempts += 1
        if reached == 0:                      # nobody to wait for: go straight to escalation
            event.attempts = MAX_ATTEMPTS
            _log(db, event, "no_recipients", "No caregivers or emergency contacts to alert.")
            return _escalate(db, event, patient, now)
        event.next_action_at = now + timedelta(seconds=c["ack_wait"])
        _log(db, event, f"caregiver_alert_{event.attempts}", f"Alerted {reached} caregiver(s)/contact(s). Waiting {c['ack_wait']}s for acknowledgement.")
        db.commit()
        hub.send_from_thread(event.user_id, {"type": "emergency.update", "event": event_dict(db, event)})
        return f"caregiver_alert_{event.attempts}"
    return _escalate(db, event, patient, now)


def _escalate(db: Session, event: SosEvent, patient: User, now: datetime) -> str:
    c = cfg()
    event.status, event.escalated_at, event.next_action_at = "escalated", now, None
    if c["mode"] == "live":
        _log(db, event, "dispatch", f"Emergency number {c['number']} requested. The patient's phone was told to dial it and share location.")
    else:
        _log(db, event, "dispatch_simulated", f"SIMULATION: would contact {c['number']}. No real call was made.")
    db.commit()
    _notify_caregivers(db, event, patient, event.attempts, escalated=True)
    hub.send_from_thread(event.user_id, {"type": "emergency.escalated", "mode": c["mode"], "number": c["number"],
                                         "event": event_dict(db, event)})
    return "escalated"


def _is_caregiver_of(db: Session, caregiver_id: int, patient_id: int) -> bool:
    return db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == caregiver_id, CaregiverRelationship.patient_id == patient_id,
        CaregiverRelationship.status == "approved").first() is not None


def can_view(db: Session, user: User, event: SosEvent) -> bool:
    return user.id == event.user_id or _is_caregiver_of(db, user.id, event.user_id)


def _broadcast(db: Session, event: SosEvent, payload: dict) -> None:
    caregivers, _ = _recipients(db, event.user_id)
    for uid in {event.user_id, *[c.id for c in caregivers]}:
        hub.send_from_thread(uid, payload)
    from app.services.care_chat import refresh_doctor
    refresh_doctor(db, event.user_id, "emergency")


def acknowledge(db: Session, event: SosEvent, user: User) -> bool:
    if event.status in ("cancelled", "resolved") or not _is_caregiver_of(db, user.id, event.user_id):
        return False
    if event.status != "escalated":
        event.status = "acknowledged"
    event.acknowledged_by, event.acknowledged_at, event.next_action_at = user.id, _now(), None
    _log(db, event, "acknowledged", f"{_name(user)} is responding.")
    db.commit()
    _broadcast(db, event, {"type": "emergency.acknowledged", "by_name": _name(user), "event": event_dict(db, event)})
    return True


def cancel(db: Session, event: SosEvent, user: User) -> bool:
    if user.id != event.user_id or event.status in ("cancelled", "resolved"):
        return False
    notified = event.attempts > 0
    event.status, event.resolved_at, event.next_action_at = "cancelled", _now(), None
    _log(db, event, "cancelled", "Cancelled by the patient (false alarm).")
    db.commit()
    if notified:
        _broadcast(db, event, {"type": "alert", "kind": "emergency.cancelled", "message": f"{_name(user)} cancelled the alert. They are OK.", "event": event_dict(db, event)})
    _broadcast(db, event, {"type": "emergency.update", "event": event_dict(db, event)})
    return True


def resolve(db: Session, event: SosEvent, user: User) -> bool:
    if event.status in ("cancelled", "resolved") or not (user.id == event.user_id or _is_caregiver_of(db, user.id, event.user_id)):
        return False
    event.status, event.resolved_at, event.next_action_at = "resolved", _now(), None
    _log(db, event, "resolved", f"Marked resolved by {_name(user)}.")
    db.commit()
    _broadcast(db, event, {"type": "emergency.update", "event": event_dict(db, event)})
    return True


def update_location(db: Session, event: SosEvent, user: User, lat: float, lng: float, accuracy: Optional[float]) -> bool:
    if user.id != event.user_id or event.status in ("cancelled", "resolved"):
        return False
    first = event.lat is None
    event.lat, event.lng, event.accuracy, event.location_at = lat, lng, accuracy, _now()
    if first:
        _log(db, event, "location_shared", "Live location sharing started.")
    db.commit()
    caregivers, _ = _recipients(db, event.user_id)
    for cg in caregivers:
        hub.send_from_thread(cg.id, {"type": "emergency.location", "event_id": event.id, "lat": lat, "lng": lng, "accuracy": accuracy, "location_url": location_url(event)})
    return True


# ---------------------------------------------------------------- background worker
def tick() -> int:
    """Advance every event whose next step is due. Runs in a worker thread."""
    db = SessionLocal()
    n = 0
    try:
        now = _now()
        for ev in db.query(SosEvent).filter(SosEvent.status.in_(("pending", "active"))).all():
            try:
                if advance(db, ev, now):
                    n += 1
            except Exception:
                db.rollback()
                logger.exception("escalation failed for event %s", ev.id)
        return n
    finally:
        db.close()


async def escalation_worker(interval: float = 3.0) -> None:
    while True:
        try:
            await anyio.to_thread.run_sync(tick)
        except Exception:
            logger.exception("escalation worker error")
        await anyio.sleep(interval)
