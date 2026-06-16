import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'dat_admin_token'
const PERIODS = ['1h', '24h', '7d', '30d']

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
          <h1 className="text-white text-2xl font-bold">dropathot</h1>
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
                {attemptsLeft > 0 && attemptsLeft < 5 && ` ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`}
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


// ── Moderation review panel ───────────────────────────────────────────────────

function ReviewPanel({ token, type, id, onDone }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [done, setDone] = useState(null) // result message

  useEffect(() => {
    if (!id || !token) return
    setLoading(true)
    fetch(`${API_URL}/admin/review/${type}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(`Failed to load (${e})`); setLoading(false) })
  }, [type, id, token])

  async function doAction(action, body = {}) {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_URL}/admin/review/${type}/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.status)
      setDone(`Done: ${action}${json.emailed ? ' · email sent to user' : ''}`)
    } catch (e) { setError(e.message) }
    setActionLoading(false)
  }

  function BtnRed({ label, action, confirm: msg, body }) {
    return (
      <button
        onClick={() => { if (!msg || window.confirm(msg)) doAction(action, body || {}) }}
        disabled={actionLoading || !!done}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: '#e11d48', color: '#fff' }}
      >
        {label}
      </button>
    )
  }
  function BtnGreen({ label, action, confirm: msg, body }) {
    return (
      <button
        onClick={() => { if (!msg || window.confirm(msg)) doAction(action, body || {}) }}
        disabled={actionLoading || !!done}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: '#16a34a', color: '#fff' }}
      >
        {label}
      </button>
    )
  }

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>

  return (
    <div className="mt-8 rounded-2xl overflow-hidden" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg,#e11d48,#7c3aed)' }} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-500">
            {type === 'thot' ? 'Thot Review' : 'User Review'}
          </p>
          <button onClick={onDone} className="text-gray-600 hover:text-gray-400 text-xs">✕ close</button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {done && <p className="text-green-400 text-sm mb-4 font-medium">{done}</p>}

        {type === 'thot' && data && (() => {
          const { thot, reports } = data
          return (
            <>
              {/* Thot content */}
              <div className="rounded-xl p-4 mb-5" style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-white text-sm leading-relaxed mb-2">"{thot.content}"</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="text-purple-400">{thot.pen_name || 'anon'}</span>
                  <span>{timeAgo(thot.created_at)}</span>
                  <span>♥ {thot.hype_count}</span>
                  {thot.hidden && <span className="text-yellow-500">hidden</span>}
                </div>
              </div>

              {/* Reports */}
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Reports ({reports.length})</p>
              <div className="space-y-2 mb-6">
                {reports.map(r => (
                  <div key={r.id} className="text-xs text-gray-400 py-1.5 border-b border-white/5 last:border-0">
                    {r.reason || <span className="text-gray-600 italic">no reason given</span>}
                    <span className="ml-2 text-gray-600">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <BtnGreen label="✓ Unhide (restore)" action="unhide" confirm="Restore this thot to the map? The author will be emailed." />
                <BtnRed label="✕ Keep removed" action="remove" confirm="Permanently remove this thot? The author will be emailed." body={{ reason: 'Violated community guidelines' }} />
              </div>
            </>
          )
        })()}

        {type === 'user' && data && (() => {
          const { user, reports, thots, comments } = data
          return (
            <>
              {/* User info */}
              <div className="rounded-xl p-4 mb-5" style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-white text-base font-bold mb-1">{user.pen_name}</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>Joined {timeAgo(user.created_at)}</span>
                  <span>b. {user.birth_year}</span>
                  {user.is_banned && <span className="text-red-400 font-medium">BANNED</span>}
                </div>
              </div>

              {/* Reports */}
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Reports ({reports.length})</p>
              <div className="space-y-1 mb-5">
                {reports.map(r => (
                  <div key={r.id} className="text-xs text-gray-400 py-1.5 border-b border-white/5 last:border-0">
                    {r.reason || <span className="text-gray-600 italic">no reason</span>}
                    <span className="ml-2 text-gray-600">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>

              {/* Their thots */}
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Thots ({thots.length})</p>
              <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
                {thots.map(t => (
                  <div key={t.id} className="py-2 border-b border-white/5 last:border-0">
                    <p className="text-sm text-white/80 leading-snug">{t.content}</p>
                    <div className="flex gap-2 text-xs text-gray-600 mt-0.5">
                      <span>{timeAgo(t.created_at)}</span>
                      {t.hidden && <span className="text-yellow-600">hidden</span>}
                      <span>♥ {t.hype_count}</span>
                    </div>
                  </div>
                ))}
                {thots.length === 0 && <p className="text-gray-600 text-xs">No thots</p>}
              </div>

              {/* Their comments */}
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Comments ({comments.length})</p>
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="py-2 border-b border-white/5 last:border-0">
                    <p className="text-sm text-white/80 leading-snug">{c.content}</p>
                    <span className="text-xs text-gray-600">{timeAgo(c.created_at)}</span>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-gray-600 text-xs">No comments</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {user.is_banned ? (
                  <BtnGreen label="✓ Reinstate user" action="unban" confirm={`Reinstate ${user.pen_name}? They will be emailed that their account is restored.`} />
                ) : (
                  <>
                    <BtnGreen label="✓ No action — notify user" action="dismiss" confirm={`Email ${user.pen_name} that their reports were reviewed and no action was taken?`} />
                    <BtnRed label="⊘ Ban + hide all posts" action="ban" confirm={`Ban ${user.pen_name}? Their thots will be hidden and they will be emailed.`} body={{ reason: 'Repeated violations of community guidelines' }} />
                  </>
                )}
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [token, setToken]         = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [lockedUntil, setLockedUntil] = useState(null) // timestamp ms — set from server 429
  const [countdown, setCountdown] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(5)
  const [period, setPeriod]       = useState('24h')
  const [stats, setStats]         = useState(null)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [loginError, setLoginError]   = useState('')
  const [activeDetail, setActiveDetail] = useState(null)
  const [seedVisible, setSeedVisible] = useState(null) // null=loading, true=visible, false=hidden
  const [seedToggling, setSeedToggling] = useState(false)
  const detailRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const reviewType = searchParams.get('review') // 'thot' | 'user'
  const reviewId   = searchParams.get('id')

  const isLocked = Boolean(lockedUntil && Date.now() < lockedUntil)

  // Lockout countdown — driven by server-returned retryAfter
  useEffect(() => {
    if (!lockedUntil) return
    function tick() {
      const remaining = Math.max(0, lockedUntil - Date.now())
      setCountdown(Math.ceil(remaining / 1000))
      if (remaining <= 0) setLockedUntil(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const fetchStats = useCallback(async (tok, per) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/admin/stats?period=${per}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setLockedUntil(Date.now() + (data.retryAfter ?? 600) * 1000)
        sessionStorage.removeItem(TOKEN_KEY)
        setToken('')
        return
      }
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        sessionStorage.removeItem(TOKEN_KEY)
        setToken('')
        setAttemptsLeft(data.attemptsLeft ?? 0)
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
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/admin/seed/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSeedVisible(d.visible)).catch(() => {})
  }, [token])

  async function handleSeedToggle() {
    setSeedToggling(true)
    try {
      const res = await fetch(`${API_URL}/admin/seed/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSeedVisible(data.visible)
    } catch (e) {
      setError('Seed toggle failed: ' + e.message)
    } finally {
      setSeedToggling(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchStats(token, period)
    const id = setInterval(() => fetchStats(token, period), 30_000)
    return () => clearInterval(id)
  }, [token, period, fetchStats])

  async function handleLogin(passcode) {
    setLoginError('')
    // Probe the server first — this will 429 if locked, 401 if wrong, 200 if correct
    try {
      const res = await fetch(`${API_URL}/admin/stats?period=1h`, {
        headers: { Authorization: `Bearer ${passcode}` },
      })
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setLockedUntil(Date.now() + (data.retryAfter ?? 600) * 1000)
        setLoginError('Too many failed attempts.')
        return
      }
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        setAttemptsLeft(data.attemptsLeft ?? 0)
        setLoginError('Incorrect passcode.')
        return
      }
      if (res.status === 503) { setLoginError('Admin not configured on server.'); return }
    } catch { setLoginError('Could not reach server.'); return }
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
            <h1 className="text-2xl font-bold">dropathot <span className="text-gray-600 font-normal">admin</span></h1>
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

        {/* Seed data toggle */}
        <div className="mt-6 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-sm text-white/70 font-medium">Seed data</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {seedVisible === null ? 'Checking…' : seedVisible ? 'Currently visible on map' : 'Hidden from map'}
            </p>
          </div>
          <button
            onClick={handleSeedToggle}
            disabled={seedToggling || seedVisible === null}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40"
            style={seedVisible
              ? { background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed55' }
              : { background: '#e11d4822', color: '#fb7185', border: '1px solid #e11d4855' }}
          >
            {seedToggling ? 'Updating…' : seedVisible ? 'Hide seed data' : 'Show seed data'}
          </button>
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

        {/* Moderation review panel (opened from email link) */}
        {reviewType && reviewId && (
          <ReviewPanel
            token={token}
            type={reviewType}
            id={reviewId}
            onDone={() => setSearchParams({})}
          />
        )}

      </div>
    </div>
  )
}
