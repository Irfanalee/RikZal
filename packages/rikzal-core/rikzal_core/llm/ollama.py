from __future__ import annotations

from typing import AsyncIterator
import ollama


class OllamaProvider:
    def __init__(self, model: str = "qwen2.5:3b", embed_model: str = "nomic-embed-text"):
        self.model = model
        self.embed_model = embed_model
        self._client = ollama.AsyncClient()

    async def complete(self, prompt: str, system: str = "", **kwargs) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = await self._client.chat(
            model=self.model,
            messages=messages,
            **kwargs,
        )
        return response.message.content

    async def embed(self, text: str) -> list[float]:
        response = await self._client.embed(model=self.embed_model, input=text)
        return response.embeddings[0]

    async def stream(self, prompt: str, system: str = "", **kwargs) -> AsyncIterator[str]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async for chunk in await self._client.chat(
            model=self.model,
            messages=messages,
            stream=True,
            **kwargs,
        ):
            if chunk.message.content:
                yield chunk.message.content
