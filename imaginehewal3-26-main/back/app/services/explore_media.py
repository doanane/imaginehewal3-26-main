"""Picture links for the Explore screens. The pictures live on our Cloudinary account; `scripts/seed_explore.py` uploads them and writes the links."""
import json
import os
from functools import lru_cache
from typing import Optional

_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "explore_media.json")


@lru_cache(maxsize=1)
def _all() -> dict:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:                      # no pictures uploaded yet: the screens show a plain tile instead
        return {}


def url(key: str) -> Optional[str]:
    return (_all().get(key) or {}).get("url")


def credit(key: str) -> Optional[str]:
    return (_all().get(key) or {}).get("credit")
