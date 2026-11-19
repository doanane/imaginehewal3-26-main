"""Workplace heat safety.

Doctor (/doctor-portal/workplaces): create a workplace, record the site temperature and humidity (or let a sensor post them with the site key),
see the current heat level, the history and how many staff joined (a count under 5 is hidden). Staff (/workplace): join with a code, see the site
conditions and advice written for their own health conditions, leave any time. When the level reaches danger the joined staff are told once
(then again only if it gets worse, or after 3 hours). Heat levels and advice come from `services/preventive.heat_check`; nothing is invented.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_doctor, get_current_active_user
from app.config import settings
from app.database import get_db
from app.models.caregiver import Doctor
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.models.workplace import SiteReading, Workplace, WorkplaceMember
from app.realtime import hub
from app.services import preventive, push
from app.services.care_snapshot import iso as _iso
from app.services.simple_limiter import hit as _hit

doctor_router = APIRouter(prefix="/doctor-portal/workplaces", tags=["workplace_doctor"])
patient_router = APIRouter(prefix="/workplace", tags=["workplace"])

MIN_GROUP = 5
ALERT_LEVELS = ("danger", "extreme_danger")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _h(value: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), value.strip().upper().encode(), hashlib.sha256).hexdigest()


def _site_level(w: Workplace, r: Optional[SiteReading]) -> Optional[dict]:
    """The heat level for the site itself (light work, no personal adjustments). None when nobody has recorded a reading in the last 12 hours."""
    if not r or _aware(r.recorded_at) < _now() - timedelta(hours=12):
        return None
    return preventive.heat_check(temp_c=r.temp_c, humidity_pct=r.humidity_pct, effort="light", region=w.region)


def _reading(r: SiteReading) -> dict:
    return {"id": r.id, "temp_c": r.temp_c, "humidity_pct": r.humidity_pct, "source": r.source, "note": r.note, "at": _iso(r.recorded_at)}


def _latest(db: Session, wid: int) -> Optional[SiteReading]:
    return db.query(SiteReading).filter(SiteReading.workplace_id == wid).order_by(SiteReading.recorded_at.desc(), SiteReading.id.desc()).first()


def _card(db: Session, w: Workplace) -> dict:
    latest = _latest(db, w.id)
    lvl = _site_level(w, latest)
    n = db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == w.id).count()
    return {"id": w.id, "name": w.name, "region": w.region, "latest": _reading(latest) if latest else None,
            "level": lvl["level"] if lvl else None, "title": lvl["title"] if lvl else None, "heat_index_c": lvl["heat_index_c"] if lvl else None,
            "members": n if n >= MIN_GROUP else None, "members_hidden": n < MIN_GROUP, "has_sensor_key": w.site_key_hash is not None,
            "last_alert_at": _iso(w.last_alert_at), "last_alert_level": w.last_alert_level}


def _owned(db: Session, doctor: Doctor, wid: int) -> Workplace:
    w = db.query(Workplace).filter(Workplace.id == wid, Workplace.doctor_pk == doctor.id).first()
    if not w:
        raise HTTPException(404, "Workplace not found")
    return w


def _record(db: Session, w: Workplace, temp_c: float, rh: float, source: str, note: Optional[str]) -> SiteReading:
    r = SiteReading(workplace_id=w.id, temp_c=temp_c, humidity_pct=rh, source=source, note=note, recorded_at=_now())
    db.add(r); db.commit(); db.refresh(r)
    _maybe_alert(db, w, r)
    return r


def _maybe_alert(db: Session, w: Workplace, r: SiteReading) -> None:
    """Tell joined staff when the site reaches danger: once, again if it gets worse, or after 3 hours."""
    lvl = _site_level(w, r)
    if not lvl or lvl["level"] not in ALERT_LEVELS:
        return
    worse = w.last_alert_level != lvl["level"] and (w.last_alert_level not in ALERT_LEVELS or lvl["level"] == "extreme_danger")
    stale = not w.last_alert_at or _aware(w.last_alert_at) < _now() - timedelta(hours=3)
    if not (worse or stale):
        return
    ids = [m.user_id for m in db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == w.id).all()]
    w.last_alert_at, w.last_alert_level = _now(), lvl["level"]
    title = f"Heat alert at {w.name}"
    text = f"{lvl['title']}: it feels like {round(lvl['heat_index_c'])}°C. {lvl['water']} {lvl['rest']}"
    for uid in ids:
        db.add(Notification(user_id=uid, notification_type="system", title=title, message=text, sender_type="system"))
    db.commit()
    for uid in ids:
        hub.send_from_thread(uid, {"type": "workplace.update", "workplace_id": w.id})
    push.notify_users(ids, title, "Open HEWAL3 for heat safety advice.", {"type": "workplace"}, urgent=True)


# ------------------------------------------------------------------ doctor
class WorkplaceIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    region: str = "ae"

    @field_validator("region")
    @classmethod
    def _region(cls, v):
        if v not in ("ae", "gh"):
            raise ValueError("region must be ae or gh")
        return v


class ReadingIn(BaseModel):
    temp_c: float = Field(..., ge=-20, le=60)
    humidity_pct: float = Field(..., ge=0, le=100)
    note: Optional[str] = Field(None, max_length=200)


@doctor_router.post("")
def create(body: WorkplaceIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    if db.query(Workplace).filter(Workplace.doctor_pk == doctor.id).count() >= 20:
        raise HTTPException(400, "You can manage up to 20 workplaces")
    code, key = secrets.token_hex(3).upper(), secrets.token_urlsafe(24)
    w = Workplace(doctor_pk=doctor.id, name=body.name.strip(), region=body.region, join_code_hash=_h(code), site_key_hash=_h(key))
    db.add(w); db.commit(); db.refresh(w)
    return {**_card(db, w), "join_code": code, "site_key": key, "note": "The join code and the sensor key are shown once. Keep them safe."}


@doctor_router.get("")
def mine(db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    return {"workplaces": [_card(db, w) for w in db.query(Workplace).filter(Workplace.doctor_pk == doctor.id).order_by(Workplace.id).all()]}


@doctor_router.post("/{wid}/readings")
def add_reading(wid: int, body: ReadingIn, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    w = _owned(db, doctor, wid)
    _record(db, w, body.temp_c, body.humidity_pct, "manual", body.note)
    return _card(db, w)


@doctor_router.get("/{wid}/readings")
def history(wid: int, hours: int = 48, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    w = _owned(db, doctor, wid)
    since = _now() - timedelta(hours=max(1, min(hours, 24 * 14)))
    rows = db.query(SiteReading).filter(SiteReading.workplace_id == w.id, SiteReading.recorded_at >= since).order_by(SiteReading.recorded_at.desc()).limit(500).all()
    out = []
    for r in rows:
        lv = preventive.heat_check(temp_c=r.temp_c, humidity_pct=r.humidity_pct, region=w.region)
        out.append({**_reading(r), "level": lv["level"], "heat_index_c": lv["heat_index_c"]})
    return {"readings": out}


@doctor_router.post("/{wid}/rotate")
def rotate(wid: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    """New join code and new sensor key. The old ones stop working at once; staff who already joined stay joined."""
    w = _owned(db, doctor, wid)
    code, key = secrets.token_hex(3).upper(), secrets.token_urlsafe(24)
    w.join_code_hash, w.site_key_hash = _h(code), _h(key)
    db.commit()
    return {"join_code": code, "site_key": key, "note": "Shown once. The old code and key no longer work."}


@doctor_router.delete("/{wid}")
def remove(wid: int, db: Session = Depends(get_db), doctor: Doctor = Depends(get_current_active_doctor)):
    w = _owned(db, doctor, wid)
    db.query(SiteReading).filter(SiteReading.workplace_id == w.id).delete(synchronize_session=False)
    db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == w.id).delete(synchronize_session=False)
    db.delete(w); db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ a sensor posts readings with the site key
@patient_router.post("/ingest")
def ingest(body: ReadingIn, x_site_key: str = Header(..., alias="X-Site-Key"), db: Session = Depends(get_db)):
    h = _h(x_site_key)
    _hit(f"site:{h[:16]}", 60, 60, "Too many readings. One a minute is enough.")
    w = db.query(Workplace).filter(Workplace.site_key_hash == h).first()
    if not w:
        raise HTTPException(401, "Unknown site key")
    r = _record(db, w, body.temp_c, body.humidity_pct, "sensor", body.note)
    return {"ok": True, "id": r.id}


# ------------------------------------------------------------------ staff
class JoinIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


def _mine(db: Session, user: User, w: Workplace) -> dict:
    p = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    latest = _latest(db, w.id)
    base = {"id": w.id, "name": w.name, "region": w.region, "latest": _reading(latest) if latest else None, "level": None, "advice": None}
    if latest and _aware(latest.recorded_at) >= _now() - timedelta(hours=12):
        # advice written for this person: their own conditions can raise the level, and the answer says why
        lv = preventive.heat_check(temp_c=latest.temp_c, humidity_pct=latest.humidity_pct, effort="moderate", conditions=(p.chronic_conditions if p else []) or [], region=w.region)
        base["level"], base["advice"] = lv["level"], lv
    return base


@patient_router.post("/join")
def join(body: JoinIn, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    _hit(f"wjoin:{user.id}", 10, 600, "Too many tries. Please wait a few minutes.")
    w = db.query(Workplace).filter(Workplace.join_code_hash == _h(body.code)).first()
    if not w:
        raise HTTPException(404, "That code is not valid. Ask your occupational health doctor for the current one.")
    if not db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == w.id, WorkplaceMember.user_id == user.id).first():
        db.add(WorkplaceMember(workplace_id=w.id, user_id=user.id)); db.commit()
    return _mine(db, user, w)


@patient_router.get("")
def my_workplaces(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    ids = [m.workplace_id for m in db.query(WorkplaceMember).filter(WorkplaceMember.user_id == user.id).all()]
    ws = db.query(Workplace).filter(Workplace.id.in_(ids)).all() if ids else []
    return {"workplaces": [_mine(db, user, w) for w in ws]}


@patient_router.delete("/{wid}")
def leave(wid: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    n = db.query(WorkplaceMember).filter(WorkplaceMember.workplace_id == wid, WorkplaceMember.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    if not n:
        raise HTTPException(404, "You are not part of this workplace")
    return {"ok": True}
