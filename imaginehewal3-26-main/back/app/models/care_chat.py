"""Chat between a doctor and a patient who has linked them. Doctors are not rows in `users`, so this has its own table."""
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class DoctorMessage(Base):
    __tablename__ = "doctor_messages"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(8), nullable=False)          # "doctor" or "patient"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_doctor_messages_pair", "doctor_pk", "patient_id", "id"),)
