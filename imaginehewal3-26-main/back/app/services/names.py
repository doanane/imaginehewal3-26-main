"""One way to show a person's name, so a doctor never sees the word "Patient" when we know who it is.
Order: the full name on their profile, then first and last name, then the username, then the part of the email before the @."""
from typing import Optional


def person_name(user, profile=None, fallback: str = "Patient") -> str:
    if profile is not None and getattr(profile, "full_name", None) and profile.full_name.strip():
        return profile.full_name.strip()
    if user is None:
        return fallback
    both = f"{getattr(user, 'first_name', None) or ''} {getattr(user, 'last_name', None) or ''}".strip()
    if both:
        return both
    if getattr(user, "username", None):
        return user.username
    local = (getattr(user, "email", None) or "").split("@")[0]
    return local or fallback


def lookup(db, user_id: int, fallback: str = "Patient") -> str:
    from app.models.user import User, UserProfile
    u = db.query(User).filter(User.id == user_id).first()
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return person_name(u, p, fallback)
