/**
 * VibeButton — floats on the map, calls GET /vibe, displays an AI-generated
 * natural-language summary of what people nearby are posting about.
 */
import { useState } from 'react'

export default function VibeButton({ userLocation }) {
  const [state, setState] = useState('idle') // idle | loading | open | error
  const [data, setData] = useState(null)

  async function fetchVibe() {
    if (!userLocation) return
    setState('loading')
    try {
      const { lat, lng } = userLocation
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/vibe?lat=${lat}&lng=${lng}&radius=1500`)
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setData(json)
      setState('open')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  function close() {
    setState('idle')
    setData(null)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={state === 'open' ? close : fetchVibe}
        disabled={state === 'loading' || !userLocation}
        title={userLocation ? 'What\'s the vibe nearby?' : 'Enable location to see vibe'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
          bg-[#0e0e1a] border border-white/10 text-white/70 hover:text-white hover:border-white/25
          disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {state === 'loading' ? (
          <>
            <span className="animate-spin text-xs">◌</span>
            <span>Reading the room…</span>
          </>
        ) : state === 'open' ? (
          <>
            <span>✦</span>
            <span>Close vibe</span>
          </>
        ) : state === 'error' ? (
          <>
            <span>⚠</span>
            <span>Try again</span>
          </>
        ) : (
          <>
            <span>✦</span>
            <span>What's the vibe?</span>
          </>
        )}
      </button>

      {/* Result card */}
      {state === 'open' && data && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[min(90vw,380px)]
            bg-[#0e0e1a]/95 border border-white/10 rounded-2xl p-4 shadow-2xl z-50"
          style={{ backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#7c3aed]">
              ✦ Area Vibe
            </span>
            <div className="flex items-center gap-2">
              {data.cached && (
                <span className="text-[10px] text-white/30 uppercase tracking-wide">cached</span>
              )}
              <button
                onClick={close}
                className="text-white/30 hover:text-white/70 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <p className="text-sm text-white/85 leading-relaxed">{data.summary}</p>
          {data.thotCount > 0 && (
            <p className="mt-2 text-[11px] text-white/30">
              Based on {data.thotCount} thot{data.thotCount !== 1 ? 's' : ''} within 1.5 km
            </p>
          )}
        </div>
      )}
    </>
  )
}
