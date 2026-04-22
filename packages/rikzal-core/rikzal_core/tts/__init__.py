"""TTS via macOS `say` — Phase 1 implementation."""
from __future__ import annotations

import asyncio
import logging
import sys

log = logging.getLogger("rikzal_tts")


async def speak(text: str) -> None:
    if sys.platform != "darwin":
        log.warning("TTS via `say` is macOS-only; skipping on %s", sys.platform)
        return
    log.info("Speaking brief (%d chars)…", len(text))
    proc = await asyncio.create_subprocess_exec(
        "say", text,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    log.info("TTS done")
