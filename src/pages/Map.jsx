import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import { SlidersHorizontal, MessageSquarePlus, LocateFixed, Star, Search, X } from 'lucide-react'
import useAppStore from '../stores/useAppStore'
import { invalidate as invalidateThotCache } from '../lib/thotCache'
import useLocation from '../hooks/useLocation'
import useThots from '../hooks/useThots'
import ThotPin, { AnonAvatar, YouPin, pinAgeHours } from '../components/ThotPin'
import ComposeDrawer from '../components/ComposeDrawer'
import ToolsPanel from '../components/ToolsPanel'
import TopThots from '../components/TopThots'
import ProfileSheet from '../components/ProfileSheet'
import DMDrawer from '../components/DMDrawer'
import AuthModal from '../components/AuthModal'
import { getOrCreateSession, updateSession } from '../lib/identity'
import { explodeMarker } from '../lib/animations'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'


// Grid-based spatial dedupe — divides the screen into cellSizePx cells,
// keeps up to maxPerCell thots per cell (best hype wins).
// Grid cells are geographic so Brooklyn cells are always separate from
// Manhattan cells regardless of zoom level.
function dedupeThots(thots, map, maxPerCell = 2, cellSizePx = 150) {
  if (!map) return thots
  const canvas = map.getCanvas()
  const w = canvas.width
  const h = canvas.height
  const sorted = [...thots].sort((a, b) => (b.hype_count ?? 0) - (a.hype_count ?? 0))
  const cells = {}
  const kept = []
  for (const thot of sorted) {
    const pt = map.project([thot.lng, thot.lat])
    // Drop thots projected outside the visible canvas
    if (pt.x < 0 || pt.y < 0 || pt.x > w || pt.y > h) continue
    const key = `${Math.floor(pt.x / cellSizePx)},${Math.floor(pt.y / cellSizePx)}`
    const count = cells[key] ?? 0
    if (count < maxPerCell) {
      cells[key] = count + 1
      kept.push(thot)
    }
  }
  return kept
}

// Radius and thot limit scale with zoom level.
// Zoomed in  → small radius, show everything.
// Zoomed out → large radius, only show top thots by hype so the map stays readable.
function applyZoomSettings(map) {
  const c = map.getCenter()
  const bounds = map.getBounds()
  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  // Radius = half-diagonal of visible viewport in meters (covers entire screen)
  const latDiff = Math.abs(ne.lat - sw.lat) / 2
  const lngDiff = Math.abs(ne.lng - sw.lng) / 2
  const radius = Math.round(Math.sqrt(
    Math.pow(latDiff * 111320, 2) +
    Math.pow(lngDiff * 111320 * Math.cos(c.lat * Math.PI / 180), 2)
  ))
  const store = useAppStore.getState()
  store.setMapCenter({ lat: c.lat, lng: c.lng })
  store.setRadius(radius)
  store.setLimit(100)
}

// Generate a GeoJSON circle polygon approximation (radiusM metres, n points)
function makeCircleGeoJSON(lat, lng, radiusM, n = 64) {
  const coords = []
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * 2 * Math.PI
    const dLat = (radiusM * Math.cos(angle)) / 111320
    const dLng = (radiusM * Math.sin(angle)) / (111320 * Math.cos(lat * Math.PI / 180))
    coords.push([lng + dLng, lat + dLat])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
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
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [authModal, setAuthModal] = useState(null) // null | 'login' | 'signup'
  const [searchFetching, setSearchFetching] = useState(false)
  const searchInputRef = useRef(null)
  const searchSessionToken = useRef(crypto.randomUUID())
  const hypeTimersRef = useRef({})        // debounce timers per thot
  const hypeServerRef = useRef({})        // last confirmed server state per thot

  const { location, error: locationError, request: requestLocation, retry } = useLocation()
  const { error: thotsError } = useThots()

  const thots = useAppStore((s) => s.thots)
  const [visibleThots, setVisibleThots] = useState([])
  const session = useAppStore((s) => s.session)
  const composing = useAppStore((s) => s.composing)
  const setComposing = useAppStore((s) => s.setComposing)
  const selectedThot = useAppStore((s) => s.selectedThot)
  const setSelectedThot = useAppStore((s) => s.setSelectedThot)
  const [showYouProfile, setShowYouProfile] = useState(false)
  const [dmPartner, setDmPartner] = useState(null) // { userId, penName, accentColor }
  const [dmSource, setDmSource] = useState(null) // 'selected' | 'you' — which profile sheet to restore
  const [openCommentForThotId, setOpenCommentForThotId] = useState(null)
  const [youHighlightThotId, setYouHighlightThotId] = useState(null)
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
          .then(ids => { setHypedThotIds(ids); ids.forEach(id => { hypeServerRef.current[id] = true }) })
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

        // When tab becomes visible again (e.g. laptop opened), force-refresh the token
        // so a stale JWT doesn't silently fail on the next post attempt
        const onVisible = async () => {
          if (document.visibilityState !== 'visible') return
          const { data } = await supabase.auth.getSession()
          if (data?.session) {
            updateSession({ supabaseToken: data.session.access_token, supabaseRefreshToken: data.session.refresh_token })
            useAppStore.getState().setSession({ ...useAppStore.getState().session, supabaseToken: data.session.access_token })
          }
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
          subscription.unsubscribe()
          document.removeEventListener('visibilitychange', onVisible)
        }
      }
      return
    }

    // Only authenticated users can reach the map — nothing to do for anon sessions
  }, [])

  // Ping server on mount to wake Railway from cold start before any real requests
  useEffect(() => {
    fetch(`${API_URL}/health`, { method: 'GET' }).catch(() => {})
  }, [])

  // Request location on mount
  useEffect(() => {
    requestLocation()
  }, [])

  // Listen for auth-required signals from detached ThotPin React roots
  useEffect(() => {
    const handler = () => setAuthModal('signup')
    const authHandler = (e) => setAuthModal(e.detail ?? 'login')
    window.addEventListener('thots:needs-auth', handler)
    window.addEventListener('thots:open-auth', authHandler)
    return () => {
      window.removeEventListener('thots:needs-auth', handler)
      window.removeEventListener('thots:open-auth', authHandler)
    }
  }, [])

  // Initialize Mapbox
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token || token.startsWith('pk.REPLACE')) {
      setMapError('no-token')
      return
    }

    if (!mapboxgl.supported()) {
      setMapError('WebGL is not supported on this browser/device.')
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
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })
    // Lock to 2D — no tilt or rotation gestures
    map.dragRotate.disable()
    map.touchPitch.disable()
    map.touchZoomRotate.disableRotation()

    map.addControl(new mapboxgl.AttributionControl({ compact: true }))

    map.on('load', () => {
      setMapReady(true)
      applyZoomSettings(map)
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
      setMapError(e?.error?.message || e?.message || 'map-error')
    })

    // iOS Safari: resize map when browser UI changes (address bar hide/show,
    // permission dialogs dismiss) to prevent blank canvas
    const onResize = () => map.resize()
    const onVisible = () => { if (document.visibilityState === 'visible') map.resize() }
    const onPageShow = () => { setTimeout(() => map.resize(), 100) }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    // Update fetch params on every pan/zoom (debounced 400ms)
    let moveTimer
    map.on('moveend', () => {
      clearTimeout(moveTimer)
      moveTimer = setTimeout(() => {
        applyZoomSettings(map)
        setVisibleThots(dedupeThots(useAppStore.getState().thots, map))
      }, 400)
    })

    mapInstanceRef.current = map

    return () => {
      clearTimeout(moveTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
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

  // Pan to user location once available + force resize in case iOS blanked the canvas
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !location) return
    map.resize()
    map.easeTo({ center: [location.lng, location.lat], zoom: 16, duration: 800 })
    // Second resize after browser UI fully settles on mobile
    const t = setTimeout(() => map.resize(), 300)
    return () => clearTimeout(t)
  }, [location])

  // Your location marker — created once on location + mapReady
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady || !location) return

    const isAnon = session?.type !== 'user'
    const el = document.createElement('div')
    el.style.cssText = 'pointer-events: none; overflow: visible;'
    const root = createRoot(el)
    root.render(<YouPin hasThot={false} isAnon={isAnon} onAvatarClick={() => { setShowYouProfile(true); setYouHighlightThotId(null); setSelectedThot(null) }} />)

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([location.lng, location.lat])
      .addTo(map)

    if (youMarkerRef.current) {
      youMarkerRef.current.root.unmount()
      youMarkerRef.current.marker.remove()
    }
    youMarkerRef.current = { marker, root }
  }, [location, mapReady])

  // Re-render YouPin when the user's thot status or auth state changes
  useEffect(() => {
    if (!youMarkerRef.current) return
    const isAnon = session?.type !== 'user'
    const userThot = thots.find(t => t.session_id === session?.id || t.user_id === session?.id) ?? null
    youMarkerRef.current.root.render(
      <YouPin
        hasThot={!!userThot}
        isAnon={isAnon}
        onAvatarClick={() => { setShowYouProfile(true); setYouHighlightThotId(null); setSelectedThot(null) }}
      />
    )
  }, [thots, session?.id, session?.type])



  // 200m postable-range ring — only shown for authenticated users (anon can't post)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady) return
    const isAuth = session?.type === 'user'
    // Remove ring if user is anonymous or location is gone
    if (!isAuth || !location) {
      if (map.getLayer('range-ring-fill')) map.removeLayer('range-ring-fill')
      if (map.getLayer('range-ring-line')) map.removeLayer('range-ring-line')
      if (map.getSource('range-ring')) map.removeSource('range-ring')
      return
    }
    const geojson = makeCircleGeoJSON(location.lat, location.lng, 200)
    if (map.getSource('range-ring')) {
      map.getSource('range-ring').setData(geojson)
    } else {
      map.addSource('range-ring', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'range-ring-fill',
        type: 'fill',
        source: 'range-ring',
        paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.03 },
      })
      map.addLayer({
        id: 'range-ring-line',
        type: 'line',
        source: 'range-ring',
        paint: { 'line-color': '#94a3b8', 'line-opacity': 0.4, 'line-width': 1.5, 'line-dasharray': [4, 4] },
      })
    }
  }, [location, mapReady, session?.type])

  // Recompute visible (deduped) thots whenever raw thots change
  useEffect(() => {
    const map = mapInstanceRef.current
    setVisibleThots(dedupeThots(thots, map))
  }, [thots])

  // Sync thot markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady) return

    const currentIds = new Set(visibleThots.map((t) => t.id))
    const existingIds = new Set(Object.keys(markersRef.current))

    // Remove stale — particle-explode at the marker's screen position, then destroy
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const { marker, root } = markersRef.current[id]
        delete markersRef.current[id]
        explodeMarker(marker, map, () => { root.unmount(); marker.remove() })
      }
    })

    // Add new — oldest first so newer pins are later in the DOM and
    // naturally win pointer-event ties without relying solely on z-index
    const newThots = visibleThots
      .filter((t) => !existingIds.has(t.id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    newThots.forEach((thot) => {
      const isYou = thot.session_id === session?.id || thot.user_id === session?.id

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
            if (t.lat != null && t.lng != null) {
              mapInstanceRef.current?.flyTo({ center: [t.lng, t.lat], zoom: 17, duration: 700 })
            }
            if (t.session_id === session?.id || t.user_id === session?.id) {
              setShowYouProfile(true)
              setYouHighlightThotId(t.id)
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
  }, [visibleThots, mapReady, session?.id])

  function handleHype(thotId) {
    const s = useAppStore.getState()
    if (!s.session?.supabaseToken) {
      window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      return
    }
    // Optimistic toggle — instant UI feedback
    const wasHyped = s.hypedThotIds.has(thotId)
    const prevCount = s.thots.find(t => t.id === thotId)?.hype_count ?? 0
    toggleHypedThot(thotId, !wasHyped, wasHyped ? prevCount - 1 : prevCount + 1)

    // Debounce the API call so rapid clicks only send one request
    clearTimeout(hypeTimersRef.current[thotId])
    hypeTimersRef.current[thotId] = setTimeout(async () => {
      const current = useAppStore.getState()
      const desiredHyped = current.hypedThotIds.has(thotId)
      const serverHyped = hypeServerRef.current[thotId] ?? false

      // If optimistic state already matches server, skip the request
      if (desiredHyped === serverHyped) return

      const token = current.session?.supabaseToken
      const res = await fetch(`${API_URL}/thots/${thotId}/hype`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        toggleHypedThot(thotId, serverHyped, prevCount) // revert
        window.dispatchEvent(new CustomEvent('thots:needs-auth'))
        return
      }
      if (!res.ok) {
        toggleHypedThot(thotId, serverHyped, prevCount) // revert
        return
      }
      const data = await res.json().catch(() => ({}))
      hypeServerRef.current[thotId] = data.hyped  // update known server state
      toggleHypedThot(thotId, data.hyped, data.hype_count)
    }, 350)
  }

  async function handlePost(content, duration, jitteredLoc) {
    if (!location) throw new Error('Location required')
    if (session?.type !== 'user') {
      window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      throw new Error('Sign in to post')
    }
    const body = {
      content,
      lat: (jitteredLoc ?? location).lat,
      lng: (jitteredLoc ?? location).lng,
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
      const err = new Error(data.error || `Server error ${res.status}`)
      err.code = data.code ?? null
      throw err
    }
    const newThot = await res.json()
    useAppStore.getState().addThot(newThot)
    invalidateThotCache(session?.id)
  }

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", background: "#0a0f1e", userSelect: "none" }}>
      {/* Mapbox container — always rendered so ref is available */}
      <div className="absolute inset-0 overflow-hidden" style={{ transform: "translateZ(0)" }}>
        <div ref={mapRef} className="w-full h-full" style={{ transform: "translateZ(0)" }} />
      </div>

      {/* Loading overlay — shown until Mapbox fires its load event */}
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1e] z-10 gap-3">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs">Loading map…</p>
        </div>
      )}

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
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        {searchOpen ? (
          /* Search mode */
          <div className="flex flex-col pointer-events-auto mx-3 mt-3 search-bar-expand">
            <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-2xl" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.18)' }}>
              <Search size={15} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={async (e) => {
                  const q = e.target.value
                  setSearchQuery(q)
                  if (!q.trim()) { setSearchResults([]); return }
                  setSearchFetching(true)
                  try {
                    const token = import.meta.env.VITE_MAPBOX_TOKEN
                    const map = mapInstanceRef.current
                    const center = map?.getCenter()
                    const proximity = center ? `${center.lng},${center.lat}` : ''
                    const params = new URLSearchParams({
                      q,
                      access_token: token,
                      session_token: searchSessionToken.current,
                      limit: '6',
                      language: 'en',
                      ...(proximity ? { proximity } : {}),
                    })
                    const r = await fetch(
                      `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`
                    )
                    const data = await r.json()
                    setSearchResults(data.suggestions ?? [])
                  } catch { setSearchResults([]) }
                  finally { setSearchFetching(false) }
                }}
                placeholder="Search any place…"
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none search-input-fadein"
                style={{ fontSize: '16px' }}
                autoFocus
              />
              {searchFetching && (
                <div className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin flex-shrink-0" />
              )}
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1.5 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.12)' }}>
                {searchResults.map((suggestion, i) => {
                  const primary = suggestion.name
                  const secondary = suggestion.place_formatted ?? suggestion.full_address ?? ''
                  return (
                    <button
                      key={suggestion.mapbox_id}
                      onClick={async () => {
                        try {
                          const token = import.meta.env.VITE_MAPBOX_TOKEN
                          const params = new URLSearchParams({
                            access_token: token,
                            session_token: searchSessionToken.current,
                          })
                          const r = await fetch(
                            `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?${params}`
                          )
                          const data = await r.json()
                          const coords = data.features?.[0]?.geometry?.coordinates
                          if (coords) {
                            mapInstanceRef.current?.flyTo({ center: coords, zoom: 15, duration: 800 })
                            searchSessionToken.current = crypto.randomUUID()
                          }
                        } catch (e) { console.error(e) }
                        setSearchOpen(false)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
                      style={{ background: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <Search size={12} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium leading-tight truncate">{primary}</p>
                        {secondary && <p className="text-slate-400 text-xs mt-0.5 truncate">{secondary}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Normal mode */
          <div className="relative flex items-center px-4 py-3 bg-gradient-to-b from-[#0a0f1e] to-transparent pointer-events-none">
            {/* Search — left */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => { if (session?.type !== 'user') { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }; setSearchOpen(true); setLeaderboardOpen(false); setToolsOpen(false); setSelectedThot(null); setShowYouProfile(false); setComposing(false); setDmPartner(null) }}
                className="w-9 h-9 rounded-full border border-white/15 bg-white/10 flex items-center justify-center text-slate-300 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <Search size={15} />
              </button>
            </div>
            {/* Logo — absolute center */}
            <span className="absolute left-1/2 -translate-x-1/2 text-white font-black text-xl tracking-tight pointer-events-none">dropathot</span>
            <div className="flex items-center gap-2 pointer-events-auto ml-auto">
              <button
                onClick={() => { setLeaderboardOpen(o => !o); setToolsOpen(false); setSelectedThot(null); setShowYouProfile(false); setComposing(false) }}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  leaderboardOpen
                    ? 'bg-amber-500/20 border-amber-500/50'
                    : 'bg-white/10 border-white/15 hover:bg-white/20'
                }`}
              >
                <Star size={15} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
              </button>
              <button
                onClick={() => { setToolsOpen(o => !o); setLeaderboardOpen(false); setSelectedThot(null); setShowYouProfile(false); setComposing(false) }}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  toolsOpen
                    ? 'bg-brand-purple/20 border-brand-purple/50 text-brand-purple'
                    : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/20'
                }`}
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>
          </div>
        )}
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
            onClick={() => mapInstanceRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 16, pitch: 0, bearing: 0, duration: 600 })}
            className="w-9 h-9 rounded-xl bg-[#0e0e1a]/90 border border-white/10 shadow-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: '#e11d48' }}
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
            onClick={() => {
              if (session?.type !== 'user') {
                window.dispatchEvent(new CustomEvent('thots:needs-auth'))
                return
              }
              setComposing(true)
            }}
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
          onClose={() => { setComposing(false); setTimeout(() => mapInstanceRef.current?.resize(), 100) }}
          onPost={handlePost}
          location={location}
          session={session}
        />
      )}

      {/* Tools panel */}
      {leaderboardOpen && (
        <TopThots
          thots={visibleThots}
          session={session}
          onHype={handleHype}
          onClose={() => setLeaderboardOpen(false)}
          onSelectThot={(thot) => {
            useAppStore.getState().setSelectedThot(thot)
            setOpenCommentForThotId(null)
            setLeaderboardOpen(false)
          }}
          onCommentClick={(thot) => {
            useAppStore.getState().setSelectedThot(thot)
            setOpenCommentForThotId(thot.id)
            setLeaderboardOpen(false)
          }}
          onFlyTo={(thot) => {
            mapInstanceRef.current?.flyTo({ center: [thot.lng, thot.lat], zoom: 17, duration: 700 })
            setLeaderboardOpen(false)
          }}
        />
      )}

      {toolsOpen && (
        <ToolsPanel
          onClose={() => setToolsOpen(false)}
          thots={visibleThots}
          session={session}
          onHype={handleHype}
          onOpenProfile={(thot) => {
            useAppStore.getState().setSelectedThot(thot)
            setToolsOpen(false)
          }}
          onFlyTo={(thot) => {
            mapInstanceRef.current?.flyTo({ center: [thot.lng, thot.lat], zoom: 17, duration: 700 })
            setToolsOpen(false)
          }}
          onOpenDM={partner => { setToolsOpen(false); setDmPartner(partner) }}
        />
      )}

      {/* Profile sheet — tapping any thot bubble or avatar */}
      {selectedThot && !composing && (
        <ProfileSheet
          thot={selectedThot}
          isYouProfile={selectedThot?.user_id === session?.id}
          session={session}
          onHype={handleHype}
          onClose={() => { setSelectedThot(null); setOpenCommentForThotId(null) }}
          openCommentForThotId={openCommentForThotId}
          highlightThotId={selectedThot?.id}
          onFlyTo={(t) => {
            mapInstanceRef.current?.flyTo({ center: [t.lng, t.lat], zoom: 17, duration: 700 })
            setSelectedThot(t)
          }}
          onOpenDM={partner => { setDmSource('selected'); setDmPartner(partner) }}
        />
      )}

      {/* Your profile sheet — tapping your own YouPin */}
      {showYouProfile && !composing && (
        <ProfileSheet
          thot={thots.find(t => t.session_id === session?.id || t.user_id === session?.id) ?? null}
          session={session}
          isYouProfile
          onHype={handleHype}
          onCompose={() => { setShowYouProfile(false); setComposing(true) }}
          onClose={() => { setShowYouProfile(false); setYouHighlightThotId(null) }}
          highlightThotId={youHighlightThotId}
          onFlyTo={(t) => {
            mapInstanceRef.current?.flyTo({ center: [t.lng, t.lat], zoom: 17, duration: 700 })
            setYouHighlightThotId(t.id)
          }}
          onOpenDM={partner => { setDmSource('you'); setDmPartner(partner) }}
        />
      )}

      {/* DM Drawer */}
      {dmPartner && !composing && (
        <DMDrawer
          partner={dmPartner}
          onClose={() => {
            setDmPartner(null)
            setDmSource(null)
          }}
        />
      )}

      {/* Auth modal */}
      {authModal && (
        <AuthModal
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
          onSuccess={() => setAuthModal(null)}
        />
      )}
    </div>
  )
}
