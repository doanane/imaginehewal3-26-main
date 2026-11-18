"""Profile pictures. They live in Cloudinary (the address is stored on the profile), so they survive restarts and new sign-ins."""
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings

IMAGE_MAGIC = ((b"\xff\xd8\xff", "jpg"), (b"\x89PNG\r\n\x1a\n", "png"), (b"GIF8", "gif"))
MAX_BYTES = 5 * 1024 * 1024


def sniff(head: bytes) -> Optional[str]:
    """The real kind of an image from its first bytes, never from the file name the client sent."""
    for magic, kind in IMAGE_MAGIC:
        if head.startswith(magic):
            return kind
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def absolute(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    base = (getattr(settings, "BASE_URL", "") or "").rstrip("/")
    return f"{base}/{url.lstrip('/')}" if base else url


def doctor_photo(doctor) -> Optional[str]:
    return absolute(getattr(doctor, "profile_image_url", None)) if doctor else None


def user_photo(db: Session, user_id: int) -> Optional[str]:
    from app.models.user import UserProfile
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return absolute(getattr(p, "profile_image_url", None)) if p else None


# A call must never wait on the database in the middle of its hand-shake, so the picture of a connected person is read once when they
# connect (and again when it changes) and kept here for a short while.
import time as _time
_CACHE: dict = {}
TTL = 120.0


def remember(key: int, url: Optional[str]) -> None:
    _CACHE[key] = (url, _time.monotonic() + TTL)


def peek(key: int) -> Optional[str]:
    """What we last knew, without touching the database."""
    hit = _CACHE.get(key)
    return hit[0] if hit else None


def forget(key: int) -> None:
    """Called when a picture is added, changed or removed."""
    _CACHE.pop(key, None)


def stale(key: int) -> bool:
    hit = _CACHE.get(key)
    return not hit or hit[1] < _time.monotonic()
