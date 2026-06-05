import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldX, ShieldCheck, ArrowBigUp } from 'lucide-react'
import { AnonAvatar } from './ThotPin'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ThotCard({ thot, accentColor, highlighted, onHype }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const isAuth = useAppStore((s) => s.session?.type === 'user')

  return (
    <div
      className="rounded-xl p-3 transition-colors"
      style={highlighted ? {
        background: `${accentColor}12`,
        border: `1px solid ${accentColor}35`,
      } : {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p className="text-white text-xs leading-relaxed">{thot.content}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-slate-500 text-[10px]">{relativeTime(thot.created_at)}</span>
        <button
          onClick={() => isAuth ? onHype?.(thot.id) : window.dispatchEvent(new CustomEvent('thots:needs-auth'))}
          title={isAuth ? (hyped ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
          style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '11px',
            color: hyped ? accentColor : 'rgba(255,255,255,0.3)',
            background: hyped ? `${accentColor}20` : 'transparent',
            border: 'none', borderRadius: '6px', padding: '2px 5px',
            cursor: isAuth ? 'pointer' : 'default',
            opacity: isAuth ? 1 : 0.45,
            transition: 'color 0.15s, background 0.15s',
          }}
        >
          <ArrowBigUp size={14} style={{ fill: hyped ? accentColor : 'none', strokeWidth: 1.5 }} />
          <span>{hypeCount}</span>
        </button>
      </div>
    </div>
  )
}

export default function ProfileSheet({ thot, session, isYouProfile = false, onCompose, onClose, onHype }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const blockedSessions = useAppStore((s) => s.blockedSessions)
  const blockSession = useAppStore((s) => s.blockSession)
  const unblockSession = useAppStore((s) => s.unblockSession)

  const isYou = isYouProfile || thot?.session_id === session?.id
  const isAuth = session?.type === 'user'
  const sessionId = isYou ? (session?.id ?? thot?.session_id) : thot?.session_id
  // For your own profile, prefer the session pen name (always current) over the thot's stored copy
  const penName = isYou
    ? (session?.penName ?? thot?.pen_name ?? null)
    : (thot?.pen_name ?? null)
  const accentColor = isYou ? '#e11d48' : thot?.pen_name ? '#7c3aed' : '#64748b'
  const isBlocked = blockedSessions.has(sessionId)

  useEffect(() => {
    if (!sessionId) { setHistory([]); setLoading(false); return }
    setLoading(true)
    fetch(`${API_URL}/thots?session_id=${sessionId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [sessionId])

  function toggleBlock() {
    if (isBlocked) unblockSession(sessionId)
    else blockSession(sessionId)
    onClose()
  }

  // All posts sorted newest first; highlighted thot first if present
  const allThots = history
    ? (thot ? [thot, ...history.filter(t => t.id !== thot.id)] : history)
    : (thot ? [thot] : [])

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <AnonAvatar size={30} color={accentColor} active={isYou} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm leading-tight" style={{ color: accentColor }}>
                {penName || 'Anonymous'}
              </span>
              {isYou && (
                <span className="text-[9px] bg-brand-red/20 text-brand-red border border-brand-red/30 px-1 py-0.5 rounded-full font-medium leading-none">
                  you
                </span>
              )}
            </div>
            <p className="text-slate-600 text-[10px] mt-0.5">
              {loading ? '…' : allThots.length === 0 ? 'no thots yet' : `${allThots.length} thot${allThots.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isYou && (
            <button
              onClick={toggleBlock}
              title={isBlocked ? 'Unblock' : 'Block'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isBlocked ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              {isBlocked ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Thot list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-slate-600 text-xs">Loading…</span>
          </div>
        )}
        {!loading && allThots.length > 0 && allThots.map((t) => (
          <ThotCard
            key={t.id}
            thot={t}
            accentColor={accentColor}
            highlighted={!!thot && t.id === thot.id}
            onHype={onHype}
          />
        ))}

        {/* Empty state — you've never posted */}
        {!loading && allThots.length === 0 && isYou && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-10 text-center">
            <p className="text-slate-500 text-xs leading-relaxed">
              You haven't dropped a thot yet.
            </p>
            {onCompose && (
              <button
                onClick={onCompose}
                style={{ background: '#e11d48', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Drop a thot
              </button>
            )}
            {!isAuth && (
              <p className="text-slate-600 text-[10px]">
                <button
                  onClick={() => navigate('/', { state: { openSignup: true } })}
                  className="text-brand-purple underline hover:text-violet-400 transition-colors cursor-pointer"
                >Sign up</button> to keep your pen name across sessions
              </p>
            )}
          </div>
        )}

        {!loading && allThots.length > 0 && !isAuth && (
          <p className="text-slate-600 text-[10px] text-center pt-2">
            <button
              onClick={() => navigate('/', { state: { openSignup: true } })}
              className="text-brand-purple underline hover:text-violet-400 transition-colors cursor-pointer"
            >Sign up</button> to upvote thots
          </p>
        )}
      </div>

      {/* Drop a new thot — shown when viewing your own profile and you have thots */}
      {isYou && onCompose && allThots.length > 0 && (
        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
          <button
            onClick={onCompose}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-colors cursor-pointer"
            style={{ background: '#e11d48', color: '#fff', border: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = '#be123c'}
            onMouseLeave={e => e.currentTarget.style.background = '#e11d48'}
          >
            + Drop a new thot
          </button>
        </div>
      )}
    </div>
  )
}
