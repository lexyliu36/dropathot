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

  radius: 2000,
  setRadius: (radius) => set({ radius }),

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
