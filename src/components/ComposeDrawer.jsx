import { useState, useEffect } from 'react'
import { X, Send, User, Map } from 'lucide-react'

// Place thot at approximately radiusM metres away in a random direction (±10% variance)
function jitterLocation(lat, lng, radiusM) {
  if (radiusM === 0) return { lat, lng }
  const angle = Math.random() * 2 * Math.PI
  const r = radiusM * (0.9 + Math.random() * 0.2) // 90–110% of set distance
  const dLat = (r * Math.cos(angle)) / 111320
  const dLng = (r * Math.sin(angle)) / (111320 * Math.cos(lat * Math.PI / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

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

  const isAuth = session?.type === 'user'
  const identity = session?.penName || 'member'
  const rateNote = isAuth ? 'no rate limit' : '3 thots/hr'
  const durationOptions = isAuth ? AUTH_OPTIONS : ANON_OPTIONS
  const [duration, setDuration] = useState(durationOptions[0].value)
  const [jitter, setJitter] = useState(0) // 0–100 → 0–200m

  // Track keyboard height via Visual Viewport API so the drawer stays above the keyboard
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onVPChange() {
      // keyboard height = total window height minus the visible viewport height/offset
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardOffset(kb)
    }
    vv.addEventListener('resize', onVPChange)
    vv.addEventListener('scroll', onVPChange)
    return () => {
      vv.removeEventListener('resize', onVPChange)
      vv.removeEventListener('scroll', onVPChange)
    }
  }, [])

  async function handlePost() {
    if (!text.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      const maxRadius = 200 // metres
      const radiusM = Math.round((jitter / 100) * maxRadius)
      const jitteredLoc = location ? jitterLocation(location.lat, location.lng, radiusM) : null
      await onPost(text.trim(), duration, jitteredLoc)
      onClose()
    } catch (err) {
      setError({ message: err.message || 'Failed to post. Try again.', code: err.code ?? null })
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ paddingBottom: keyboardOffset }} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="w-full mx-5 sm:mx-0 sm:max-w-[550px] bg-[#0e0e1a] border border-white/10 rounded-3xl p-5 flex flex-col gap-4 shadow-2xl pointer-events-auto panel-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-base">Drop a thot</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Identity indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
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
        </span>
        {!isAuth && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'signup' }))}
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
          {error && (
            error.code === 'SUBNET_LIMIT' ? (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
                <p className="text-orange-300 text-xs font-semibold mb-1">Network limit reached</p>
                <p className="text-orange-200/80 text-[11px] leading-relaxed">{error.message}</p>
                <p className="text-orange-200/50 text-[10px] mt-1.5">This prevents one network from flooding a location. Limit resets after 1 hour.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-red-300 text-xs">{error.message}</p>
              </div>
            )
          )}

          {/* Location Randomizer */}
          <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2">
              <Map size={13} className="text-brand-purple flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-400">Location Randomizer</span>
              {jitter > 0 && (
                <span className="ml-auto text-[10px] text-brand-purple">
                  ~{Math.round((jitter / 100) * 200)}m offset
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-brand-purple w-6">less</span>
              <input
                type="range"
                min={0}
                max={100}
                value={jitter}
                onChange={(e) => setJitter(Number(e.target.value))}
                className="flex-1 cursor-pointer"
                style={{
                  fontSize: '16px',
                  accentColor: '#7c3aed',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  height: '4px',
                  borderRadius: '9999px',
                  background: `linear-gradient(to right, #7c3aed ${jitter}%, #ffffff22 ${jitter}%)`,
                  outline: 'none',
                }}
              />
              <span className="text-[11px] text-brand-purple w-6 text-right">more</span>
            </div>
          </div>

          {/* Duration picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex-shrink-0">Visible for</span>
            <select
              value={duration ?? ''}
              onChange={(e) => setDuration(e.target.value === '' ? null : parseInt(e.target.value))}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-brand-purple transition-colors cursor-pointer" style={{ fontSize: "12px" }}
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
                  onClick={() => window.dispatchEvent(new CustomEvent('thots:open-auth', { detail: 'signup' }))}
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
