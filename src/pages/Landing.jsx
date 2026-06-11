import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, checkEmailExists } from "../lib/auth";
import { updateSession, clearSession, getOrCreateSession } from "../lib/identity";

const TAGLINES = [
  "What's really going on around you.",
  "The city, unfiltered.",
  "Your neighborhood's inner monologue.",
  "Drop it. Read it. Gone tomorrow.",
]

function TaglineCycler() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % TAGLINES.length)
        setVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      style={{
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
        display: 'inline-block',
      }}
    >
      {TAGLINES[index]}
    </span>
  )
}

export default function Landing() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [mode, setMode] = useState("home"); // home | login | signup
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", penName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState(new Set());

  const validators = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address.',
    penName: v => {
      if (!v) return 'Pen name is required.'
      if (v.length < 3) return 'Pen name must be at least 3 characters.'
      if (v.length > 20) return 'Pen name must be 20 characters or fewer.'
      if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores.'
      if (/^_|_$/.test(v)) return "Can\'t start or end with an underscore."
      return null
    },
    password: v => {
      if (v.length < 8) return 'At least 8 characters.'
      if (!/[A-Z]/.test(v)) return 'Include at least one uppercase letter.'
      if (!/[0-9]/.test(v)) return 'Include at least one number.'
      return null
    },
  }

  function validateSignup() {
    const errs = {}
    const em = validators.email(form.email); if (em) errs.email = em
    const pn = validators.penName(form.penName); if (pn) errs.penName = pn
    const pw = validators.password(form.password); if (pw) errs.password = pw
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateLogin() {
    const errs = {}
    const em = validators.email(form.email); if (em) errs.email = em
    if (!form.password) errs.password = 'Password is required.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function onFieldBlur(field) {
    setTouched(prev => new Set([...prev, field]))
    const err = validators[field]?.(form[field])
    setFieldErrors(prev => ({ ...prev, [field]: err || undefined }))
  }

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (touched.has(field)) {
      const err = validators[field]?.(value)
      setFieldErrors(prev => ({ ...prev, [field]: err || undefined }))
    }
  }

  // If already enrolled and not here to sign up/in, go straight to map
  useEffect(() => {
    if (state?.openLogin || state?.openSignup) return;
    const session = getOrCreateSession();
    if (session.ageVerified && session.type) navigate("/map", { replace: true });
  }, []);

  // Detect Supabase post-verification redirect: /#access_token=...&type=signup
  // Show the verified banner and switch to login mode so they can sign in immediately
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    if (params.get('type') === 'signup' || params.get('type') === 'recovery') {
      setMode('login')
      // Clean the hash from the URL without a page reload
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      // Use router state to trigger the green banner
      navigate('.', { replace: true, state: { emailVerified: true } })
    }
  }, [])

  // Components navigate here with { openLogin } or { openSignup } to pre-select a mode
  function resetValidation() { setFieldErrors({}); setTouched(new Set()); }

  useEffect(() => {
    if (state?.openLogin) { setMode("login"); resetValidation(); if (state.prefillEmail) setForm(f => ({ ...f, email: state.prefillEmail })); }
    else if (state?.openSignup) { setMode("signup"); resetValidation(); }
  }, [state]);

  function handleAnon() {
    navigate("/age-gate", { state: { type: "anon" } });
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await signIn(form.email, form.password);
      clearSession(); // drop any prior anon session
      updateSession({
        id: data.session_id,
        type: "user",
        ageVerified: true,
        penName: data.pen_name,
        userId: data.user_id,
        supabaseToken: data.access_token,
        supabaseRefreshToken: data.refresh_token,
      });
      navigate("/map");
    } catch (err) {
      if (err.message.toLowerCase().includes("email not confirmed")) {
        navigate("/verify-email", { state: { email: form.email } });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!validateSignup()) return;
    setLoading(true);
    setError(null);
    try {
      const { exists, confirmed } = await checkEmailExists(form.email);
      if (exists && confirmed) {
        setFieldErrors(prev => ({ ...prev, email: 'An account with this email already exists.' }));
        setTouched(prev => new Set([...prev, 'email']));
        return;
      }
      if (exists && !confirmed) {
        // Account exists but email was never verified — navigate to resend page
        navigate('/verify-email', { state: { email: form.email } });
        return;
      }
      // Write to sessionStorage instead of history.state so the plaintext
      // password never persists in window.history where DevTools/XSS can read it.
      sessionStorage.setItem("pending_signup", JSON.stringify({
        email: form.email,
        password: form.password,
        penName: form.penName,
      }));
      navigate("/age-gate", { state: { type: "user" } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Animated background */}
      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) rotate(-8deg); }
          50% { transform: translateY(-18px) rotate(-8deg); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50% { transform: translateY(-12px) rotate(6deg); }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-22px) rotate(-3deg); }
        }
        @keyframes electricFlow {
          0% { stroke-dashoffset: 2000; opacity: 0.15; }
          30% { opacity: 0.45; }
          70% { opacity: 0.3; }
          100% { stroke-dashoffset: 0; opacity: 0.15; }
        }
        @keyframes electricFlow2 {
          0% { stroke-dashoffset: -1600; opacity: 0.1; }
          40% { opacity: 0.35; }
          100% { stroke-dashoffset: 0; opacity: 0.1; }
        }
        @keyframes electricPulse {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.22; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.07; }
          50% { opacity: 0.18; }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep glow blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-purple opacity-10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-red opacity-10 blur-[120px]" />

        {/* Electric city grid map */}
        <svg
          viewBox="0 0 1080 960"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full"
          style={{ animation: 'glowPulse 4s ease-in-out infinite' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glowStrong">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {[120,240,360,480,600,720,840,960].map(x => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="960" stroke="#7c3aed" strokeWidth="0.5" opacity="0.08" />
          ))}
          {[80,160,240,320,400,480,560,640,720,800,880].map(y => (
            <line key={`h${y}`} x1="0" y1={y} x2="1080" y2={y} stroke="#7c3aed" strokeWidth="0.5" opacity="0.08" />
          ))}
          <line x1="0" y1="960" x2="500" y2="0" stroke="#7c3aed" strokeWidth="0.5" opacity="0.06" />
          <line x1="200" y1="960" x2="700" y2="0" stroke="#7c3aed" strokeWidth="0.5" opacity="0.06" />
          <line x1="580" y1="960" x2="1080" y2="200" stroke="#7c3aed" strokeWidth="0.5" opacity="0.06" />

          <path
            d="M0,400 L120,400 L120,320 L360,320 L360,240 L600,240 L600,160 L840,160 L840,80 L1080,80"
            fill="none" stroke="#7c3aed" strokeWidth="1.5"
            strokeDasharray="2000" filter="url(#glow)"
            style={{ animation: 'electricFlow 3.8s ease-in-out infinite' }}
          />
          <path
            d="M0,640 L240,640 L240,560 L480,560 L480,480 L720,480 L720,400 L960,400 L960,320 L1080,320"
            fill="none" stroke="#7c3aed" strokeWidth="1"
            strokeDasharray="1800" filter="url(#glow)"
            style={{ animation: 'electricFlow 5.2s ease-in-out infinite 1.2s' }}
          />
          <path
            d="M1080,560 L960,560 L960,640 L720,640 L720,720 L480,720 L480,800 L240,800 L240,880 L0,880"
            fill="none" stroke="#e11d48" strokeWidth="1.5"
            strokeDasharray="1600" filter="url(#glow)"
            style={{ animation: 'electricFlow2 4.5s ease-in-out infinite 0.6s' }}
          />
          <path
            d="M540,0 L540,160 L480,160 L480,320 L420,320 L420,480 L360,480 L360,640 L300,640 L300,800 L240,800"
            fill="none" stroke="#e11d48" strokeWidth="1"
            strokeDasharray="1400" filter="url(#glow)"
            style={{ animation: 'electricFlow2 6s ease-in-out infinite 2s' }}
          />

          {[[120,320],[360,240],[600,160],[840,80],[240,640],[480,560],[720,480],[960,400],[480,800],[720,640]].map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3" fill="#7c3aed" opacity="0.5" filter="url(#glowStrong)"
              style={{ animation: `electricPulse ${2.5 + i*0.3}s ease-in-out infinite ${i*0.4}s` }} />
          ))}
          {[[960,560],[720,640],[480,720],[240,800]].map(([cx,cy], i) => (
            <circle key={`r${i}`} cx={cx} cy={cy} r="2.5" fill="#e11d48" opacity="0.5" filter="url(#glowStrong)"
              style={{ animation: `electricPulse ${3 + i*0.4}s ease-in-out infinite ${i*0.5}s` }} />
          ))}
        </svg>

        {/* Floating map markers */}
        <div className="absolute" style={{ top: '18%', left: '12%', animation: 'floatA 5.5s ease-in-out infinite', opacity: 0.55 }}>
          <svg width="52" height="66" viewBox="0 0 52 66" fill="none">
            <path d="M26 2C13.85 2 4 11.85 4 24c0 17 22 40 22 40s22-23 22-40C48 11.85 38.15 2 26 2z" fill="#e11d48" fillOpacity="0.25" stroke="#e11d48" strokeWidth="2" filter="url(#glowStrong)" />
            <circle cx="26" cy="24" r="8" fill="#e11d48" fillOpacity="0.6" />
          </svg>
        </div>
        <div className="absolute" style={{ top: '12%', right: '10%', animation: 'floatB 4.2s ease-in-out infinite 0.8s', opacity: 0.4 }}>
          <svg width="36" height="46" viewBox="0 0 52 66" fill="none">
            <path d="M26 2C13.85 2 4 11.85 4 24c0 17 22 40 22 40s22-23 22-40C48 11.85 38.15 2 26 2z" fill="#7c3aed" fillOpacity="0.2" stroke="#7c3aed" strokeWidth="2" />
            <circle cx="26" cy="24" r="8" fill="#7c3aed" fillOpacity="0.5" />
          </svg>
        </div>
        <div className="absolute" style={{ top: '28%', right: '22%', animation: 'floatC 3.6s ease-in-out infinite 1.6s', opacity: 0.28 }}>
          <svg width="22" height="28" viewBox="0 0 52 66" fill="none">
            <path d="M26 2C13.85 2 4 11.85 4 24c0 17 22 40 22 40s22-23 22-40C48 11.85 38.15 2 26 2z" fill="#e11d48" fillOpacity="0.15" stroke="#e11d48" strokeWidth="2.5" />
            <circle cx="26" cy="24" r="8" fill="#e11d48" fillOpacity="0.4" />
          </svg>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <span className="text-4xl font-black tracking-tight text-white">drop-a-thot</span>
          <div className="flex items-center gap-1 text-slate-400 text-sm min-h-[1.5em] justify-center">
            <TaglineCycler />
          </div>
        </div>

        {/* Email verified banner */}
        {state?.emailVerified && (
          <div className="w-full px-4 py-3 rounded-2xl bg-green-500/12 border border-green-500/35 text-green-400 text-sm text-center panel-slide-up flex items-center justify-center gap-2">
            <span>✓</span>
            <span>Email verified — you're good to go. Sign in below.</span>
          </div>
        )}

        {mode === "home" && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setMode("login")}
              className="w-full py-3.5 rounded-2xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={() => setMode("signup")}
              className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-base hover:bg-white/15 transition-colors cursor-pointer"
            >
              Create account
            </button>
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              onClick={handleAnon}
              className="w-full py-3.5 rounded-2xl bg-[#1a1a2e] border border-white/10 text-white font-semibold text-base hover:bg-[#22223a] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="text-lg">🎭</span>
              Use anonymously
            </button>
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => onFieldBlur('email')}
                  className={`w-full bg-[#1c1c2e] border rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none transition-colors ${fieldErrors.email ? 'border-red-500/70' : 'border-white/10 focus:border-brand-blue'}`}
                />
              </div>
              {fieldErrors.email && <p className="text-red-400 text-[11px] pl-2">{fieldErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  onBlur={() => onFieldBlur('password')}
                  className={`w-full bg-[#1c1c2e] border rounded-2xl py-3.5 pl-11 pr-11 text-white placeholder:text-slate-500 focus:outline-none transition-colors ${fieldErrors.password ? 'border-red-500/70' : 'border-white/10 focus:border-brand-blue'}`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-red-400 text-sm px-1">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-500 transition-colors cursor-pointer mt-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Log in"}
            </button>
            <button type="button" onClick={() => { setMode("home"); setError(null); resetValidation(); }} className="text-slate-500 text-sm hover:text-white cursor-pointer">
              ← Back
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="w-full flex flex-col gap-3">
            <h2 className="text-white font-bold text-xl text-center mb-1">Register Your Profile</h2>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-base">@</span>
                <input
                  type="text"
                  placeholder="Pen name"
                  value={form.penName}
                  onChange={e => handleChange('penName', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  onBlur={() => onFieldBlur('penName')}
                  maxLength={20}
                  className={`w-full bg-[#1c1c2e] border rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none transition-colors ${fieldErrors.penName ? 'border-red-500/70 focus:border-red-500' : 'border-white/10 focus:border-brand-purple'}`}
                />
              </div>
              {fieldErrors.penName && <p className="text-red-400 text-[11px] pl-2">{fieldErrors.penName}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => onFieldBlur('email')}
                  className={`w-full bg-[#1c1c2e] border rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none transition-colors ${fieldErrors.email ? 'border-red-500/70 focus:border-red-500' : 'border-white/10 focus:border-brand-purple'}`}
                />
              </div>
              {fieldErrors.email && <p className="text-red-400 text-[11px] pl-2">{fieldErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  onBlur={() => onFieldBlur('password')}
                  className={`w-full bg-[#1c1c2e] border rounded-2xl py-3.5 pl-11 pr-11 text-white placeholder:text-slate-500 focus:outline-none transition-colors ${fieldErrors.password ? 'border-red-500/70 focus:border-red-500' : 'border-white/10 focus:border-brand-purple'}`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-400 text-[11px] pl-2">{fieldErrors.password}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-brand-purple text-white font-semibold text-base hover:bg-violet-500 transition-colors cursor-pointer mt-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Send email verification"}
            </button>
            <button type="button" onClick={() => { setMode("home"); resetValidation(); }} className="text-slate-500 text-sm hover:text-white cursor-pointer">
              ← Back
            </button>
          </form>
        )}

        {/* Legal */}
        <p className="text-center text-xs text-slate-600 leading-relaxed px-2">
          By entering, you agree to our{" "}
          <a href="/legal/terms" className="underline text-slate-500 hover:text-white">Terms of Service</a>,{" "}
          <a href="/legal/privacy" className="underline text-slate-500 hover:text-white">Privacy Policy</a>, and{" "}
          <a href="/legal/safety" className="underline text-slate-500 hover:text-white">Safety Policy</a>.{" "}
          You must be 18 or older to enter.
        </p>
      </div>
    </div>
  );
}
