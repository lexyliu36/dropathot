import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldX, ShieldCheck, Heart, MessageCircle, Upload, Flag } from 'lucide-react'
import { AnonAvatar } from './ThotPin'
import CommentThread from './CommentThread'
import ShareSheet from './ShareSheet'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function ThotCard({ thot, accentColor, highlighted, onHype, session }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const isAuth = useAppStore((s) => s.session?.type === 'user')
  const [showComments, setShowComments] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [reported, setReported] = useState(false)
  const commentCount = thot.comment_count ?? 0
  const isOwn = thot.session_id === session?.id

  async function handleReport() {
    if (reported) return
    try {
      await fetch(`${API_URL}/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thot_id: thot.id, reason: 'user_report' }),
      })
      setReported(true)
    } catch (err) {
      console.error('Report failed:', err)
    }
  }

  return (
    <>
      <div
        className="py-3 px-1 transition-colors"
        style={highlighted ? {
          background: `${accentColor}0d`,
          borderRadius: '12px',
          padding: '10px 12px',
          border: `1px solid ${accentColor}28`,
        } : {
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Header: avatar + name + timestamp */}
        <div className="flex items-start gap-2.5">
          <div className="flex-shrink-0 mt-0.5">
            <AnonAvatar size={30} color={accentColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold leading-tight" style={{ color: accentColor }}>
                {thot.pen_name || 'anon'}
              </span>
              <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
            </div>

            {/* Content */}
            <p className="text-white/90 text-xs leading-relaxed mt-1 break-words">{thot.content}</p>

            {/* Action row */}
            <div className="flex items-center gap-4 mt-2.5">
              {/* Hype / Heart */}
              <button
                onClick={() => isAuth
                  ? onHype?.(thot.id)
                  : window.dispatchEvent(new CustomEvent('thots:needs-auth'))
                }
                title={isAuth ? (hyped ? 'Unlike' : 'Like') : 'Sign in to like'}
                className="flex items-center gap-1 transition-colors cursor-pointer group"
                style={{ background: 'none', border: 'none', padding: 0, color: hyped ? '#e11d48' : '#64748b' }}
              >
                <Heart
                  size={15}
                  style={{
                    fill: hyped ? '#e11d48' : 'none',
                    transition: 'fill 0.15s, color 0.15s',
                  }}
                />
                {hypeCount > 0 && (
                  <span className="text-[11px]" style={{ color: hyped ? '#e11d48' : '#64748b' }}>
                    {hypeCount}
                  </span>
                )}
              </button>

              {/* Comment */}
              <button
                onClick={() => setShowComments(v => !v)}
                className="flex items-center gap-1 transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0, color: showComments ? '#94a3b8' : '#64748b' }}
              >
                <MessageCircle size={15} />
                {commentCount > 0 && <span className="text-[11px]">{commentCount}</span>}
              </button>

              {/* Share */}
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1 transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0, color: '#64748b' }}
              >
                <Upload size={15} />
              </button>

              {/* Report — only for other people's thots */}
              {!isOwn && (
                <button
                  onClick={handleReport}
                  title={reported ? 'Reported' : 'Report this thot'}
                  className="flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: reported ? '#f97316' : '#3f4b5b',
                  }}
                >
                  <Flag size={13} style={{ fill: reported ? '#f97316' : 'none' }} />
                  {reported && <span className="text-[10px]" style={{ color: '#f97316' }}>reported</span>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Comment thread — indented under content */}
        {showComments && (
          <div className="mt-3 ml-9">
            <CommentThread thotId={thot.id} accentColor={accentColor} session={session} />
          </div>
        )}
      </div>

      {showShare && <ShareSheet thot={thot} onClose={() => setShowShare(false)} />}
    </>
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
                <span className="text-[9px] px-1 py-0.5 rounded-full font-medium leading-none"
                  style={{ background: 'rgba(225,29,72,0.15)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.3)' }}>
                  you
                </span>
              )}
            </div>
            <p className="text-slate-600 text-[10px] mt-0.5">
              {loading ? '…' : allThots.length === 0 ? 'no drops yet' : `${allThots.length} drop${allThots.length !== 1 ? 's' : ''}`}
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
              style={{ background: 'none', border: 'none' }}
            >
              {isBlocked ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Thot list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
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
            session={session}
          />
        ))}

        {/* Empty state */}
        {!loading && allThots.length === 0 && isYou && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-10 text-center">
            <p className="text-slate-500 text-xs leading-relaxed">You haven't dropped a thot yet.</p>
            {onCompose && (
              <button
                onClick={onCompose}
                className="rounded-xl py-2 px-5 text-sm font-semibold cursor-pointer"
                style={{ background: '#e11d48', color: '#fff', border: 'none' }}
              >
                Drop a thot
              </button>
            )}
            {!isAuth && (
              <p className="text-slate-600 text-[10px]">
                <button
                  onClick={() => navigate('/', { state: { openSignup: true } })}
                  className="underline cursor-pointer"
                  style={{ background: 'none', border: 'none', color: '#7c3aed' }}
                >Sign up</button> to keep your pen name
              </p>
            )}
          </div>
        )}

        {!loading && allThots.length > 0 && !isAuth && (
          <p className="text-slate-600 text-[10px] text-center py-3">
            <button
              onClick={() => navigate('/', { state: { openSignup: true } })}
              className="underline cursor-pointer"
              style={{ background: 'none', border: 'none', color: '#7c3aed' }}
            >Sign up</button> to like thots
          </p>
        )}
      </div>

      {/* Drop new thot CTA */}
      {isYou && onCompose && allThots.length > 0 && (
        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
          <button
            onClick={onCompose}
            className="w-full rounded-xl py-2.5 text-sm font-semibold cursor-pointer transition-colors"
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
