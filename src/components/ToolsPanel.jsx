import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, User, Settings, LogOut, Heart, Upload, Trash2, Mail, KeyRound } from 'lucide-react'
import { clearSession } from '../lib/identity'
import ShareSheet from './ShareSheet'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TABS = [
  { id: 'profile',  icon: User,     label: 'Profile'  },
  { id: 'settings', icon: Settings, label: 'Settings' },
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
    <button
      onClick={() => session?.type === 'user'
        ? onHype?.(thot.id)
        : window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      }
      className="flex items-center gap-0.5 transition-colors cursor-pointer"
      style={{ background: 'none', border: 'none', padding: 0, color: hyped ? '#e11d48' : '#64748b' }}
    >
      <Heart size={10} style={{ fill: hyped ? '#e11d48' : 'none', color: hyped ? '#e11d48' : '#64748b' }} />
      {hypeCount > 0 && <span className="text-[10px]">{hypeCount}</span>}
    </button>
  )
}

function ProfileTab({ session, thots, onHype, onOpenProfile }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const [myThots, setMyThots] = useState([])
  const [likedThots, setLikedThots] = useState([])
  const [shareThot, setShareThot] = useState(null)
  const [view, setView] = useState('thots') // 'thots' | 'likes'

  useEffect(() => {
    const id = session?.id
    if (!id) return
    fetch(`${API_URL}/thots?session_id=${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMyThots(data))
      .catch(() => {})
  }, [session?.id])

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

  const totalHypes = myThots.reduce((sum, t) => sum + (t.hype_count ?? 0), 0)

  return (
    <div>
      {/* Identity card */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-4">
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
              {isAuth ? 'member · no rate limit' : 'guest · 3 thots/hr'}
            </p>
          </div>
        </div>

        {isAuth && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/8">
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
          <p className="text-slate-500 text-[11px] mb-2">Your drops ({myThots.length})</p>
          {myThots.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">Nothing posted yet</p>
          ) : (
            myThots.map(thot => (
              <div key={thot.id} className="py-2.5 border-b border-white/5 last:border-0">
                <p className="text-white text-xs leading-snug line-clamp-2">{thot.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
                  <ProfileHeart thot={thot} onHype={onHype} session={session} />
                  <button
                    onClick={() => setShareThot(thot)}
                    className="ml-auto text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                    style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Upload size={11} />
                  </button>
                </div>
              </div>
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
                <p className="text-white text-xs leading-snug line-clamp-2">{thot.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {thot.pen_name ? (
                    <button
                      onClick={() => onOpenProfile?.(thot)}
                      className="text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: 'none', border: 'none', padding: 0, color: '#7c3aed' }}
                    >
                      {thot.pen_name}
                    </button>
                  ) : (
                    <span className="text-slate-600 text-[10px]">anon</span>
                  )}
                  <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
                  <button
                    onClick={() => setShareThot(thot)}
                    className="ml-auto text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                    style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Upload size={11} />
                  </button>
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
      <div className="bg-white/3 border border-white/6 rounded-xl p-3">
        <p className="text-slate-500 text-xs font-medium mb-1">Preferences</p>
        <p className="text-slate-700 text-[11px]">More settings coming soon</p>
      </div>

      {/* Sign out */}
      <div className="bg-white/3 border border-white/6 rounded-xl p-3">
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
        <div className="bg-white/3 border border-white/6 rounded-xl p-3">
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

export default function ToolsPanel({ onClose, thots, session, onHype, onOpenProfile }) {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <span className="text-white font-bold text-sm tracking-tight">Tools</span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/8 flex-shrink-0">
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
        {activeTab === 'profile'     && <ProfileTab session={session} thots={thots} onHype={onHype} onOpenProfile={onOpenProfile} />}
        {activeTab === 'settings'    && <SettingsPane session={session} />}
      </div>
    </div>
  )
}
