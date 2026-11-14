"""Privacy centre: who can see my data, who did, export everything, delete everything.

The export and the erase are generic over the database schema: they discover every table that references the user, so a
table added later is covered automatically and cannot be forgotten.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import Base
from app.models.auth import EmailVerificationToken, LoginOTP, PasswordResetToken, RefreshToken, UserSession
from app.models.caregiver import CaregiverRelationship
from app.models.emergency import EmergencyContact
from app.models.trust import AccessLog
from app.models.user import User
from app.realtime import hub

OWNER_COLS = {"user_id", "patient_id", "caregiver_id", "sender_id", "receiver_id"}
SECRET_TABLES = {PasswordResetToken.__tablename__, EmailVerificationToken.__tablename__, LoginOTP.__tablename__,
                 RefreshToken.__tablename__, UserSession.__tablename__}
USER_FIELDS = ("id", "email", "username", "first_name", "last_name", "phone_number", "is_caregiver", "created_at")

CAREGIVER_SEES = [
    "Your health readings and trends (steps, sleep, water, heart rate, blood pressure)",
    "Your risk level and the main reasons for it",
    "Your live heart rate and oxygen from your watch",
    "Emergency alerts, and your live location while an emergency is open",
    "Messages you send them",
]
COMMUNITY_NOTE = ("If you join the community or a leaderboard, other members can see your display name, your posts, and the steps, distance "
                  "and points you choose to compete with. You can leave at any time.")
NEVER_SHARED = [
    "Your wellbeing check-in answers",
    "Your conversations with the health assistant",
    "Your meal photos (they are analysed and not stored)",
    "Your account password or sign-in details",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _name(u: Optional[User]) -> str:
    return (f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or u.email) if u else "Someone"


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    return None if dt is None else (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc))


# ------------------------------------------------------------------ audit log
def log_access(db: Session, patient_id: int, viewer: User, resource: str) -> None:
    """Record that `viewer` looked at the patient's data. A person looking at their own data is not logged,
    and the same viewer and resource is recorded at most once every 10 minutes to keep the log readable."""
    if viewer.id == patient_id:
        return
    since = _now() - timedelta(minutes=10)
    if db.query(AccessLog).filter(AccessLog.patient_id == patient_id, AccessLog.viewer_id == viewer.id,
                                  AccessLog.resource == resource, AccessLog.at >= since).first():
        return
    db.add(AccessLog(patient_id=patient_id, viewer_id=viewer.id, resource=resource,
                     viewer_role="caregiver" if getattr(viewer, "is_caregiver", False) else "other"))
    db.commit()


LABELS = {"risk_summary": "your risk level", "analytics": "your health trends", "emergency": "your emergency",
          "clinician_summary": "your health summary"}


def access_log(db: Session, user: User, limit: int = 50) -> List[dict]:
    rows = db.query(AccessLog).filter_by(patient_id=user.id).order_by(AccessLog.id.desc()).limit(limit).all()
    out = []
    for r in rows:
        v = db.query(User).filter(User.id == r.viewer_id).first()
        out.append({"id": r.id, "viewer": _name(v), "role": r.viewer_role, "what": LABELS.get(r.resource, r.resource),
                    "at": _utc(r.at).isoformat() if r.at else None})
    return out


# ------------------------------------------------------------------ who can see my data
def access_list(db: Session, user: User) -> dict:
    people = []
    for rel in db.query(CaregiverRelationship).filter_by(patient_id=user.id).filter(CaregiverRelationship.status.in_(("approved", "pending"))).all():
        cg = db.query(User).filter(User.id == rel.caregiver_id).first()
        people.append({"relationship_id": rel.id, "name": _name(cg), "relationship": rel.relationship_type, "status": rel.status,
                       "since": _utc(rel.created_at).isoformat() if rel.created_at else None})
    contacts = [{"name": c.name, "relationship": c.relationship_type, "note": "Receives an SMS only if an emergency is not answered"}
                for c in db.query(EmergencyContact).filter_by(user_id=user.id).all()]
    return {"people": people, "emergency_contacts": contacts, "can_see": CAREGIVER_SEES, "never_shared": NEVER_SHARED,
            "employers_and_insurers": "HEWAL3 has no feature that shares your data with employers or insurers."}


def revoke(db: Session, user: User, relationship_id: int) -> bool:
    rel = db.query(CaregiverRelationship).filter_by(id=relationship_id, patient_id=user.id).first()
    if not rel or rel.status == "disconnected":
        return False
    rel.status = "disconnected"
    db.commit()
    hub.send_from_thread(rel.caregiver_id, {"type": "alert", "kind": "access.revoked",
                                            "message": f"{_name(user)} has stopped sharing their health information with you."})
    return True


# ------------------------------------------------------------------ export (data portability)
def _jsonable(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return None
    return v


def export_all(db: Session, user: User) -> dict:
    data: Dict[str, Any] = {"exported_at": _now().isoformat(), "format": "HEWAL3 data export v1", "tables": {}}
    me = db.query(User).filter(User.id == user.id).first()
    data["account"] = {f: _jsonable(getattr(me, f, None)) for f in USER_FIELDS}
    for table in Base.metadata.sorted_tables:
        if table.name == "users" or table.name in SECRET_TABLES:
            continue
        cols = [c for c in table.c if c.name in OWNER_COLS]
        if not cols:
            continue
        cond = None
        for c in cols:
            cond = (c == user.id) if cond is None else (cond | (c == user.id))
        rows = db.execute(table.select().where(cond)).mappings().all()
        if not rows:
            continue
        keep = [c.name for c in table.c if not any(s in c.name.lower() for s in ("password", "token", "hash", "secret"))]
        data["tables"][table.name] = [{k: _jsonable(r[k]) for k in keep} for r in rows]
    sos = data["tables"].get("sos_events")
    if sos:
        ids = [e["id"] for e in sos]
        logs = db.execute(text("SELECT id, event_id, at, kind, detail FROM sos_logs WHERE event_id IN (%s)" % ",".join(str(int(i)) for i in ids))).mappings().all()
        data["tables"]["sos_logs"] = [{k: _jsonable(v) for k, v in r.items()} for r in logs]
    return data


# ------------------------------------------------------------------ erase (right to be forgotten)
def delete_account(db: Session, user: User) -> dict:
    uid = user.id
    db.execute(text("DELETE FROM sos_logs WHERE event_id IN (SELECT id FROM sos_events WHERE user_id = :u)"), {"u": uid})
    for child in ("post_comments", "post_likes", "post_reports"):
        db.execute(text(f"DELETE FROM {child} WHERE post_id IN (SELECT id FROM community_posts WHERE user_id = :u)"), {"u": uid})
    removed = 0
    for table in reversed(Base.metadata.sorted_tables):          # dependants first, so foreign keys never block us
        if table.name == "users":
            continue
        for col in table.c:
            if not any(fk.column.table.name == "users" and fk.column.name == "id" for fk in col.foreign_keys):
                continue
            if col.name in OWNER_COLS or not col.nullable:
                removed += db.execute(table.delete().where(col == uid)).rowcount or 0
            else:                                                # e.g. "acknowledged_by": keep the record, drop the link
                db.execute(table.update().where(col == uid).values({col.name: None}))
    db.execute(Base.metadata.tables["users"].delete().where(Base.metadata.tables["users"].c.id == uid))
    db.commit()
    return {"deleted": True, "rows_removed": removed}
