from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator, Callable, Optional, Protocol, runtime_checkable

from pydantic import BaseModel


class RawEvent(BaseModel):
    """Normalized event emitted by any connector."""
    source: str
    event_type: str
    occurred_at: datetime
    payload: dict[str, Any]


@dataclass
class ConnectorConfig:
    connector_id: str
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthStatus:
    healthy: bool
    message: str = ""


@runtime_checkable
class Connector(Protocol):
    id: str
    name: str
    version: str

    async def setup(self, config: ConnectorConfig) -> None: ...
    async def health_check(self) -> HealthStatus: ...
    async def poll(self, since: datetime) -> AsyncIterator[RawEvent]: ...

    # Optional real-time subscription — connectors that support it implement this
    async def subscribe(self, callback: Callable[[RawEvent], None]) -> None: ...
