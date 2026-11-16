"""A doctor asks to follow a patient, and the patient decides. Nothing is shared until the patient accepts."""
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class DoctorLinkRequest(Base):
    __tablename__ = "doctor_link_requests"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String(200), nullable=True)               # an optional line from the doctor ("We spoke at the clinic on Monday")
    status = Column(String(10), default="pending")             # pending | accepted | declined | cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_doctor_link_pair", "doctor_pk", "patient_id", "status"),)
