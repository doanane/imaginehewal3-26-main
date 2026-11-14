from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date, timezone
import logging

from app.database import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.models.caregiver import CaregiverRelationship
from app.models.health import HealthData
from app.models.caregiver_tasks import CaregiverTask, TaskStatus
from app.models.caregiver_schedule import CaregiverSchedule, AppointmentStatus
from app.schemas.caregiver_dashboard import (
    CaregiverDashboardResponse, DashboardStats, PatientOverview,
    TaskOverview, AppointmentOverview, AlertItem, VitalTrend
)
from app.utils.enum_value import ev

router = APIRouter(prefix="/caregivers", tags=["caregiver_dashboard"])
logger = logging.getLogger(__name__)

@router.get("/dashboard", response_model=CaregiverDashboardResponse)
def get_caregiver_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not getattr(current_user, 'is_caregiver', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a caregiver"
        )
    
    relationships = db.query(CaregiverRelationship).filter(
        CaregiverRelationship.caregiver_id == current_user.id,
        CaregiverRelationship.status == "approved"
    ).all()
    
    patient_ids = [rel.patient_id for rel in relationships]
    patients = db.query(User).filter(User.id.in_(patient_ids)).all()
    
    rows = _care_rows(patient_ids, db)
    stats = calculate_dashboard_stats(current_user.id, patient_ids, db, rows)
    recent_patients = get_recent_patients(patients, db, rows)
    upcoming_tasks = get_upcoming_tasks(current_user.id, db)
    todays_appointments = get_todays_appointments(current_user.id, db)
    recent_alerts = get_recent_alerts(patient_ids, db)
    vital_trends = get_vital_trends(patient_ids, db)
    
    caregiver_info = {
        "id": current_user.id,
        "name": f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip(),
        "email": current_user.email,
        "caregiver_id": getattr(current_user, 'caregiver_id', None),
        "phone": current_user.phone_number,
        "experience_years": getattr(current_user, 'experience_years', 0)
    }
    
    return CaregiverDashboardResponse(
        stats=stats,
        recent_patients=recent_patients,
        upcoming_tasks=upcoming_tasks,
        todays_appointments=todays_appointments,
        recent_alerts=recent_alerts,
        vital_trends=vital_trends,
        caregiver_info=caregiver_info,
        last_updated=datetime.now(timezone.utc)
    )

def _care_rows(patient_ids: List[int], db: Session):
    """(user, profile, snapshot) for each patient, most urgent first."""
    from app.models.user import UserProfile
    from app.services.care_snapshot import snapshot
    if not patient_ids:
        return []
    order = {"critical": 0, "monitor": 1, "stable": 2, "no_data": 3}
    rows = []
    for u in db.query(User).filter(User.id.in_(patient_ids)).all():
        prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        rows.append((u, prof, snapshot(db, u, prof)))
    rows.sort(key=lambda r: (order[r[2]["status"]], r[2]["name"].lower()))
    return rows


def _latest_progress_score(patient_ids: List[int], db: Session) -> int:
    from app.models.health import WeeklyProgress
    scores = []
    for pid in patient_ids:
        w = db.query(WeeklyProgress).filter(WeeklyProgress.user_id == pid).order_by(WeeklyProgress.week_start_date.desc()).first()
        if w and w.progress_score is not None:
            scores.append(w.progress_score)
    return round(sum(scores) / len(scores)) if scores else 0


def calculate_dashboard_stats(caregiver_id: int, patient_ids: List[int], db: Session, rows=None) -> DashboardStats:
    rows = rows if rows is not None else _care_rows(patient_ids, db)
    now = datetime.now(timezone.utc)
    pending_tasks = db.query(CaregiverTask).filter(
        CaregiverTask.caregiver_id == caregiver_id,
        CaregiverTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])).count()
    completed_tasks = db.query(CaregiverTask).filter(
        CaregiverTask.caregiver_id == caregiver_id, CaregiverTask.status == TaskStatus.COMPLETED,
        CaregiverTask.completed_at >= now - timedelta(days=7)).count()
    overdue_tasks = db.query(CaregiverTask).filter(
        CaregiverTask.caregiver_id == caregiver_id,
        CaregiverTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
        CaregiverTask.due_date < now).count()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(microseconds=1)
    todays = db.query(CaregiverSchedule).filter(
        CaregiverSchedule.caregiver_id == caregiver_id, CaregiverSchedule.start_time.between(today_start, today_end)).count()
    weekly = db.query(CaregiverSchedule).filter(
        CaregiverSchedule.caregiver_id == caregiver_id,
        CaregiverSchedule.start_time.between(today_start, today_end + timedelta(days=7))).count()
    return DashboardStats(
        total_patients=len(patient_ids),
        active_patients=sum(1 for r in rows if r[2]["status"] != "no_data"),
        critical_patients=sum(1 for r in rows if r[2]["status"] == "critical"),
        pending_tasks=pending_tasks, completed_tasks=completed_tasks, overdue_tasks=overdue_tasks,
        todays_appointments=todays, weekly_appointments=weekly,
        avg_health_score=_latest_progress_score(patient_ids, db))


def get_recent_patients(patients, db: Session, rows=None) -> List[PatientOverview]:
    rows = rows if rows is not None else _care_rows([p.id for p in patients], db)
    out = []
    for u, prof, snap in rows[:30]:
        vit = snap["vitals"]
        out.append(PatientOverview(
            id=u.id, name=snap["name"], email=u.email or "", patient_id=u.patient_id or f"PAT{u.id:06d}",
            age=snap["age"], gender=snap["gender"], status=snap["status"],
            health_score=_latest_progress_score([u.id], db) or None,
            last_checkup=vit["at"], conditions=snap["conditions"],
            recent_vitals={"heart_rate": vit["heart_rate"], "blood_oxygen": vit["blood_oxygen"],
                           "blood_pressure": (f"{vit['systolic']}/{vit['diastolic']}" if vit["systolic"] and vit["diastolic"] else None),
                           "blood_glucose": vit["glucose"], "steps": vit["steps"]}))
    return out


def get_upcoming_tasks(caregiver_id: int, db: Session) -> List[TaskOverview]:
    tasks = db.query(CaregiverTask).filter(
        CaregiverTask.caregiver_id == caregiver_id,
        CaregiverTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
    ).order_by(CaregiverTask.due_date).limit(10).all()
    
    return [
        TaskOverview(
            id=task.id,
            title=task.title,
            patient_id=task.patient_id,
            patient_name=task.patient.username if task.patient else "Unknown",
            task_type=task.task_type,
            status=ev(task.status),
            priority=ev(task.priority),
            due_date=task.due_date,
            is_overdue=task.is_overdue()
        )
        for task in tasks
    ]

def get_todays_appointments(caregiver_id: int, db: Session) -> List[AppointmentOverview]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(microseconds=1)
    
    appointments = db.query(CaregiverSchedule).filter(
        CaregiverSchedule.caregiver_id == caregiver_id,
        CaregiverSchedule.start_time.between(today_start, today_end),
        CaregiverSchedule.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED])
    ).order_by(CaregiverSchedule.start_time).all()
    
    return [
        AppointmentOverview(
            id=appointment.id,
            title=appointment.title,
            patient_id=appointment.patient_id,
            patient_name=appointment.patient.username if appointment.patient else "Unknown",
            appointment_type=ev(appointment.appointment_type),
            status=ev(appointment.status),
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            location=appointment.location,
            is_virtual=appointment.is_virtual
        )
        for appointment in appointments
    ]

def get_recent_alerts(patient_ids: List[int], db: Session) -> List[AlertItem]:
    from app.models.notification import Notification
    from app.models.safety import SosEvent
    from app.services.emergency_service import OPEN
    if not patient_ids:
        return []
    from app.models.user import UserProfile
    names = {u.id: (u.username or u.email) for u in db.query(User).filter(User.id.in_(patient_ids)).all()}
    for prof in db.query(UserProfile).filter(UserProfile.user_id.in_(patient_ids)).all():
        if prof.full_name:
            names[prof.user_id] = prof.full_name
    items = []
    for e in (db.query(SosEvent).filter(SosEvent.user_id.in_(patient_ids), SosEvent.status.in_(OPEN))
              .order_by(SosEvent.id.desc()).limit(10).all()):
        items.append(AlertItem(id=e.id, type="critical", title="Emergency", message=e.reason,
                               patient_id=e.user_id, patient_name=names.get(e.user_id, "Patient"), timestamp=e.created_at, is_read=False))
    for n in (db.query(Notification).filter(Notification.user_id.in_(patient_ids), Notification.notification_type.in_(["critical", "warning"]))
              .order_by(Notification.created_at.desc()).limit(5).all()):
        items.append(AlertItem(id=n.id, type=n.notification_type, title=n.title or "Alert", message=n.message or "",
                               patient_id=n.user_id, patient_name=names.get(n.user_id, "Patient"), timestamp=n.created_at, is_read=bool(n.is_read)))
    return items[:10]


def get_vital_trends(patient_ids: List[int], db: Session) -> List[VitalTrend]:
    from app.models.iot_device import VitalReading
    if not patient_ids:
        return []
    now = datetime.now(timezone.utc)
    trends = []
    for metric, col, unit in (("Heart Rate", VitalReading.heart_rate, "bpm"), ("Blood Oxygen", VitalReading.blood_oxygen, "%")):
        def avg(start, end, col=col):
            vals = [v for (v,) in db.query(col).filter(VitalReading.user_id.in_(patient_ids), col.isnot(None),
                                                       VitalReading.timestamp >= start, VitalReading.timestamp < end).all()]
            return sum(vals) / len(vals) if vals else None
        now_avg = avg(now - timedelta(hours=24), now + timedelta(minutes=1))
        before = avg(now - timedelta(hours=48), now - timedelta(hours=24))
        if now_avg is None:
            continue
        change = ((now_avg - before) / before * 100) if before else 0.0
        trends.append(VitalTrend(metric=metric, current_value=round(now_avg, 1), unit=unit,
                                 trend="up" if change > 3 else "down" if change < -3 else "stable",
                                 change_percentage=round(change, 1), last_updated=now))
    return trends
