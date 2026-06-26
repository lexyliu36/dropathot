import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, checkEmailExists } from "../lib/auth";
import { updateSession, clearSession, getOrCreateSession } from "../lib/identity";
import dropaThotIcon from "../assets/dropathot-icon.svg";

const TAGLINES = [
  "What people near you are actually thinking.",
  "The city, unfiltered.",
  "Your neighborhood's inner monologue.",
  "The city's stream of consciousness.",
  "The unspoken thought of everyone around you.",
  "Thoughts drop. You find them.",
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
    if (session.ageVerified && session.type === 'user') navigate('/map', { replace: true });
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
    <div className="landing-bg relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#7c3aed]">
      {/* Animated background */}
      <style>{`
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @media (max-width: 639px) {
          .landing-bg {
            background: rgba(10,8,22,0.72) !important;
          }
          .landing-card {
            background: rgba(10,8,22,0.72) !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }
        }
      `}</style>
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Floating icon above card */}
        <div className="landing-card w-full px-6 py-8 flex flex-col items-center gap-6 rounded-3xl" style={{ background: "rgba(10,8,22,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "none" }}>
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="relative flex items-center justify-center">
            <span className="text-4xl font-black tracking-tight text-white">dropathot</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-sm min-h-[1.5em] justify-center">
            <span>Say what you want to say, any </span><span style={{ textDecoration: 'underline', textDecorationColor: '#c9a84c', textUnderlineOffset: '3px' }}>where</span><span>, any </span><span style={{ textDecoration: 'underline', textDecorationColor: '#c9a84c', textUnderlineOffset: '3px' }}>time</span><span>.</span>
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
              Log in to post
            </button>
            <button
              onClick={() => setMode("signup")}
              className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-base hover:bg-white/15 transition-colors cursor-pointer"
            >
              Create account
            </button>
            <button
              onClick={() => {
                updateSession({ type: 'viewer', ageVerified: true })
                navigate("/map")
              }}
              className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer"
            >
              View map anonymously
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
        </div>{/* end card */}
      </div>{/* end outer wrapper */}
    </div>
  );
}
