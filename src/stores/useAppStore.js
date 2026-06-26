import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),

  userLocation: null,
  locationError: null,
  setUserLocation: (userLocation) => set({ userLocation, locationError: null }),
  setLocationError: (locationError) => set({ locationError }),

  // Map viewport center — updated as user pans/zooms; used for API fetching
  mapCenter: null,
  setMapCenter: (mapCenter) => set({ mapCenter }),

  thots: [],
  setThots: (thots) => set((s) => ({
    thots: thots.filter(t => !s.blockedSessions.has(t.session_id))
  })),
  addThot: (thot) => {
    const s = get()
    if (s.blockedSessions.has(thot.session_id)) return
    if (s.thots.find((t) => t.id === thot.id)) return
    // Mirror server logic: only hide same-session thots within the block radius (~500m).
    // Thots posted far away from the new one remain visible.
    const BLOCK_RADIUS_M = 150
    set((s) => ({
      thots: [thot, ...s.thots.filter((t) => {
        if (t.session_id !== thot.session_id) return true  // different user, keep
        if (t.lat == null || t.lng == null) return false    // no location, hide to be safe
        const dLat = (t.lat - thot.lat) * Math.PI / 180
        const dLng = (t.lng - thot.lng) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(thot.lat * Math.PI / 180) * Math.cos(t.lat * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2
        const distM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return distM > BLOCK_RADIUS_M  // keep if far enough away
      })],
    }))
  },

  composing: false,
  setComposing: (composing) => set({ composing }),

  selectedThot: null,
  setSelectedThot: (selectedThot) => set({ selectedThot }),

  radius: 625,
  setRadius: (radius) => set({ radius }),

  limit: 100,
  setLimit: (limit) => set({ limit }),

  // Hyped thot IDs for the current auth user
  hypedThotIds: new Set(),
  setHypedThotIds: (ids) => set({ hypedThotIds: new Set(ids) }),
  toggleHypedThot: (thotId, hyped, hypeCount) => set((s) => {
    const next = new Set(s.hypedThotIds)
    if (hyped) next.add(thotId)
    else next.delete(thotId)
    return {
      hypedThotIds: next,
      thots: s.thots.map(t => t.id === thotId ? { ...t, hype_count: hypeCount } : t),
    }
  }),

  removeThot: (thotId) => set((s) => ({
    thots: s.thots.filter(t => t.id !== thotId),
    // Close the ProfileSheet if the deleted thot is currently selected
    selectedThot: s.selectedThot?.id === thotId ? null : s.selectedThot,
  })),

  // Update a live pin's position in-place (driven by thot:move socket event)
  moveThot: (id, lat, lng) => set((s) => ({
    thots: s.thots.map(t => t.id === id ? { ...t, lat, lng } : t),
  })),

  // Reported thot IDs — persisted in localStorage so you can't re-report after refresh
  reportedThotIds: new Set(JSON.parse(localStorage.getItem('reportedThotIds') || '[]')),
  addReportedThot: (thotId) => set((s) => {
    const next = new Set(s.reportedThotIds)
    next.add(thotId)
    localStorage.setItem('reportedThotIds', JSON.stringify([...next]))
    return { reportedThotIds: next }
  }),
  removeReportedThot: (thotId) => set((s) => {
    const next = new Set(s.reportedThotIds)
    next.delete(thotId)
    localStorage.setItem('reportedThotIds', JSON.stringify([...next]))
    return { reportedThotIds: next }
  }),

  // Blocked session IDs — persisted in localStorage so blocks survive page reload
  blockedSessions: new Set(JSON.parse(localStorage.getItem('blockedSessions') || '[]')),
  blockSession: (sessionId) => set((s) => {
    const next = new Set(s.blockedSessions)
    next.add(sessionId)
    localStorage.setItem('blockedSessions', JSON.stringify([...next]))
    return { blockedSessions: next, thots: s.thots.filter(t => t.session_id !== sessionId) }
  }),
  unblockSession: (sessionId) => set((s) => {
    const next = new Set(s.blockedSessions)
    next.delete(sessionId)
    localStorage.setItem('blockedSessions', JSON.stringify([...next]))
    return { blockedSessions: next }
  }),
}))

export default useAppStore
