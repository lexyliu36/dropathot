import webpush from 'web-push'
import { supabase } from './supabase.js'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return true
  const { VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_MAILTO || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[webPush] VAPID env vars missing — push notifications disabled')
    return false
  }
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Silently no-ops if userId is missing or user has no subscriptions.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendPush(userId, payload) {
  if (!userId || !ensureVapid()) return

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subs?.length) return

  const notification = JSON.stringify({
    title: payload.title ?? 'dropathot',
    body: payload.body ?? '',
    icon: '/favicon.svg',
    url: payload.url ?? '/',
  })

  const staleIds = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id)
        } else {
          console.error('[webPush] send error:', err.message)
        }
      }
    })
  )

  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}
