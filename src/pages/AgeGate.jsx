import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, ChevronLeft, RotateCcw, Loader2, Mail } from "lucide-react";
import { updateSession } from "../lib/identity";
import { signUp } from "../lib/auth";

// ─── Birth year scroll picker ────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - 18 - i);

function YearPicker({ value, onChange }) {
  const listRef = useRef(null);
  const ITEM_H = 48;

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    onChange(YEARS[idx]);
  }

  function scrollTo(year) {
    const idx = YEARS.indexOf(year);
    if (idx === -1 || !listRef.current) return;
    listRef.current.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    onChange(year);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-white/5 border border-white/10" style={{ height: ITEM_H * 5 }}>
      {/* Selection band */}
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-12 border-y border-brand-blue/50 bg-brand-blue/10 z-10" />
      {/* Fade top */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0e0e1a] to-transparent z-20" />
      {/* Fade bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0e0e1a] to-transparent z-20" />

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Padding so first/last items can center */}
        <div style={{ height: ITEM_H * 2 }} />
        {YEARS.map(y => (
          <div
            key={y}
            onClick={() => scrollTo(y)}
            className={`snap-center flex items-center justify-center cursor-pointer transition-all duration-150 ${
              y === value
                ? "text-white font-bold text-xl"
                : "text-slate-500 text-base"
            }`}
            style={{ height: ITEM_H }}
          >
            {y}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

// ─── Simple drag CAPTCHA ──────────────────────────────────────────────────────
const SHAPES = ["■", "▲", "●", "◆"];

function DragCaptcha({ onVerified }) {
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 30, y: 90 });
  const [solved, setSolved] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const TARGET = { x: 200, y: 90 };
  const TOLERANCE = 30;
  const shapeIdx = 1; // triangle

  function onMouseDown(e) {
    if (solved) return;
    setDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    e.preventDefault();
  }
  function onTouchStart(e) {
    if (solved) return;
    const t = e.touches[0];
    setDragging(true);
    setOffset({ x: t.clientX - pos.x, y: t.clientY - pos.y });
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(0, Math.min(clientX - offset.x, rect.width - 40));
    const ny = Math.max(0, Math.min(clientY - offset.y, rect.height - 40));
    setPos({ x: nx, y: ny });
  }
  function onUp() {
    if (!dragging) return;
    setDragging(false);
    const dist = Math.hypot(pos.x - TARGET.x, pos.y - TARGET.y);
    if (dist < TOLERANCE) {
      setPos(TARGET);
      setSolved(true);
      setTimeout(onVerified, 400);
    }
  }

  function reset() {
    setSolved(false);
    setPos({ x: 30, y: 90 });
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <p className="text-center text-white font-semibold text-base">Drag the shape to its outline</p>
      <p className="text-center text-slate-400 text-sm">Just confirming you're not a robot.</p>

      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-[#0e1020] select-none"
        style={{ height: 180 }}
        onMouseMove={e => onMove(e.clientX, e.clientY)}
        onMouseUp={onUp}
        onTouchMove={e => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onUp}
      >
        {/* Target outline */}
        <div
          className="absolute flex items-center justify-center text-4xl text-brand-blue/40 border-2 border-brand-blue/30 border-dashed rounded-lg"
          style={{ left: TARGET.x - 20, top: TARGET.y - 20, width: 48, height: 48 }}
        >
          {SHAPES[shapeIdx]}
        </div>

        {/* Draggable shape */}
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className={`absolute flex items-center justify-center text-4xl cursor-grab active:cursor-grabbing transition-colors ${
            solved ? "text-green-400" : "text-brand-blue"
          }`}
          style={{ left: pos.x, top: pos.y - 20, width: 48, height: 48, userSelect: "none" }}
        >
          {SHAPES[shapeIdx]}
        </div>

        {solved && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/10">
            <span className="text-green-400 font-bold text-lg">✓ Verified</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={reset} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm cursor-pointer">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

// ─── Main AgeGate page ────────────────────────────────────────────────────────
export default function AgeGate() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [step, setStep] = useState("age"); // age | captcha | email-sent
  const [year, setYear] = useState(2000);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState("");

  // Redirect to landing if accessed directly without going through the flow
  const flowType = state?.type || "anon";

  function handleAgeContinue() {
    if (!agreed) { setError("You must confirm you meet the age requirements."); return; }
    const age = CURRENT_YEAR - year;
    if (age < 18) { setError("You must be 18 or older to use drop-a-thot."); return; }
    setError("");
    setStep("captcha");
  }

  async function handleVerified() {
    if (flowType === "anon") {
      updateSession({ ageVerified: true, type: "anon" });
      navigate("/map");
      return;
    }

    // Signup flow — read credentials from sessionStorage, wipe immediately, then call API
    let pending;
    try {
      pending = JSON.parse(sessionStorage.getItem("pending_signup") || "null");
    } catch {}
    sessionStorage.removeItem("pending_signup"); // clear regardless of parse result

    if (!pending?.email || !pending?.password) {
      setError("Session expired. Please go back and try again.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await signUp(pending.email, pending.password, pending.penName, year);
      setSignedUpEmail(pending.email);
      setStep("email-sent");
    } catch (err) {
      setError(err.message);
      setStep("captcha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0f] px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-purple opacity-8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#0e0e1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Blue top bar */}
          <div className="h-1.5 bg-gradient-to-r from-brand-blue to-brand-purple" />

          <div className="p-6 flex flex-col gap-5">
            {step === "age" && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎂</span>
                    <h2 className="text-white font-bold text-xl">Age Check</h2>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-brand-blue flex items-center justify-center font-black text-white text-sm">18+</div>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed">
                  <strong className="text-white">Thots contains mature content</strong> so we need to verify your age.
                </p>

                <div>
                  <p className="text-white font-semibold text-sm mb-3">When were you born?</p>
                  <YearPicker value={year} onChange={setYear} />
                  <p className="text-brand-red text-xs mt-2 italic">This cannot be changed later.</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand-blue cursor-pointer"
                  />
                  <span className="text-slate-300 text-sm leading-relaxed">
                    I confirm <strong className="text-white">I meet all age requirements</strong> outlined in Thots'{" "}
                    <a href="#" className="text-brand-blue underline">Terms of Service</a>.
                  </span>
                </label>

                {error && <p className="text-brand-red text-sm">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex-1 py-3 rounded-2xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft size={16} /> Go back
                  </button>
                  <button
                    onClick={handleAgeContinue}
                    className="flex-1 py-3 rounded-2xl bg-brand-blue text-white font-semibold hover:bg-blue-500 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

            {step === "captcha" && (
              <>
                <DragCaptcha onVerified={handleVerified} />
                {submitting && (
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <Loader2 size={16} className="animate-spin" /> Creating your account…
                  </div>
                )}
                {error && <p className="text-brand-red text-sm text-center">{error}</p>}
                <div className="flex justify-start">
                  <button onClick={() => setStep("age")} className="text-slate-500 text-sm hover:text-white cursor-pointer flex items-center gap-1">
                    <ChevronLeft size={14} /> Back
                  </button>
                </div>
              </>
            )}

            {step === "email-sent" && (
              <div className="flex flex-col items-center gap-5 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center">
                  <Mail size={26} className="text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    We sent a confirmation link to{" "}
                    <span className="text-white font-semibold">{signedUpEmail}</span>.
                  </p>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Click it to verify your account, then come back here to log in.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/", { state: { openLogin: true } })}
                  className="w-full py-3 rounded-2xl bg-brand-blue text-white font-semibold hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Go to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
