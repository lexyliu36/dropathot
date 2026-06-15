// Module-level cache for thot history: key = session_id
// Each entry: { thots: [], total: number, fetchedAt: number }
// TTL: 5 minutes. Automatically invalidated on post/delete.

const _cache = new Map()
const TTL_MS = 5 * 60 * 1000

export function getCached(sessionId) {
  const entry = _cache.get(sessionId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) { _cache.delete(sessionId); return null }
  return entry
}

export function setCached(sessionId, thots, total) {
  _cache.set(sessionId, { thots, total, fetchedAt: Date.now() })
}

export function appendCached(sessionId, newThots, total) {
  const entry = _cache.get(sessionId)
  if (!entry) return
  const ids = new Set(entry.thots.map(t => t.id))
  const merged = [...entry.thots, ...newThots.filter(t => !ids.has(t.id))]
  _cache.set(sessionId, { thots: merged, total, fetchedAt: entry.fetchedAt })
}

export function invalidate(sessionId) {
  if (sessionId) _cache.delete(sessionId)
}

export function removeFromCache(sessionId, thotId) {
  const entry = _cache.get(sessionId)
  if (!entry) return
  _cache.set(sessionId, {
    ...entry,
    thots: entry.thots.filter(t => t.id !== thotId),
    total: Math.max(0, (entry.total ?? entry.thots.length) - 1),
  })
}
