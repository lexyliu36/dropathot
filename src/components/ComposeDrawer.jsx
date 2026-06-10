import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Send, User } from 'lucide-react'

const MAX = 280

const ANON_OPTIONS = [
  { value: 6, label: '6 hours' },
  { value: 3, label: '3 hours' },
  { value: 2, label: '2 hours' },
  { value: 1, label: '1 hour' },
]

const AUTH_OPTIONS = [
  { value: 72, label: '3 days' },
  { value: 48, label: '2 days' },
  { value: 24, label: '1 day' },
  { value: 6, label: '6 hours' },
  { value: 3, label: '3 hours' },
  { value: 1, label: '1 hour' },
]

export default function ComposeDrawer({ onClose, onPost, location, session }) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  const navigate = useNavigate()
  const isAuth = session?.type === 'user'
  const identity = isAuth ? (session?.penName || 'member') : 'anonymous'
  const rateNote = isAuth ? '10 thots/hr' : '3 thots/hr'
  const durationOptions = isAuth ? AUTH_OPTIONS : ANON_OPTIONS
  const [duration, setDuration] = useState(durationOptions[0].value)

  async function handlePost() {
    if (!text.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      await onPost(text.trim(), duration)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to post. Try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="w-full mx-5 sm:mx-0 sm:max-w-[550px] bg-[#0e0e1a] border border-white/10 rounded-3xl p-5 flex flex-col gap-4 shadow-2xl pointer-events-auto">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-base">Drop a thot</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Identity indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isAuth ? '#7c3aed33' : '#64748b33', border: `1px solid ${isAuth ? '#7c3aed' : '#475569'}` }}
        >
          <User size={10} className={isAuth ? 'text-brand-purple' : 'text-slate-400'} />
        </div>
        <span className="text-xs text-slate-400">
          Posting as{' '}
          <span className={isAuth ? 'text-brand-purple font-semibold' : 'text-slate-300'}>
            {identity}
          </span>
          <span className="text-slate-600 ml-1">· {rateNote}</span>
        </span>
        {!isAuth && (
          <button
            onClick={() => navigate('/', { state: { openSignup: true } })}
            className="ml-auto text-[10px] text-brand-purple underline cursor-pointer hover:text-violet-400 transition-colors"
          >
            Sign up for more
          </button>
        )}
      </div>

      {!location ? (
        <p className="text-slate-400 text-sm text-center py-4">Enable location to post</p>
      ) : (
        <>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="What's on your mind?"
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-brand-purple transition-colors text-sm"
            style={{ fontSize: '16px' }}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}

          {/* Duration picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex-shrink-0">Visible for</span>
            <select
              value={duration ?? ''}
              onChange={(e) => setDuration(e.target.value === '' ? null : parseInt(e.target.value))}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-brand-purple transition-colors cursor-pointer"
            >
              {durationOptions.map(opt => (
                <option key={String(opt.value)} value={opt.value ?? ''} style={{ background: '#0e0e1a' }}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!isAuth && (
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                <button
                  onClick={() => navigate('/', { state: { openSignup: true } })}
                  className="text-brand-purple underline hover:text-violet-400 transition-colors cursor-pointer"
                >Sign up</button> for permanent thots
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-xs ${MAX - text.length < 30 ? 'text-brand-red' : 'text-slate-500'}`}>
              {MAX - text.length} remaining
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-purple text-white font-semibold text-sm disabled:opacity-40 hover:bg-violet-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {posting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Post thot
            </button>
          </div>
        </>
      )}
    </div>
    </div>
  )
}
