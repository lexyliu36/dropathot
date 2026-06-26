/**
 * useNetworkStatus.js
 *
 * Returns { isOnline: boolean }.
 *
 * On native iOS/Android (Capacitor): uses @capacitor/network for reliable status
 * even when the device has a WiFi association but no real internet (common at
 * busy festivals where the AP is saturated).
 *
 * In a browser: falls back to navigator.onLine + online/offline events.
 */

import { useState, useEffect } from 'react'

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    let removeListener = () => {}

    async function setup() {
      try {
        // Dynamic import so the web build doesn't break if native plugin is absent
        const { Network } = await import('@capacitor/network')

        // Get current status immediately
        const status = await Network.getStatus()
        setIsOnline(status.connected)

        // Listen for changes (Capacitor checks the actual data path, not just WiFi association)
        const listener = await Network.addListener('networkStatusChange', (s) => {
          setIsOnline(s.connected)
        })
        removeListener = () => listener.remove()
      } catch {
        // Browser fallback
        const handleOnline  = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online',  handleOnline)
        window.addEventListener('offline', handleOffline)
        removeListener = () => {
          window.removeEventListener('online',  handleOnline)
          window.removeEventListener('offline', handleOffline)
        }
      }
    }

    setup()
    return () => removeListener()
  }, [])

  return isOnline
}
