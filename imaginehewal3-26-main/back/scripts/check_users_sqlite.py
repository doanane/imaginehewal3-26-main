import sqlite3
import os

db_path = "hewal3.db"
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, email, patient_id, caregiver_id, is_caregiver FROM users")
    users = cursor.fetchall()
    
    with open("user_list.txt", "w") as f:
        f.write("\n" + "="*100 + "\n")
        f.write(f"{'ID':<5} | {'Email':<30} | {'Patient ID':<20} | {'Caregiver ID':<20} | {'Is Caregiver':<15}\n")
        f.write("-" * 100 + "\n")
        for user in users:
            uid, email, p_id, c_id, is_c = user
            f.write(f"{uid:<5} | {str(email):<30} | {str(p_id):<20} | {str(c_id):<20} | {str(is_c):<15}\n")
        f.write("="*100 + "\n")
    print("User list written to user_list.txt")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
