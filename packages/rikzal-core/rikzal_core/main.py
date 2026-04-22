"""RikZal core entry point — generates the morning brief, speaks it, and serves it."""
from __future__ import annotations

import asyncio
import logging

import uvicorn

from rikzal_core.agents.morning_brief import run_morning_brief
from rikzal_core.api import app, set_brief
from rikzal_core.ipc import send_brief
from rikzal_core.llm.ollama import OllamaProvider
from rikzal_core.tts import speak

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rikzal_core")

API_HOST = "127.0.0.1"
API_PORT = 8765


async def _main() -> None:
    log.info("RikZal core starting")

    config = uvicorn.Config(app, host=API_HOST, port=API_PORT, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    llm = OllamaProvider()
    log.info("Generating morning brief...")
    brief = await run_morning_brief(llm)

    set_brief(brief)
    log.info(
        "Morning brief for %s: %d items, %d chars narrative",
        brief.brief_date,
        len(brief.items),
        len(brief.narrative_text),
    )
    log.info("Brief available at http://%s:%d/api/brief", API_HOST, API_PORT)

    await asyncio.gather(
        speak(brief.narrative_text),
        send_brief(brief),
    )

    await server_task


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
