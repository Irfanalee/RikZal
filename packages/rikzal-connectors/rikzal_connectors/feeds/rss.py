from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import AsyncIterator

import feedparser

from rikzal_connectors.base import ConnectorConfig, HealthStatus, RawEvent


class RSSConnector:
    id = "rss"
    name = "RSS/Atom Feeds"
    version = "0.1.0"

    def __init__(self):
        self._feed_urls: list[str] = []

    async def setup(self, config: ConnectorConfig) -> None:
        self._feed_urls = config.settings.get("feed_urls", [])

    async def health_check(self) -> HealthStatus:
        if self._feed_urls:
            return HealthStatus(healthy=True, message=f"{len(self._feed_urls)} feeds configured")
        return HealthStatus(healthy=False, message="No feed URLs configured")

    async def poll(self, since: datetime) -> AsyncIterator[RawEvent]:
        for url in self._feed_urls:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                published = _parse_date(entry)
                if published and published < since:
                    continue
                yield RawEvent(
                    source=self.id,
                    event_type="news_article",
                    occurred_at=published or datetime.now(timezone.utc),
                    payload={
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                        "summary": entry.get("summary", ""),
                        "feed_title": feed.feed.get("title", url),
                    },
                )


def _parse_date(entry) -> datetime | None:
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                return parsedate_to_datetime(raw).replace(tzinfo=timezone.utc)
            except Exception:
                pass
    return None
