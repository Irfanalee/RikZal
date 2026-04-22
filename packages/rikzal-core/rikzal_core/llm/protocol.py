from __future__ import annotations

from typing import AsyncIterator, Protocol, runtime_checkable


@runtime_checkable
class LLMProvider(Protocol):
    async def complete(self, prompt: str, system: str = "", **kwargs) -> str: ...
    async def embed(self, text: str) -> list[float]: ...
    async def stream(self, prompt: str, system: str = "", **kwargs) -> AsyncIterator[str]: ...
