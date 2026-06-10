import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const STORAGE_KEY = 'thots_admin_token'

const PERIODS = ['1h', '24h', '7d', '30d']

function StatCard({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ background: '#0e0e1a' }}>
      <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-4xl font-bold tabular-nums ${color}`}>
        {value === null ? <span className="text-gray-700">—</span> : value.toLocaleString()}
      </span>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
    </div>
  )
}

function LoginScreen({ onLogin, error }) {
  const [input, setInput] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (input.trim()) onLogin(input.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: '#0e0e1a' }}>
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">Thots. Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your admin passcode to continue.</p>
        </div>
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
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            className="text-white rounded-lg py-3 text-sm font-semibold transition-colors hover:opacity-90"
            style={{ background: '#7c3aed' }}
          >
            Access dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '')
  const [period, setPeriod] = useState('24h')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [loginError, setLoginError] = useState('')

  const fetchStats = useCallback(async (tok, per) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/admin/stats?period=${per}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY)
        setToken('')
        setLoginError('Invalid passcode.')
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
    fetchStats(token, period)
    const id = setInterval(() => fetchStats(token, period), 30_000)
    return () => clearInterval(id)
  }, [token, period, fetchStats])

  function handleLogin(passcode) {
    setLoginError('')
    sessionStorage.setItem(STORAGE_KEY, passcode)
    setToken(passcode)
  }

  function handleSignOut() {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken('')
    setStats(null)
    setLoginError('')
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />
  }

  const s = stats

  return (
    <div className="min-h-screen text-white p-6 md:p-10" style={{ background: '#0a0a0f' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Thots. Admin</h1>
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
              onClick={() => setPeriod(p)}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard
            label="New thots"
            value={s?.new_thots ?? null}
            color="text-rose-500"
          />
          <StatCard
            label="New sessions"
            value={s?.new_sessions ?? null}
            color="text-purple-400"
            sub="unique session IDs"
          />
          <StatCard
            label="New users"
            value={s?.new_users ?? null}
            color="text-blue-400"
            sub="signed-up accounts"
          />
          <StatCard
            label="New comments"
            value={s?.new_comments ?? null}
          />
          <StatCard
            label="Reports filed"
            value={s?.new_reports ?? null}
            color="text-yellow-400"
          />
          <StatCard
            label="Active now"
            value={s?.active_sessions ?? null}
            color="text-green-400"
            sub="sessions in last 30 min"
          />
        </div>

        {/* All-time totals */}
        <p className="text-gray-600 text-xs uppercase tracking-wider font-medium mb-3">
          All time
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total thots" value={s?.total_thots ?? null} />
          <StatCard label="Total users" value={s?.total_users ?? null} />
          <StatCard
            label="Hidden by reports"
            value={s?.hidden_thots ?? null}
            color="text-red-700"
            sub="auto-moderated"
          />
        </div>

      </div>
    </div>
  )
}
