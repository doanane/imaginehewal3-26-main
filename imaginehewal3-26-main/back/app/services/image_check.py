"""Identify an uploaded image from its own bytes.

Phones and the app's fetch layer often send a photo with no content type, or with application/octet-stream, so the header cannot be
trusted either way. The first bytes of the file say what it really is, and that is also what stops a script renamed to .png.
"""
from typing import Optional

EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def sniff_image(data: bytes) -> Optional[str]:
    """'image/jpeg', 'image/png', 'image/webp', or None when it is not one of those."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
