import { useEffect, useRef, useState } from "react";
import { Settings2, MessageSquarePlus, X, Send } from "lucide-react";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_THOTS = [
  { id: "1", x: 30,  y: 40,  text: "anyone else notice how the sky looks different at 3am",      penName: null, time: "2m ago" },
  { id: "2", x: 65,  y: 25,  text: "just dropped my phone in a puddle and it survived. we are SO back",  penName: "VoidDrifter", time: "5m ago" },
  { id: "3", x: 50,  y: 60,  text: "the coffee shop on 5th st has free wifi that actually works",  penName: "NeonEcho",   time: "11m ago" },
  { id: "4", x: 20,  y: 70,  text: "unpopular opinion: silence is underrated",                   penName: null, time: "18m ago" },
  { id: "5", x: 78,  y: 55,  text: "if you're reading this you're within a mile of me. spooky",   penName: "LiminalTrace",time: "23m ago" },
  { id: "6", x: 42,  y: 80,  text: "hot take: this city is better at night",                     penName: "ObsidianNode",time: "31m ago" },
];

// ─── Anonymous avatar SVG ─────────────────────────────────────────────────────
function AnonAvatar({ size = 44, color = "#7c3aed", active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="21" fill={color} fillOpacity="0.2" stroke={color} strokeWidth={active ? 2.5 : 1.5} />
      {/* Mask / anonymous face */}
      <ellipse cx="22" cy="19" rx="8" ry="7" fill={color} fillOpacity="0.6" />
      <ellipse cx="22" cy="35" rx="11" ry="8" fill={color} fillOpacity="0.4" />
      {/* Eye slits */}
      <ellipse cx="18.5" cy="18.5" rx="2" ry="1.2" fill="white" fillOpacity="0.8" />
      <ellipse cx="25.5" cy="18.5" rx="2" ry="1.2" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

// ─── Thot bubble ──────────────────────────────────────────────────────────────
function ThotBubble({ thot, isYou = false, onClick }) {
  const color = isYou ? "#e11d48" : (thot.penName ? "#7c3aed" : "#334155");
  const borderColor = isYou ? "#e11d48" : (thot.penName ? "#7c3aed" : "#475569");

  return (
    <div
      className="absolute flex flex-col items-center cursor-pointer group"
      style={{ left: `${thot.x}%`, top: `${thot.y}%`, transform: "translate(-50%, -100%)" }}
      onClick={() => onClick(thot)}
    >
      {/* Text bubble */}
      <div
        className="relative max-w-[180px] rounded-2xl rounded-bl-none px-3 py-2 mb-1 shadow-lg transition-transform duration-150 group-hover:scale-105"
        style={{ background: "#0e0e1a", border: `1px solid ${borderColor}40` }}
      >
        <p className="text-white text-xs leading-snug line-clamp-2">{thot.text}</p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px]" style={{ color: borderColor }}>
            {thot.penName || "anon"}
          </span>
          <span className="text-[10px] text-slate-600">{thot.time}</span>
        </div>
        {/* Bubble tail */}
        <div
          className="absolute -bottom-[6px] left-3 w-3 h-3"
          style={{
            background: "#0e0e1a",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            borderLeft: `1px solid ${borderColor}40`,
            borderBottom: `1px solid ${borderColor}40`,
          }}
        />
      </div>
      {/* Avatar */}
      <AnonAvatar size={36} color={isYou ? "#e11d48" : (thot.penName ? "#7c3aed" : "#64748b")} active={isYou} />
    </div>
  );
}

// ─── Compose drawer ───────────────────────────────────────────────────────────
function ComposeDrawer({ onClose, onPost }) {
  const [text, setText] = useState("");
  const MAX = 280;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#0e0e1a] border-t border-white/10 rounded-t-3xl p-5 flex flex-col gap-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-base">Drop a thot</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer"><X size={20} /></button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX))}
        placeholder="What's on your mind?"
        rows={3}
        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-brand-purple transition-colors text-sm"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${MAX - text.length < 30 ? "text-brand-red" : "text-slate-500"}`}>
          {MAX - text.length} remaining
        </span>
        <button
          onClick={() => { if (text.trim()) { onPost(text); onClose(); }}}
          disabled={!text.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-purple text-white font-semibold text-sm disabled:opacity-40 hover:bg-violet-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Send size={14} /> Post thot
        </button>
      </div>
    </div>
  );
}

// ─── Map page ─────────────────────────────────────────────────────────────────
export default function Map() {
  const [thots, setThots] = useState(MOCK_THOTS);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState(null);

  // "You" pin — center of map
  const YOU = { id: "you", x: 50, y: 50, text: "Tap + to drop your thot here", penName: null, time: "now" };

  function handlePost(text) {
    const newThot = {
      id: crypto.randomUUID(),
      x: 50, y: 50,
      text,
      penName: null,
      time: "just now",
    };
    setThots(prev => [newThot, ...prev]);
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f1e] select-none">
      {/* ── Fake dark map background ── */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e2a4a" strokeWidth="0.5"/>
          </pattern>
          <pattern id="bigGrid" width="300" height="300" patternUnits="userSpaceOnUse">
            <path d="M 300 0 L 0 0 0 300" fill="none" stroke="#1e3060" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
        <rect width="100%" height="100%" fill="url(#bigGrid)"/>
        {/* Fake streets */}
        <line x1="0" y1="35%" x2="100%" y2="38%" stroke="#162040" strokeWidth="8"/>
        <line x1="0" y1="62%" x2="100%" y2="60%" stroke="#162040" strokeWidth="12"/>
        <line x1="25%" y1="0" x2="22%" y2="100%" stroke="#162040" strokeWidth="6"/>
        <line x1="55%" y1="0" x2="58%" y2="100%" stroke="#162040" strokeWidth="10"/>
        <line x1="80%" y1="0" x2="78%" y2="100%" stroke="#162040" strokeWidth="5"/>
        <line x1="0" y1="18%" x2="100%" y2="20%" stroke="#162040" strokeWidth="4"/>
        <line x1="0" y1="80%" x2="100%" y2="82%" stroke="#162040" strokeWidth="7"/>
      </svg>

      {/* ── Thot pins ── */}
      {thots.map(t => (
        <ThotBubble key={t.id} thot={t} onClick={setSelected} />
      ))}
      {/* You */}
      <ThotBubble thot={YOU} isYou onClick={() => {}} />

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#0a0f1e] to-transparent">
        <span className="text-white font-black text-xl tracking-tight">Thots.</span>
        <button className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-slate-300 hover:bg-white/20 cursor-pointer">
          <Settings2 size={16} />
        </button>
      </div>

      {/* ── Compose button ── */}
      {!composing && (
        <button
          onClick={() => setComposing(true)}
          className="absolute bottom-6 right-5 z-20 w-14 h-14 rounded-full bg-brand-red shadow-lg flex items-center justify-center text-white hover:bg-rose-500 transition-colors cursor-pointer"
          style={{ boxShadow: "0 0 24px #e11d4860" }}
        >
          <MessageSquarePlus size={24} />
        </button>
      )}

      {/* ── Compose drawer ── */}
      {composing && <ComposeDrawer onClose={() => setComposing(false)} onPost={handlePost} />}

      {/* ── Selected thot detail ── */}
      {selected && (
        <div
          className="absolute inset-0 z-25 bg-black/40 flex items-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full bg-[#0e0e1a] border-t border-white/10 rounded-t-3xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <AnonAvatar size={40} color={selected.penName ? "#7c3aed" : "#64748b"} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-brand-purple font-semibold text-sm">{selected.penName || "Anonymous"}</span>
                  <span className="text-slate-600 text-xs">{selected.time}</span>
                </div>
                <p className="text-white text-sm leading-relaxed mt-1">{selected.text}</p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-500 text-sm hover:text-white cursor-pointer">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
