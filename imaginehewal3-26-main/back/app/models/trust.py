from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from app.database import Base


class AccessLog(Base):
    """Who looked at a patient's data, and when. Shown to the patient in the privacy centre."""
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    viewer_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    viewer_role = Column(String, default="caregiver")
    resource = Column(String, nullable=False)      # risk_summary | analytics | emergency | clinician_summary
    at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class DoctorAccessLog(Base):
    """A doctor opened a patient's record. Shown to the patient in the privacy centre next to caregiver access (HIPAA audit controls: who accessed what, when)."""
    __tablename__ = "doctor_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), index=True, nullable=False)
    resource = Column(String, nullable=False, default="record")
    at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class WellbeingCheckin(Base):
    """PHQ-2 and GAD-2 answers (public-domain screeners). Private to the user: never shown to caregivers."""
    __tablename__ = "wellbeing_checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    answers = Column(JSON, nullable=False)          # four integers 0..3
    phq2 = Column(Integer, nullable=False)
    gad2 = Column(Integer, nullable=False)
    safety_flag = Column(Boolean, default=False)    # answered yes to the separate safety question
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
