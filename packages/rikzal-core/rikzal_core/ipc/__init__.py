"""IPC client — sends MessagePack messages to the rikzal-daemon Unix socket."""
from __future__ import annotations

import asyncio
import logging
import struct
from pathlib import Path

import msgpack

from rikzal_core.store.models import MorningBrief

log = logging.getLogger("rikzal_ipc")

SOCKET_PATH = Path.home() / ".local" / "share" / "rikzal" / "rikzal.sock"


async def send_brief(brief: MorningBrief) -> None:
    msg = {
        "type": "brief_ready",
        "date": brief.brief_date,
        "narrative": brief.narrative_text,
        "audio_path": brief.audio_path,
    }
    encoded = msgpack.packb(msg, use_bin_type=True)
    length = struct.pack(">I", len(encoded))

    try:
        _, writer = await asyncio.open_unix_connection(str(SOCKET_PATH))
        writer.write(length + encoded)
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        log.info("Brief sent to daemon")
    except Exception as exc:
        log.warning("Could not reach daemon (is it running?): %s", exc)
