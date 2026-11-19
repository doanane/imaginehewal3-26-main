"""The person's health record: allergies, laboratory results, radiology reports, immunisations, insurance, dependents and hospital visits.

Who writes what: the patient records allergies, immunisations, insurance and dependents (labelled source "patient"); a doctor
records laboratory results, radiology reports, visits (check-in and check-out) and may add allergies and immunisations
(source "doctor"). Nothing here is ever filled in by the system. All times are UTC.
"""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class PatientAllergy(Base):
    __tablename__ = "patient_allergies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    substance = Column(String(120), nullable=False)
    reaction = Column(String(200), nullable=True)
    severity = Column(String(10), nullable=False, default="mild")          # mild | moderate | severe
    source = Column(String(8), nullable=False, default="patient")          # patient | doctor
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    test = Column(String(120), nullable=False)
    value = Column(String(60), nullable=False)
    unit = Column(String(30), nullable=True)
    ref_range = Column(String(60), nullable=True)
    flag = Column(String(10), nullable=False, default="normal")            # normal | low | high | critical
    taken_at = Column(DateTime(timezone=True), nullable=False)
    note = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_lab_results_user_time", "user_id", "taken_at"),)


class RadiologyReport(Base):
    __tablename__ = "radiology_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    modality = Column(String(12), nullable=False)                          # xray | ct | mri | ultrasound | mammogram | other
    body_part = Column(String(80), nullable=False)
    facility = Column(String(120), nullable=True)
    performed_at = Column(DateTime(timezone=True), nullable=False)
    findings = Column(Text, nullable=True)
    impression = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)                         # an address the doctor attached (https only)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_radiology_user_time", "user_id", "performed_at"),)


class Immunisation(Base):
    __tablename__ = "immunisations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    vaccine = Column(String(120), nullable=False)
    dose = Column(String(30), nullable=True)
    given_on = Column(Date, nullable=False)
    facility = Column(String(120), nullable=True)
    source = Column(String(8), nullable=False, default="patient")          # patient | doctor
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    provider = Column(String(120), nullable=False)
    plan = Column(String(120), nullable=True)
    member_no = Column(String(60), nullable=True)
    valid_until = Column(Date, nullable=True)
    coverage_notes = Column(String(400), nullable=True)                    # written by the patient from their own card
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Dependent(Base):
    __tablename__ = "dependents"

    id = Column(Integer, primary_key=True, index=True)
    guardian_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    relationship = Column(String(30), nullable=False)                      # child | parent | spouse | other
    birth_date = Column(Date, nullable=True)
    sex = Column(String(10), nullable=True)
    allergies = Column(String(300), nullable=True)
    conditions = Column(String(300), nullable=True)
    notes = Column(String(400), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CareVisit(Base):
    """A hospital or clinic visit: the doctor checks the patient in and later out (with a short discharge summary)."""
    __tablename__ = "care_visits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    facility = Column(String(120), nullable=True)
    kind = Column(String(12), nullable=False, default="clinic")            # clinic | emergency | admission
    reason = Column(String(300), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=False)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    summary = Column(Text, nullable=True)


class RecordShare(Base):
    """A time-limited code the patient gives to another clinic. The code is stored only as a hash. Every use is logged and the patient can revoke it."""
    __tablename__ = "record_shares"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code_hash = Column(String(64), nullable=False, unique=True, index=True)
    label = Column(String(120), nullable=True)                              # who it is for, e.g. "City Hospital"
    expires_at = Column(DateTime(timezone=True), nullable=False)
    max_uses = Column(Integer, nullable=False, default=3)
    uses = Column(Integer, nullable=False, default=0)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RecordShareUse(Base):
    __tablename__ = "record_share_uses"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(Integer, ForeignKey("record_shares.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    used_at = Column(DateTime(timezone=True), server_default=func.now())
