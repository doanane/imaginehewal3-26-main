import logging
# Disable sqlalchemy logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    users = db.query(User).all()
    with open("user_list.txt", "w") as f:
        f.write("\n" + "="*100 + "\n")
        f.write(f"{'ID':<5} | {'Email':<30} | {'Patient ID':<20} | {'Caregiver ID':<20} | {'Is Caregiver':<15}\n")
        f.write("-" * 100 + "\n")
        for user in users:
            email = str(user.email) if user.email else "None"
            p_id = str(user.patient_id) if user.patient_id else "None"
            c_id = str(user.caregiver_id) if user.caregiver_id else "None"
            is_c = str(user.is_caregiver)
            f.write(f"{user.id:<5} | {email:<30} | {p_id:<20} | {c_id:<20} | {is_c:<15}\n")
        f.write("="*100 + "\n")
    print("User list written to user_list.txt")
finally:
    db.close()
