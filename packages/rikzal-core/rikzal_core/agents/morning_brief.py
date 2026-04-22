from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from rikzal_core.llm.protocol import LLMProvider
from rikzal_core.store.models import AttentionItem, AttentionItemType, MorningBrief


class BriefState(TypedDict):
    date: str
    calendar_events: list[dict[str, Any]]
    open_commitments: list[dict[str, Any]]
    unread_count: int
    news_headlines: list[str]
    attention_items: list[AttentionItem]
    narrative_text: str
    audio_path: str | None


def build_brief_graph(llm: LLMProvider) -> Any:
    graph = StateGraph(BriefState)

    graph.add_node("gather_calendar", gather_calendar)
    graph.add_node("gather_commitments", gather_commitments)
    graph.add_node("rank_attention", make_rank_attention(llm))
    graph.add_node("synthesize_narrative", make_synthesize_narrative(llm))

    graph.set_entry_point("gather_calendar")
    graph.add_edge("gather_calendar", "gather_commitments")
    graph.add_edge("gather_commitments", "rank_attention")
    graph.add_edge("rank_attention", "synthesize_narrative")
    graph.add_edge("synthesize_narrative", END)

    return graph.compile()


async def gather_calendar(state: BriefState) -> BriefState:
    # TODO: pull from SQLite store once connector sync is wired
    # Using mock data for Phase 0 validation
    now = datetime.now(timezone.utc)
    mock_events = [
        {
            "summary": "Team standup",
            "start": (now.replace(hour=9, minute=0)).isoformat(),
            "attendees": ["alice@company.com", "bob@company.com"],
            "description": "",
        },
        {
            "summary": "Product review with Sarah",
            "start": (now.replace(hour=14, minute=0)).isoformat(),
            "attendees": ["sarah@company.com"],
            "description": "Q2 roadmap review",
        },
    ]
    return {**state, "calendar_events": mock_events}


async def gather_commitments(state: BriefState) -> BriefState:
    # TODO: query SQLite for open commitments with deadline <= today+3
    mock_commitments = [
        {
            "id": "c1",
            "text": "Send Sarah the updated roadmap doc",
            "promised_to": "Sarah",
            "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "status": "open",
        }
    ]
    return {**state, "open_commitments": mock_commitments}


def make_rank_attention(llm: LLMProvider):
    async def rank_attention(state: BriefState) -> BriefState:
        items: list[AttentionItem] = []
        rank = 1

        for event in state["calendar_events"]:
            items.append(AttentionItem(
                rank=rank,
                item_type=AttentionItemType.meeting_prep,
                headline=event["summary"],
                why_now=f"Meeting today at {_fmt_time(event['start'])}",
                action_hint=f"Attendees: {', '.join(event.get('attendees', []))}",
                brief_date=state["date"],
            ))
            rank += 1

        for commit in state["open_commitments"]:
            deadline_str = commit.get("deadline", "")
            items.append(AttentionItem(
                rank=rank,
                item_type=AttentionItemType.commitment,
                headline=commit["text"],
                why_now=f"Promised to {commit.get('promised_to', 'someone')}"
                        + (f", due {_fmt_date(deadline_str)}" if deadline_str else ""),
                brief_date=state["date"],
            ))
            rank += 1

        if state.get("unread_count", 0) > 0:
            items.append(AttentionItem(
                rank=rank,
                item_type=AttentionItemType.unread_thread,
                headline=f"{state['unread_count']} unread emails",
                why_now="Arrived overnight",
                brief_date=state["date"],
            ))

        return {**state, "attention_items": items}

    return rank_attention


def make_synthesize_narrative(llm: LLMProvider):
    async def synthesize_narrative(state: BriefState) -> BriefState:
        today = state["date"]
        events_txt = "\n".join(
            f"- {e['summary']} at {_fmt_time(e['start'])}"
            for e in state["calendar_events"]
        )
        commits_txt = "\n".join(
            f"- {c['text']} (promised to {c.get('promised_to', 'someone')})"
            for c in state["open_commitments"]
        )

        prompt = f"""You are RikZal, an ambient intelligence assistant. Generate a concise,
friendly morning briefing (90 seconds when spoken aloud, ~200 words).
Speak directly to the user. Be warm but efficient.

Date: {today}

Today's meetings:
{events_txt or "No meetings scheduled."}

Open commitments:
{commits_txt or "No open commitments."}

Unread emails: {state.get('unread_count', 0)}

Generate the briefing now:"""

        narrative = await llm.complete(prompt, system="You are a helpful personal assistant.")
        return {**state, "narrative_text": narrative, "audio_path": None}

    return synthesize_narrative


def _fmt_time(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%-I:%M %p")
    except Exception:
        return iso


def _fmt_date(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%b %-d")
    except Exception:
        return iso


async def run_morning_brief(llm: LLMProvider) -> MorningBrief:
    today = datetime.now().strftime("%Y-%m-%d")
    graph = build_brief_graph(llm)

    initial: BriefState = {
        "date": today,
        "calendar_events": [],
        "open_commitments": [],
        "unread_count": 0,
        "news_headlines": [],
        "attention_items": [],
        "narrative_text": "",
        "audio_path": None,
    }

    final = await graph.ainvoke(initial)

    return MorningBrief(
        brief_date=today,
        items=final["attention_items"],
        narrative_text=final["narrative_text"],
        audio_path=final.get("audio_path"),
    )
