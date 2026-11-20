"""Keep the hosted service from going to sleep.

Free hosting stops a service that has had no requests for about 15 minutes, and the next visitor waits about a minute while it starts again.
While the service is awake, this asks for its own public /ping page every 15 seconds, which counts as a visit and so stops it from falling asleep.
It cannot wake a service that is already asleep: for that, the scheduled check in .github/workflows/keep-alive.yml (or any outside uptime monitor)
visits it from outside.

Only runs when the host gives the service its public address (Render sets RENDER_EXTERNAL_URL). Turn it off with KEEP_AWAKE=0. Nothing personal is sent.
"""
import logging
import os
import threading
import time
import urllib.request

logger = logging.getLogger(__name__)
INTERVAL_S = max(5, int(os.getenv("KEEP_AWAKE_SECONDS", "15")))        # every 15 seconds unless KEEP_AWAKE_SECONDS says otherwise


def _loop(url: str) -> None:
    while True:
        time.sleep(INTERVAL_S)
        try:
            urllib.request.urlopen(url, timeout=30).read(64)
        except Exception as e:                                   # a failed ping is not a problem: the next one tries again
            logger.warning("Keep-awake ping failed: %s", e)


def start() -> bool:
    base = (os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
    if not base or os.getenv("KEEP_AWAKE", "1") == "0":
        return False
    threading.Thread(target=_loop, args=(base + "/ping",), daemon=True, name="keep-awake").start()
    logger.info("Keep-awake ping started for %s", base)
    return True
