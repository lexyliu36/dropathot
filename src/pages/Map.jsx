import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import { SlidersHorizontal, MessageSquarePlus, LocateFixed } from 'lucide-react'
import useAppStore from '../stores/useAppStore'
import useLocation from '../hooks/useLocation'
import useThots from '../hooks/useThots'
import ThotPin, { AnonAvatar, YouPin, pinAgeHours } from '../components/ThotPin'
import ComposeDrawer from '../components/ComposeDrawer'
import ToolsPanel from '../components/ToolsPanel'
import ProfileSheet from '../components/ProfileSheet'
import { getOrCreateSession, updateSession } from '../lib/identity'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Radius and thot limit scale with zoom level.
// Zoomed in  → small radius, show everything.
// Zoomed out → large radius, only show top thots by hype so the map stays readable.
function applyZoomSettings(map) {
  const c = map.getCenter()
  const zoom = map.getZoom()
  const radius = Math.round(40000 / Math.pow(2, zoom - 10)) // no hard cap — grows naturally
  const limit =
    zoom >= 16 ? 100 :
    zoom >= 14 ? 60  :
    zoom >= 12 ? 30  :
    zoom >= 10 ? 20  :
    zoom >=  8 ? 10  :
    zoom >=  6 ?  5  : 3
  const store = useAppStore.getState()
  store.setMapCenter({ lat: c.lat, lng: c.lng })
  store.setRadius(radius)
  store.setLimit(limit)
}

export default function Map() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})        // { [thotId]: { marker, root } }
  const youMarkerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [toolsOpen, setToolsOpen] = useState(false)

  const { location, error: locationError, request: requestLocation, retry } = useLocation()
  const { error: thotsError } = useThots()

  const thots = useAppStore((s) => s.thots)
  const session = useAppStore((s) => s.session)
  const composing = useAppStore((s) => s.composing)
  const setComposing = useAppStore((s) => s.setComposing)
  const selectedThot = useAppStore((s) => s.selectedThot)
  const setSelectedThot = useAppStore((s) => s.setSelectedThot)
  const [showYouProfile, setShowYouProfile] = useState(false)
  const setSession = useAppStore((s) => s.setSession)
  const setHypedThotIds = useAppStore((s) => s.setHypedThotIds)
  const toggleHypedThot = useAppStore((s) => s.toggleHypedThot)

  // Load session from localStorage and refresh auth user's pen name from the server
  useEffect(() => {
    const localSession = getOrCreateSession()
    setSession(localSession)

    if (localSession.type === 'user' && localSession.supabaseToken) {
      // Restore the Supabase session so the client SDK auto-refreshes the token.
      // setSession() returns immediately with a valid (possibly refreshed) token.
      const initAuth = async () => {
        let token = localSession.supabaseToken
        if (supabase && localSession.supabaseRefreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: localSession.supabaseToken,
            refresh_token: localSession.supabaseRefreshToken,
          })
          if (data?.session) {
            token = data.session.access_token
            updateSession({ supabaseToken: token, supabaseRefreshToken: data.session.refresh_token })
            setSession({ ...localSession, supabaseToken: token })
          }
        }
        const headers = { Authorization: `Bearer ${token}` }
        fetch(`${API_URL}/auth/profile`, { credentials: 'include', headers })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.pen_name) {
              updateSession({ penName: d.pen_name })
              // setSession takes a value, not a functional updater — read current state explicitly
              setSession({ ...useAppStore.getState().session, penName: d.pen_name })
            }
          })
          .catch(() => {})
        fetch(`${API_URL}/thots/my-hypes`, { credentials: 'include', headers })
          .then(r => r.ok ? r.json() : [])
          .then(ids => setHypedThotIds(ids))
          .catch(() => {})
      }
      initAuth()

      // Keep the stored token fresh whenever the SDK auto-refreshes it
      if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session) {
            updateSession({ supabaseToken: session.access_token, supabaseRefreshToken: session.refresh_token })
            useAppStore.getState().setSession({ ...useAppStore.getState().session, supabaseToken: session.access_token })
          }
        })
        return () => subscription.unsubscribe()
      }
      return
    }

    // Anon users: register with server to get the authoritative httpOnly session cookie
    fetch(`${API_URL}/auth/anon`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.session_id) setSession({ ...localSession, id: data.session_id }) })
      .catch(() => {})
  }, [])

  // Request location on mount
  useEffect(() => {
    requestLocation()
  }, [])

  // Listen for auth-required signals from detached ThotPin React roots
  useEffect(() => {
    const handler = () => navigate('/', { state: { openSignup: true } })
    window.addEventListener('thots:needs-auth', handler)
    return () => window.removeEventListener('thots:needs-auth', handler)
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

    map.on('load', () => {
      setMapReady(true)
      applyZoomSettings(map)
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
      setMapError(e?.error?.message || e?.message || 'map-error')
    })

    // Update fetch params on every pan/zoom (debounced 400ms)
    let moveTimer
    map.on('moveend', () => {
      clearTimeout(moveTimer)
      moveTimer = setTimeout(() => applyZoomSettings(map), 400)
    })

    mapInstanceRef.current = map

    return () => {
      clearTimeout(moveTimer)
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

  // Your location marker — created once on location + mapReady
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady || !location) return

    const el = document.createElement('div')
    el.style.cssText = 'pointer-events: none; overflow: visible;'
    const root = createRoot(el)
    root.render(<YouPin hasThot={false} onAvatarClick={() => { setShowYouProfile(true); setSelectedThot(null) }} />)

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([location.lng, location.lat])
      .addTo(map)

    if (youMarkerRef.current) {
      youMarkerRef.current.root.unmount()
      youMarkerRef.current.marker.remove()
    }
    youMarkerRef.current = { marker, root }
  }, [location, mapReady])

  // Re-render YouPin when the user's thot status changes
  useEffect(() => {
    if (!youMarkerRef.current) return
    const userThot = thots.find(t => t.session_id === session?.id) ?? null
    youMarkerRef.current.root.render(
      <YouPin
        hasThot={!!userThot}
        onAvatarClick={() => { setShowYouProfile(true); setSelectedThot(null) }}
      />
    )
  }, [thots, session?.id])

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
      root.render(
        <ThotPin
          thot={thot}
          isYou={isYou}
          session={session}
          onHype={handleHype}
          onClick={(t) => {
            if (t.session_id === session?.id) {
              setShowYouProfile(true)
              setSelectedThot(null)
            } else {
              setSelectedThot(t)
              setShowYouProfile(false)
            }
            setToolsOpen(false)
          }}
        />
      )

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([thot.lng, thot.lat])
        .addTo(map)

      const zIndex = Math.max(1, 24 - Math.floor(pinAgeHours(thot)))
      if (el.parentElement) el.parentElement.style.zIndex = zIndex

      markersRef.current[thot.id] = { marker, root, thot }
    })

    // Re-insert YouPin's element last so it wins click ties by DOM order
    const youEl = youMarkerRef.current?.marker?.getElement()
    if (youEl?.parentElement) youEl.parentElement.appendChild(youEl)
  }, [thots, mapReady, session?.id])

  async function handleHype(thotId) {
    const s = useAppStore.getState()
    console.log('[hype] called for', thotId, 'session type:', s.session?.type, 'has token:', !!s.session?.supabaseToken)
    if (!s.session?.supabaseToken) {
      window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      return
    }
    const res = await fetch(`${API_URL}/thots/${thotId}/hype`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${s.session.supabaseToken}` },
    })
    const data = await res.json().catch(() => ({}))
    console.log('[hype] server response', res.status, data)
    if (res.status === 401) { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }
    if (!res.ok) return
    toggleHypedThot(thotId, data.hyped, data.hype_count)
  }

  async function handlePost(content, duration) {
    if (!location) throw new Error('Location required')
    const body = {
      content,
      lat: location.lat,
      lng: location.lng,
      session_id: session?.id,
      pen_name: session?.penName ?? null,
      duration_hours: duration,
    }
    const headers = { 'Content-Type': 'application/json' }
    if (session?.supabaseToken) headers['Authorization'] = `Bearer ${session.supabaseToken}`

    const res = await fetch(`${API_URL}/thots`, {
      method: 'POST',
      credentials: 'include',
      headers,
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
    <div className="relative w-screen overflow-hidden bg-[#0a0f1e] select-none" style={{ height: "100dvh" }}>
      {/* Mapbox container — always rendered so ref is available */}
      <div className="absolute inset-3 rounded-2xl overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Token missing fallback */}
      {mapError && mapError !== 'no-token' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1e] z-10 px-8">
          <p className="text-white font-bold text-lg mb-2">Map failed to load</p>
          <p className="text-slate-400 text-sm text-center">{mapError}</p>
        </div>
      )}

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
        <button
          onClick={() => setToolsOpen(o => !o)}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer pointer-events-auto ${
            toolsOpen
              ? 'bg-brand-purple/20 border-brand-purple/50 text-brand-purple'
              : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/20'
          }`}
        >
          <SlidersHorizontal size={15} />
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

      {/* Bottom-left stack: zoom controls above dev coords */}
      <div className="absolute bottom-6 left-4 z-20 flex flex-col items-start gap-2">
        {/* Recenter button */}
        {location && (
          <button
            onClick={() => mapInstanceRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 16, duration: 600 })}
            className="w-9 h-9 rounded-xl bg-[#0e0e1a]/90 border border-white/10 shadow-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Recenter on me"
          >
            <LocateFixed size={15} />
          </button>
        )}

        {/* Zoom controls */}
        <div className="flex flex-col rounded-xl overflow-hidden border border-white/10 shadow-lg">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn({ duration: 200 })}
            className="w-9 h-9 bg-[#0e0e1a]/90 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center text-lg font-light transition-colors cursor-pointer border-b border-white/10"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut({ duration: 200 })}
            className="w-9 h-9 bg-[#0e0e1a]/90 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center text-lg font-light transition-colors cursor-pointer"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* Dev coords — only in dev mode */}
        {import.meta.env.DEV && location && (
          <div
            className="bg-black/70 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:border-white/30 transition-colors"
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
      </div>

      {/* Compose button */}
      {!composing && (
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

      {/* Tools panel */}
      {toolsOpen && (
        <ToolsPanel
          onClose={() => setToolsOpen(false)}
          thots={thots}
          session={session}
        />
      )}

      {/* Profile sheet — tapping any thot bubble or avatar */}
      {selectedThot && !composing && (
        <ProfileSheet
          thot={selectedThot}
          session={session}
          onHype={handleHype}
          onClose={() => setSelectedThot(null)}
        />
      )}

      {/* Your profile sheet — tapping your own YouPin */}
      {showYouProfile && !composing && (
        <ProfileSheet
          thot={thots.find(t => t.session_id === session?.id) ?? null}
          session={session}
          isYouProfile
          onHype={handleHype}
          onCompose={() => { setShowYouProfile(false); setComposing(true) }}
          onClose={() => setShowYouProfile(false)}
        />
      )}
    </div>
  )
}
