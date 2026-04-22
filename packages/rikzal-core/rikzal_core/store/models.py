from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
from ulid import ULID


def new_id() -> str:
    return str(ULID())


class RawEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    source: str
    event_type: str
    occurred_at: datetime
    payload: dict[str, Any]
    embedding: Optional[list[float]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EntityType(str, Enum):
    person = "person"
    project = "project"
    document = "document"
    meeting = "meeting"
    task = "task"


class Entity(BaseModel):
    id: str = Field(default_factory=new_id)
    entity_type: EntityType
    name: str
    aliases: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CommitmentStatus(str, Enum):
    open = "open"
    done = "done"
    overdue = "overdue"


class Commitment(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    extracted_from: Optional[str] = None  # RawEvent id
    promised_to: Optional[str] = None     # Entity id
    deadline: Optional[datetime] = None
    status: CommitmentStatus = CommitmentStatus.open
    confidence: float = 1.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AttentionItemType(str, Enum):
    commitment = "commitment"
    meeting_prep = "meeting_prep"
    unread_thread = "unread_thread"
    task = "task"
    news = "news"


class AttentionItem(BaseModel):
    id: str = Field(default_factory=new_id)
    rank: int
    item_type: AttentionItemType
    reference_id: Optional[str] = None
    headline: str
    why_now: str
    action_hint: Optional[str] = None
    brief_date: str  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MorningBrief(BaseModel):
    id: str = Field(default_factory=new_id)
    brief_date: str  # YYYY-MM-DD
    items: list[AttentionItem] = Field(default_factory=list)
    narrative_text: str
    audio_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
