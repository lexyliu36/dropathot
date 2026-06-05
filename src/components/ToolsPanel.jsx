import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Trophy, User, Settings, LogOut } from 'lucide-react'
import { clearSession } from '../lib/identity'

const TABS = [
  { id: 'leaderboard', icon: Trophy, label: 'Top Thots' },
  { id: 'profile',     icon: User,    label: 'Profile'   },
  { id: 'settings',    icon: Settings, label: 'Settings' },
]

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Leaderboard({ thots }) {
  const ranked = [...thots]
    .sort((a, b) =>
      (b.hype_count ?? 0) - (a.hype_count ?? 0) ||
      new Date(b.created_at) - new Date(a.created_at)
    )
    .slice(0, 10)

  return (
    <div>
      <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
        Top thots in the current view — zooming out surfaces the best from a wider area.
      </p>
      {ranked.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-10">No thots nearby yet</p>
      ) : (
        ranked.map((thot, i) => (
          <div key={thot.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
            <span className="text-slate-700 text-xs font-mono w-5 mt-0.5 flex-shrink-0">
              #{i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs leading-snug line-clamp-2">{thot.content}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: thot.pen_name ? '#7c3aed' : '#475569' }}
                >
                  {thot.pen_name || 'anon'}
                </span>
                <span className="text-slate-600 text-[10px]">
                  {relativeTime(thot.created_at)}
                </span>
                {(thot.hype_count ?? 0) > 0 && (
                  <span className="text-slate-500 text-[10px] ml-auto flex-shrink-0">
                    ↑ {thot.hype_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ProfileTab({ session, thots }) {
  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const myThots = (thots ?? []).filter(t => t.session_id === session?.id)
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
              <p className="text-slate-600 text-[10px]">upvotes</p>
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
            onClick={() => navigate('/', { state: { openSignup: true } })}
            className="w-full py-2 rounded-lg bg-brand-purple text-white text-xs font-semibold hover:bg-violet-500 transition-colors cursor-pointer"
          >
            Create account
          </button>
          <button
            onClick={() => navigate('/', { state: { openLogin: true } })}
            className="w-full py-1.5 mt-1.5 rounded-lg text-brand-purple text-xs hover:text-violet-400 transition-colors cursor-pointer underline"
          >
            Already have an account? Sign in
          </button>
        </div>
      )}

      {/* My thots */}
      <p className="text-slate-500 text-[11px] mb-2">
        Your thots nearby ({myThots.length})
      </p>
      {myThots.length === 0 ? (
        <p className="text-slate-600 text-xs text-center py-8">Nothing posted yet</p>
      ) : (
        myThots.map(thot => (
          <div key={thot.id} className="py-2.5 border-b border-white/5 last:border-0">
            <p className="text-white text-xs leading-snug line-clamp-2">{thot.content}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</span>
              <span className="text-slate-500 text-[10px] ml-auto">↑ {thot.hype_count ?? 0}</span>
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

export default function ToolsPanel({ onClose, thots, session }) {
  const [activeTab, setActiveTab] = useState('leaderboard')

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
        {activeTab === 'leaderboard' && <Leaderboard thots={thots} />}
        {activeTab === 'profile'     && <ProfileTab session={session} thots={thots} />}
        {activeTab === 'settings'    && <SettingsPane session={session} />}
      </div>
    </div>
  )
}
