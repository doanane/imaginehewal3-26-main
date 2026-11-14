"""Password hashing using the bcrypt library directly.

passlib 1.7.x breaks with bcrypt >= 4.1 ("password cannot be longer than 72 bytes" during backend
detection), so we avoid it. Output is standard $2b$ bcrypt, so hashes created earlier with passlib
still verify. Passwords are truncated to 71 bytes exactly as before, to keep old hashes valid.
"""
import logging

import bcrypt

logger = logging.getLogger(__name__)

_MAX_BYTES = 71


def _prep(password: str) -> bytes:
    return password.encode("utf-8")[:_MAX_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_prep(plain_password), hashed_password.encode("utf-8"))
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False


def get_password_hash(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty")
    return bcrypt.hashpw(_prep(password), bcrypt.gensalt()).decode("utf-8")
