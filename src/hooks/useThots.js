import { useState, useEffect, useRef } from 'react'
import useAppStore from '../stores/useAppStore'
import { getSocket } from '../lib/socket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Dev mock data — shaped like real DB schema, positioned relative to NYC
const MOCK_THOTS = [
  { id: '1', content: 'anyone else notice how the sky looks different at 3am', pen_name: null, session_id: 'mock', created_at: new Date(Date.now() - 2 * 60000).toISOString(), lat: 40.7148, lng: -74.008 },
  { id: '2', content: 'just dropped my phone in a puddle and it survived. we are SO back', pen_name: 'VoidDrifter', session_id: 'mock', created_at: new Date(Date.now() - 5 * 60000).toISOString(), lat: 40.7118, lng: -74.003 },
  { id: '3', content: 'the coffee shop on 5th st has free wifi that actually works', pen_name: 'NeonEcho', session_id: 'mock', created_at: new Date(Date.now() - 11 * 60000).toISOString(), lat: 40.7138, lng: -74.011 },
  { id: '4', content: 'unpopular opinion: silence is underrated', pen_name: null, session_id: 'mock', created_at: new Date(Date.now() - 18 * 60000).toISOString(), lat: 40.7108, lng: -74.006 },
  { id: '5', content: "if you're reading this you're within a mile of me. spooky", pen_name: 'LiminalTrace', session_id: 'mock', created_at: new Date(Date.now() - 23 * 60000).toISOString(), lat: 40.7158, lng: -74.001 },
]

export default function useThots() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const socketSubscribed = useRef(false)
  const { userLocation, mapCenter, radius, limit, setThots, addThot } = useAppStore()
  const fetchCenter = mapCenter ?? userLocation

  useEffect(() => {
    if (!fetchCenter) return

    let cancelled = false

    async function fetchThots() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${API_URL}/thots?lat=${fetchCenter.lat}&lng=${fetchCenter.lng}&radius=${radius}&limit=${limit}`
        )
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        if (!cancelled) setThots(data)
      } catch (err) {
        if (!cancelled) {
          setThots(MOCK_THOTS.map((t) => ({
            ...t,
            lat: fetchCenter.lat + (t.lat - 40.7128),
            lng: fetchCenter.lng + (t.lng - (-74.006)),
          })))
          setError('Using mock data — backend not running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchThots()

    // Socket.io subscription
    if (!socketSubscribed.current) {
      const socket = getSocket()
      socket.connect()
      socket.emit('subscribe', { lat: userLocation.lat, lng: userLocation.lng })
      socket.on('thot:new', addThot)
      socketSubscribed.current = true
    }

    return () => {
      cancelled = true
    }
  }, [fetchCenter?.lat, fetchCenter?.lng, radius, limit])

  useEffect(() => {
    return () => {
      if (socketSubscribed.current) {
        const socket = getSocket()
        socket.emit('unsubscribe')
        socket.off('thot:new')
        socketSubscribed.current = false
      }
    }
  }, [])

  const refresh = () => {
    if (userLocation) {
      setThots([])
      socketSubscribed.current = false
    }
  }

  return { loading, error, refresh }
}
