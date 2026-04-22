import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { briefAtom, sidebarCollapsedAtom } from "../store/atoms";
import type { AttentionItem } from "../lib/types";

const SIDEBAR_W = 320;
const SIDEBAR_C = 48;

function urgency(item: AttentionItem): "high" | "soon" | "med" | "low" {
  const w = (item.why_now + item.headline).toLowerCase();
  if (w.includes("overdue") || w.includes("critical") || w.includes("failing")) return "high";
  if (w.includes("soon") || w.includes("min")) return "soon";
  if (item.item_type === "meeting_prep") return "med";
  return "low";
}

/* ─── Attention item ───────────────────────────────────────────── */
function AttentionRow({ item, rank, active, onClick }: { item: AttentionItem; rank: number; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const u     = urgency(item);
  const isHi  = u === "high" || u === "soon";
  const barC  = u === "high" ? "var(--red)" : u === "soon" ? "var(--amber)" : undefined;

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding:"9px 12px",
        background: active || hov ? "var(--s2)" : "transparent",
        border:"1px solid", borderColor: active ? "var(--border-hi)" : hov ? "var(--border)" : "transparent",
        borderRadius:6, cursor:"pointer", transition:"all .15s", position:"relative",
      }}>
      {isHi && (
        <div style={{
          position:"absolute", left:0, top:"18%", bottom:"18%", width:2, borderRadius:1,
          background: barC,
          boxShadow: u === "high" ? "0 0 5px var(--red)" : undefined,
        }}/>
      )}
      <div style={{ display:"flex", gap:8, paddingLeft: isHi ? 8 : 0 }}>
        <span style={{ fontFamily:"var(--font-m)", fontSize:8, color:"var(--t4)", width:12, flexShrink:0, marginTop:1 }}>
          {String(rank).padStart(2,"0")}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11.5, fontWeight:500, color: hov || active ? "var(--t1)" : "var(--t2)", lineHeight:1.3, marginBottom:2, transition:"color .15s" }}>{item.headline}</div>
          <div style={{ fontSize:10, color:"var(--t3)", lineHeight:1.4, marginBottom:5 }}>{item.why_now}</div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)", textTransform:"capitalize" as const }}>{item.item_type.replace("_"," ")}</span>
            {item.action_hint && (
              <span style={{ fontFamily:"var(--font-m)", fontSize:10, color:"var(--cyan)", opacity: hov || active ? 1 : 0, transition:"opacity .15s", marginLeft:"auto" }}>
                {item.action_hint} →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────── */
export default function Sidebar() {
  const [brief]                   = useAtom(briefAtom);
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const [active, setActive]       = useState<string | null>(null);
  const [filter, setFilter]       = useState("");
  const [time, setTime]           = useState(new Date());

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const fmtClock = (d: Date) => d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});

  const items    = brief?.items ?? [];
  const filtered = items.filter(i => !filter || i.headline.toLowerCase().includes(filter.toLowerCase()) || i.why_now.toLowerCase().includes(filter.toLowerCase()));

  const critCount = items.filter(i => urgency(i) === "high").length;
  const soonCount = items.filter(i => urgency(i) === "soon").length;
  const medCount  = items.filter(i => urgency(i) === "med").length;

  return (
    <div style={{
      position:"fixed", right:0, top:0, bottom:0,
      width: collapsed ? SIDEBAR_C : SIDEBAR_W,
      background:"var(--s1)", borderLeft:"1px solid var(--border)",
      display:"flex", flexDirection:"column",
      transition:"width .25s cubic-bezier(.4,0,.2,1)",
      zIndex:20, overflow:"hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: collapsed ? "14px 0" : "12px 14px",
        borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center",
        justifyContent: collapsed ? "center" : "space-between",
        gap:8, flexShrink:0,
      }}>
        {!collapsed && (
          <>
            <div>
              <div style={{ fontFamily:"var(--font-m)", fontSize:8, color:"var(--t4)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:2 }}>Attention Queue</div>
              <div style={{ fontFamily:"var(--font-m)", fontSize:12, color:"var(--t2)", letterSpacing:".02em" }}>{fmtClock(time)}</div>
            </div>
            <button onClick={() => setCollapsed(true)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--t3)", padding:4, display:"flex", alignItems:"center", transition:"color .15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color="var(--t1)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color="var(--t3)"}>
              <svg width="14" height="14" viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--t3)", display:"flex", alignItems:"center", transition:"color .15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color="var(--t1)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color="var(--t3)"}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <line x1="3" y1="7"  x2="21" y2="7"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Expanded content ── */}
      {!collapsed && (
        <>
          {/* Urgency pills */}
          {(critCount + soonCount + medCount) > 0 && (
            <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--border)", display:"flex", gap:5, flexShrink:0 }}>
              {critCount > 0 && <Pill label={`${critCount} critical`} color="red"/>}
              {soonCount > 0 && <Pill label={`${soonCount} soon`}     color="amber"/>}
              {medCount  > 0 && <Pill label={`${medCount} medium`}    color="cyan"/>}
            </div>
          )}

          {/* Filter */}
          <div style={{ padding:"7px 12px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            <input
              value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              style={{ width:"100%", background:"var(--s2)", border:"1px solid var(--border)", borderRadius:5, padding:"5px 9px", fontFamily:"var(--font-b)", fontSize:11, color:"var(--t2)", outline:"none", transition:"border-color .15s" }}
              onFocus={e  => (e.target as HTMLInputElement).style.borderColor="var(--border-hi)"}
              onBlur={e   => (e.target as HTMLInputElement).style.borderColor="var(--border)"}
            />
          </div>

          {/* List */}
          <div style={{ flex:1, overflow:"auto", padding:"6px 8px" }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize:11, color:"var(--t4)", fontStyle:"italic", padding:"12px 8px" }}>
                {brief ? "Queue is clear" : "Generating…"}
              </p>
            ) : (
              filtered.map((item, i) => (
                <div key={item.id} style={{ animation:`slideIn .3s ease ${i*.04}s both` }}>
                  <AttentionRow
                    item={item}
                    rank={i+1}
                    active={active === item.id}
                    onClick={() => setActive(active === item.id ? null : item.id)}
                  />
                  {i < filtered.length-1 && <div style={{ height:1, background:"var(--border)", margin:"2px 0", opacity:.5 }}/>}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--green)", animation:"pulse 2s ease infinite" }}/>
            <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)", letterSpacing:".05em" }}>AMBIENT · LOCAL AI RUNNING</span>
          </div>
        </>
      )}

      {/* ── Collapsed dots ── */}
      {collapsed && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:10, paddingTop:14 }}>
          {Array.from({ length: critCount }).map((_,i) => (
            <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--red)", boxShadow:"0 0 6px var(--red)" }}/>
          ))}
          {Array.from({ length: soonCount }).map((_,i) => (
            <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--amber)" }}/>
          ))}
          <div style={{ flex:1 }}/>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--green)", animation:"pulse 2s ease infinite", marginBottom:12 }}/>
        </div>
      )}
    </div>
  );
}

/* ─── Urgency pill ─────────────────────────────────────────────── */
function Pill({ label, color }: { label: string; color: "red"|"amber"|"cyan" }) {
  return (
    <div style={{
      fontFamily:"var(--font-m)", fontSize:9, letterSpacing:".04em",
      color:`var(--${color})`, background:`var(--${color}-dim)`,
      borderRadius:4, padding:"2px 7px",
    }}>{label}</div>
  );
}
