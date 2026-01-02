from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}
        self.connection_index: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, auction_id: str | None) -> None:
        await websocket.accept()
        key = auction_id or "_global"
        self.active_connections.setdefault(key, set()).add(websocket)
        self.connection_index[websocket] = key

    def disconnect(self, websocket: WebSocket) -> None:
        key = self.connection_index.pop(websocket, None)
        if key and key in self.active_connections:
            self.active_connections[key].discard(websocket)
            if not self.active_connections[key]:
                self.active_connections.pop(key, None)

    async def broadcast(self, message: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for connections in list(self.active_connections.values()):
            for websocket in list(connections):
                try:
                    await websocket.send_json(message)
                except Exception:
                    stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)

    async def broadcast_to(self, auction_id: str, message: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in list(self.active_connections.get(auction_id, set())):
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)
