use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

pub async fn init(data_dir: &Path) -> Result<()> {
    let db_path = data_dir.join("rikzal.db");
    let conn = Connection::open(&db_path)?;
    conn.execute_batch(SCHEMA)?;
    tracing::info!("Database initialized at {}", db_path.display());
    Ok(())
}

const SCHEMA: &str = "
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS raw_events (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    payload     TEXT NOT NULL,
    embedding   BLOB,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entities (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name        TEXT NOT NULL,
    aliases     TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commitments (
    id               TEXT PRIMARY KEY,
    text             TEXT NOT NULL,
    extracted_from   TEXT REFERENCES raw_events(id),
    promised_to      TEXT REFERENCES entities(id),
    deadline         TEXT,
    status           TEXT NOT NULL DEFAULT 'open',
    confidence       REAL NOT NULL DEFAULT 1.0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attention_items (
    id             TEXT PRIMARY KEY,
    rank           INTEGER NOT NULL,
    item_type      TEXT NOT NULL,
    reference_id   TEXT,
    headline       TEXT NOT NULL,
    why_now        TEXT NOT NULL,
    action_hint    TEXT,
    brief_date     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS morning_briefs (
    id             TEXT PRIMARY KEY,
    brief_date     TEXT NOT NULL UNIQUE,
    narrative_text TEXT NOT NULL,
    audio_path     TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_raw_events_source ON raw_events(source);
CREATE INDEX IF NOT EXISTS idx_raw_events_type   ON raw_events(event_type);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status);
CREATE INDEX IF NOT EXISTS idx_attention_brief_date ON attention_items(brief_date);
";
