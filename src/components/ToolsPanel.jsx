import { useState, useEffect } from 'react'
import { getCached, setCached, appendCached, removeFromCache } from '../lib/thotCache'
import { reverseGeocode } from '../lib/geocode.js'

function GeoLabel({ lat, lng }) {
  const [label, setLabel] = useState(null)
  useEffect(() => {
    if (lat != null && lng != null) reverseGeocode(lat, lng).then(l => { if (l) setLabel(l) })
  }, [lat, lng])
  if (!label) return null
  return <span className="text-slate-600 text-[10px] block mt-0.5">{label}</span>
}
import { useNavigate } from 'react-router-dom'
import { X, User, Settings, LogOut, Heart, Upload, Trash2, Mail, KeyRound, Users, MessageSquare, Send } from 'lucide-react'
import { clearSession } from '../lib/identity'
import ShareSheet from './ShareSheet'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TABS = [
  { id: 'profile',  icon: User,          label: 'Profile'  },
  { id: 'messages', icon: MessageSquare, label: 'Messages' },
  { id: 'settings', icon: Settings,      label: 'Settings' },
]

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ProfileHeart({ thot, onHype, session }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  return (
    <div className="relative group/tip" style={{ width: '40px', flexShrink: 0 }}>
      <button
        onClick={() => session?.type === 'user'
          ? onHype?.(thot.id)
          : window.dispatchEvent(new CustomEvent('thots:needs-auth'))
        }
        className="flex items-center gap-1 transition-colors cursor-pointer"
        style={{ background: 'none', border: 'none', padding: 0, color: hyped ? '#e11d48' : '#64748b' }}
      >
        <Heart size={17} style={{ fill: hyped ? '#e11d48' : 'none', color: hyped ? '#e11d48' : '#64748b' }} />
        {hypeCount > 0 && <span className="text-xs">{hypeCount}</span>}
      </button>
      <span className="action-tip">{hyped ? 'Unlike' : 'Like'}</span>
    </div>
  )
}

function ProfileTab({ session, thots, onHype, onOpenProfile, onFlyTo }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const [myThots, setMyThots] = useState([])
  const [myTotal, setMyTotal] = useState(0)
  const [myOffset, setMyOffset] = useState(0)
  const [myLoadingMore, setMyLoadingMore] = useState(false)
  const [myLoading, setMyLoading] = useState(true)
  const [likedThots, setLikedThots] = useState([])
  const [shareThot, setShareThot] = useState(null)
  const [view, setView] = useState('thots') // 'thots' | 'likes' | 'following'
  const [followingUsers, setFollowingUsers] = useState([])
  const [followerUsers, setFollowerUsers] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [deletingId, setDeletingId] = useState(null)

  const PAGE = 20

  useEffect(() => {
    const id = session?.id
    if (!id) { setMyLoading(false); return }
    const cached = getCached(id)
    if (cached) {
      setMyThots(cached.thots)
      setMyTotal(cached.total)
      setMyOffset(cached.thots.length)
      setMyLoading(false)
      return
    }
    setMyLoading(true)
    fetch(`${API_URL}/thots?session_id=${id}&limit=${PAGE}&offset=0`)
      .then(r => r.ok ? r.json() : { thots: [], total: 0 })
      .then(({ thots, total }) => {
        setCached(id, thots, total ?? thots.length)
        setMyThots(thots)
        setMyTotal(total ?? thots.length)
        setMyOffset(thots.length)
      })
      .catch(() => {})
      .finally(() => setMyLoading(false))
  }, [session?.id])

  async function loadMoreMyThots() {
    const id = session?.id
    if (!id || myLoadingMore) return
    setMyLoadingMore(true)
    try {
      const r = await fetch(`${API_URL}/thots?session_id=${id}&limit=${PAGE}&offset=${myOffset}`)
      const { thots, total: t } = r.ok ? await r.json() : { thots: [], total: myTotal }
      appendCached(id, thots, t ?? myTotal)
      setMyThots(prev => {
        const ids = new Set(prev.map(x => x.id))
        return [...prev, ...thots.filter(x => !ids.has(x.id))]
      })
      setMyTotal(t ?? myTotal)
      setMyOffset(o => o + thots.length)
    } catch {}
    setMyLoadingMore(false)
  }

  useEffect(() => {
    if (!isAuth || !session?.supabaseToken) return
    fetch(`${API_URL}/thots/liked`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${session.supabaseToken}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLikedThots(data))
      .catch(() => {})
  }, [session?.id])

  useEffect(() => {
    if (!isAuth || !session?.supabaseToken) return
    const token = session.supabaseToken
    fetch(`${API_URL}/follows/following`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFollowingUsers(data))
      .catch(() => {})
    fetch(`${API_URL}/follows/followers`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFollowerUsers(data))
      .catch(() => {})
    fetch(`${API_URL}/follows/${session.id}/stats`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFollowerCount(d.followers) })
      .catch(() => {})
  }, [session?.id])

  async function handleDeleteThot(thotId) {
    if (!window.confirm('Hide this thot? It will be removed from the map and your history.')) return
    setDeletingId(thotId)
    try {
      const s = useAppStore.getState()
      const headers = {}
      if (s.session?.supabaseToken) headers['Authorization'] = `Bearer ${s.session.supabaseToken}`
      const r = await fetch(`${API_URL}/thots/${thotId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (r.ok) {
        const data = await r.json()
        removeFromCache(session?.id, thotId)
        setMyThots(prev => prev.filter(t => t.id !== thotId))
        setMyTotal(n => Math.max(0, n - 1))
        s.removeThot(thotId)
        if (data.restored) {
          const restored = { ...data.restored, _isNew: true }
          s.addThot(restored)
          setMyThots(prev => [restored, ...prev.filter(t => t.id !== restored.id)])
        }
      } else {
        const err = await r.json().catch(() => ({}))
        console.error('[delete thot] server error:', r.status, err)
      }
    } catch (err) {
      console.error('[delete thot] network error:', err)
    }
    setDeletingId(null)
  }

  const totalHypes = myThots.reduce((sum, t) => sum + (t.hype_count ?? 0), 0)

  return (
    <div>
      {/* Identity card */}
      <div className="bg-white/5 border border-white/[0.05] rounded-xl p-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: isAuth ? '#7c3aed22' : '#64748b22',
              border: `1px solid ${isAuth ? '#7c3aed55' : '#47556955'}`,
            }}
          >
            <User size={15} className={isAuth ? 'text-brand-purple' : 'text-slate-500'} />
          </div>
          <div>
            {isAuth && session.penName ? (
              <button
                onClick={() => onOpenProfile?.({ pen_name: session.penName, session_id: session.id })}
                className="text-sm font-semibold leading-tight transition-colors cursor-pointer hover:opacity-80"
                style={{ background: 'none', border: 'none', padding: 0, color: '#7c3aed' }}
              >
                {session.penName}
              </button>
            ) : (
              <p className="text-white text-sm font-semibold leading-tight">
                {isAuth ? 'Member' : 'Anonymous'}
              </p>
            )}
            <p className="text-slate-500 text-[10px] mt-0.5">
              {isAuth ? 'member' : 'guest · 3 thots/hr'}
            </p>
          </div>
        </div>

        {isAuth && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.05]">
            <button
              onClick={() => setView('thots')}
              className="text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <p className="text-white text-sm font-bold">{myThots.length}</p>
              <p className="text-[10px]" style={{ color: view === 'thots' ? '#7c3aed' : '#475569' }}>thots</p>
            </button>
            <button
              onClick={() => setView('likes')}
              className="text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <p className="text-white text-sm font-bold">{likedThots.length}</p>
              <p className="text-[10px]" style={{ color: view === 'likes' ? '#e11d48' : '#475569' }}>liked</p>
            </button>
            <button
              onClick={() => setView('following')}
              className="text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <p className="text-white text-sm font-bold">{followingUsers.length}</p>
              <p className="text-[10px]" style={{ color: view === 'following' ? '#7c3aed' : '#475569' }}>following</p>
            </button>
            <button
              onClick={() => setView('followers')}
              className="text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <p className="text-white text-sm font-bold">{followerCount}</p>
              <p className="text-[10px]" style={{ color: view === 'followers' ? '#7c3aed' : '#475569' }}>followers</p>
            </button>
          </div>
        )}
      </div>

      {/* Sign up nudge for anon */}
      {!isAuth && (
        <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-3 mb-4">
          <p className="text-white text-xs font-semibold mb-1">Get a pen name</p>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
            Sign up to claim a pen name and track your likes across sessions.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'signup' }))}
            className="w-full py-2 rounded-lg bg-brand-purple text-white text-xs font-semibold hover:bg-violet-500 transition-colors cursor-pointer"
          >
            Create account
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'login' }))}
            className="w-full py-1.5 mt-1.5 rounded-lg text-brand-purple text-xs hover:text-violet-400 transition-colors cursor-pointer underline"
          >
            Already have an account? Sign in
          </button>
        </div>
      )}

      {shareThot && <ShareSheet thot={shareThot} onClose={() => setShareThot(null)} />}

      {/* Thots list */}
      {view === 'thots' && (
        <>
          <p className="text-slate-500 text-[11px] mb-2">Your drops ({myTotal || myThots.length})</p>
          {myThots.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">Nothing posted yet</p>
          ) : (
            myThots.map(thot => (
              <div key={thot.id} className="py-2.5 border-b border-white/5 last:border-0">
                <button
                  onClick={() => onFlyTo?.(thot)}
                  className="w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <p className="text-white text-xs sm:text-sm leading-snug line-clamp-2">{thot.content}</p>
                  <GeoLabel lat={thot.lat} lng={thot.lng} />
                </button>
                <div className="flex items-center mt-1.5">
                  <span className="text-slate-600 text-[10px] w-16 flex-shrink-0">{relativeTime(thot.created_at)}</span>
                  <div className="flex flex-1 items-center">
                    <div className="flex-1 flex justify-center">
                      <ProfileHeart thot={thot} onHype={onHype} session={session} />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="relative group/tip">
                        <button
                          onClick={() => setShareThot(thot)}
                          className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          <Upload size={17} />
                        </button>
                        <span className="action-tip">Share</span>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="relative group/tip">
                        <button
                          onClick={() => handleDeleteThot(thot.id)}
                          disabled={deletingId === thot.id}
                          className="text-slate-700 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <span className="action-tip">Delete</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {/* Load more */}
          {myThots.length > 0 && myThots.length < myTotal && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMoreMyThots}
                disabled={myLoadingMore}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-4 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
              >
                {myLoadingMore ? 'Loading…' : `Load more (${myTotal - myThots.length} left)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Following users list */}
      {view === 'following' && (
        <>
          <p className="text-slate-500 text-[11px] mb-2">Following ({followingUsers.length})</p>
          {followingUsers.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">Not following anyone yet</p>
          ) : (
            followingUsers.map(u => (
              <button
                key={u.id}
                onClick={() => onOpenProfile?.({ pen_name: u.pen_name, session_id: u.id })}
                className="w-full flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 hover:opacity-80 transition-opacity cursor-pointer text-left"
                style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0' }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed22', border: '1px solid #7c3aed55' }}>
                  <Users size={13} className="text-brand-purple" />
                </div>
                <span className="text-white text-xs font-medium">{u.pen_name}</span>
              </button>
            ))
          )}
        </>
      )}

      {/* Followers list */}
      {view === 'followers' && (
        <>
          <p className="text-slate-500 text-[11px] mb-2">Followers ({followerUsers.length})</p>
          {followerUsers.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">No followers yet</p>
          ) : (
            followerUsers.map(u => (
              <button
                key={u.id}
                onClick={() => onOpenProfile?.({ pen_name: u.pen_name, session_id: u.id })}
                className="w-full flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 hover:opacity-80 transition-opacity cursor-pointer text-left"
                style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0' }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed22', border: '1px solid #7c3aed55' }}>
                  <Users size={13} className="text-brand-purple" />
                </div>
                <span className="text-white text-xs font-medium">{u.pen_name}</span>
              </button>
            ))
          )}
        </>
      )}

      {/* Liked thots list */}
      {view === 'likes' && (
        <>
          <p className="text-slate-500 text-[11px] mb-2">Thots you liked ({likedThots.length})</p>
          {likedThots.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">No liked thots yet</p>
          ) : (
            likedThots.map(thot => (
              <div key={thot.id} className="py-2.5 border-b border-white/5 last:border-0">
                <p className="text-white text-xs sm:text-sm leading-snug line-clamp-2">{thot.content}</p>
                <GeoLabel lat={thot.lat} lng={thot.lng} />
                <div className="flex items-center gap-2 mt-1.5">
                  {thot.pen_name ? (
                    <button
                      onClick={() => onOpenProfile?.(thot)}
                      className="text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: 'none', border: 'none', padding: 0, color: '#7c3aed' }}
                    >
                      {thot.pen_name}
                    </button>
                  ) : (
                    <span className="text-slate-600 text-xs">anon</span>
                  )}
                  <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
                  <div className="relative group/tip ml-auto">
                    <button
                      onClick={() => setShareThot(thot)}
                      className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      <Upload size={17} />
                    </button>
                    <span className="action-tip">Share</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

function SettingsPane({ session }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const [confirming, setConfirming] = useState(false)
  // fetch current email from server (session may not have it if logged in before this change)
  const [currentEmail, setCurrentEmail] = useState(session?.email ?? null)
  useEffect(() => {
    if (!isAuth || !session?.supabaseToken) return
    fetch(`${API_URL}/auth/profile`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${session.supabaseToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setCurrentEmail(d.email) })
      .catch(() => {})
  }, [session?.id])

  // email change
  const [emailForm, setEmailForm] = useState('idle') // 'idle' | 'open'
  const [emailFields, setEmailFields] = useState({ currentPassword: '', newEmail: '' })
  const [emailMsg, setEmailMsg] = useState(null) // { ok, text }
  const [emailBusy, setEmailBusy] = useState(false)
  // password change
  const [passwordForm, setPasswordForm] = useState('idle') // 'idle' | 'open'
  const [passwordFields, setPasswordFields] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [passwordBusy, setPasswordBusy] = useState(false)
  // deletion state
  const [deletionStatus, setDeletionStatus] = useState(null) // { pending, hard_delete_at, days_left }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1) // 1 = warn, 2 = final confirm
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!isAuth || !session?.supabaseToken) return
    fetch(`${API_URL}/auth/account/deletion-status`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${session.supabaseToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setDeletionStatus(data))
      .catch(() => {})
  }, [session?.id])

  async function handleEmailChange() {
    if (!session?.supabaseToken) return
    setEmailBusy(true)
    setEmailMsg(null)
    try {
      const r = await fetch(`${API_URL}/auth/email`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.supabaseToken}` },
        body: JSON.stringify({ current_password: emailFields.currentPassword, new_email: emailFields.newEmail }),
      })
      const data = await r.json()
      if (r.ok) {
        setEmailMsg({ ok: true, text: data.message ?? 'Email updated.' })
        setCurrentEmail(emailFields.newEmail)
        setEmailFields({ currentPassword: '', newEmail: '' })
        setTimeout(() => setEmailForm('idle'), 2000)
      } else {
        setEmailMsg({ ok: false, text: data.error ?? 'Failed to update email.' })
      }
    } catch { setEmailMsg({ ok: false, text: 'Network error.' }) }
    setEmailBusy(false)
  }

  async function handlePasswordChange() {
    if (!session?.supabaseToken) return
    if (passwordFields.newPassword !== passwordFields.confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Passwords do not match.' })
      return
    }
    if (passwordFields.newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: 'New password must be at least 8 characters.' })
      return
    }
    setPasswordBusy(true)
    setPasswordMsg(null)
    try {
      const r = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.supabaseToken}` },
        body: JSON.stringify({ current_password: passwordFields.currentPassword, new_password: passwordFields.newPassword }),
      })
      const data = await r.json()
      if (r.ok) {
        setPasswordMsg({ ok: true, text: data.message ?? 'Password updated.' })
        setPasswordFields({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setPasswordForm('idle'), 2000)
      } else {
        setPasswordMsg({ ok: false, text: data.error ?? 'Failed to update password.' })
      }
    } catch { setPasswordMsg({ ok: false, text: 'Network error.' }) }
    setPasswordBusy(false)
  }

  function handleLogout() {
    clearSession()
    navigate('/', { replace: true })
  }

  async function handleRequestDeletion() {
    if (!session?.supabaseToken) return
    setDeleteBusy(true)
    try {
      const r = await fetch(`${API_URL}/auth/account`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${session.supabaseToken}` },
      })
      if (r.ok) {
        const data = await r.json()
        setDeletionStatus({ pending: true, hard_delete_at: data.hard_delete_at, days_left: 30 })
        setShowDeleteConfirm(false)
        setDeleteStep(1)
      }
    } catch {}
    setDeleteBusy(false)
  }

  async function handleCancelDeletion() {
    if (!session?.supabaseToken) return
    setDeleteBusy(true)
    try {
      const r = await fetch(`${API_URL}/auth/account/cancel-deletion`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${session.supabaseToken}` },
      })
      if (r.ok) setDeletionStatus({ pending: false })
    } catch {}
    setDeleteBusy(false)
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Coming soon placeholder */}
      <div className="bg-white/[0.07] border border-white/[0.04] rounded-xl p-3">
        <p className="text-slate-500 text-xs font-medium mb-1">Preferences</p>
        <p className="text-slate-700 text-[11px]">More settings coming soon</p>
      </div>

      {/* Sign out */}
      <div className="bg-white/[0.07] border border-white/[0.04] rounded-xl p-3">
        <p className="text-slate-500 text-xs font-medium mb-2">Account</p>
        {isAuth && session.penName && (
          <p className="text-slate-400 text-[11px] mb-3">
            Signed in as <span className="text-brand-purple font-semibold">{session.penName}</span>
          </p>
        )}

        {/* Change email */}
        {isAuth && (
          <div className="mb-2">
            {emailForm === 'idle' ? (
              <button
                onClick={() => { setEmailForm('open'); setPasswordForm('idle') }}
                className="w-full text-left py-2 px-2.5 rounded-lg text-slate-400 text-[11px] hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Mail size={11} className="flex-shrink-0" />
                Change email
              </button>
            ) : (
              <div className="flex flex-col gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white text-[11px] font-semibold">Change email</p>
                {currentEmail && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Mail size={10} className="text-slate-600 flex-shrink-0" />
                    <span className="text-slate-500 text-[11px] truncate">{currentEmail}</span>
                  </div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={emailFields.currentPassword}
                  onChange={e => setEmailFields(f => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-slate-600 focus:outline-none focus:border-brand-purple/50"
                />
                <input
                  type="email"
                  placeholder="New email address"
                  value={emailFields.newEmail}
                  onChange={e => setEmailFields(f => ({ ...f, newEmail: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-slate-600 focus:outline-none focus:border-brand-purple/50"
                />
                {emailMsg && (
                  <p className={`text-[10px] ${emailMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{emailMsg.text}</p>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setEmailForm('idle'); setEmailFields({ currentPassword: '', newEmail: '' }); setEmailMsg(null) }}
                    className="flex-1 py-1.5 rounded-lg border border-white/10 text-slate-400 text-[11px] hover:bg-white/5 transition-colors cursor-pointer"
                  >Cancel</button>
                  <button
                    onClick={handleEmailChange}
                    disabled={emailBusy || !emailFields.currentPassword || !emailFields.newEmail}
                    className="flex-1 py-1.5 rounded-lg bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-[11px] font-semibold hover:bg-brand-purple/30 transition-colors cursor-pointer disabled:opacity-40"
                  >{emailBusy ? 'Saving…' : 'Update email'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Change password */}
        {isAuth && (
          <div className="mb-3">
            {passwordForm === 'idle' ? (
              <button
                onClick={() => { setPasswordForm('open'); setEmailForm('idle') }}
                className="w-full text-left py-2 px-2.5 rounded-lg text-slate-400 text-[11px] hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <KeyRound size={11} className="flex-shrink-0" />
                Change password
              </button>
            ) : (
              <div className="flex flex-col gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white text-[11px] font-semibold">Change password</p>
                <input
                  type="password"
                  placeholder="Current password"
                  value={passwordFields.currentPassword}
                  onChange={e => setPasswordFields(f => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-slate-600 focus:outline-none focus:border-brand-purple/50"
                />
                <input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={passwordFields.newPassword}
                  onChange={e => setPasswordFields(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-slate-600 focus:outline-none focus:border-brand-purple/50"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordFields.confirmPassword}
                  onChange={e => setPasswordFields(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder:text-slate-600 focus:outline-none focus:border-brand-purple/50"
                />
                {passwordMsg && (
                  <p className={`text-[10px] ${passwordMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{passwordMsg.text}</p>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setPasswordForm('idle'); setPasswordFields({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPasswordMsg(null) }}
                    className="flex-1 py-1.5 rounded-lg border border-white/10 text-slate-400 text-[11px] hover:bg-white/5 transition-colors cursor-pointer"
                  >Cancel</button>
                  <button
                    onClick={handlePasswordChange}
                    disabled={passwordBusy || !passwordFields.currentPassword || !passwordFields.newPassword || !passwordFields.confirmPassword}
                    className="flex-1 py-1.5 rounded-lg bg-brand-purple/20 border border-brand-purple/30 text-brand-purple text-[11px] font-semibold hover:bg-brand-purple/30 transition-colors cursor-pointer disabled:opacity-40"
                  >{passwordBusy ? 'Saving…' : 'Update password'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            {isAuth ? 'Sign out' : 'End session'}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-slate-400 text-[11px] text-center">
              {isAuth ? "You'll need to sign in again to post." : 'Your anonymous session will be cleared.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-slate-400 text-xs hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                {isAuth ? 'Sign out' : 'Clear session'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete account — members only */}
      {isAuth && (
        <div className="bg-white/[0.07] border border-white/[0.04] rounded-xl p-3">
          <p className="text-slate-500 text-xs font-medium mb-1">Delete account</p>
          {!deletionStatus?.pending && !showDeleteConfirm && (
            <p className="text-slate-600 text-[10px] leading-relaxed mb-3">
              You'll have 30 days to change your mind. After that your pen name is released and your thots become anonymous.
            </p>
          )}

          {deletionStatus?.pending ? (
            /* Pending deletion banner */
            <div className="flex flex-col gap-2">
              <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-2.5">
                <p className="text-red-400 text-[11px] font-semibold mb-0.5">Deletion scheduled</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Your account will be permanently deleted in{' '}
                  <span className="text-white font-semibold">{deletionStatus.days_left ?? 30} day{(deletionStatus.days_left ?? 30) !== 1 ? 's' : ''}</span>.
                  Your thots will be anonymised and remain on the map until they expire.
                </p>
              </div>
              <button
                onClick={handleCancelDeletion}
                disabled={deleteBusy}
                className="w-full py-2 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteBusy ? 'Cancelling…' : 'Cancel deletion'}
              </button>
            </div>
          ) : !showDeleteConfirm ? (
            /* Delete button */
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteStep(1) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 text-red-500/60 text-xs font-semibold hover:bg-red-500/8 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              Delete my account
            </button>
          ) : deleteStep === 1 ? (
            /* Step 1 — consequences warning */
            <div className="flex flex-col gap-2">
              <p className="text-white text-[11px] font-semibold">Before you go…</p>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Your account will enter a <span className="text-white">30-day grace period</span>. Sign back in at any time to cancel.
                After 30 days your pen name is released, your hypes are deleted, and your thots are anonymised (they stay on the map until they naturally expire).
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteStep(1) }}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-slate-400 text-xs hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Keep account
                </button>
                <button
                  onClick={() => setDeleteStep(2)}
                  className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            /* Step 2 — final confirm */
            <div className="flex flex-col gap-2">
              <p className="text-slate-400 text-[11px] text-center">
                Schedule deletion of{' '}
                <span className="text-brand-purple font-semibold">{session.penName}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteStep(1) }}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-slate-400 text-xs hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestDeletion}
                  disabled={deleteBusy}
                  className="flex-1 py-2 rounded-xl bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleteBusy ? 'Scheduling…' : 'Delete account'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


const API_URL_DM = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTimeDM(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function MessagesTab({ session, onOpenDM }) {
  const [convos, setConvos] = useState([])
  const [loading, setLoading] = useState(true)
  const token = session?.supabaseToken

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${API_URL_DM}/messages`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setConvos(data))
      .catch(() => setConvos([]))
      .finally(() => setLoading(false))
  }, [token])

  if (!session || session.type !== 'user') {
    return <p className="text-slate-600 text-xs text-center mt-8">Sign in to view messages.</p>
  }

  if (loading) return <p className="text-slate-600 text-xs text-center mt-8">Loading…</p>

  if (convos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 mt-12 opacity-50">
        <MessageSquare size={28} className="text-slate-600" />
        <p className="text-slate-500 text-xs text-center">No messages yet.<br/>Message someone from their profile.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 -mx-4 px-0">
      {convos.map(convo => {
        const isFromMe = convo.from_user_id === session?.userId
        const partner = isFromMe ? convo.to_user : convo.from_user
        const partnerName = partner?.pen_name ?? null
        const partnerId = partner?.id ?? (isFromMe ? convo.to_user_id : convo.from_user_id)
        const partnerColor = partnerName ? '#7c3aed' : '#64748b'
        const unread = convo.unread > 0
        return (
          <button
            key={convo.id}
            onClick={() => onOpenDM?.({ userId: partnerId, penName: partnerName, accentColor: partnerColor })}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer text-left border-b border-white/[0.04] last:border-0"
            style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            {/* Avatar placeholder */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${partnerColor}22`, border: `1px solid ${partnerColor}44` }}>
              <span className="text-[10px] font-bold" style={{ color: partnerColor }}>
                {(partnerName || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold truncate" style={{ color: unread ? '#fff' : partnerColor }}>
                  {partnerName || 'Anonymous'}
                </span>
                <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTimeDM(convo.created_at)}</span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${unread ? 'text-slate-300' : 'text-slate-600'}`}>
                {isFromMe && <span className="text-slate-600 mr-1">You:</span>}
                {convo.content}
              </p>
            </div>
            {unread && <div className="w-1.5 h-1.5 rounded-full bg-brand-purple flex-shrink-0 mt-2" />}
          </button>
        )
      })}
    </div>
  )
}

export default function ToolsPanel({ onClose, thots, session, onHype, onOpenProfile, onFlyTo, onOpenDM }) {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <span className="text-white font-bold text-sm tracking-tight">Tools</span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/[0.05] flex-shrink-0">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === id
                ? 'text-white border-brand-purple'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'profile'     && <ProfileTab session={session} thots={thots} onHype={onHype} onOpenProfile={onOpenProfile} onFlyTo={onFlyTo} />}
        {activeTab === 'messages'    && <MessagesTab session={session} onOpenDM={onOpenDM} />}
        {activeTab === 'settings'    && <SettingsPane session={session} />}
      </div>
    </div>
  )
}
