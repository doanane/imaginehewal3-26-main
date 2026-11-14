from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Boolean, Float, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class SosEvent(Base):
    """One emergency, from first detection to resolution. New tables (not the old emergency_events)
    so no migration is needed on an existing database."""
    __tablename__ = "sos_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    trigger = Column(String, nullable=False)          # manual | auto_vitals
    reason = Column(String, nullable=False)
    severity = Column(String, default="critical")
    status = Column(String, default="pending", index=True)  # pending|active|acknowledged|escalated|cancelled|resolved
    vitals = Column(JSON, nullable=True)              # snapshot that triggered it
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    grace_until = Column(DateTime(timezone=True), nullable=True)   # patient can cancel before this
    attempts = Column(Integer, default=0)             # caregiver alert rounds sent
    next_action_at = Column(DateTime(timezone=True), nullable=True, index=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    location_at = Column(DateTime(timezone=True), nullable=True)
    dispatch_mode = Column(String, default="simulate")  # simulate | live


class SosLog(Base):
    __tablename__ = "sos_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("sos_events.id"), index=True, nullable=False)
    at = Column(DateTime(timezone=True), server_default=func.now())
    kind = Column(String, nullable=False)
    detail = Column(Text, nullable=True)


class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String, nullable=False)
    dose = Column(String, nullable=True)
    times = Column(JSON, nullable=False)               # ["08:00", "20:00"]
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    day = Column(Date, nullable=False, index=True)
    time = Column(String, nullable=False)              # the scheduled "HH:MM"
    status = Column(String, nullable=False)            # taken | skipped
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
