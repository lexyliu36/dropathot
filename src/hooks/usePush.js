import { useState, useEffect, useCallback, useRef } from 'react'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function usePush() {
  const session = useAppStore((s) => s.session)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [checking, setChecking] = useState(true)  // initial SW check only
  const [acting, setActing] = useState(false)      // subscribe/unsubscribe in progress
  const [error, setError] = useState(null)
  const regRef = useRef(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setChecking(false)
      return
    }
    setSupported(true)
    setPermission(Notification.permission)

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => { regRef.current = reg; return reg.pushManager.getSubscription() })
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const subscribe = useCallback(async () => {
    if (!session?.supabaseToken) return
    setActing(true)
    setError(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Blocked — enable in browser settings' : 'Permission not granted')
        return
      }

      const reg = regRef.current ?? await navigator.serviceWorker.ready
      regRef.current = reg

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('Push not configured')

      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const { endpoint, keys } = sub.toJSON()
      const res = await fetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.supabaseToken}` },
        body: JSON.stringify({ endpoint, keys }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      setSubscribed(true)
    } catch (err) {
      console.error('[usePush] subscribe:', err)
      setError(err.message)
      setSubscribed(false)
    } finally {
      setActing(false)
    }
  }, [session?.supabaseToken])

  const unsubscribe = useCallback(async () => {
    if (!session?.supabaseToken) return
    setActing(true)
    setError(null)
    try {
      const reg = regRef.current ?? await navigator.serviceWorker.ready
      regRef.current = reg
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(`${API_URL}/push/subscribe`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.supabaseToken}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('[usePush] unsubscribe:', err)
      // Re-verify actual state
      try {
        const sub = regRef.current ? await regRef.current.pushManager.getSubscription() : null
        setSubscribed(!!sub)
      } catch {}
    } finally {
      setActing(false)
    }
  }, [session?.supabaseToken])

  return { supported, permission, subscribed, checking, acting, error, subscribe, unsubscribe }
}
