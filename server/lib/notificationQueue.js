import { supabase } from './supabase.js'

/**
 * Enqueue a notification for a user.
 * Silently no-ops if userId is missing (e.g. target user not found).
 *
 * @param {string} userId       - UUID of the user to notify
 * @param {'like'|'comment'|'follow'} type
 * @param {string} actorPenName - pen name of whoever triggered the action
 * @param {string|null} thotPreview - first 80 chars of the thot content (null for follows)
 * @param {string|null} thotId  - UUID of the thot (null for follows)
 */
export async function enqueueNotification(userId, type, actorPenName, thotPreview = null, thotId = null) {
  if (!userId) return
  const { error } = await supabase.from('notification_queue').insert({
    user_id: userId,
    type,
    actor_pen_name: actorPenName ?? 'Someone',
    thot_preview: thotPreview ? thotPreview.slice(0, 80) : null,
    thot_id: thotId ?? null,
  })
  if (error) console.error('[notificationQueue] enqueue error:', error.message)
}
