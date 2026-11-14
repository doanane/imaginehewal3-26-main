import sqlite3
import os

db_path = "hewal3.db"
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Admins:")
    cursor.execute("SELECT * FROM admins")
    admins = cursor.fetchall()
    for admin in admins:
        print(admin)
        
    print("\nDoctors:")
    cursor.execute("SELECT * FROM doctors")
    doctors = cursor.fetchall()
    for doctor in doctors:
        print(doctor)
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
