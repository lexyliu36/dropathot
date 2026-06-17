import { useState, useCallback, useEffect, useRef } from 'react'
import useAppStore from '../stores/useAppStore'

const ERROR_MESSAGES = {
  1: 'Location permission denied. Enable it in your browser settings.',
  2: 'Location unavailable. Check your connection and try again.',
  3: 'Location request timed out. Try again.',
}

export default function useLocation() {
  const [loading, setLoading] = useState(false)
  const setUserLocation = useAppStore((s) => s.setUserLocation)
  const setLocationError = useAppStore((s) => s.setLocationError)
  const location = useAppStore((s) => s.userLocation)
  const error = useAppStore((s) => s.locationError)
  const watchId = useRef(null)

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      return
    }
    // Clear any existing watcher before starting a new one
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current)
    }
    setLoading(true)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      (err) => {
        setLocationError(ERROR_MESSAGES[err.code] ?? 'Unable to get location.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [setUserLocation, setLocationError])

  // Auto-start watching on mount; clean up on unmount
  useEffect(() => {
    startWatch()
    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [startWatch])

  return { location, error, loading, retry: startWatch, request: startWatch }
}
