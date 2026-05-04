from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiosqlite

from rikzal_core.store.models import (
    AttentionItem,
    AttentionItemType,
    Commitment,
    CommitmentStatus,
    Entity,
    EntityType,
    MorningBrief,
    RawEvent,
    new_id,
)

_DB_PATH = Path.home() / ".local" / "share" / "rikzal" / "rikzal.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS raw_events (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    payload     TEXT NOT NULL,   -- JSON
    embedding   TEXT,            -- JSON array or NULL
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_events_source ON raw_events (source);
CREATE INDEX IF NOT EXISTS idx_raw_events_occurred ON raw_events (occurred_at);

CREATE TABLE IF NOT EXISTS entities (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name        TEXT NOT NULL,
    aliases     TEXT NOT NULL,   -- JSON array
    metadata    TEXT NOT NULL,   -- JSON object
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (name);

CREATE TABLE IF NOT EXISTS commitments (
    id             TEXT PRIMARY KEY,
    text           TEXT NOT NULL,
    extracted_from TEXT,          -- raw_events.id
    promised_to    TEXT,          -- entities.id
    deadline       TEXT,
    status         TEXT NOT NULL DEFAULT 'open',
    confidence     REAL NOT NULL DEFAULT 1.0,
    created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments (status);
CREATE INDEX IF NOT EXISTS idx_commitments_deadline ON commitments (deadline);

CREATE TABLE IF NOT EXISTS attention_items (
    id           TEXT PRIMARY KEY,
    rank         INTEGER NOT NULL,
    item_type    TEXT NOT NULL,
    reference_id TEXT,
    headline     TEXT NOT NULL,
    why_now      TEXT NOT NULL,
    action_hint  TEXT,
    brief_date   TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attention_brief_date ON attention_items (brief_date);

CREATE TABLE IF NOT EXISTS morning_briefs (
    id             TEXT PRIMARY KEY,
    brief_date     TEXT NOT NULL UNIQUE,
    narrative_text TEXT NOT NULL,
    audio_path     TEXT,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS morning_brief_items (
    brief_id TEXT NOT NULL REFERENCES morning_briefs(id),
    item_id  TEXT NOT NULL REFERENCES attention_items(id),
    PRIMARY KEY (brief_id, item_id)
);
"""


def _dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


class Store:
    """Async SQLite persistence layer for all RikZal models."""

    def __init__(self, db_path: Path = _DB_PATH) -> None:
        self._path = db_path
        self._db: aiosqlite.Connection | None = None

    async def open(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self._path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(_SCHEMA)
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def __aenter__(self) -> "Store":
        await self.open()
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()

    # ------------------------------------------------------------------
    # RawEvent
    # ------------------------------------------------------------------

    async def save_event(self, event: RawEvent) -> None:
        await self._db.execute(
            """
            INSERT OR IGNORE INTO raw_events
                (id, source, event_type, occurred_at, payload, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.id,
                event.source,
                event.event_type,
                _iso(event.occurred_at),
                json.dumps(event.payload),
                json.dumps(event.embedding) if event.embedding else None,
                _iso(event.created_at),
            ),
        )
        await self._db.commit()

    async def get_events(
        self,
        source: str | None = None,
        since: datetime | None = None,
        limit: int = 200,
    ) -> list[RawEvent]:
        clauses, params = [], []
        if source:
            clauses.append("source = ?")
            params.append(source)
        if since:
            clauses.append("occurred_at >= ?")
            params.append(_iso(since))
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        async with self._db.execute(
            f"SELECT * FROM raw_events {where} ORDER BY occurred_at DESC LIMIT ?",
            params,
        ) as cur:
            rows = await cur.fetchall()
        return [
            RawEvent(
                id=r["id"],
                source=r["source"],
                event_type=r["event_type"],
                occurred_at=_dt(r["occurred_at"]),
                payload=json.loads(r["payload"]),
                embedding=json.loads(r["embedding"]) if r["embedding"] else None,
                created_at=_dt(r["created_at"]),
            )
            for r in rows
        ]

    async def latest_event_time(self, source: str) -> datetime | None:
        async with self._db.execute(
            "SELECT occurred_at FROM raw_events WHERE source = ? ORDER BY occurred_at DESC LIMIT 1",
            (source,),
        ) as cur:
            row = await cur.fetchone()
        return _dt(row["occurred_at"]) if row else None

    # ------------------------------------------------------------------
    # Entity
    # ------------------------------------------------------------------

    async def upsert_entity(self, entity: Entity) -> None:
        await self._db.execute(
            """
            INSERT INTO entities (id, entity_type, name, aliases, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                aliases=excluded.aliases,
                metadata=excluded.metadata
            """,
            (
                entity.id,
                entity.entity_type.value,
                entity.name,
                json.dumps(entity.aliases),
                json.dumps(entity.metadata),
                _iso(entity.created_at),
            ),
        )
        await self._db.commit()

    async def find_entity_by_name(self, name: str) -> Entity | None:
        async with self._db.execute(
            "SELECT * FROM entities WHERE name = ? LIMIT 1", (name,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return Entity(
            id=row["id"],
            entity_type=EntityType(row["entity_type"]),
            name=row["name"],
            aliases=json.loads(row["aliases"]),
            metadata=json.loads(row["metadata"]),
            created_at=_dt(row["created_at"]),
        )

    # ------------------------------------------------------------------
    # Commitment
    # ------------------------------------------------------------------

    async def save_commitment(self, commitment: Commitment) -> None:
        await self._db.execute(
            """
            INSERT OR IGNORE INTO commitments
                (id, text, extracted_from, promised_to, deadline, status, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                commitment.id,
                commitment.text,
                commitment.extracted_from,
                commitment.promised_to,
                _iso(commitment.deadline) if commitment.deadline else None,
                commitment.status.value,
                commitment.confidence,
                _iso(commitment.created_at),
            ),
        )
        await self._db.commit()

    async def update_commitment_status(
        self, commitment_id: str, status: CommitmentStatus
    ) -> None:
        await self._db.execute(
            "UPDATE commitments SET status = ? WHERE id = ?",
            (status.value, commitment_id),
        )
        await self._db.commit()

    async def get_open_commitments(
        self, due_within_days: int = 7
    ) -> list[Commitment]:
        async with self._db.execute(
            """
            SELECT * FROM commitments
            WHERE status = 'open'
              AND (deadline IS NULL OR deadline <= date('now', ? || ' days'))
            ORDER BY deadline ASC NULLS LAST
            """,
            (f"+{due_within_days}",),
        ) as cur:
            rows = await cur.fetchall()
        return [_row_to_commitment(r) for r in rows]

    # ------------------------------------------------------------------
    # AttentionItem
    # ------------------------------------------------------------------

    async def save_attention_item(self, item: AttentionItem) -> None:
        await self._db.execute(
            """
            INSERT OR IGNORE INTO attention_items
                (id, rank, item_type, reference_id, headline, why_now, action_hint, brief_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item.id,
                item.rank,
                item.item_type.value,
                item.reference_id,
                item.headline,
                item.why_now,
                item.action_hint,
                item.brief_date,
                _iso(item.created_at),
            ),
        )
        await self._db.commit()

    # ------------------------------------------------------------------
    # MorningBrief
    # ------------------------------------------------------------------

    async def save_brief(self, brief: MorningBrief) -> None:
        await self._db.execute(
            """
            INSERT OR REPLACE INTO morning_briefs
                (id, brief_date, narrative_text, audio_path, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                brief.id,
                brief.brief_date,
                brief.narrative_text,
                brief.audio_path,
                _iso(brief.created_at),
            ),
        )
        for item in brief.items:
            await self.save_attention_item(item)
            await self._db.execute(
                "INSERT OR IGNORE INTO morning_brief_items (brief_id, item_id) VALUES (?, ?)",
                (brief.id, item.id),
            )
        await self._db.commit()

    async def get_brief(self, date: str) -> MorningBrief | None:
        async with self._db.execute(
            "SELECT * FROM morning_briefs WHERE brief_date = ?", (date,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None

        async with self._db.execute(
            """
            SELECT a.* FROM attention_items a
            JOIN morning_brief_items m ON m.item_id = a.id
            WHERE m.brief_id = ?
            ORDER BY a.rank ASC
            """,
            (row["id"],),
        ) as cur:
            item_rows = await cur.fetchall()

        return MorningBrief(
            id=row["id"],
            brief_date=row["brief_date"],
            narrative_text=row["narrative_text"],
            audio_path=row["audio_path"],
            items=[_row_to_attention_item(r) for r in item_rows],
            created_at=_dt(row["created_at"]),
        )

    async def get_today_events(self, source: str | None = None) -> list[RawEvent]:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        clauses = ["DATE(occurred_at) = ?"]
        params: list = [today]
        if source:
            clauses.append("source = ?")
            params.append(source)
        params.append(200)
        async with self._db.execute(
            f"SELECT * FROM raw_events WHERE {' AND '.join(clauses)} ORDER BY occurred_at ASC LIMIT ?",
            params,
        ) as cur:
            rows = await cur.fetchall()
        return [
            RawEvent(
                id=r["id"],
                source=r["source"],
                event_type=r["event_type"],
                occurred_at=_dt(r["occurred_at"]),
                payload=json.loads(r["payload"]),
                embedding=json.loads(r["embedding"]) if r["embedding"] else None,
                created_at=_dt(r["created_at"]),
            )
            for r in rows
        ]


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _row_to_commitment(r: aiosqlite.Row) -> Commitment:
    return Commitment(
        id=r["id"],
        text=r["text"],
        extracted_from=r["extracted_from"],
        promised_to=r["promised_to"],
        deadline=_dt(r["deadline"]) if r["deadline"] else None,
        status=CommitmentStatus(r["status"]),
        confidence=r["confidence"],
        created_at=_dt(r["created_at"]),
    )


def _row_to_attention_item(r: aiosqlite.Row) -> AttentionItem:
    return AttentionItem(
        id=r["id"],
        rank=r["rank"],
        item_type=AttentionItemType(r["item_type"]),
        reference_id=r["reference_id"],
        headline=r["headline"],
        why_now=r["why_now"],
        action_hint=r["action_hint"],
        brief_date=r["brief_date"],
        created_at=_dt(r["created_at"]),
    )


# Module-level singleton — import and use directly
store = Store()
