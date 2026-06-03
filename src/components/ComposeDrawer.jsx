import { useState } from 'react'
import { X, Send, User } from 'lucide-react'

const MAX = 280

export default function ComposeDrawer({ onClose, onPost, location, session }) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  const isAuth = session?.type === 'user'
  const identity = isAuth ? (session?.penName || 'member') : 'anonymous'
  const rateNote = isAuth ? '10 thots/hr' : '3 thots/hr'

  async function handlePost() {
    if (!text.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      await onPost(text.trim())
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to post. Try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#0e0e1a] border-t border-white/10 rounded-t-3xl p-5 flex flex-col gap-4 shadow-2xl">
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
          <span className="ml-auto text-[10px] text-slate-600 underline cursor-pointer hover:text-slate-400">
            Sign up for more
          </span>
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
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-brand-purple transition-colors text-sm"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
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
  )
}
