"""Tiny in-memory sliding-window limiter for write actions (posts, comments). Use Redis if you run more than one instance."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

_lock = threading.Lock()
_hits = defaultdict(deque)


def hit(key: str, limit: int, window_s: int, message: str = "You are doing that too quickly. Please wait a little.") -> None:
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, message, headers={"Retry-After": str(window_s)})
        q.append(now)


def check(key: str, limit: int, window_s: int, message: str = "You are doing that too quickly. Please wait a little.") -> None:
    """Raise if the key is already at its limit, without counting this attempt."""
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, message, headers={"Retry-After": str(window_s)})


def record(key: str) -> None:
    with _lock:
        _hits[key].append(time.time())


def reset() -> None:
    with _lock:
        _hits.clear()
