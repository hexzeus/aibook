"""
WebSocket Manager for Real-time Notifications
Handles WebSocket connections and broadcasts notifications to users
"""
from fastapi import WebSocket
from typing import Dict, Set
import json
import asyncio


class WebSocketManager:
    """Manages WebSocket connections for real-time notifications"""

    def __init__(self):
        # Map of license_key -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, license_key: str):
        """Accept WebSocket connection and register it for a user"""
        await websocket.accept()

        if license_key not in self.active_connections:
            self.active_connections[license_key] = set()

        self.active_connections[license_key].add(websocket)
        print(f"[WEBSOCKET] Client connected for license key: {license_key[:8]}... (Total: {len(self.active_connections[license_key])} connections)")

    def disconnect(self, websocket: WebSocket, license_key: str):
        """Remove WebSocket connection"""
        if license_key in self.active_connections:
            self.active_connections[license_key].discard(websocket)

            # Clean up empty sets
            if not self.active_connections[license_key]:
                del self.active_connections[license_key]

            print(f"[WEBSOCKET] Client disconnected for license key: {license_key[:8]}...")

    async def send_notification(self, license_key: str, notification: dict):
        """Send notification to all connections for a specific user"""
        if license_key not in self.active_connections:
            print(f"[WEBSOCKET] No active connections for license key: {license_key[:8]}...")
            return

        # Send to all active connections for this user
        disconnected = set()
        for websocket in self.active_connections[license_key]:
            try:
                await websocket.send_json(notification)
                print(f"[WEBSOCKET] Sent notification to {license_key[:8]}...: {notification}")
            except Exception as e:
                print(f"[WEBSOCKET] Error sending to {license_key[:8]}...: {e}")
                disconnected.add(websocket)

        # Clean up disconnected websockets
        for websocket in disconnected:
            self.disconnect(websocket, license_key)

    async def broadcast_credit_added(self, license_key: str, credits_added: int, new_total: int):
        """Broadcast that credits were added to a user's account"""
        notification = {
            "type": "credits_added",
            "credits_added": credits_added,
            "new_total": new_total,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_notification(license_key, notification)

    async def broadcast_auto_gen_progress(self, license_key: str, book_id: str, progress_data: dict):
        """
        Broadcast auto-generation progress to user

        Args:
            license_key: User's license key
            book_id: ID of book being generated
            progress_data: Dict with keys:
                - status: 'started' | 'generating_page' | 'generating_illustration' | 'generating_cover' | 'completed' | 'error'
                - current_page: Current page number being generated
                - total_pages: Total pages to generate
                - message: User-friendly message
                - percentage: Progress percentage (0-100)
                - with_illustrations: Whether illustrations are being generated
                - error: Error message (if status='error')
        """
        notification = {
            "type": "auto_gen_progress",
            "book_id": book_id,
            **progress_data,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.send_notification(license_key, notification)


# Global WebSocket manager instance
ws_manager = WebSocketManager()
