import { useState, useEffect, useRef } from 'react'
import useAppStore from '../stores/useAppStore'
import { getSocket } from '../lib/socket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function useThots() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const socketSubscribed = useRef(false)
  const { userLocation, mapCenter, radius, limit, setThots, addThot, moveThot } = useAppStore()
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
          setThots([])
          setError('Could not load thots — check your connection.')
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
      socket.emit('subscribe', { lat: fetchCenter.lat, lng: fetchCenter.lng })
      socket.on('thot:new', addThot)
      socket.on('thot:move', (thot) => { moveThot(thot.id, thot.lat, thot.lng) })
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
        socket.off('thot:move')
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
