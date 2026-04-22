from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import AsyncIterator

import keyring
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from rikzal_connectors.base import ConnectorConfig, HealthStatus, RawEvent

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
KEYRING_SERVICE = "rikzal"
KEYRING_KEY = "google_calendar_token"


class GoogleCalendarConnector:
    id = "google_calendar"
    name = "Google Calendar"
    version = "0.1.0"

    def __init__(self):
        self._creds: Credentials | None = None

    async def setup(self, config: ConnectorConfig) -> None:
        raw = keyring.get_password(KEYRING_SERVICE, KEYRING_KEY)
        if raw:
            token_data = json.loads(raw)
            self._creds = Credentials.from_authorized_user_info(token_data, SCOPES)
            if self._creds.expired and self._creds.refresh_token:
                self._creds.refresh(Request())
                keyring.set_password(
                    KEYRING_SERVICE, KEYRING_KEY,
                    self._creds.to_json()
                )

    async def health_check(self) -> HealthStatus:
        if self._creds and self._creds.valid:
            return HealthStatus(healthy=True, message="Connected")
        return HealthStatus(healthy=False, message="Not authenticated — run rikzal auth google_calendar")

    async def poll(self, since: datetime) -> AsyncIterator[RawEvent]:
        if not self._creds or not self._creds.valid:
            return

        service = build("calendar", "v3", credentials=self._creds, cache_discovery=False)
        now = datetime.now(timezone.utc).isoformat()
        since_iso = since.isoformat()

        result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=since_iso,
                timeMax=now,
                singleEvents=True,
                orderBy="startTime",
                maxResults=50,
            )
            .execute()
        )

        for event in result.get("items", []):
            start_raw = event.get("start", {})
            start_str = start_raw.get("dateTime") or start_raw.get("date", now)
            try:
                occurred_at = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            except ValueError:
                occurred_at = datetime.now(timezone.utc)

            yield RawEvent(
                source=self.id,
                event_type="calendar_event",
                occurred_at=occurred_at,
                payload={
                    "id": event.get("id"),
                    "summary": event.get("summary", "(No title)"),
                    "description": event.get("description", ""),
                    "location": event.get("location", ""),
                    "start": start_raw,
                    "end": event.get("end", {}),
                    "attendees": [
                        {"email": a.get("email"), "name": a.get("displayName", "")}
                        for a in event.get("attendees", [])
                    ],
                    "html_link": event.get("htmlLink", ""),
                },
            )

    @classmethod
    def save_credentials(cls, creds: Credentials) -> None:
        keyring.set_password(KEYRING_SERVICE, KEYRING_KEY, creds.to_json())
