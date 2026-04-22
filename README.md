# RikZal

**Ambient intelligence for people who live inside many apps at once.**

RikZal is an OS-layer personal command center — not a chatbot you query, but a proactive system that watches your context, surfaces what matters, and speaks your day to you each morning. Think JARVIS from Iron Man: always running, always aware, human always in charge.

---

## What it does

Every morning RikZal generates a **spoken briefing** — a 90-second audio summary of your day, produced entirely on-device by a local language model. No cloud, no subscriptions, no data leaving your machine.

The briefing covers:

- **Meetings** — what's coming, who's attending, what to prep
- **Open commitments** — promises you've made that need action today
- **Inbox** — what arrived overnight that actually matters
- **Attention queue** — a ranked list of the 10 things that need you, updated throughout the day

The sidebar stays open at the edge of your screen, quietly re-ranking your attention queue as things change.

---

## Architecture

```
┌─────────────────────────────────────┐
│  React UI  (Vite · Jotai · Tailwind)│  ← Morning Brief + Sidebar
│  polls localhost:8765 every 5s      │
└────────────────┬────────────────────┘
                 │ HTTP JSON
┌────────────────▼────────────────────┐
│  rikzal-core  (Python · FastAPI)    │  ← LangGraph agents
│  LLM: Qwen 2.5 3B via Ollama       │
│  TTS: macOS `say`                   │
└────────────────┬────────────────────┘
                 │ Unix socket · MessagePack
┌────────────────▼────────────────────┐
│  rikzal-daemon  (Rust · Tokio)      │  ← Always-running tray app
│  SQLite · IPC server                │
└─────────────────────────────────────┘
```

**Key decisions:**
- **Local-first** — Qwen 2.5 3B runs entirely on your machine via Ollama
- **Privacy by default** — no data leaves unless you explicitly add a cloud connector
- **Layered approach** — runs on macOS/Linux today; custom kernel/distro later
- **Connector framework** — pluggable integrations (Google Calendar, Gmail, RSS, Linear, GitHub…)

---

## Quick start

### Prerequisites

```bash
# 1. Install Ollama — https://ollama.com
ollama pull qwen2.5:3b

# 2. Install Rust — https://rustup.rs
# 3. Install uv — https://astral.sh/uv
# 4. Install pnpm — npm i -g pnpm
```

### Run

```bash
# Terminal 1 — local LLM
ollama serve

# Terminal 2 — everything else
./scripts/dev.sh
```

Then open **http://localhost:5173**.

The UI shows "Generating your brief…" while Qwen processes (~30–60s on first run). When it's ready the brief appears and is spoken aloud automatically. Hit ▶ to replay.

### Individual processes

```bash
cargo run -p rikzal-daemon          # Rust daemon (tray + IPC + SQLite)
uv run rikzal-core                  # Python agents + FastAPI on :8765
cd ui && pnpm dev                   # React UI on :5173
```

---

## Project layout

```
RikZalRepo/
├── crates/
│   ├── rikzal-daemon/     Rust: tray app, Unix IPC server, SQLite
│   └── rikzal-tauri/      Rust: desktop shell (Phase 2)
├── packages/
│   ├── rikzal-core/       Python: LangGraph agents, Ollama, FastAPI, TTS
│   └── rikzal-connectors/ Python: Calendar, Gmail, RSS, Linear connectors
├── ui/                    React + Tailwind: Morning Brief + Sidebar
└── scripts/
    └── dev.sh             Orchestrates all three processes
```

---

## Connectors (Phase 2)

Connectors are Python packages that implement the `Connector` protocol and register via entry points. Built-in:

| Connector | Status | Data |
|-----------|--------|------|
| Google Calendar | ✅ Scaffolded | Meetings, events |
| Gmail | 🔜 Phase 2 | Inbox, threads |
| RSS / Atom | ✅ Done | News, blogs |
| Linear | 🔜 Phase 2 | Tasks, PRs |
| GitHub | 🔜 Phase 2 | PRs, CI status |
| Slack | 🔜 Phase 3 | Messages, mentions |

Adding a connector: implement `poll()` + `subscribe()`, return `RawEvent` objects, register in `pyproject.toml` entry points.

---

## Roadmap

| Phase | What |
|-------|------|
| **0** ✅ | Scaffolding — Rust daemon, Python agents, React UI, Qwen 2.5 3B |
| **1** ✅ | Morning Brief end-to-end — IPC wired, TTS, FastAPI, UI polling |
| **2** 🔜 | Real connectors — Google Calendar OAuth, Gmail, commitment NLP extraction |
| **3** 🔜 | Tauri desktop shell, macOS login hook, knowledge graph |
| **4** 🔜 | Custom Linux distro / kernel hooks, multi-device sync |

---

## Philosophy

Most AI tools today are apps you switch to. RikZal is an OS primitive — it runs beneath everything else, builds a model of your life over time, and gets smarter without you asking. The goal is a system that feels like a trusted colleague who knows your priorities, tracks your promises, and tells you what actually needs your attention — not what's merely new.

The human is always in charge. RikZal prepares; you decide.

---

*Local AI. Private by default. Built for people who think in systems.*
