import { useAtom } from "jotai";
import { briefAtom } from "../store/atoms";
import type { AttentionItem } from "../lib/types";

const TYPE_LABEL: Record<string, string> = {
  meeting_prep:  "Meeting",
  commitment:    "Commitment",
  unread_thread: "Inbox",
  task:          "Task",
  news:          "News",
};

const TYPE_COLOR: Record<string, string> = {
  meeting_prep:  "var(--blue)",
  commitment:    "var(--amber)",
  unread_thread: "var(--fg-subtle)",
  task:          "var(--accent)",
  news:          "var(--fg-subtle)",
};

export default function Sidebar() {
  const [brief] = useAtom(briefAtom);
  const items   = brief?.items.slice(0, 10) ?? [];
  const urgent  = items.filter(
    (i) => i.item_type === "commitment" || i.item_type === "meeting_prep"
  ).length;

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        width: 272,
        background: "var(--bg-base)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-5 py-5 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Today's Focus
          </span>
        </div>
        {urgent > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(94,106,210,0.15)",
              color: "var(--accent)",
              border: "1px solid rgba(94,106,210,0.25)",
            }}
          >
            {urgent}
          </span>
        )}
      </div>

      {/* ── Queue ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div
              className="w-1 h-1 rounded-full animate-pulse-soft"
              style={{ background: "var(--accent)" }}
            />
            <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              {brief ? "Queue is clear" : "Loading…"}
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <QueueItem key={item.id} item={item} rank={idx + 1} />
          ))
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div
        className="px-5 py-4 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          {brief?.brief_date
            ? new Date(brief.brief_date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              })
            : "–"}
        </p>
      </div>
    </div>
  );
}

/* ── Queue item ──────────────────────────────────────────────── */
function QueueItem({ item, rank }: { item: AttentionItem; rank: number }) {
  const dotColor = TYPE_COLOR[item.item_type] ?? "var(--fg-subtle)";
  const typeLabel = TYPE_LABEL[item.item_type] ?? item.item_type;

  return (
    <div
      className="rounded-xl px-3 py-3 cursor-default transition-all duration-150 group"
      style={{
        border: "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--surface-hover)";
        el.style.borderColor = "var(--border)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "transparent";
        el.style.borderColor = "transparent";
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Rank */}
        <span
          className="text-xs font-semibold tabular-nums mt-0.5 shrink-0 w-4 text-right"
          style={{ color: "var(--fg-subtle)" }}
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          {/* Type badge */}
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-1 rounded-full shrink-0" style={{ background: dotColor }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: dotColor }}>
              {typeLabel}
            </span>
          </div>

          {/* Headline */}
          <p
            className="text-xs font-medium leading-snug"
            style={{ color: "var(--fg)" }}
          >
            {item.headline}
          </p>

          {/* Why now */}
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            {item.why_now}
          </p>

          {/* Action hint — visible on hover */}
          {item.action_hint && (
            <p
              className="text-xs mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 font-medium"
              style={{ color: "var(--accent)" }}
            >
              → {item.action_hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
