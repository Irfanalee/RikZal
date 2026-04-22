import { useAtom } from "jotai";
import { useEffect, useRef, useState, useCallback } from "react";
import { briefAtom, sidebarCollapsedAtom, personaAtom } from "../store/atoms";
import type { AttentionItem, MorningBrief as Brief } from "../lib/types";

const API_URL   = "http://127.0.0.1:8765/api/brief";
const SPEAK_URL = "http://127.0.0.1:8765/api/speak";
const SIDEBAR_W = 320;
const SIDEBAR_C = 48;
const PERSONAS  = ["Developer", "CEO", "Doctor", "Analyst"] as const;

/* ─── urgency helper ───────────────────────────────────────────── */
function urgency(item: AttentionItem): "high" | "soon" | "med" | "low" {
  const w = (item.why_now + item.headline).toLowerCase();
  if (w.includes("overdue") || w.includes("critical") || w.includes("failing")) return "high";
  if (w.includes("soon") || w.includes("min") || w.includes("8 min")) return "soon";
  if (item.item_type === "meeting_prep") return "med";
  return "low";
}
const uc  = (u: string) => u==="high"?"var(--red)":u==="soon"?"var(--amber)":u==="med"?"var(--cyan)":"var(--t4)";
const udim = (u: string) => u==="high"?"var(--red-dim)":u==="soon"?"var(--amber-dim)":u==="med"?"var(--cyan-dim)":"transparent";

/* ─── Waveform ─────────────────────────────────────────────────── */
function Waveform({ playing }: { playing: boolean }) {
  return (
    <div style={{ display:"flex", gap:2, alignItems:"center", height:18 }}>
      {[...Array(6)].map((_,i) => (
        <div key={i} style={{
          width:2, borderRadius:1, background:"var(--cyan)",
          height: playing ? undefined : 3,
          animation: playing ? `waveform ${0.55+i*0.1}s ease-in-out infinite alternate` : "none",
          animationDelay: `${i*0.07}s`,
          opacity: playing ? 0.9 : 0.25,
          transition:"opacity .3s",
        }}/>
      ))}
    </div>
  );
}

/* ─── Radial ring ──────────────────────────────────────────────── */
function Ring({ pct, size=36, stroke=3, color="var(--cyan)" }: { pct:number; size?:number; stroke?:number; color?:string }) {
  const r    = (size - stroke*2) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--s3)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
        strokeLinecap="round" style={{ transition:"stroke-dashoffset .6s ease" }}/>
    </svg>
  );
}

/* ─── Timeline strip ───────────────────────────────────────────── */
function TimelineStrip({ meetings }: { meetings: AttentionItem[] }) {
  const startH = 8, endH = 18;
  const now    = new Date();
  const nowH   = now.getHours() + now.getMinutes() / 60;
  const pct    = (h: number) => ((h - startH) / (endH - startH)) * 100;

  const COLORS = ["var(--cyan)","var(--amber)","var(--violet)","var(--green)"];

  // parse hour from "Meeting today at 9:00 AM"
  const parseHour = (why: string) => {
    const m = why.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    if (m[3]?.toUpperCase() === "PM" && h < 12) h += 12;
    if (m[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return h + parseInt(m[2]) / 60;
  };

  return (
    <div style={{ marginBottom:24, animation:"fadeUp .5s ease .08s both" }}>
      <div style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)", letterSpacing:".1em", marginBottom:8 }}>
        TODAY'S SCHEDULE · {startH}:00 → {endH}:00
      </div>
      <div style={{ position:"relative", height:28, background:"var(--s2)", borderRadius:6, overflow:"hidden", border:"1px solid var(--border)" }}>
        {meetings.map((m,i) => {
          const h = parseHour(m.why_now);
          if (h === null) return null;
          const left  = pct(h);
          const width = pct(h + 0.5) - left; // assume 30min default
          return (
            <div key={m.id} title={m.headline} style={{
              position:"absolute", top:4, bottom:4,
              left:`${left}%`, width:`${Math.max(width,3)}%`,
              background: COLORS[i % COLORS.length], opacity:.7, borderRadius:3,
              cursor:"pointer", transition:"opacity .15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity="1"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity=".7"}
            />
          );
        })}
        {/* Now indicator */}
        {nowH >= startH && nowH <= endH && (
          <div style={{ position:"absolute", top:0, bottom:0, left:`${pct(nowH)}%`, width:1.5, background:"var(--t1)", opacity:.5 }}/>
        )}
        {[9,11,13,15,17].map(h => (
          <div key={h} style={{ position:"absolute", bottom:-18, left:`${pct(h)}%`, transform:"translateX(-50%)", fontFamily:"var(--font-m)", fontSize:8, color:"var(--t4)" }}>{h}</div>
        ))}
      </div>
      <div style={{ height:20 }}/>
    </div>
  );
}

/* ─── Stat block ───────────────────────────────────────────────── */
function Stat({ label, value, sub, color="var(--t1)", accent }: { label:string; value:number; sub:string; color?:string; accent:string }) {
  return (
    <div style={{ flex:1, padding:"14px 16px", background:"var(--s1)", border:"1px solid var(--border)", borderRadius:8, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 0% 100%, ${accent} 0%, transparent 60%)`, opacity:.07, pointerEvents:"none" }}/>
      <div style={{ fontFamily:"var(--font-d)", fontSize:34, fontWeight:300, color, lineHeight:1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:500, color:"var(--t2)" }}>{label}</div>
      <div style={{ fontSize:10, color:"var(--t4)", marginTop:2 }}>{sub}</div>
    </div>
  );
}

/* ─── Meeting card ─────────────────────────────────────────────── */
function MeetingCard({ item, idx }: { item: AttentionItem; idx: number }) {
  const [hov, setHov] = useState(false);
  const COLORS = ["var(--cyan)","var(--amber)","var(--violet)","var(--green)"];
  const ac = COLORS[idx % COLORS.length];
  const u  = urgency(item);
  const isSoon = u === "soon";

  // parse time label from why_now
  const timeMatch = item.why_now.match(/(\d+:\d+\s*(?:AM|PM)?)/i);
  const timeLabel = timeMatch ? timeMatch[1] : "";

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", gap:12, padding:"11px 14px",
        background: hov ? "var(--s2)" : "var(--s1)",
        border:"1px solid", borderColor: hov ? "var(--border-hi)" : "var(--border)",
        borderRadius:8, cursor:"pointer", transition:"all .15s", position:"relative", overflow:"hidden",
      }}>
      <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:2, background:ac, borderRadius:1, opacity:.8 }}/>
      <div style={{ flexShrink:0, width:38, textAlign:"center", paddingLeft:4 }}>
        <div style={{ fontFamily:"var(--font-m)", fontSize:11, color: isSoon ? "var(--amber)" : "var(--t2)", fontWeight:500 }}>{timeLabel}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <span style={{ fontSize:12, fontWeight:500, color:"var(--t1)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.headline}</span>
          {isSoon && <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--amber)", background:"var(--amber-dim)", padding:"2px 6px", borderRadius:3, letterSpacing:".04em", flexShrink:0 }}>SOON</span>}
        </div>
        {item.action_hint && <div style={{ fontSize:11, color:"var(--t3)" }}>{item.action_hint}</div>}
      </div>
    </div>
  );
}

/* ─── Commitment card ──────────────────────────────────────────── */
function CommitmentCard({ item }: { item: AttentionItem }) {
  const [hov, setHov] = useState(false);
  const u = urgency(item);
  const isOverdue = item.why_now.toLowerCase().includes("overdue") || item.why_now.toLowerCase().includes("ago");

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding:"10px 14px",
        background: hov ? "var(--s2)" : "var(--s1)",
        border:"1px solid", borderColor: hov ? "var(--border-hi)" : "var(--border)",
        borderRadius:8, cursor:"pointer", transition:"all .15s",
      }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <div style={{ marginTop:1 }}><Ring pct={0} size={32} stroke={2.5} color={uc(u)}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"var(--t1)", marginBottom:2, lineHeight:1.35 }}>{item.headline}</div>
          {item.action_hint && <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>{item.action_hint}</div>}
          <div style={{ display:"flex", alignItems:"center" }}>
            <span style={{ marginLeft:"auto", fontFamily:"var(--font-m)", fontSize:10, color: isOverdue ? "var(--red)" : "var(--t3)" }}>{item.why_now}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inbox card ───────────────────────────────────────────────── */
function InboxCard({ item }: { item: AttentionItem }) {
  const [hov, setHov] = useState(false);
  const initials = item.headline.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", gap:10, padding:"10px 14px",
        background: hov ? "var(--s2)" : "var(--s1)",
        border:"1px solid", borderColor: hov ? "var(--border-hi)" : "var(--border)",
        borderRadius:8, cursor:"pointer", transition:"all .15s",
      }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:"50%", background:"var(--violet-dim)", border:"1.5px solid var(--violet)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-m)", fontSize:9, color:"var(--violet)" }}>{initials}</div>
        <div style={{ position:"absolute", top:-1, right:-1, width:7, height:7, borderRadius:"50%", background:"var(--cyan)", border:"1.5px solid var(--bg)" }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, color:"var(--t1)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.headline}</div>
        <div style={{ fontSize:11, color:"var(--t3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.why_now}</div>
        {item.action_hint && <div style={{ fontSize:10, color:"var(--t4)", marginTop:1 }}>{item.action_hint}</div>}
      </div>
    </div>
  );
}

/* ─── Column header ────────────────────────────────────────────── */
function ColHeader({ label, dot, count }: { label:string; dot:string; count:number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:dot }}/>
      <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t3)", letterSpacing:".1em", textTransform:"uppercase" as const }}>{label}</span>
      <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)", marginLeft:"auto" }}>{count}</span>
    </div>
  );
}

/* ─── Audio card ───────────────────────────────────────────────── */
function AudioCard({ text }: { text: string }) {
  const [playing, setPlaying]   = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const [expanded, setExpanded] = useState(false);
  const total = Math.max(30, Math.round(text.split(" ").length / 2.5)); // ~150wpm spoken

  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    if (playing) t = setInterval(() => setElapsed(e => { if (e >= total) { setPlaying(false); return total; } return e+1; }), 1000);
    return () => clearInterval(t!);
  }, [playing, total]);

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const togglePlay = useCallback(() => {
    if (!playing && elapsed >= total) setElapsed(0);
    setPlaying(p => !p);
    fetch(SPEAK_URL, { method:"POST" }).catch(() => {});
  }, [playing, elapsed, total]);

  const shortText = text.slice(0, 200) + (text.length > 200 ? "…" : "");

  return (
    <div style={{ background:"var(--s1)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 18px", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {/* Play/pause */}
        <button onClick={togglePlay} style={{
          width:32, height:32, borderRadius:"50%", border:"1px solid var(--border-hi)",
          background: playing ? "var(--cyan-dim)" : "var(--s2)",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", color:"var(--cyan)", flexShrink:0, transition:"all .2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background="var(--cyan-dim)"; (e.currentTarget as HTMLButtonElement).style.borderColor="var(--cyan)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background=playing?"var(--cyan-dim)":"var(--s2)"; (e.currentTarget as HTMLButtonElement).style.borderColor="var(--border-hi)"; }}>
          {playing
            ? <div style={{ display:"flex", gap:2.5 }}><div style={{ width:2.5, height:11, background:"var(--cyan)", borderRadius:1 }}/><div style={{ width:2.5, height:11, background:"var(--cyan)", borderRadius:1 }}/></div>
            : <svg width="11" height="11" viewBox="0 0 24 24" style={{ marginLeft:2 }}><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
          }
        </button>

        <Waveform playing={playing}/>

        {/* Scrub */}
        <div style={{ flex:1, height:2, background:"var(--s3)", borderRadius:1, cursor:"pointer" }}
          onClick={e => { const r=(e.currentTarget as HTMLDivElement).getBoundingClientRect(); setElapsed(Math.round(((e.clientX-r.left)/r.width)*total)); }}>
          <div style={{ height:"100%", width:`${(elapsed/total)*100}%`, background:"var(--cyan)", borderRadius:1, transition:"width .5s linear" }}/>
        </div>

        <span style={{ fontFamily:"var(--font-m)", fontSize:10, color:"var(--t4)", flexShrink:0 }}>{fmt(elapsed)}/{fmt(total)}</span>

        <button onClick={() => setExpanded(x=>!x)} style={{
          fontFamily:"var(--font-m)", fontSize:9, letterSpacing:".05em",
          padding:"3px 8px", borderRadius:3, cursor:"pointer",
          background:"transparent", border:"1px solid var(--border)", color:"var(--t3)", transition:"all .15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color="var(--t1)"; (e.currentTarget as HTMLButtonElement).style.borderColor="var(--border-hi)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color="var(--t3)"; (e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)"; }}>
          {expanded ? "COLLAPSE" : "READ"}
        </button>
      </div>

      <p style={{ fontSize:12.5, lineHeight:1.8, color:"var(--t2)", fontWeight:300, letterSpacing:".01em" }}>
        {expanded ? text : shortText}
      </p>
    </div>
  );
}

/* ─── TopBar ───────────────────────────────────────────────────── */
function TopBar({ persona, setPersona }: { persona:string; setPersona:(p:string)=>void }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const dateStr = time.toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"}).toUpperCase();
  const timeStr = time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false});

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 36px", borderBottom:"1px solid var(--border)", flexShrink:0, position:"relative", zIndex:1 }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ color:"var(--cyan)" }}>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".9"/>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1" opacity=".4"/>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".2"/>
          <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" opacity=".6"/>
          <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" opacity=".6"/>
          <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" opacity=".6"/>
          <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" opacity=".6"/>
        </svg>
        <span style={{ fontFamily:"var(--font-m)", fontSize:11, color:"var(--t4)", letterSpacing:".1em" }}>RIKZAL</span>
      </div>

      <div style={{ fontFamily:"var(--font-m)", fontSize:11, color:"var(--t3)", letterSpacing:".04em" }}>{dateStr} · {timeStr}</div>

      {/* Persona switcher */}
      <div style={{ display:"flex", gap:6 }}>
        {PERSONAS.map(p => (
          <button key={p} onClick={() => setPersona(p)} style={{
            fontFamily:"var(--font-m)", fontSize:9, letterSpacing:".05em",
            padding:"3px 8px", borderRadius:3, cursor:"pointer",
            background: persona===p ? "var(--cyan-dim)" : "transparent",
            border: `1px solid ${persona===p ? "var(--cyan)" : "var(--border)"}`,
            color: persona===p ? "var(--cyan)" : "var(--t3)",
            transition:"all .15s",
          }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── Status bar ───────────────────────────────────────────────── */
function StatusBar({ brief: _ }: { brief: Brief }) {
  const timeStr = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});
  return (
    <div style={{ borderTop:"1px solid var(--border)", padding:"8px 36px", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--green)", animation:"glow 2s ease infinite" }}/>
        <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)", letterSpacing:".07em" }}>ALL SYSTEMS NOMINAL</span>
      </div>
      <div style={{ width:1, height:10, background:"var(--border)" }}/>
      <span style={{ fontFamily:"var(--font-m)", fontSize:9, color:"var(--t4)" }}>
        BRIEF GENERATED{timeStr ? ` ${timeStr}` : ""} · LOCAL AI · PRIVATE
      </span>
    </div>
  );
}

/* ─── Loading state ────────────────────────────────────────────── */
function LoadingState({ sidebarW }: { sidebarW: number }) {
  return (
    <div style={{ position:"fixed", inset:0, right:sidebarW, background:"var(--bg)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, animation:"fadeIn .4s ease" }}>
      <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--cyan)", animation:"glow 2s ease infinite" }}/>
      <p style={{ fontFamily:"var(--font-m)", fontSize:11, color:"var(--t3)", letterSpacing:".07em" }}>GENERATING YOUR BRIEF…</p>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function MorningBrief() {
  const [brief, setBrief]       = useAtom(briefAtom);
  const [collapsed]             = useAtom(sidebarCollapsedAtom);
  const [persona, setPersona]   = useAtom(personaAtom);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const sidebarW                = collapsed ? SIDEBAR_C : SIDEBAR_W;

  // Poll API
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch(API_URL);
        if (!res.ok) return;
        const data: Brief | null = await res.json();
        if (data) { setBrief(data); if (intervalRef.current) clearInterval(intervalRef.current); }
      } catch { /* core not ready */ }
    };
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [setBrief]);

  if (!brief) return <LoadingState sidebarW={sidebarW}/>;

  const meetings    = brief.items.filter(i => i.item_type === "meeting_prep");
  const commitments = brief.items.filter(i => i.item_type === "commitment");
  const unread      = brief.items.filter(i => i.item_type === "unread_thread");
  const highCount   = brief.items.filter(i => urgency(i) === "high").length;

  return (
    <div style={{ position:"fixed", inset:0, right:sidebarW, background:"var(--bg)", display:"flex", flexDirection:"column", animation:"fadeIn .4s ease", overflow:"hidden", transition:"right .25s cubic-bezier(.4,0,.2,1)" }}>

      {/* Ambient orb */}
      <div style={{ position:"absolute", top:-120, left:"30%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, oklch(71% .13 194 / .06) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }}/>

      <TopBar persona={persona} setPersona={setPersona}/>

      {/* Scrollable body */}
      <div style={{ flex:1, overflow:"auto", padding:"28px 36px 20px", position:"relative", zIndex:1 }}>

        {/* ── Hero row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:24, marginBottom:24, animation:"fadeUp .5s ease both" }}>

          <div>
            <div style={{ fontFamily:"var(--font-d)", fontSize:46, fontWeight:300, lineHeight:1.1, letterSpacing:"-.01em", marginBottom:12 }}>
              Good morning, <em style={{ fontStyle:"italic" }}>there.</em>
            </div>
            <AudioCard text={brief.narrative_text}/>
          </div>

          {/* Stat blocks */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, width:148 }}>
            <Stat label="Meetings today"  value={meetings.length}    sub="Tap to see all"         color="var(--t1)"  accent="var(--cyan)"/>
            <Stat label="Open tasks"      value={commitments.length} sub={`${highCount} critical`} color="var(--red)" accent="var(--red)"/>
            <Stat label="Unread"          value={unread.length}      sub="In your inbox"           color="var(--amber)" accent="var(--amber)"/>
          </div>
        </div>

        {/* ── Timeline ── */}
        {meetings.length > 0 && <TimelineStrip meetings={meetings}/>}

        {/* ── 3 columns ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, animation:"fadeUp .5s ease .15s both" }}>

          <div>
            <ColHeader label="Meetings" dot="var(--cyan)" count={meetings.length}/>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {meetings.length === 0
                ? <p style={{ fontSize:11, color:"var(--t4)", fontStyle:"italic" }}>No meetings today</p>
                : meetings.map((m,i) => <MeetingCard key={m.id} item={m} idx={i}/>)}
            </div>
          </div>

          <div>
            <ColHeader label="Open Commitments" dot="var(--amber)" count={commitments.length}/>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {commitments.length === 0
                ? <p style={{ fontSize:11, color:"var(--t4)", fontStyle:"italic" }}>Nothing outstanding</p>
                : commitments.map(c => <CommitmentCard key={c.id} item={c}/>)}
            </div>
          </div>

          <div>
            <ColHeader label={`Inbox · ${unread.length} unread`} dot="var(--violet)" count={unread.length}/>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {unread.length === 0
                ? <p style={{ fontSize:11, color:"var(--t4)", fontStyle:"italic" }}>All caught up</p>
                : unread.map(u => <InboxCard key={u.id} item={u}/>)}
            </div>
          </div>
        </div>
      </div>

      <StatusBar brief={brief}/>
    </div>
  );
}
