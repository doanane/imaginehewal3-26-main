"""Doctor-led care: appointments, clinical notes, prescriptions, and the phone tokens used for push notifications.

All times are stored in UTC. A prescription creates a normal `Medication` for the patient (so reminders, the daily list and
adherence statistics work with no extra code) and keeps the link, so the doctor can stop it later.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class DoctorAppointment(Base):
    __tablename__ = "doctor_appointments"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_min = Column(Integer, nullable=False, default=30)
    mode = Column(String(12), nullable=False, default="in_person")        # in_person | video | phone
    reason = Column(String(300), nullable=True)
    # requested (patient asked) | confirmed | declined | cancelled | completed
    status = Column(String(12), nullable=False, default="requested")
    requested_by = Column(String(8), nullable=False, default="patient")     # patient | doctor
    doctor_message = Column(String(300), nullable=True)                     # shown to the patient, e.g. why it was declined
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DoctorNote(Base):
    __tablename__ = "doctor_notes"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    shared = Column(Boolean, nullable=False, default=False)                 # private to the doctor unless shared
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_doctor_notes_pair", "doctor_pk", "patient_id", "id"),)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=True)
    name = Column(String(120), nullable=False)
    dose = Column(String(60), nullable=True)
    times = Column(JSON, nullable=False)                                    # ["08:00", "20:00"]
    instructions = Column(String(400), nullable=True)
    status = Column(String(8), nullable=False, default="active")            # active | stopped
    stop_reason = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stopped_at = Column(DateTime(timezone=True), nullable=True)


class PushToken(Base):
    """An Expo push token for one phone. One person can have several phones; a token belongs to the last person who signed in on it."""
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(200), nullable=False, unique=True)
    platform = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CareNote(Base):
    """The shared care log: a note a caregiver writes about the person they care for. The patient and every approved caregiver of that
    patient can read it. The doctor's own notes are separate (DoctorNote) and private unless the doctor shares them."""
    __tablename__ = "care_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
