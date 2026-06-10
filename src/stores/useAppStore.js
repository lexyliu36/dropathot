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
    // Remove previous thot from the same session (server marks it hidden, we mirror that locally)
    set((s) => ({ thots: [thot, ...s.thots.filter((t) => t.session_id !== thot.session_id)] }))
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

  // Blocked session IDs — their thots are hidden locally only
  blockedSessions: new Set(),
  blockSession: (sessionId) => set((s) => {
    const next = new Set(s.blockedSessions)
    next.add(sessionId)
    return { blockedSessions: next, thots: s.thots.filter(t => t.session_id !== sessionId) }
  }),
  unblockSession: (sessionId) => set((s) => {
    const next = new Set(s.blockedSessions)
    next.delete(sessionId)
    return { blockedSessions: next }
  }),
}))

export default useAppStore
