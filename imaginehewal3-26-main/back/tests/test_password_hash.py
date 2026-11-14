#!/usr/bin/env python3
"""Test password hashing to debug login issues"""

from app.auth.hashing import get_password_hash, verify_password

# Test password hashing consistency
test_password = 'TestPassword123!'
hashed = get_password_hash(test_password)

print(f"Original password: {test_password}")
print(f"Hashed password: {hashed}")
print(f"Hash length: {len(hashed)}")
print(f"Verification result: {verify_password(test_password, hashed)}")
print(f"Wrong password verification: {verify_password('WrongPassword123!', hashed)}")

# Test with email format password
email_password = "mypassword@123"
email_hashed = get_password_hash(email_password)
print(f"\nEmail password: {email_password}")
print(f"Email hashed: {email_hashed}")
print(f"Email verification: {verify_password(email_password, email_hashed)}")
