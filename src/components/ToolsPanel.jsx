import { useState } from 'react'
import { X, Trophy, User, Settings } from 'lucide-react'

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
        Most hyped thots in the current area. Post something worth⚡.
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
                <span className="text-slate-500 text-[10px] ml-auto flex-shrink-0">
                  ⚡ {thot.hype_count ?? 0}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ProfileTab({ session, thots }) {
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
            <p className="text-white text-sm font-semibold leading-tight">
              {isAuth ? (session.penName || 'Member') : 'Anonymous'}
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
              <p className="text-slate-600 text-[10px]">hypes</p>
            </div>
          </div>
        )}
      </div>

      {/* Sign up nudge for anon */}
      {!isAuth && (
        <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-3 mb-4">
          <p className="text-white text-xs font-semibold mb-1">Get a pen name</p>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
            Sign up to claim a pen name, post 10 thots/hr, and track your hypes across sessions.
          </p>
          <button className="w-full py-2 rounded-lg bg-brand-purple text-white text-xs font-semibold hover:bg-violet-500 transition-colors cursor-pointer">
            Create account
          </button>
          <button className="w-full py-1.5 mt-1.5 rounded-lg text-slate-400 text-xs hover:text-white transition-colors cursor-pointer">
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
              <span className="text-slate-500 text-[10px] ml-auto">⚡ {thot.hype_count ?? 0}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function SettingsPane() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Settings size={28} className="text-slate-700 mb-3" />
      <p className="text-slate-500 text-sm font-medium">Settings</p>
      <p className="text-slate-600 text-xs mt-1">Coming soon</p>
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
        {activeTab === 'settings'    && <SettingsPane />}
      </div>
    </div>
  )
}
