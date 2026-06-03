import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),

  userLocation: null,
  locationError: null,
  setUserLocation: (userLocation) => set({ userLocation, locationError: null }),
  setLocationError: (locationError) => set({ locationError }),

  thots: [],
  setThots: (thots) => set({ thots }),
  addThot: (thot) => {
    const existing = get().thots.find((t) => t.id === thot.id)
    if (existing) return
    // Remove previous thot from the same session (server marks it hidden, we mirror that locally)
    set((s) => ({ thots: [thot, ...s.thots.filter((t) => t.session_id !== thot.session_id)] }))
  },

  composing: false,
  setComposing: (composing) => set({ composing }),

  selectedThot: null,
  setSelectedThot: (selectedThot) => set({ selectedThot }),

  radius: 2000,
  setRadius: (radius) => set({ radius }),
}))

export default useAppStore
