# RikZal

Ambient intelligence layer for macOS/Linux — the JARVIS for daily work. Not a chatbot; a proactive OS-level partner that watches your context, surfaces what matters, and delegates cognitive load.

## Architecture

```
rikzal-daemon  (Rust)   — always-running tray app, Unix socket IPC, SQLite store
rikzal-core   (Python)  — LangGraph agents, Qwen 2.5 3B via Ollama, FastAPI server
ui            (React)   — Morning Brief window + Sidebar, polls core at :8765
```

## Dev setup

```bash
# Prerequisites
ollama serve                  # start Ollama (pulls qwen2.5:3b on first run)
ollama pull qwen2.5:3b        # if not already pulled

# Run everything
./scripts/dev.sh
```

- UI: http://localhost:5173
- Core API: http://localhost:8765/api/brief

## Key files

| Path | Purpose |
|------|---------|
| `packages/rikzal-core/rikzal_core/agents/morning_brief.py` | LangGraph brief pipeline |
| `packages/rikzal-core/rikzal_core/llm/ollama.py` | Qwen 2.5 3B provider |
| `packages/rikzal-core/rikzal_core/api.py` | FastAPI HTTP server (:8765) |
| `packages/rikzal-core/rikzal_core/ipc/__init__.py` | Unix socket client → daemon |
| `packages/rikzal-core/rikzal_core/tts/__init__.py` | macOS `say` TTS |
| `crates/rikzal-daemon/src/ipc/` | Rust IPC server + MessagePack protocol |
| `ui/src/windows/MorningBrief.tsx` | Morning Brief React component |

## Phase roadmap

- **Phase 0** ✅ — Scaffolding, mock data, Qwen 2.5 3B integration
- **Phase 1** ✅ — Morning Brief end-to-end: IPC wired, TTS, FastAPI, UI polling
- **Phase 2** — Real connectors (Google Calendar, Gmail), commitment NLP extraction
- **Phase 3** — Tauri shell, system login hook, persistent knowledge graph

## IPC protocol

Python → Rust via Unix socket (`~/.local/share/rikzal/rikzal.sock`).  
Wire format: 4-byte big-endian length + MessagePack body matching `Message` enum in `crates/rikzal-daemon/src/ipc/protocol.rs`.
