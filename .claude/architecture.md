# RikZal Architecture

---

## 1. Services Architecture

High-level view of the three long-running processes and their runtime boundaries.

```mermaid
graph TB
    subgraph macOS["macOS / Linux Host"]

        subgraph Daemon["rikzal-daemon  (Rust · always-on)"]
            TRAY["System Tray"]
            IPC_SRV["IPC Server\n~/.local/share/rikzal/rikzal.sock"]
            DB["SQLite Store\nrikzal.db"]
            OS["OS Hooks\nlogin / wake observer"]
        end

        subgraph Core["rikzal-core  (Python · FastAPI)"]
            API["HTTP API\nlocalhost:8765"]
            AGENTS["LangGraph Agents"]
            LLM_MOD["LLM Provider\nqwen2.5:3b"]
            IPC_CLI["IPC Client\n(msgpack)"]
            TTS["TTS\nmacOS say"]
            NEWS_MOD["News Fetcher\nRSS cache 15 min"]
        end

        subgraph UI["ui  (React · Vite)"]
            MB["MorningBrief\nwindow"]
            SB["Sidebar\nwindow"]
        end

        subgraph External["Local AI"]
            OLLAMA["Ollama\nlocalhost:11434"]
        end

    end

    subgraph Internet["External APIs  (read-only)"]
        OMAPI["Open-Meteo\nWeather API"]
        GNEWS["Google News\nRSS"]
        TCAI["TechCrunch AI\nRSS"]
        NOM["Nominatim\nReverse Geocoding"]
    end

    OS -->|"wakes Core"| AGENTS
    AGENTS -->|"Unix socket\n4-byte len + msgpack"| IPC_SRV
    IPC_SRV --- DB
    IPC_SRV --- TRAY
    AGENTS --> LLM_MOD
    LLM_MOD -->|"HTTP /api/chat"| OLLAMA
    AGENTS --> TTS
    Core --> API
    API --> NEWS_MOD
    MB -->|"GET /api/brief\npoll 5 s"| API
    SB -->|"GET /api/news\npoll 5 min"| API
    MB -->|"POST /api/speak"| API
    MB -->|"Geolocation + fetch"| OMAPI
    MB -->|"Reverse geocode"| NOM
    NEWS_MOD -->|"feedparser"| GNEWS
    NEWS_MOD -->|"feedparser"| TCAI
```

---

## 2. Component-Based Architecture

Internal composition of each service: modules, files, and their responsibilities.

```mermaid
graph LR

    subgraph UI["ui/src"]
        direction TB
        MAIN["main.tsx\nReact root + Jotai Provider"]
        MB_C["windows/MorningBrief.tsx\nHero · Audio · Timeline\nStats · Columns · Weather"]
        SB_C["windows/Sidebar.tsx\nAttention Queue · News\nUrgency pills · Filter"]
        ATOMS["store/atoms.ts\nbriefAtom\nsidebarCollapsedAtom\npersonaAtom\nnewsFeedAtom"]
        TYPES["lib/types.ts\nAttentionItem\nMorningBrief\nNewsItem · NewsFeed\nConnectorStatus"]
        MAIN --> MB_C
        MAIN --> SB_C
        MB_C --> ATOMS
        SB_C --> ATOMS
        MB_C --> TYPES
        SB_C --> TYPES
        ATOMS --> TYPES
    end

    subgraph Core["packages/rikzal-core/rikzal_core"]
        direction TB
        API_M["api.py\nFastAPI app\n/brief /news /speak /health"]
        MAIN_M["main.py\nasync entry point\norchestration loop"]
        AGENT["agents/morning_brief.py\nLangGraph graph\nBriefState pipeline"]
        LLM_P["llm/protocol.py\nLLMProvider protocol"]
        LLM_O["llm/ollama.py\nOllamaProvider\ncomplete · embed · stream"]
        NEWS_M["news.py\nRSS fetcher\n15-min cache"]
        IPC_M["ipc/__init__.py\nUnix socket client\nsend_brief()"]
        TTS_M["tts/__init__.py\nmacOS say\nspeak()"]
        MODELS["store/models.py\nPydantic models\nMorningBrief · AttentionItem\nCommitment · Entity"]
        MAIN_M --> AGENT
        MAIN_M --> API_M
        AGENT --> LLM_P
        LLM_P --> LLM_O
        AGENT --> MODELS
        API_M --> MODELS
        API_M --> NEWS_M
        MAIN_M --> IPC_M
        MAIN_M --> TTS_M
    end

    subgraph Daemon["crates/rikzal-daemon/src"]
        direction TB
        DMAIN["main.rs\ntokio async runtime\ndata-dir setup"]
        DLIB["lib.rs\nrun() entry"]
        DIPC["ipc/mod.rs\nUnixListener server\nframe decode/dispatch"]
        DPROT["ipc/protocol.rs\nMessage enum\nBriefReady · AttentionUpdate\nConnectorStatus · Ping/Pong"]
        DDB["db/mod.rs\nSQLite init\nWAL schema migrations"]
        DTRAY["tray.rs\nmacOS tray icon\nstatus indicator"]
        DOS["os/mod.rs\nOS-level hooks\nlogin observer"]
        DMAIN --> DLIB
        DLIB --> DIPC
        DLIB --> DDB
        DLIB --> DTRAY
        DLIB --> DOS
        DIPC --> DPROT
    end
```

---

## 3. Traffic Routing

Request and data flows across all boundaries, annotated with protocols and ports.

```mermaid
sequenceDiagram
    autonumber
    participant OS as macOS Login Hook
    participant Daemon as rikzal-daemon<br/>(Rust)
    participant Core as rikzal-core<br/>(Python :8765)
    participant Ollama as Ollama<br/>(:11434)
    participant TTS as macOS say
    participant UI as React UI<br/>(:5173)
    participant Weather as Open-Meteo +<br/>Nominatim
    participant RSS as Google News +<br/>TechCrunch RSS

    OS->>Core: spawn process on login/wake
    Core->>Core: init FastAPI + LangGraph
    Core->>Ollama: GET /api/tags (health check)
    Core->>Core: gather_calendar (mock → future: SQLite)
    Core->>Core: gather_commitments (mock → future: SQLite)
    Core->>Ollama: POST /api/chat (rank_attention prompt)
    Ollama-->>Core: ranked attention items JSON
    Core->>Ollama: POST /api/chat (synthesize_narrative prompt)
    Ollama-->>Core: narrative text
    Core->>Daemon: Unix socket · 4-byte len + msgpack BriefReady
    Daemon-->>Core: (no response for BriefReady)
    Core->>TTS: subprocess macOS say

    loop Every 5 seconds until brief ready
        UI->>Core: GET http://127.0.0.1:8765/api/brief
        Core-->>UI: MorningBrief JSON (or null)
    end

    UI->>Weather: GET api.open-meteo.com/v1/forecast
    Weather-->>UI: temp · weather_code · daily H/L
    UI->>Weather: GET nominatim.openstreetmap.org/reverse
    Weather-->>UI: city · address JSON

    loop Every 5 minutes
        UI->>Core: GET http://127.0.0.1:8765/api/news
        alt cache stale > 15 min
            Core->>RSS: feedparser GET Google News RSS
            RSS-->>Core: top-5 world headlines
            Core->>RSS: feedparser GET TechCrunch AI RSS
            RSS-->>Core: top-5 AI headlines
        end
        Core-->>UI: NewsFeed JSON {general, ai}
    end

    UI->>Core: POST http://127.0.0.1:8765/api/speak
    Core->>TTS: subprocess macOS say (narrative)
```

---

## 4. Agentic Architecture

The LangGraph pipeline inside `rikzal-core` — state graph, node responsibilities, LLM touch-points, and planned connector expansions.

```mermaid
flowchart TD
    START(["▶ run_morning_brief()"])

    subgraph STATE["BriefState  (TypedDict)"]
        direction LR
        S1["date: str"]
        S2["calendar_events: list[dict]"]
        S3["open_commitments: list[dict]"]
        S4["unread_count: int"]
        S5["news_headlines: list[str]"]
        S6["attention_items: list[AttentionItem]"]
        S7["narrative_text: str"]
        S8["audio_path: str | None"]
    end

    subgraph GRAPH["LangGraph StateGraph"]
        direction TB

        N1["gather_calendar\n─────────────\nSource: SQLite raw_events\n(mock data · Phase 0)\nFuture: Google Calendar\nconnector sync"]

        N2["gather_commitments\n─────────────\nSource: SQLite commitments\n(mock data · Phase 0)\nFuture: NLP extraction\nfrom email + calendar"]

        N3["rank_attention\n─────────────\n🤖 LLM: qwen2.5:3b\nBuilds AttentionItem list\nfrom events + commitments\nFuture: semantic ranking\nvia embeddings"]

        N4["synthesize_narrative\n─────────────\n🤖 LLM: qwen2.5:3b\nGenerates ~200-word\nspoken briefing\nFuture: persona-aware\nvoice profiles"]

        N1 --> N2
        N2 --> N3
        N3 --> N4
    end

    DONE(["✓ MorningBrief\n  Pydantic model"])

    subgraph CONNECTORS["Phase 2 Connectors  (planned)"]
        direction LR
        GC["Google Calendar\nOAuth2 sync"]
        GM["Gmail\nthread reader"]
        SL["Slack\nmessage digest"]
        GH["GitHub\nPR + issue digest"]
    end

    subgraph MEMORY["Phase 3 Knowledge Graph  (planned)"]
        KG["Entity store\n(people · projects · orgs)"]
        EMB["Vector embeddings\nnomic-embed-text"]
        SQ["SQLite WAL\nraw_events · entities\ncommitments"]
    end

    START --> STATE
    STATE --> GRAPH
    N4 --> DONE
    DONE -->|"set_brief()"| API_OUT["FastAPI /api/brief"]
    DONE -->|"send_brief()"| IPC_OUT["Unix socket → Daemon"]
    DONE -->|"speak()"| TTS_OUT["macOS say TTS"]

    CONNECTORS -.->|"future feed"| N1
    CONNECTORS -.->|"future feed"| N2
    MEMORY -.->|"future context"| N3
    N3 -.->|"future write"| MEMORY

    style N3 fill:#0e3a4a,stroke:#06b6d4,color:#e2e8f0
    style N4 fill:#0e3a4a,stroke:#06b6d4,color:#e2e8f0
    style CONNECTORS fill:#1a1a2e,stroke:#f59e0b,color:#e2e8f0,stroke-dasharray:5 5
    style MEMORY fill:#1a1a2e,stroke:#8b5cf6,color:#e2e8f0,stroke-dasharray:5 5
```
