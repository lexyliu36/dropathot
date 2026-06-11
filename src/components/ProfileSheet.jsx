import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldX, ShieldCheck, Heart, MessageCircle, Upload, Flag, Trash2 } from 'lucide-react'
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

function ThotCard({ thot, accentColor, highlighted, onHype, session, onDelete }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)

  function handleHypeClick() {
    if (!isAuth) { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }
    setHeartAnim(true)
    onHype?.(thot.id)
  }
  const isAuth = useAppStore((s) => s.session?.type === 'user')
  const [showComments, setShowComments] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const commentCount = thot.comment_count ?? 0
  const isOwn = thot.session_id === session?.id
  const reported = useAppStore((s) => s.reportedThotIds.has(thot.id))
  const addReportedThot = useAppStore((s) => s.addReportedThot)
  const removeReportedThot = useAppStore((s) => s.removeReportedThot)

  async function handleReport() {
    if (reported) {
      // Toggle off — remove the report
      if (!window.confirm('Remove your report on this thot?')) return
      try {
        await fetch(`${API_URL}/reports/${thot.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        removeReportedThot(thot.id)
      } catch (err) {
        console.error('Unreport failed:', err)
      }
      return
    }
    if (!window.confirm('Report this thot? It will be reviewed by moderators.')) return
    try {
      const r = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thot_id: thot.id, reason: 'user_report' }),
      })
      if (r.ok || r.status === 409) addReportedThot(thot.id)
    } catch (err) {
      console.error('Report failed:', err)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Hide this thot? It will be removed from the map and your history.')) return
    setDeleteError(null)
    try {
      const s = useAppStore.getState()
      const headers = {}
      if (s.session?.supabaseToken) headers['Authorization'] = `Bearer ${s.session.supabaseToken}`
      const r = await fetch(`${API_URL}/thots/${thot.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (r.ok) {
        const data = await r.json()
        // removeThot also clears selectedThot, collapsing the ProfileSheet
        s.removeThot(thot.id)
        if (data.restored) s.addThot({ ...data.restored, _isNew: true })
        onDelete?.(thot.id)
        setDeleted(true)
      } else {
        const err = await r.json().catch(() => ({}))
        console.error('[delete thot] server error:', r.status, err)
        setDeleteError(err.error ?? `Error ${r.status}`)
      }
    } catch (err) {
      console.error('[delete thot] network error:', err)
      setDeleteError('Network error — try again')
    }
  }

  if (deleted) return null

  return (
    <>
      <div
        className="py-3 px-2 rounded-xl transition-colors"
        style={highlighted ? {
          background: `${accentColor}0d`,
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
              <span className="text-xs sm:text-sm font-semibold leading-tight" style={{ color: accentColor }}>
                {thot.pen_name || 'anon'}
              </span>
              <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
            </div>

            {/* Content */}
            <p className="text-white/90 text-xs sm:text-sm leading-relaxed mt-1 break-words">{thot.content}</p>

            {/* Action row */}
            <div className="flex items-center gap-5 mt-3">
              {/* Hype / Heart */}
              <div className="relative group/tip">
                <button
                  onClick={handleHypeClick}
                  className="flex items-center gap-1.5 transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0, color: hyped ? '#e11d48' : '#64748b' }}
                >
                  <Heart
                    size={19}
                    className={heartAnim ? 'heart-pop' : ''}
                    onAnimationEnd={() => setHeartAnim(false)}
                    style={{ fill: hyped ? '#e11d48' : 'none', transition: 'fill 0.15s, color 0.15s' }}
                  />
                  {hypeCount > 0 && (
                    <span className="text-xs" style={{ color: hyped ? '#e11d48' : '#64748b' }}>{hypeCount}</span>
                  )}
                </button>
                <span className="action-tip">{isAuth ? (hyped ? 'Unlike' : 'Like') : 'Sign in'}</span>
              </div>

              {/* Comment */}
              <div className="relative group/tip">
                <button
                  onClick={() => setShowComments(v => !v)}
                  className="flex items-center gap-1.5 transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0, color: showComments ? '#94a3b8' : '#64748b' }}
                >
                  <MessageCircle size={17} />
                  {commentCount > 0 && <span className="text-xs">{commentCount}</span>}
                </button>
                <span className="action-tip">Comment</span>
              </div>

              {/* Share */}
              <div className="relative group/tip">
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-1 transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0, color: '#64748b' }}
                >
                  <Upload size={17} />
                </button>
                <span className="action-tip">Share</span>
              </div>

              {/* Delete — only for own thots */}
              {isOwn && (
                <div className="flex flex-col items-end ml-auto gap-1">
                  <div className="relative group/tip">
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-1 transition-colors cursor-pointer text-slate-700 hover:text-red-400"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      <Trash2 size={17} />
                    </button>
                    <span className="action-tip">Delete</span>
                  </div>
                  {deleteError && (
                    <span className="text-[10px]" style={{ color: '#f87171' }}>{deleteError}</span>
                  )}
                </div>
              )}

              {/* Report — only for other people's thots */}
              {!isOwn && (
                <div className="relative group/tip ml-auto">
                  <button
                    onClick={handleReport}
                    className="flex items-center gap-1 transition-colors cursor-pointer"
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: reported ? '#f97316' : '#3f4b5b',
                    }}
                  >
                    <Flag size={17} style={{ fill: reported ? '#f97316' : 'none' }} />
                  </button>
                  <span className="action-tip">{reported ? 'Reported' : 'Report'}</span>
                </div>
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
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
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
            onDelete={(id) => setHistory(prev => prev.filter(h => h.id !== id))}
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
                  onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'signup' }))}
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
              onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'signup' }))}
              className="underline cursor-pointer"
              style={{ background: 'none', border: 'none', color: '#7c3aed' }}
            >Sign up</button> to like thots
          </p>
        )}
      </div>

      {/* Drop new thot CTA */}
      {isYou && onCompose && allThots.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.05] flex-shrink-0">
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
