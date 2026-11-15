"""In-process realtime hub: maps user_id -> open WebSocket connections and pushes events to them.

Single-instance by design (fine for a pilot/demo). To scale horizontally, back `send` with Redis pub/sub.
Events are plain dicts: {"type": "message.new" | "notification.new" | "vitals.update" | "alert" | ...}
"""
import logging
from typing import Dict, Iterable, Set

import anyio
from fastapi import WebSocket

logger = logging.getLogger(__name__)

MAX_CONN_PER_USER = 5


class Hub:
    def __init__(self) -> None:
        self._conns: Dict[int, Set[WebSocket]] = {}

    def register(self, user_id: int, ws: WebSocket) -> bool:
        conns = self._conns.setdefault(user_id, set())
        if len(conns) >= MAX_CONN_PER_USER:
            return False
        conns.add(ws)
        return True

    def unregister(self, user_id: int, ws: WebSocket) -> None:
        conns = self._conns.get(user_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self._conns.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return bool(self._conns.get(user_id))

    async def send(self, user_id: int, event: dict) -> int:
        """Send to every open connection of a user. Returns how many received it."""
        delivered = 0
        for ws in list(self._conns.get(user_id, ())):
            try:
                await ws.send_json(event)
                delivered += 1
            except Exception:
                self.unregister(user_id, ws)
        return delivered

    async def send_except(self, user_id: int, skip: WebSocket, event: dict) -> int:
        """Send to every open connection of a user except one (the device that just answered)."""
        delivered = 0
        for ws in list(self._conns.get(user_id, ())):
            if ws is skip:
                continue
            try:
                await ws.send_json(event)
                delivered += 1
            except Exception:
                self.unregister(user_id, ws)
        return delivered

    async def send_ws(self, user_id: int, ws: WebSocket, event: dict) -> bool:
        """Send to one specific connection of a user, if it is still open."""
        if ws not in self._conns.get(user_id, ()):
            return False
        try:
            await ws.send_json(event)
            return True
        except Exception:
            self.unregister(user_id, ws)
            return False

    async def send_many(self, user_ids: Iterable[int], event: dict) -> None:
        for uid in set(user_ids):
            await self.send(uid, event)

    async def broadcast(self, event: dict) -> None:
        """Send to every connected user. Events carry no personal data: clients fetch what they are allowed to see."""
        for uid in list(self._conns):
            await self.send(uid, event)

    def broadcast_from_thread(self, event: dict) -> None:
        try:
            anyio.from_thread.run(self.broadcast, event)
        except Exception as e:
            logger.debug("realtime broadcast skipped: %s", e)

    def send_from_thread(self, user_id: int, event: dict) -> None:
        """For sync (threadpool) endpoints. Never raises: realtime is best-effort."""
        try:
            anyio.from_thread.run(self.send, user_id, event)
        except Exception as e:  # not inside a worker thread, or loop closed
            logger.debug("realtime push skipped: %s", e)


hub = Hub()
