"""Minimal HTTP API so the React UI can poll for the latest brief."""
from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rikzal_core.store.models import MorningBrief

app = FastAPI(title="RikZal Core API", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_latest_brief: MorningBrief | None = None


def set_brief(brief: MorningBrief) -> None:
    global _latest_brief
    _latest_brief = brief


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/brief")
async def get_brief() -> dict | None:
    if _latest_brief is None:
        return None
    return _latest_brief.model_dump(mode="json")


@app.post("/api/speak")
async def replay_brief() -> dict:
    if _latest_brief is None:
        return {"status": "no_brief"}
    from rikzal_core.tts import speak
    asyncio.create_task(speak(_latest_brief.narrative_text))
    return {"status": "speaking"}
