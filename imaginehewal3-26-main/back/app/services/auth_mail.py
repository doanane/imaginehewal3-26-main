"""Tokens and 6-digit codes behind the emailed flows (verify email, reset password).

- A link token and a short code are issued together; either one completes the flow. Both are STORED HASHED (HMAC-SHA256 with the server secret),
  so a copy of the database does not hand out working links or codes. Old plain-text tokens issued before this change still work until they expire.
- A short code is only 6 digits, so guessing is limited: 5 wrong tries per address per 15 minutes, then the code is destroyed and a new one must be requested.
- Asking for emails is limited per address and per network address, so nobody can use HEWAL3 to flood a mailbox or burn the SendGrid quota.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.auth import EmailVerificationToken, PasswordResetToken
from app.models.user import User
from app.services import simple_limiter

CODE_MINUTES = 10                                       # every emailed code and link: verification, password reset and sign-in
VERIFY_TTL = timedelta(minutes=CODE_MINUTES)
RESET_TTL = timedelta(minutes=CODE_MINUTES)
MAX_WRONG_CODES = 5
WRONG_CODE_WINDOW = 900
TOO_MANY = "Too many requests. Please wait a little and try again."


def norm(email: Optional[str]) -> str:
    return (email or "").lower().strip()


def h(value: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def new_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def _code_hash(email: str, code: str, purpose: str) -> str:
    return h(f"{purpose}:{norm(email)}:{code}")


def user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(User.email) == norm(email)).first()


def display_name(user: User) -> str:
    return user.first_name or user.username or (user.email or "").split("@")[0] or "there"


# ---- limits
def limit_requests(kind: str, email: str, request: Optional[Request], per_address: int, window: int) -> None:
    """Raises 429. The same answer for an address that has no account, so it reveals nothing."""
    simple_limiter.hit(f"mail:{kind}:{norm(email)}", per_address, window, TOO_MANY)
    ip = request.client.host if request is not None and request.client else "unknown"
    simple_limiter.hit(f"mailip:{ip}", 30, 3600, TOO_MANY)


def guard_codes(db: Session, purpose: str, email: str) -> None:
    """Call before checking a code. After 5 wrong tries the pending codes are destroyed and the caller must ask for a new one."""
    try:
        simple_limiter.check(f"wrong:{purpose}:{norm(email)}", MAX_WRONG_CODES, WRONG_CODE_WINDOW, "Too many wrong codes. Please ask for a new code.")
    except HTTPException:
        destroy_pending(db, purpose, email)
        raise


def wrong_code(purpose: str, email: str) -> None:
    simple_limiter.record(f"wrong:{purpose}:{norm(email)}")


def destroy_pending(db: Session, purpose: str, email: str) -> None:
    if purpose == "verify":
        u = user_by_email(db, email)
        if u:
            db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.id).delete()
    elif purpose == "reset":
        db.query(PasswordResetToken).filter(func.lower(PasswordResetToken.email) == norm(email)).delete(synchronize_session=False)
    db.commit()


# ---- verification
def issue_verification(db: Session, user: User) -> Tuple[str, str]:
    """A new link token and code for this user. Returns the RAW values to email.
    An earlier email stays valid until its own 10 minutes are over, so asking again never breaks the email you already have.
    Expired ones are cleared here, and the request limit (3 an hour) keeps the number of live codes small."""
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id, EmailVerificationToken.expires_at <= datetime.utcnow()).delete()
    raw, code = secrets.token_urlsafe(32), new_code()
    until = datetime.utcnow() + VERIFY_TTL
    db.add(EmailVerificationToken(user_id=user.id, token=h(raw), expires_at=until))
    db.add(EmailVerificationToken(user_id=user.id, token=_code_hash(user.email, code, "verify"), expires_at=until))
    db.commit()
    return raw, code


def verification_by_token(db: Session, raw: str) -> Optional[EmailVerificationToken]:
    return db.query(EmailVerificationToken).filter(EmailVerificationToken.token.in_([h(raw), raw]), EmailVerificationToken.expires_at > datetime.utcnow()).first()


def verification_by_code(db: Session, user: User, code: str) -> Optional[EmailVerificationToken]:
    return db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id, EmailVerificationToken.token == _code_hash(user.email, code, "verify"),
                                                   EmailVerificationToken.expires_at > datetime.utcnow()).first()


def mark_verified(db: Session, user: User) -> None:
    user.is_email_verified = True
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
    db.commit()


# ---- password reset
def issue_reset(db: Session, email: str) -> Tuple[str, str]:
    email = norm(email)
    db.query(PasswordResetToken).filter(func.lower(PasswordResetToken.email) == email, PasswordResetToken.expires_at <= datetime.utcnow()).delete(synchronize_session=False)
    raw, code = secrets.token_urlsafe(32), new_code()
    until = datetime.utcnow() + RESET_TTL
    db.add(PasswordResetToken(email=email, token=h(raw), expires_at=until, is_used=False))
    db.add(PasswordResetToken(email=email, token=_code_hash(email, code, "reset"), expires_at=until, is_used=False))
    db.commit()
    return raw, code


def reset_by_token(db: Session, raw: str) -> Optional[PasswordResetToken]:
    return db.query(PasswordResetToken).filter(PasswordResetToken.token.in_([h(raw), raw]), PasswordResetToken.is_used == False,  # noqa: E712
                                               PasswordResetToken.expires_at > datetime.utcnow()).first()


def reset_by_code(db: Session, email: str, code: str) -> Optional[PasswordResetToken]:
    return db.query(PasswordResetToken).filter(PasswordResetToken.token == _code_hash(email, code, "reset"), PasswordResetToken.is_used == False,  # noqa: E712
                                               PasswordResetToken.expires_at > datetime.utcnow()).first()
