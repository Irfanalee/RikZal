import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { briefAtom } from "../store/atoms";
import type { AttentionItem, MorningBrief as MorningBriefType } from "../lib/types";

const API_URL  = "http://127.0.0.1:8765/api/brief";
const SPEAK_URL = "http://127.0.0.1:8765/api/speak";

export default function MorningBrief() {
  const [brief, setBrief] = useAtom(briefAtom);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const data: MorningBriefType | null = await res.json();
        if (data) {
          setBrief(data);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // core not ready yet — keep polling
      }
    };
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [setBrief]);

  if (!brief) return <LoadingState />;

  const meetings    = brief.items.filter((i) => i.item_type === "meeting_prep");
  const commitments = brief.items.filter((i) => i.item_type === "commitment");
  const unread      = brief.items.filter((i) => i.item_type === "unread_thread");

  const dateLabel = new Date(brief.brief_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div
      className="min-h-screen flex flex-col p-10 select-none"
      style={{ background: "var(--bg-deep)" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="mb-10 flex items-end justify-between">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--fg-muted)" }}
          >
            {dateLabel}
          </p>
          <h1
            className="text-4xl font-light leading-none tracking-tight"
            style={{ color: "var(--fg)" }}
          >
            Good morning.
          </h1>
        </div>

        {/* Logo mark */}
        <div className="flex items-center gap-2 opacity-40">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: "var(--fg)" }}>
            RikZal
          </span>
        </div>
      </header>

      {/* ── Narrative ──────────────────────────────────────────── */}
      {brief.narrative_text && (
        <NarrativeCard text={brief.narrative_text} />
      )}

      {/* ── Three columns ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
        <Column
          title="Today's Meetings"
          dot="var(--blue)"
          count={meetings.length}
          empty="No meetings scheduled"
        >
          {meetings.map((item) => (
            <ItemCard key={item.id} item={item} accent="blue" />
          ))}
        </Column>

        <Column
          title="Open Commitments"
          dot="var(--amber)"
          count={commitments.length}
          empty="Nothing outstanding"
        >
          {commitments.map((item) => (
            <ItemCard key={item.id} item={item} accent="amber" />
          ))}
        </Column>

        <Column
          title="Inbox"
          dot="var(--fg-subtle)"
          count={unread.length}
          empty="All caught up"
        >
          {unread.map((item) => (
            <ItemCard key={item.id} item={item} accent="neutral" />
          ))}
        </Column>
      </div>
    </div>
  );
}

/* ── Loading state ─────────────────────────────────────────────── */
function LoadingState() {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-3"
      style={{ background: "var(--bg-deep)" }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
        style={{ background: "var(--accent)" }}
      />
      <p className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
        Generating your brief…
      </p>
    </div>
  );
}

/* ── Narrative card ────────────────────────────────────────────── */
function NarrativeCard({ text }: { text: string }) {
  const replay = () =>
    fetch(SPEAK_URL, { method: "POST" }).catch(() => {});

  return (
    <div
      className="rounded-2xl p-5 flex items-start gap-5 group transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Accent bar */}
      <div
        className="mt-1 shrink-0 w-px h-full min-h-[3rem] rounded-full opacity-60"
        style={{ background: `linear-gradient(to bottom, var(--accent), transparent)` }}
      />

      <p
        className="flex-1 text-sm leading-[1.75] font-light"
        style={{ color: "var(--fg)", maxWidth: "72ch" }}
      >
        {text}
      </p>

      {/* Replay button */}
      <button
        onClick={replay}
        title="Replay audio"
        className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
        style={{
          background: "var(--surface-hover)",
          border: "1px solid var(--border)",
          color: "var(--fg-muted)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        }}
      >
        <svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor">
          <path d="M0 1.5A.5.5 0 0 1 .8 1l7 4a.5.5 0 0 1 0 .86l-7 4A.5.5 0 0 1 0 9.5v-8Z" />
        </svg>
      </button>
    </div>
  );
}

/* ── Column ────────────────────────────────────────────────────── */
function Column({
  title, dot, count, empty, children,
}: {
  title: string;
  dot: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <h2
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--fg-muted)" }}
        >
          {title}
        </h2>
        {count > 0 && (
          <span
            className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--surface-hover)",
              color: "var(--fg-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {count === 0
          ? <p className="text-xs italic" style={{ color: "var(--fg-subtle)" }}>{empty}</p>
          : children}
      </div>
    </div>
  );
}

/* ── Item card ─────────────────────────────────────────────────── */
type Accent = "blue" | "amber" | "neutral";

const accentLeft: Record<Accent, string> = {
  blue:    "var(--blue)",
  amber:   "var(--amber)",
  neutral: "var(--fg-subtle)",
};

function ItemCard({ item, accent }: { item: AttentionItem; accent: Accent }) {
  return (
    <div
      className="rounded-xl p-3.5 flex gap-3 cursor-default transition-all duration-150 group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--surface-hover)";
        el.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--surface)";
        el.style.borderColor = "var(--border)";
      }}
    >
      {/* Accent stripe */}
      <div
        className="shrink-0 w-0.5 rounded-full mt-0.5"
        style={{ background: accentLeft[accent], minHeight: "1.2rem" }}
      />

      <div className="min-w-0">
        <p
          className="text-sm font-medium leading-snug"
          style={{ color: "var(--fg)" }}
        >
          {item.headline}
        </p>
        <p
          className="text-xs mt-1 leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          {item.why_now}
        </p>
        {item.action_hint && (
          <p
            className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ color: "var(--fg-subtle)" }}
          >
            {item.action_hint}
          </p>
        )}
      </div>
    </div>
  );
}
