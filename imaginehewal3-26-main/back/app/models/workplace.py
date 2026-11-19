"""Workplace heat safety and family-member entries.

A workplace belongs to an occupational-health doctor. Staff join with a code (their own choice; they can leave any time). The doctor, or a sensor that
holds the site key, records the temperature and humidity of the site. The site shows only counts, and a count under 5 is hidden: an employer never
sees an individual's health. Readings are never invented: with no reading, the site shows none.
"""
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Workplace(Base):
    __tablename__ = "workplaces"

    id = Column(Integer, primary_key=True, index=True)
    doctor_pk = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    region = Column(String(4), nullable=False, default="ae")                 # gh | ae
    join_code_hash = Column(String(64), nullable=False, unique=True, index=True)
    site_key_hash = Column(String(64), nullable=True, unique=True, index=True)
    last_alert_at = Column(DateTime(timezone=True), nullable=True)
    last_alert_level = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkplaceMember(Base):
    __tablename__ = "workplace_members"

    id = Column(Integer, primary_key=True, index=True)
    workplace_id = Column(Integer, ForeignKey("workplaces.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ux_workplace_member", "workplace_id", "user_id", unique=True),)


class SiteReading(Base):
    __tablename__ = "site_readings"

    id = Column(Integer, primary_key=True, index=True)
    workplace_id = Column(Integer, ForeignKey("workplaces.id"), nullable=False, index=True)
    temp_c = Column(Float, nullable=False)
    humidity_pct = Column(Float, nullable=False)
    source = Column(String(10), nullable=False, default="manual")            # manual | sensor
    note = Column(String(200), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class DependentEntry(Base):
    """A dated entry in a family member's own record: a vaccine, a test result or a visit. Written by the guardian only."""
    __tablename__ = "dependent_entries"

    id = Column(Integer, primary_key=True, index=True)
    dependent_id = Column(Integer, ForeignKey("dependents.id"), nullable=False, index=True)
    guardian_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(10), nullable=False)                                # vaccine | result | visit
    title = Column(String(120), nullable=False)
    detail = Column(String(400), nullable=True)
    on_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
