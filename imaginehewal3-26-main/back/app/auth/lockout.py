"""Brute-force protection for login (OWASP A07).

Two limits over a sliding 15-minute window:
- 5 failures per (email, IP): stops guessing from one place without letting an attacker lock a victim out
- 20 failures per email overall: slows distributed guessing against one account
In-memory (single instance). Use Redis if you scale out.
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

WINDOW_S = 15 * 60
MAX_PER_PAIR = 5
MAX_PER_EMAIL = 20

_lock = threading.Lock()
_pair = defaultdict(deque)
_email = defaultdict(deque)


def _prune(q: deque, now: float) -> None:
    while q and now - q[0] > WINDOW_S:
        q.popleft()


def check(email: str, ip: str) -> None:
    now = time.time()
    with _lock:
        for q, limit in ((_pair[(email, ip)], MAX_PER_PAIR), (_email[email], MAX_PER_EMAIL)):
            _prune(q, now)
            if len(q) >= limit:
                wait = int(WINDOW_S - (now - q[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many failed attempts. Try again in {max(1, wait // 60)} minute(s).",
                    headers={"Retry-After": str(wait)})


def record_failure(email: str, ip: str) -> None:
    now = time.time()
    with _lock:
        _pair[(email, ip)].append(now)
        _email[email].append(now)


def clear(email: str, ip: str) -> None:
    with _lock:
        _pair.pop((email, ip), None)


def reset_all() -> None:  # for tests
    with _lock:
        _pair.clear()
        _email.clear()
