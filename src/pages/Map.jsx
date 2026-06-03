import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import { Settings2, MessageSquarePlus } from 'lucide-react'
import useAppStore from '../stores/useAppStore'
import useLocation from '../hooks/useLocation'
import useThots from '../hooks/useThots'
import ThotPin, { AnonAvatar, pinAgeHours } from '../components/ThotPin'
import ComposeDrawer from '../components/ComposeDrawer'
import { getOrCreateSession } from '../lib/identity'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Map() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})        // { [thotId]: { marker, root } }
  const youMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(null)

  const { location, error: locationError, request: requestLocation, retry } = useLocation()
  const { error: thotsError } = useThots()

  const thots = useAppStore((s) => s.thots)
  const session = useAppStore((s) => s.session)
  const composing = useAppStore((s) => s.composing)
  const setComposing = useAppStore((s) => s.setComposing)
  const selectedThot = useAppStore((s) => s.selectedThot)
  const setSelectedThot = useAppStore((s) => s.setSelectedThot)
  const setSession = useAppStore((s) => s.setSession)

  // Load session from localStorage
  useEffect(() => {
    const localSession = getOrCreateSession()
    setSession(localSession)
    // Register with server — it issues an httpOnly cookie as the authoritative
    // session_id. The returned session_id may differ from localStorage (server-generated).
    fetch(`${API_URL}/auth/anon`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.session_id) setSession({ ...localSession, id: data.session_id }) })
      .catch(() => {}) // non-blocking — falls back to localStorage UUID if backend is down
  }, [])

  // Request location on mount
  useEffect(() => {
    requestLocation()
  }, [])

  // Initialize Mapbox
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token || token.startsWith('pk.REPLACE')) {
      setMapError('no-token')
      return
    }

    mapboxgl.accessToken = token

    const center = location
      ? [location.lng, location.lat]
      : [-74.006, 40.7128]

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 16,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))

    map.on('load', () => setMapReady(true))

    mapInstanceRef.current = map

    return () => {
      Object.values(markersRef.current).forEach(({ root }) => root.unmount())
      markersRef.current = {}
      if (youMarkerRef.current) {
        youMarkerRef.current.root?.unmount()
        youMarkerRef.current.marker?.remove()
        youMarkerRef.current = null
      }
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Pan to user location once available
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !location) return
    map.easeTo({ center: [location.lng, location.lat], zoom: 16, duration: 800 })
  }, [location])

  // Your location marker
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady || !location) return

    const el = document.createElement('div')
    el.style.cssText = 'pointer-events: none;'
    const root = createRoot(el)
    root.render(<AnonAvatar size={40} color="#e11d48" active />)

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([location.lng, location.lat])
      .addTo(map)

    if (youMarkerRef.current) {
      youMarkerRef.current.root.unmount()
      youMarkerRef.current.marker.remove()
    }
    youMarkerRef.current = { marker, root }
  }, [location, mapReady])

  // Sync thot markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady) return

    const currentIds = new Set(thots.map((t) => t.id))
    const existingIds = new Set(Object.keys(markersRef.current))

    // Remove stale
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const { marker, root } = markersRef.current[id]
        root.unmount()
        marker.remove()
        delete markersRef.current[id]
      }
    })

    // Add new — oldest first so newer pins are later in the DOM and
    // naturally win pointer-event ties without relying solely on z-index
    const newThots = thots
      .filter((t) => !existingIds.has(t.id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    newThots.forEach((thot) => {
      const isYou = thot.session_id === session?.id

      const el = document.createElement('div')
      el.style.cssText = 'pointer-events: none; overflow: visible;'
      const root = createRoot(el)
      root.render(<ThotPin thot={thot} isYou={isYou} onClick={setSelectedThot} session={session} />)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([thot.lng, thot.lat])
        .addTo(map)

      const zIndex = Math.max(1, 24 - Math.floor(pinAgeHours(thot)))
      if (el.parentElement) el.parentElement.style.zIndex = zIndex

      // Separate rAF only for position nudge (React renders async)
      requestAnimationFrame(() => marker.setLngLat([thot.lng, thot.lat]))

      markersRef.current[thot.id] = { marker, root }
    })
  }, [thots, mapReady, session?.id])

  async function handlePost(content) {
    if (!location) throw new Error('Location required')
    const body = {
      content,
      lat: location.lat,
      lng: location.lng,
      session_id: session?.id,
      pen_name: session?.penName ?? null,
    }
    const res = await fetch(`${API_URL}/thots`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Server error ${res.status}`)
    }
    const newThot = await res.json()
    useAppStore.getState().addThot(newThot)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f1e] select-none">
      {/* Mapbox container — always rendered so ref is available */}
      <div className="absolute inset-3 rounded-2xl overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Token missing fallback */}
      {mapError === 'no-token' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1e] z-10 px-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-center mb-4">
            <span className="text-brand-red text-2xl">🗺</span>
          </div>
          <p className="text-white font-bold text-lg mb-2">Mapbox token required</p>
          <p className="text-slate-400 text-sm text-center max-w-xs leading-relaxed">
            Add your <span className="text-white font-mono text-xs bg-white/10 px-1 rounded">VITE_MAPBOX_TOKEN</span> to{' '}
            <span className="text-white font-mono text-xs bg-white/10 px-1 rounded">.env</span> and restart the dev server.
            Get a free token at <span className="text-brand-blue">mapbox.com</span>.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#0a0f1e] to-transparent pointer-events-none">
        <span className="text-white font-black text-xl tracking-tight">Thots.</span>
        <button className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-slate-300 hover:bg-white/20 cursor-pointer pointer-events-auto">
          <Settings2 size={16} />
        </button>
      </div>

      {/* Location error banner */}
      {locationError && !location && (
        <div className="absolute bottom-24 left-4 right-4 z-30 bg-[#0e0e1a] border border-white/10 rounded-2xl p-4">
          <p className="text-slate-300 text-sm">{locationError}</p>
          <button onClick={retry} className="mt-2 text-blue-400 text-sm underline cursor-pointer">
            Try again
          </button>
        </div>
      )}

      {/* Thots data error (dev hint) */}
      {thotsError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-[#0e0e1a] border border-yellow-500/30 rounded-xl px-3 py-1.5">
          <p className="text-yellow-400/80 text-[10px]">{thotsError}</p>
        </div>
      )}

      {/* Dev coords — copy exact browser location for seed commands */}
      {import.meta.env.DEV && location && (
        <div
          className="absolute bottom-24 left-4 z-20 bg-black/70 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:border-white/30 transition-colors"
          onClick={() => {
            const cmd = `node --env-file=server/.env server/seed.js --lat=${location.lat.toFixed(6)} --lng=${location.lng.toFixed(6)}`
            navigator.clipboard.writeText(cmd)
          }}
          title="Click to copy seed command"
        >
          <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">your location</p>
          <p className="text-white font-mono text-[11px]">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
          <p className="text-white/30 text-[9px] mt-0.5">click to copy seed command</p>
        </div>
      )}

      {/* Compose button */}
      {!composing && !selectedThot && (
        <div className="absolute bottom-6 right-5 z-20">
          <button
            onClick={() => setComposing(true)}
            className="w-14 h-14 rounded-full bg-brand-red shadow-lg flex items-center justify-center text-white hover:bg-rose-500 transition-colors cursor-pointer"
            style={{ boxShadow: '0 0 24px #e11d4860' }}
          >
            <MessageSquarePlus size={24} />
          </button>
        </div>
      )}

      {/* Compose drawer */}
      {composing && (
        <ComposeDrawer
          onClose={() => setComposing(false)}
          onPost={handlePost}
          location={location}
          session={session}
        />
      )}

      {/* Selected thot detail sheet */}
      {selectedThot && (
        <div
          className="absolute inset-0 z-25 bg-black/40 flex items-end"
          onClick={() => setSelectedThot(null)}
        >
          <div
            className="w-full bg-[#0e0e1a] border-t border-white/10 rounded-t-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <AnonAvatar
                size={40}
                color={selectedThot.pen_name ? '#7c3aed' : '#64748b'}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-brand-purple font-semibold text-sm">
                    {selectedThot.pen_name || 'Anonymous'}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {new Date(selectedThot.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-white text-sm leading-relaxed mt-1">{selectedThot.content}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedThot(null)}
              className="text-slate-500 text-sm hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
