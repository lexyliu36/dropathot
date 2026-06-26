/**
 * VibeButton — sparkle icon that calls GET /vibe for an AI-generated
 * neighborhood summary. Prompts for confirmation before making the API call.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function VibeButton({ userLocation, radius }) {
  const [state, setState] = useState('idle') // idle | confirm | loading | open | error
  const [data, setData] = useState(null)

  async function fetchVibe() {
    if (!userLocation) return
    setState('loading')
    try {
      const { lat, lng } = userLocation
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const vibeRadius = radius ?? 1500
      const res = await fetch(`${base}/vibe?lat=${lat}&lng=${lng}&radius=${vibeRadius}`)
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
      {/* Confirm modal — portaled to body to escape Mapbox stacking context */}
      {state === 'confirm' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setState('idle')}
        >
          <div
            className="w-[min(90vw,360px)] bg-[#0e0e1a] border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#7c3aed] text-lg">✦</span>
              <span className="text-white font-semibold text-sm">What's the Vibe?</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              This uses AI to summarize what people nearby are posting about right now — based on everything visible on your current map view.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setState('idle')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={fetchVibe}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer"
                style={{ background: '#7c3aed' }}
              >
                Read the room
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Trigger button — sparkle icon only */}
      <button
        onClick={() => {
          if (state === 'open') { close(); return }
          if (!userLocation) return
          setState('confirm')
        }}
        disabled={state === 'loading' || !userLocation}
        title={userLocation ? "What's the vibe nearby?" : 'Enable location to see vibe'}
        className="w-11 h-11 rounded-full border border-white/15 bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {state === 'loading' ? (
          <span className="animate-spin text-sm text-[#7c3aed]">◌</span>
        ) : state === 'open' ? (
          <span className="text-[#7c3aed] text-base">✦</span>
        ) : state === 'error' ? (
          <span className="text-amber-400 text-sm">⚠</span>
        ) : (
          <span className="text-base">✦</span>
        )}
      </button>

      {/* Result card — portaled to body, positioned top-left */}
      {state === 'open' && data && createPortal(
        <div
          className="fixed top-28 left-4 w-[min(90vw,320px)] bg-[#0e0e1a]/95 border border-white/10 rounded-2xl p-4 shadow-2xl z-[9999]"
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
                className="text-white/30 hover:text-white/70 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
          <p className="text-sm text-white/85 leading-relaxed">{data.summary}</p>
          {data.thotCount > 0 && (
            <p className="mt-2 text-[11px] text-white/30">
              Based on {data.thotCount} thot{data.thotCount !== 1 ? 's' : ''} in your current view
            </p>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
