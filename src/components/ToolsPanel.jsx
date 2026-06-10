import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, User, Settings, LogOut, Heart, Upload } from 'lucide-react'
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

function ProfileTab({ session, thots, onHype }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const [myThots, setMyThots] = useState([])
  const [shareThot, setShareThot] = useState(null)

  // Fetch all session thots from API (not just nearby ones on the map)
  useEffect(() => {
    const id = session?.id
    if (!id) return
    fetch(`${API_URL}/thots?session_id=${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMyThots(data))
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
            <p className="text-white text-sm font-semibold leading-tight" style={{ color: isAuth ? '#7c3aed' : undefined }}>
              {isAuth ? (session.penName || session.userId ? (session.penName || '…') : 'Member') : 'Anonymous'}
            </p>
            <p className="text-slate-500 text-[10px] mt-0.5">
              {isAuth ? '10 thots/hr · member' : 'Guest · 3 thots/hr'}
            </p>
          </div>
        </div>

        {isAuth && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/8">
            <div className="text-center">
              <p className="text-white text-sm font-bold">{myThots.length}</p>
              <p className="text-slate-600 text-[10px]">thots</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-bold">{totalHypes}</p>
              <p className="text-slate-600 text-[10px]">likes</p>
            </div>
          </div>
        )}
      </div>

      {/* Sign up nudge for anon */}
      {!isAuth && (
        <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-3 mb-4">
          <p className="text-white text-xs font-semibold mb-1">Get a pen name</p>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
            Sign up to claim a pen name, post 10 thots/hr, and track your upvotes across sessions.
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

      {/* My thots */}
      <p className="text-slate-500 text-[11px] mb-2">
        Your drops nearby ({myThots.length})
      </p>
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
    </div>
  )
}

function SettingsPane({ session }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const [confirming, setConfirming] = useState(false)

  function handleLogout() {
    clearSession()
    navigate('/', { replace: true })
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
    </div>
  )
}

export default function ToolsPanel({ onClose, thots, session, onHype }) {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
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
        {activeTab === 'profile'     && <ProfileTab session={session} thots={thots} onHype={onHype} />}
        {activeTab === 'settings'    && <SettingsPane session={session} />}
      </div>
    </div>
  )
}
