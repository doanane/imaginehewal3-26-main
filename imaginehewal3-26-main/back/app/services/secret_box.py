"""Encrypts small secrets (third-party tokens) before they are stored, so a copy of the database alone does not expose them.

The key is derived from SECRET_KEY, which the app already refuses to start without. Changing SECRET_KEY makes stored tokens unreadable,
which simply means the person reconnects.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("secret-box:" + settings.SECRET_KEY).encode()).digest()))


def seal(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def unseal(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("stored secret cannot be read") from e
