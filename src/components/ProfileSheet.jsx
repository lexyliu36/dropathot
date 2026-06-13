import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ShieldX, ShieldCheck, Heart, MessageCircle, Upload, Flag, Trash2, UserPlus, UserMinus, MessageSquare, AlertTriangle, MoreVertical, Eye, EyeOff } from 'lucide-react'
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

function ThotCard({ thot, accentColor, highlighted, onHype, session, onDelete, defaultOpenComments, onFlyTo }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)

  function handleHypeClick() {
    if (!isAuth) { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }
    setHeartAnim(true)
    onHype?.(thot.id)
  }
  const isAuth = useAppStore((s) => s.session?.type === 'user')
  const [showComments, setShowComments] = useState(defaultOpenComments ?? false)
  const [showShare, setShowShare] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const commentCount = thot.comment_count ?? 0
  const isOwn = thot.session_id === session?.id
  const isVisible = useAppStore((s) => s.thots.some(t => t.id === thot.id))
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
        className="py-3 px-2 rounded-xl transition-colors relative"
        style={highlighted ? {
          background: `${accentColor}0d`,
          border: `1px solid ${accentColor}28`,
        } : {
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Visibility badge + locate button */}
        <div className="absolute top-2.5 right-2 flex items-center gap-1.5">
          {isVisible ? (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
              <Eye size={8} />Live
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(100,116,139,0.12)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}>
              <EyeOff size={8} />Hidden
            </span>
          )}
        </div>
        {/* Header: avatar + name + timestamp — click to fly to pin when live */}
        <div
          className="flex items-start gap-2.5"
          onClick={() => isVisible && onFlyTo?.(thot)}
          style={isVisible && onFlyTo ? { cursor: 'pointer' } : {}}
        >
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
            <CommentThread thotId={thot.id} accentColor={accentColor} session={session} autoFocus={defaultOpenComments} />
          </div>
        )}
      </div>

      {showShare && <ShareSheet thot={thot} onClose={() => setShowShare(false)} />}
    </>
  )
}

export default function ProfileSheet({ thot, session, isYouProfile = false, onCompose, onClose, onHype, onOpenDM, openCommentForThotId, highlightThotId, onFlyTo }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [reportState, setReportState] = useState('idle') // idle | confirm | done
  const [showMore, setShowMore] = useState(false)
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

  // For named users, session_id IS their auth UUID (set at login, line 222 auth.js).
  // thot.user_id is only populated post-migration-012; fall back to session_id for pen_name owners.
  const targetUserId = isYou ? null : (thot?.user_id ?? (penName ? thot?.session_id : null))

  useEffect(() => {
    if (!sessionId) { setHistory([]); setLoading(false); return }
    setLoading(true)
    fetch(`${API_URL}/thots?session_id=${sessionId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Load follow stats once we have a targetUserId
  useEffect(() => {
    if (!targetUserId) return
    const token = useAppStore.getState().session?.supabaseToken
    fetch(`${API_URL}/follows/${targetUserId}/stats`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setFollowers(d.followers); setFollowing(d.following); setIsFollowing(d.isFollowing) } })
      .catch(() => {})
  }, [targetUserId])

  function toggleBlock() {
    if (isBlocked) unblockSession(sessionId)
    else blockSession(sessionId)
    onClose()
  }

  async function toggleFollow() {
    if (!isAuth || !targetUserId || followLoading) {
      if (!isAuth) window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      return
    }
    setFollowLoading(true)
    const token = useAppStore.getState().session?.supabaseToken
    const method = isFollowing ? 'DELETE' : 'POST'
    try {
      const res = await fetch(`${API_URL}/follows/${targetUserId}`, {
        method, credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setIsFollowing(!isFollowing)
        setFollowers(f => isFollowing ? Math.max(0, f - 1) : f + 1)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleReport() {
    if (!isAuth) { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }
    if (reportState === 'idle') { setReportState('confirm'); return }
    if (reportState === 'confirm') {
      const token = useAppStore.getState().session?.supabaseToken
      await fetch(`${API_URL}/follows/${targetUserId}/report`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'user report' }),
      })
      setReportState('done')
      setTimeout(() => setReportState('idle'), 3000)
    }
  }

  // Use API history directly (newest-first); fall back to thot prop only while loading.
  const allThots = history ?? (thot ? [thot] : [])

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <AnonAvatar size={30} color={accentColor} active={isYou} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm leading-tight truncate" style={{ color: accentColor }}>
                {penName || 'Anonymous'}
              </span>
              {isYou && (
                <span className="text-[9px] px-1 py-0.5 rounded-full font-medium leading-none flex-shrink-0"
                  style={{ background: 'rgba(225,29,72,0.15)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.3)' }}>
                  you
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-600 text-[10px]">
                {loading ? '…' : allThots.length === 0 ? 'no drops yet' : `${allThots.length} drop${allThots.length !== 1 ? 's' : ''}`}
              </p>
              {targetUserId && (
                <p className="text-slate-600 text-[10px]">
                  · <span className="text-slate-400">{followers}</span> follower{followers !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
            {!isYou && isAuth && targetUserId && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                  isFollowing
                    ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/10'
                    : 'bg-white/[0.06] text-slate-300 border border-white/10 hover:bg-brand-purple/15 hover:text-brand-purple hover:border-brand-purple/30'
                }`}
                style={{ border: undefined }}
              >
                {isFollowing ? <UserMinus size={11} /> : <UserPlus size={11} />}
                {isFollowing ? 'Following' : 'Follow'}
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
                  defaultOpenComments={openCommentForThotId === t.id}
            key={t.id}
            thot={t}
            accentColor={accentColor}
            highlighted={highlightThotId != null && t.id === highlightThotId}
            onHype={onHype}
            session={session}
            onDelete={(id) => setHistory(prev => prev.filter(h => h.id !== id))}
            onFlyTo={onFlyTo}
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

      {/* Bottom action bar — other user only */}
      {!isYou && (
        <div className="flex items-center border-t border-white/[0.05] flex-shrink-0 px-2 py-1.5">
          {/* DM */}
          {isAuth && targetUserId && (
            <button
              onClick={() => onOpenDM?.({ userId: targetUserId, penName, accentColor })}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-slate-500 hover:text-brand-purple transition-colors cursor-pointer"
              style={{ background: 'none', border: 'none' }}
            >
              <MessageSquare size={15} />
              <span className="text-[9px]">Message</span>
            </button>
          )}
          {/* Report */}
          {isAuth && targetUserId && (
            <button
              onClick={handleReport}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                reportState !== 'idle' ? 'text-orange-400' : 'text-slate-500 hover:text-orange-400'
              }`}
              style={{ background: 'none', border: 'none' }}
            >
              <AlertTriangle size={15} />
              <span className="text-[9px]">{reportState === 'done' ? 'Reported' : reportState === 'confirm' ? 'Confirm?' : 'Report'}</span>
            </button>
          )}
          {/* Block */}
          <button
            onClick={toggleBlock}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
              isBlocked ? 'text-green-400' : 'text-slate-500 hover:text-red-400'
            }`}
            style={{ background: 'none', border: 'none' }}
          >
            {isBlocked ? <ShieldCheck size={15} /> : <ShieldX size={15} />}
            <span className="text-[9px]">{isBlocked ? 'Unblock' : 'Block'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
