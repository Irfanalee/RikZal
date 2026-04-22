# RikZal — Product Vision

> **The ambient intelligence layer for professional life.**
> Every system you work with. Every KPI that matters. One proactive, private, voice-first OS companion — no data ever leaves your machine.

---

## North Star

Most professionals juggle 8–15 disconnected tools every day. They context-switch constantly, miss signals buried in email threads, forget commitments made in Slack, and have no single place where their work *makes sense as a whole*.

RikZal's job is to collapse that cognitive overhead into zero.

It is not a chatbot. It is not a dashboard you open. It is an ambient layer that watches your connected systems, understands what matters *right now*, surfaces it before you need to ask, and responds to your voice as naturally as talking to a colleague.

The core promise: **everything local, everything private, always on, always useful.**

---

## Foundational Principle: Privacy by Architecture

Privacy is not a feature or a setting in RikZal — it is a structural guarantee enforced at the architecture level.

| Principle | Implementation |
|---|---|
| **No data leaves the device** | All LLM inference runs locally via Ollama. No API keys to OpenAI, Anthropic, or any cloud AI provider. |
| **No telemetry** | Zero usage tracking, no crash reports sent externally, no analytics. |
| **Credentials stay local** | OAuth tokens, API keys, and connector secrets are stored in the OS keychain (Keychain on macOS, DPAPI on Windows, libsecret on Linux). Never written to disk in plaintext. |
| **Connector data is ephemeral** | Raw synced data from connectors lives in the local SQLite store only. It is not indexed by any external service. |
| **Air-gap capable** | RikZal must function fully on a machine with no internet connection, using only locally cached data and the local LLM. |
| **User-auditable** | Every piece of data RikZal holds is inspectable via a local admin panel. Users can delete any connector's data at any time. |

This makes RikZal viable in regulated industries — finance, healthcare, legal, government — where cloud AI tools are prohibited or restricted.

---

## The Model: Qwen 2.5 7B (Local, 24 GB RAM)

The production local model target is **Qwen 2.5 7B** running via Ollama, sized for machines with 16–24 GB unified memory (Apple Silicon M-series, modern Windows laptops with dedicated RAM).

| Model | RAM required | Use case |
|---|---|---|
| `qwen2.5:3b` | 8 GB | Development / low-resource machines |
| `qwen2.5:7b` | 16 GB | **Default production target** |
| `qwen2.5:14b` | 24 GB | Power users, deeper reasoning |
| `nomic-embed-text` | ~270 MB | Embeddings for semantic search (all tiers) |

The 7B model is the threshold where reliable **tool calling, structured JSON output, and multi-step reasoning** become consistent enough for production agent use. The 3B model remains supported as a fallback.

---

## Connector Ecosystem

RikZal's value scales directly with the number of systems it can read from. Each connector is an isolated MCP server that exposes a standardised tool interface to the agent layer.

### Communication & Productivity
| Connector | Data surfaced |
|---|---|
| **Microsoft Outlook** | Calendar events, emails, flagged items, meeting invites |
| **Microsoft Teams** | Unread messages, @mentions, channel digests |
| **Gmail / Google Calendar** | Same as Outlook — parallel implementation |
| **Slack** | DMs, @mentions, thread summaries, channel activity |

### Engineering & Product
| Connector | Data surfaced |
|---|---|
| **GitHub** | Open PRs awaiting review, CI failures, issues assigned to you, release status |
| **Jira** | Sprint board state, overdue tickets, blockers, velocity KPIs |
| **Linear** | Issue triage, cycle time, project health |
| **Azure DevOps** | Pipeline status, work items, PR queue |

### Business Operations
| Connector | Data surfaced |
|---|---|
| **Salesforce** | Pipeline value, deals closing this week, overdue follow-ups, quota attainment |
| **HubSpot** | Deal stage movement, contact activity, sequence performance |
| **Generic CRM** | Pluggable adapter for any CRM exposing a REST/GraphQL API |

### Enterprise Systems
| Connector | Data surfaced |
|---|---|
| **ServiceNow** | Open P1/P2 incidents, assigned tickets, SLA breach risk, change requests |
| **SAP / ERP** | Purchase order approvals, budget overruns, inventory alerts |
| **Workday** | Leave approvals, headcount reports, expense claims |
| **Power BI / Tableau** | KPI snapshot pull from published dashboards |

### Infrastructure & Observability
| Connector | Data surfaced |
|---|---|
| **PagerDuty / OpsGenie** | Active incidents, on-call schedule, escalations |
| **Grafana / Datadog** | Metric anomalies, SLO burn rate, alert digest |
| **AWS / Azure / GCP** | Cost anomalies, resource health, quota warnings |

### Local & Personal
| Connector | Data surfaced |
|---|---|
| **Local filesystem** | File activity, project directories, document context |
| **Obsidian / Notion** | Notes, meeting summaries, project context |
| **Browser history** (opt-in) | Research context, recently visited docs |
| **Git repos** | Uncommitted work, recent commits, branch status |

---

## Multi-Agent Architecture

Rather than one monolithic agent doing everything, RikZal uses a **supervisor + specialist** multi-agent model. All agents run locally. No inter-agent traffic leaves the device.

```
┌─────────────────────────────────────────────────────┐
│                  Supervisor Agent                    │
│  Routes intent → delegates to specialists            │
│  Maintains session context + working memory          │
└──────┬────────┬────────┬────────┬────────┬──────────┘
       │        │        │        │        │
   Brief    Commit   Research  Action  Connector
   Agent    Tracker   Agent    Agent   Sync Agent
```

### Supervisor Agent
The orchestrator. Receives all voice commands and scheduled triggers. Decides which specialist to invoke, aggregates results, and composes the final response. Maintains a short working memory of the current session context.

### Brief Agent
Runs at login/wake and on-demand. Queries all connected data sources through their MCP tools, ranks attention items by urgency and relevance, synthesises the spoken narrative. The current `morning_brief.py` pipeline evolves into this agent.

### Commit Tracker Agent
Runs as a background daemon. Continuously monitors new emails, Slack messages, and meeting notes for commitment language ("I'll send that by...", "I can have it ready...", "I'll follow up on..."). Extracts commitments, confirms with the user, writes to `rikzal.db`. Feeds the Brief Agent's commitment queue.

### Research Agent
Triggered on-demand by voice or by other agents. Given a topic, it searches local notes, recent emails, relevant documents, and (optionally) local web cache. Returns a structured summary. Used when the Brief Agent needs deeper context on a meeting topic.

### Action Agent
Executes write-actions on connected systems: sends a reply, creates a Jira ticket, marks a PR as reviewed, schedules a follow-up. Every action is confirmed with the user before execution (voice confirmation or button). The agent never acts autonomously on write operations.

### Connector Sync Agent
Manages background polling and delta syncing for all connectors. Owns the refresh cadence, handles auth token renewal, writes normalised events to `raw_events` in SQLite. Other agents read from the store rather than calling connectors directly — connectors are write-once from the sync agent's perspective.

---

## Agent-to-Agent Communication

Agents communicate via an internal message bus backed by SQLite — no network, no external broker, fully local.

```
Agent A  →  writes task/result to  →  agent_messages table (SQLite)
Agent B  ←  polls / is notified   ←  via Rust daemon event emitter
```

Wire format stays MessagePack over the existing Unix socket. The Rust daemon acts as the message router between Python agent processes, keeping the IPC layer language-agnostic and extensible.

Future: when the agent surface grows, migrate the internal bus to a local **LangGraph multi-agent graph** where agents are nodes and the supervisor handles routing via conditional edges.

---

## Voice-First Interaction Model

Voice is the primary interface. The keyboard/mouse UI remains for reference and browsing, but all commands can be issued by voice.

### Invocation
- **Wake word** (configurable): "Hey Rikzal" — always-listening, on-device keyword spotter (using `whisper.cpp` or `porcupine`)
- **Push-to-talk**: keyboard shortcut (configurable) for environments where wake word is impractical
- **Tray button**: single click activates listening

### Command classes
| Class | Examples |
|---|---|
| **Briefing** | "Give me my morning brief" · "What's on today?" |
| **Status query** | "Any P1 incidents?" · "How's the sprint looking?" · "What's my pipeline this week?" |
| **Refresh** | "Refresh news" · "Update weather" · "Sync my calendar" |
| **Drill-down** | "Tell me more about that Jira blocker" · "Who's in the 2pm?" |
| **Action** | "Remind me to follow up with Sarah tomorrow" · "Create a ticket for this" |
| **Settings** | "Switch to CEO mode" · "Mute until 10am" |

### Response modes
- **Spoken** — TTS narration (macOS `say`, Windows SAPI, `espeak-ng` on Linux), with streamed text display
- **Card** — structured UI card appears in sidebar for data-heavy responses (tables, KPI grids)
- **Both** — default for brief; voice summary + full detail in UI

### Manual refresh button
Every data panel in the sidebar has an inline refresh icon. One click triggers an on-demand re-fetch for that specific source. In a future release, saying "refresh [source]" maps to the same action.

---

## Platform Support

| Platform | Runtime | Tray | Voice | Status |
|---|---|---|---|---|
| **macOS** (Apple Silicon + Intel) | Tauri shell | ✅ native | `say` TTS + `whisper.cpp` | Current target |
| **Windows 11/10** | Tauri shell | ✅ native | SAPI TTS + `whisper.cpp` | Phase 3 |
| **Linux** (Ubuntu, Arch, Fedora) | Tauri shell | ✅ via `tray-icon` crate | `espeak-ng` + `whisper.cpp` | Phase 3 |

The Tauri shell (`crates/rikzal-tauri`) is already scaffolded. The React UI, Python core, and Rust daemon are all platform-agnostic by design. The main per-platform work is TTS integration, OS keychain access, and the login/wake hook.

Distribution: signed `.dmg` (macOS), `.msi`/`.exe` (Windows), `.AppImage`/`.deb`/`.rpm` (Linux). Auto-update via Tauri's built-in updater pointing to a self-hosted or GitHub Releases endpoint.

---

## Phased Roadmap

### Phase 0 ✅ — Foundation
Scaffolding, mock data, Qwen 2.5 3B, LangGraph pipeline, React UI, Rust daemon IPC.

### Phase 1 ✅ — Morning Brief End-to-End
IPC wired, TTS working, FastAPI serving UI, news feeds (RSS), weather widget, time-aware greeting.

### Phase 2 — Real Connectors + MCP Layer
- MCP server framework: each connector is an MCP server, Brief Agent uses tool calling
- First connectors: Google Calendar, Gmail, GitHub
- Upgrade default model to Qwen 2.5 7B
- Commit Tracker Agent (background NLP extraction)
- Connector Sync Agent (background polling, delta sync to SQLite)
- Manual refresh button per data source in sidebar

### Phase 3 — Enterprise Connectors + Knowledge Graph
- Outlook / Teams connector
- Jira, Linear, ServiceNow connectors
- Salesforce / HubSpot connector
- Entity knowledge graph (people, projects, orgs) with vector embeddings
- Cross-source relationship linking ("This PR is related to the incident Sarah mentioned in Slack")
- Tauri shell — packaged desktop app for macOS

### Phase 4 — Voice Commands + Action Agent
- On-device wake word detection (`whisper.cpp` / `porcupine`)
- Push-to-talk keyboard shortcut
- Action Agent with user-confirmed write operations
- Research Agent for on-demand deep dives
- Windows + Linux packaging

### Phase 5 — Multi-Agent Orchestration
- Supervisor Agent with full routing
- LangGraph multi-agent graph replacing the single pipeline
- Agent-to-agent message bus via SQLite + Rust daemon event emitter
- Pluggable connector SDK: third parties can ship MCP servers as signed plugins
- Optional: secondary screen / always-visible heads-up display mode

---

## What RikZal Is Not

- **Not a cloud service.** There will never be a "RikZal cloud" tier that processes your data remotely.
- **Not a chatbot.** It does not wait to be asked. It surfaces what matters proactively.
- **Not a replacement for your tools.** It reads from them, summarises them, and helps you act — but it does not try to be your calendar or your issue tracker.
- **Not always listening without consent.** The wake word listener is opt-in and its on/off state is always visible in the tray.
