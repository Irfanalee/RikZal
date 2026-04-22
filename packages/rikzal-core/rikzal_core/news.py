"""RSS news fetcher with 15-minute in-process cache."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

import feedparser

FEEDS = {
    "general": "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en",
    "ai": "https://techcrunch.com/category/artificial-intelligence/feed/",
}
CACHE_TTL = timedelta(minutes=15)
MAX_ITEMS = 5

log = logging.getLogger(__name__)


@dataclass
class NewsItem:
    id: str
    title: str
    url: str
    source: str
    published: str
    category: str


_cache: dict = {"general": None, "ai": None, "fetched_at": None}


def _parse_feed(url: str, category: str) -> list[dict]:
    d = feedparser.parse(url)
    items = []
    for entry in d.entries[:MAX_ITEMS]:
        link = getattr(entry, "link", "")
        source = (entry.get("source") or {}).get("title") or d.feed.get("title", "")
        raw_pub = entry.get("published", "")
        published = raw_pub[:10] if raw_pub else ""
        items.append(asdict(NewsItem(
            id=hashlib.md5(link.encode()).hexdigest()[:12],
            title=entry.get("title", ""),
            url=link,
            source=source,
            published=published,
            category=category,
        )))
    return items


async def get_news() -> dict:
    now = datetime.utcnow()
    stale = _cache["fetched_at"] is None or (now - _cache["fetched_at"]) > CACHE_TTL
    if stale:
        loop = asyncio.get_event_loop()
        try:
            _cache["general"] = await loop.run_in_executor(None, _parse_feed, FEEDS["general"], "general")
            _cache["ai"] = await loop.run_in_executor(None, _parse_feed, FEEDS["ai"], "ai")
            _cache["fetched_at"] = now
        except Exception as exc:
            log.warning("News fetch failed: %s", exc)
            if _cache["general"] is None:
                _cache["general"] = []
            if _cache["ai"] is None:
                _cache["ai"] = []
    return {
        "general": _cache["general"] or [],
        "ai": _cache["ai"] or [],
        "fetched_at": (_cache["fetched_at"] or now).isoformat(),
    }
