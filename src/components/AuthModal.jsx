import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react'
import { signIn, checkEmailExists } from '../lib/auth'
import { updateSession, clearSession } from '../lib/identity'

const validators = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address.',
  penName: v => {
    if (!v) return 'Pen name is required.'
    if (v.length < 3) return 'At least 3 characters.'
    if (v.length > 20) return '20 characters max.'
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Letters, numbers, underscores only.'
    if (/^_|_$/.test(v)) return "Can't start or end with an underscore."
    return null
  },
  password: v => {
    if (v.length < 8) return 'At least 8 characters.'
    if (!/[A-Z]/.test(v)) return 'One uppercase letter required.'
    if (!/[0-9]/.test(v)) return 'One number required.'
    return null
  },
}

export default function AuthModal({ initialMode = 'login', onClose, onSuccess }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(initialMode) // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', penName: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState(new Set())

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (touched.has(field)) {
      const err = validators[field]?.(value)
      setFieldErrors(prev => ({ ...prev, [field]: err || undefined }))
    }
  }

  function onFieldBlur(field) {
    setTouched(prev => new Set([...prev, field]))
    const err = validators[field]?.(form[field])
    setFieldErrors(prev => ({ ...prev, [field]: err || undefined }))
  }

  function switchMode(m) {
    setMode(m)
    setError(null)
    setFieldErrors({})
    setTouched(new Set())
  }

  async function handleLogin(e) {
    e.preventDefault()
    const errs = {}
    const em = validators.email(form.email); if (em) errs.email = em
    if (!form.password) errs.password = 'Password is required.'
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setLoading(true); setError(null)
    try {
      const data = await signIn(form.email, form.password)
      clearSession()
      updateSession({
        id: data.session_id,
        type: 'user',
        ageVerified: true,
        penName: data.pen_name,
        userId: data.user_id,
        supabaseToken: data.access_token,
        supabaseRefreshToken: data.refresh_token,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        navigate('/verify-email', { state: { email: form.email } })
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    const errs = {}
    const em = validators.email(form.email); if (em) errs.email = em
    const pn = validators.penName(form.penName); if (pn) errs.penName = pn
    const pw = validators.password(form.password); if (pw) errs.password = pw
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setLoading(true); setError(null)
    try {
      const exists = await checkEmailExists(form.email)
      if (exists) {
        setFieldErrors(prev => ({ ...prev, email: 'An account with this email already exists.' }))
        return
      }
      sessionStorage.setItem('pending_signup', JSON.stringify({
        email: form.email,
        password: form.password,
        penName: form.penName,
      }))
      navigate('/age-gate', { state: { type: 'user' } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputBase = (hasError) =>
    `w-full bg-[#1c1c2e] border rounded-2xl py-3 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none transition-colors text-sm ${
      hasError ? 'border-red-500/70' : 'border-white/10 focus:border-brand-blue'
    }`

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 relative"
        style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
        >
          <X size={15} />
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-white font-black text-2xl tracking-tight">drop-a-thot</span>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-2xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              style={{
                border: 'none',
                background: mode === m ? '#2563eb' : 'none',
                color: mode === m ? '#fff' : '#64748b',
              }}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-3">
          {/* Email */}
          <div>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                onBlur={() => onFieldBlur('email')}
                className={inputBase(!!fieldErrors.email)}
                style={{ fontSize: '16px' }}
              />
            </div>
            {fieldErrors.email && <p className="text-red-400 text-[11px] pl-2 mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Pen name — signup only */}
          {mode === 'signup' && (
            <div>
              <div className="relative">
                <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pen name"
                  value={form.penName}
                  onChange={e => handleChange('penName', e.target.value)}
                  onBlur={() => onFieldBlur('penName')}
                  className={inputBase(!!fieldErrors.penName)}
                  style={{ fontSize: '16px' }}
                />
              </div>
              {fieldErrors.penName && <p className="text-red-400 text-[11px] pl-2 mt-1">{fieldErrors.penName}</p>}
            </div>
          )}

          {/* Password */}
          <div>
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={form.password}
                onChange={e => handleChange('password', e.target.value)}
                onBlur={() => onFieldBlur('password')}
                className={inputBase(!!fieldErrors.password)}
                style={{ fontSize: '16px', paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {fieldErrors.password && <p className="text-red-400 text-[11px] pl-2 mt-1">{fieldErrors.password}</p>}
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-red-400 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl text-white font-semibold text-sm mt-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#2563eb', border: 'none' }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
