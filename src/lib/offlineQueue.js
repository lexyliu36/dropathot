/**
 * offlineQueue.js
 *
 * Persists thots that failed to post (bad network) in localStorage.
 * Each entry keeps all the data needed to retry the POST when connectivity returns.
 *
 * Lifecycle:
 *   1. Post attempt fails → enqueue()   → pending thot appears on map
 *   2. Network restores  → syncQueue()  → real thot replaces pending pin
 *   3. Success           → dequeue()    → entry removed from storage
 */

const STORAGE_KEY = 'pendingThots'

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function write(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full — silently ignore
  }
}

/**
 * Add a thot to the offline queue.
 * Returns the queued entry (includes _localId used as map pin id).
 */
export function enqueue({ content, lat, lng, session_id, pen_name, duration_hours, is_incognito }) {
  const entry = {
    _localId: crypto.randomUUID(),
    _pending: true,
    content,
    lat,
    lng,
    session_id,
    pen_name,
    duration_hours,
    is_incognito: is_incognito ?? false,
    queued_at: new Date().toISOString(),
  }
  const queue = read()
  queue.push(entry)
  write(queue)
  return entry
}

/** Remove a single entry by its _localId after successful sync. */
export function dequeue(localId) {
  write(read().filter(t => t._localId !== localId))
}

/** All pending entries. */
export function getQueue() {
  return read()
}

/** How many thots are waiting to be sent. */
export function pendingCount() {
  return read().length
}

/** Wipe the entire queue (e.g. on sign-out). */
export function clearQueue() {
  write([])
}
