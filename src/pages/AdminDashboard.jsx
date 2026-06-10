import { useState, useEffect, useCallback, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'dat_admin_token'
const FAIL_KEY  = 'dat_admin_fails'

const PERIODS = ['1h', '24h', '7d', '30d']

// ── Lockout helpers ───────────────────────────────────────────────────────────

function getFailState() {
  try { return JSON.parse(localStorage.getItem(FAIL_KEY) || 'null') || { attempts: 0, lockedUntil: null } }
  catch { return { attempts: 0, lockedUntil: null } }
}

function saveFailState(s) { localStorage.setItem(FAIL_KEY, JSON.stringify(s)) }

function recordFail(current) {
  const attempts = (current.attempts || 0) + 1
  const lockedUntil = attempts >= 5 ? Date.now() + 10 * 60 * 1000 : (current.lockedUntil || null)
  const next = { attempts, lockedUntil }
  saveFailState(next)
  return next
}

function clearFails() { localStorage.removeItem(FAIL_KEY) }

// ── Time formatting ───────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtCountdown(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

// ── Detail row renderers ──────────────────────────────────────────────────────

function ThotRow({ item }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-white/5 last:border-0">
      <p className="text-sm text-white/90 leading-snug">{item.content}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="text-purple-400">{item.pen_name || 'anon'}</span>
        <span>{timeAgo(item.created_at)}</span>
        {item.hype_count > 0 && <span className="text-rose-400">♥ {item.hype_count}</span>}
        {item.hidden && <span className="text-yellow-600 font-medium">hidden</span>}
        <span className="font-mono text-gray-700">{item.id.slice(0, 8)}</span>
      </div>
    </div>
  )
}

function UserRow({ item }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm text-purple-400 font-medium">{item.pen_name}</span>
        {item.is_banned && <span className="text-xs text-red-500 font-medium">banned</span>}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>b. {item.birth_year}</span>
        <span>{timeAgo(item.created_at)}</span>
      </div>
    </div>
  )
}

function CommentRow({ item }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-white/5 last:border-0">
      <p className="text-sm text-white/90 leading-snug">{item.content}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{timeAgo(item.created_at)}</span>
        {item.hype_count > 0 && <span className="text-rose-400">♥ {item.hype_count}</span>}
        <span className="font-mono text-gray-700">thot {item.thot_id?.slice(0, 8)}</span>
      </div>
    </div>
  )
}

function ReportRow({ item }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-white/5 last:border-0 gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-white/80">{item.reason || 'no reason given'}</span>
        <span className="font-mono text-xs text-gray-600">thot {item.thot_id?.slice(0, 8)}</span>
      </div>
      <span className="text-xs text-gray-500 shrink-0">{timeAgo(item.created_at)}</span>
    </div>
  )
}

function SessionRow({ item }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="font-mono text-xs text-purple-400">{item.session_id.slice(0, 16)}…</span>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{item.thot_count} thot{item.thot_count !== 1 ? 's' : ''}</span>
        <span>last {timeAgo(item.last_seen)}</span>
      </div>
    </div>
  )
}

// ── Card → detail config ──────────────────────────────────────────────────────

const DETAIL_CONFIG = {
  new_thots:       { label: 'New Thots',          endpoint: p => `/admin/detail/thots?period=${p}`,    Row: ThotRow },
  new_sessions:    { label: 'New Sessions',        endpoint: p => `/admin/detail/sessions?period=${p}`, Row: SessionRow },
  new_users:       { label: 'New Users',           endpoint: p => `/admin/detail/users?period=${p}`,    Row: UserRow },
  new_comments:    { label: 'New Comments',        endpoint: p => `/admin/detail/comments?period=${p}`, Row: CommentRow },
  new_reports:     { label: 'Reports Filed',       endpoint: p => `/admin/detail/reports?period=${p}`,  Row: ReportRow },
  active_sessions: { label: 'Active Now',          endpoint: () => '/admin/detail/sessions?period=active', Row: SessionRow },
  total_thots:     { label: 'Total Thots',         endpoint: () => '/admin/detail/thots?period=all',    Row: ThotRow },
  total_users:     { label: 'Total Users',         endpoint: () => '/admin/detail/users?period=all',    Row: UserRow },
  hidden_thots:    { label: 'Hidden by Reports',   endpoint: () => '/admin/detail/thots/hidden',        Row: ThotRow },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ id, label, value, color = 'text-white', sub, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className="rounded-xl p-5 flex flex-col gap-1 text-left w-full transition-all"
      style={{
        background: '#0e0e1a',
        outline: active ? '2px solid #7c3aed' : '2px solid transparent',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
    >
      <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-4xl font-bold tabular-nums ${color}`}>
        {value === null ? <span className="text-gray-700">—</span> : value.toLocaleString()}
      </span>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
      <span className="text-xs text-gray-700 mt-1">tap to view →</span>
    </button>
  )
}

function DetailPanel({ type, period, token, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const config = DETAIL_CONFIG[type]

  useEffect(() => {
    if (!config) return
    setLoading(true)
    setError('')
    setData(null)
    fetch(`${API_URL}${config.endpoint(period)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setData(d))
      .catch(e => setError(`Failed to load (${e})`))
      .finally(() => setLoading(false))
  }, [type, period, token])

  if (!config) return null
  const { Row } = config

  return (
    <div className="mt-4 rounded-xl p-5" style={{ background: '#0e0e1a' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{config.label}</h3>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      {loading && (
        <div className="py-8 text-center text-gray-600 text-sm">Loading…</div>
      )}
      {error && (
        <div className="py-4 text-center text-red-400 text-sm">{error}</div>
      )}
      {!loading && !error && data?.length === 0 && (
        <div className="py-8 text-center text-gray-600 text-sm">No records found.</div>
      )}
      {data?.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          {data.map((item, i) => <Row key={item.id || item.session_id || i} item={item} />)}
        </div>
      )}
    </div>
  )
}

function LoginScreen({ onLogin, isLocked, countdown, attemptsLeft, loginError }) {
  const [input, setInput] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (isLocked || !input.trim()) return
    onLogin(input.trim())
    setInput('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: '#0e0e1a' }}>
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">DropAThot</h1>
          <p className="text-gray-500 text-sm mt-1">Admin access. Passcode required.</p>
        </div>

        {isLocked ? (
          <div className="text-center py-4">
            <p className="text-4xl font-bold tabular-nums text-red-500">{fmtCountdown(countdown)}</p>
            <p className="text-gray-500 text-sm mt-2">Too many failed attempts. Try again in {Math.ceil(countdown / 60)} min.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Passcode"
              autoFocus
              className="text-white text-sm rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-purple-600"
              style={{ background: '#16162a' }}
            />
            {loginError && (
              <p className="text-red-400 text-xs">
                {loginError}
                {attemptsLeft > 0 && ` ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`}
              </p>
            )}
            <button
              type="submit"
              className="text-white rounded-lg py-3 text-sm font-semibold transition-colors hover:opacity-90"
              style={{ background: '#7c3aed' }}
            >
              Access dashboard
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token, setToken]         = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [failState, setFailState] = useState(getFailState)
  const [countdown, setCountdown] = useState(0)
  const [period, setPeriod]       = useState('24h')
  const [stats, setStats]         = useState(null)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [loginError, setLoginError]   = useState('')
  const [activeDetail, setActiveDetail] = useState(null)
  const detailRef = useRef(null)

  const isLocked = Boolean(failState.lockedUntil && Date.now() < failState.lockedUntil)
  const attemptsLeft = Math.max(0, 5 - (failState.attempts || 0))

  // Lockout countdown
  useEffect(() => {
    if (!failState.lockedUntil) return
    function tick() {
      const remaining = Math.max(0, failState.lockedUntil - Date.now())
      setCountdown(Math.ceil(remaining / 1000))
      if (remaining <= 0) {
        clearFails()
        setFailState({ attempts: 0, lockedUntil: null })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [failState.lockedUntil])

  const fetchStats = useCallback(async (tok, per) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/admin/stats?period=${per}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY)
        const next = recordFail(failState)
        setFailState(next)
        setToken('')
        setLoginError('Incorrect passcode.')
        return
      }
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      const data = await res.json()
      setStats(data.stats)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [failState])

  useEffect(() => {
    if (!token) return
    fetchStats(token, period)
    const id = setInterval(() => fetchStats(token, period), 30_000)
    return () => clearInterval(id)
  }, [token, period, fetchStats])

  function handleLogin(passcode) {
    setLoginError('')
    sessionStorage.setItem(TOKEN_KEY, passcode)
    setToken(passcode)
  }

  function handleSignOut() {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
    setStats(null)
    setLoginError('')
    setActiveDetail(null)
  }

  function handleCardClick(id) {
    if (activeDetail === id) {
      setActiveDetail(null)
      return
    }
    setActiveDetail(id)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (!token) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLocked={isLocked}
        countdown={countdown}
        attemptsLeft={attemptsLeft}
        loginError={loginError}
      />
    )
  }

  const s = stats

  function card(id, label, value, color, sub) {
    return (
      <StatCard
        key={id}
        id={id}
        label={label}
        value={value}
        color={color}
        sub={sub}
        active={activeDetail === id}
        onClick={handleCardClick}
      />
    )
  }

  return (
    <div className="min-h-screen text-white p-6 md:p-10" style={{ background: '#0a0a0f' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">DropAThot <span className="text-gray-600 font-normal">admin</span></h1>
            <p className="text-gray-600 text-xs mt-1">
              {lastRefresh
                ? `Updated ${lastRefresh.toLocaleTimeString()}${loading ? ' · refreshing…' : ''}`
                : loading ? 'Loading…' : ''}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-gray-600 hover:text-gray-400 text-sm transition-colors mt-1"
          >
            Sign out
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setActiveDetail(null) }}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={period === p
                ? { background: '#7c3aed', color: '#fff' }
                : { background: '#0e0e1a', color: '#6b7280' }}
            >
              {p}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-6 text-sm text-red-400" style={{ background: '#1a0a0a' }}>
            {error}
          </div>
        )}

        {/* Activity in period */}
        <p className="text-gray-600 text-xs uppercase tracking-wider font-medium mb-3">
          Activity — last {period}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {card('new_thots',       'New thots',       s?.new_thots       ?? null, 'text-rose-500')}
          {card('new_sessions',    'New sessions',    s?.new_sessions    ?? null, 'text-purple-400')}
          {card('new_users',       'New users',       s?.new_users       ?? null, 'text-blue-400')}
          {card('new_comments',    'New comments',    s?.new_comments    ?? null, 'text-white')}
          {card('new_reports',     'Reports filed',   s?.new_reports     ?? null, 'text-yellow-400')}
          {card('active_sessions', 'Active now',      s?.active_sessions ?? null, 'text-green-400')}
        </div>

        {/* All-time totals */}
        <p className="text-gray-600 text-xs uppercase tracking-wider font-medium mt-6 mb-3">
          All time
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {card('total_thots',  'Total thots',       s?.total_thots  ?? null, 'text-white')}
          {card('total_users',  'Total users',       s?.total_users  ?? null, 'text-white')}
          {card('hidden_thots', 'Hidden by reports', s?.hidden_thots ?? null, 'text-red-700')}
        </div>

        {/* Detail panel */}
        {activeDetail && (
          <div ref={detailRef}>
            <DetailPanel
              type={activeDetail}
              period={period}
              token={token}
              onClose={() => setActiveDetail(null)}
            />
          </div>
        )}

      </div>
    </div>
  )
}
