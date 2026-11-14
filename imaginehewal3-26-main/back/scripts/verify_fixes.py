import logging
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, create_tables, engine
from app.models.user import User
from app.models.caregiver import CaregiverRelationship
from app.auth.hashing import get_password_hash

# Disable logging to keep output clean
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logging.getLogger('app.database').setLevel(logging.WARNING)

def setup_test_data():
    db = SessionLocal()
    try:
        # Create a test patient
        patient_email = "test_patient@example.com"
        patient = db.query(User).filter(User.email == patient_email).first()
        if not patient:
            patient = User(
                email=patient_email,
                username="test_patient",
                hashed_password=get_password_hash("TestPass123!"),
                is_active=True,
                is_caregiver=False,
                patient_id="P_TEST_123"
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
            print(f"✅ Created test patient: {patient.email} (ID: {patient.id})")
        else:
            print(f"ℹ️ Test patient already exists: {patient.email} (ID: {patient.id})")
            
        # Create a test caregiver
        caregiver_email = "test_caregiver@example.com"
        caregiver = db.query(User).filter(User.email == caregiver_email).first()
        if not caregiver:
            caregiver = User(
                email=caregiver_email,
                username="test_caregiver",
                hashed_password=get_password_hash("TestPass123!"),
                is_active=True,
                is_caregiver=True,
                caregiver_id="C_TEST_123"
            )
            db.add(caregiver)
            db.commit()
            db.refresh(caregiver)
            print(f"✅ Created test caregiver: {caregiver.email} (ID: {caregiver.id})")
        else:
            print(f"ℹ️ Test caregiver already exists: {caregiver.email} (ID: {caregiver.id})")
            
        return patient.id, caregiver.id
    finally:
        db.close()

def verify_persistence():
    print("\n--- Verifying Persistence ---")
    # Simulate restart by calling create_tables (which used to drop tables)
    create_tables()
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if len(users) >= 2:
            print(f"✅ Persistence verified: {len(users)} users found after 'restart'")
            return True
        else:
            print(f"❌ Persistence failed: Only {len(users)} users found")
            return False
    finally:
        db.close()

def verify_connection_by_id(patient_id, caregiver_id):
    print("\n--- Verifying Connection by ID ---")
    db = SessionLocal()
    try:
        # Simulate the logic in the endpoint
        # We'll use the patient's numeric ID as a string, just like the endpoint receives
        patient_id_str = str(patient_id)
        
        # Search logic from caregivers.py
        patient = db.query(User).filter(
            (User.caregiver_id == patient_id_str) | 
            (User.patient_id == patient_id_str)
        ).first()
        
        if not patient:
            try:
                numeric_id = int(patient_id_str)
                patient = db.query(User).filter(User.id == numeric_id).first()
            except ValueError:
                pass
        
        if patient and patient.id == patient_id:
            print(f"✅ Connection by ID verified: Found patient {patient.email} using numeric ID {patient_id_str}")
            return True
        else:
            print(f"❌ Connection by ID failed: Could not find patient using numeric ID {patient_id_str}")
            return False
    finally:
        db.close()

if __name__ == "__main__":
    p_id, c_id = setup_test_data()
    if verify_persistence() and verify_connection_by_id(p_id, c_id):
        print("\n✨ ALL TESTS PASSED ✨")
    else:
        print("\n💥 SOME TESTS FAILED 💥")
        exit(1)
