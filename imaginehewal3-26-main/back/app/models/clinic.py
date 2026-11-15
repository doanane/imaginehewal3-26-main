"""The doctor's clinic workflow: a consultation (a SOAP note with diagnoses and the vitals taken in the room) and the documents a doctor issues
(referral letters, sick notes, letters). A signed consultation is locked: later changes are addenda, so the record shows what was written and when.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("doctor_appointments.id"), nullable=True)
    status = Column(String(8), nullable=False, default="draft")                  # draft | signed
    complaint = Column(String(300), nullable=True)                               # why they came, in the patient's words
    subjective = Column(Text, nullable=True)                                     # history
    objective = Column(Text, nullable=True)                                      # examination and results
    assessment = Column(Text, nullable=True)
    plan = Column(Text, nullable=True)
    diagnoses = Column(JSON, nullable=True)                                      # [{"code": "I10", "label": "..."}]
    clinic_vitals = Column(JSON, nullable=True)                                  # taken in the room: systolic, diastolic, heart_rate, spo2, temperature, weight, glucose
    follow_up_at = Column(DateTime(timezone=True), nullable=True)
    share_plan = Column(Boolean, nullable=False, default=False)                 # the plan is sent to the patient as a shared note when signed
    addenda = Column(JSON, nullable=True)                                        # [{"text": "...", "at": iso}] after signing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    signed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_consultations_pair", "doctor_pk", "patient_id", "id"),)


class ClinicDocument(Base):
    __tablename__ = "clinic_documents"

    id = Column(Integer, primary_key=True, index=True)
    ref = Column(String(20), unique=True, index=True, nullable=False)           # printed on the page so a third party can check it is genuine
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    kind = Column(String(12), nullable=False)                                    # referral | sick_note | letter
    title = Column(String(160), nullable=False)
    body = Column(JSON, nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
