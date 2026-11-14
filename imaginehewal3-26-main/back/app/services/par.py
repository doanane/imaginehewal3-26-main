"""Run independent database reads at the same time.

With a remote database every query costs a network round trip, so a handler that asks twelve questions one after another waits
twelve round trips. Questions that do not depend on each other can be asked together: the wait is then one round trip, not twelve.

Each function gets its own session (a session is not safe to share between threads) and must return plain values or ORM rows
whose column attributes are already loaded (no lazy relationships), because the session is closed before the result is used.
"""
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, List

from sqlalchemy.orm import Session

from app.database import SessionLocal

_pool = ThreadPoolExecutor(max_workers=32, thread_name_prefix="par")


def _run(fn: Callable[[Session], Any]) -> Any:
    db = SessionLocal()
    try:
        return fn(db)
    finally:
        db.close()


def par(*fns: Callable[[Session], Any]) -> List[Any]:
    """Results come back in the same order as the functions. The first error is raised."""
    if len(fns) == 1:
        return [_run(fns[0])]
    futures = [_pool.submit(_run, fn) for fn in fns]
    return [f.result() for f in futures]
