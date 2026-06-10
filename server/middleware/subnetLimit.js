/**
 * subnetLimit.js
 *
 * Prevents astroturfing by limiting how many distinct sessions from the
 * same /24 IP subnet can post to the same H3 geo tile within a rolling
 * 1-hour window.
 *
 * Threshold: 3 unique sessions → block further posts from that subnet+tile.
 *
 * Storage: in-memory Map (resets on server restart — intentional; fail-open
 * on restart is acceptable for this soft protection). No PII is stored:
 * the subnet is hashed before use as a key.
 */

import { createHash } from 'crypto'
import { latLngToH3 } from '../lib/geo.js'
import { alertSupport } from '../lib/email.js'

const WINDOW_MS = 60 * 60 * 1000  // 1 hour
const MAX_SESSIONS = 3             // sessions per subnet per tile per window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000  // prune stale entries every 5 min

// Map<key, { sessions: Set<session_id>, windowStart: number }>
const store = new Map()

// Periodically remove expired windows to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.windowStart > WINDOW_MS) store.delete(key)
  }
}, CLEANUP_INTERVAL_MS)

/**
 * Extract the /24 subnet prefix from an IPv4 address, or return the
 * first 4 groups for IPv6 (hashed anyway).
 */
function subnetOf(ip) {
  if (!ip) return 'unknown'
  // Handle IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const v4mapped = ip.match(/::ffff:(\d+\.\d+\.\d+)\.\d+/)
  if (v4mapped) return v4mapped[1]
  // Plain IPv4
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/)
  if (v4) return v4[1]
  // IPv6 — use first 4 groups (64-bit prefix)
  const parts = ip.split(':')
  return parts.slice(0, 4).join(':')
}

function hashKey(subnet, h3tile) {
  return createHash('sha256').update(`${subnet}:${h3tile}`).digest('hex').slice(0, 16)
}

/**
 * Express middleware. Must run after body parsing so req.body.lat/lng are available.
 * Expects req.body.{ lat, lng } and req.cookies/body.session_id.
 * Fails open if coords are missing (route handler catches those separately).
 */
export function subnetLimit(req, res, next) {
  const lat = parseFloat(req.body?.lat)
  const lng = parseFloat(req.body?.lng)
  if (isNaN(lat) || isNaN(lng)) return next()

  const session_id = req.cookies?.session_id ?? req.body?.session_id
  if (!session_id) return next()

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || ''

  // Never block localhost / private ranges (dev + Railway health checks)
  if (
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp.startsWith('10.') ||
    clientIp.startsWith('192.168.') ||
    clientIp.startsWith('172.')
  ) return next()

  const subnet = subnetOf(clientIp)
  const h3tile = latLngToH3(lat, lng)
  const key = hashKey(subnet, h3tile)

  const now = Date.now()
  let entry = store.get(key)

  // Start fresh window if none exists or previous expired
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { sessions: new Set(), windowStart: now }
    store.set(key, entry)
  }

  // Same session posting again to same tile — let it through (already counted)
  if (entry.sessions.has(session_id)) return next()

  // Block if subnet already has MAX_SESSIONS unique sessions in this window
  if (entry.sessions.size >= MAX_SESSIONS) {
    console.warn(
      `[subnet-limit] blocked subnet=${subnet} tile=${h3tile} ` +
      `sessions=${entry.sessions.size} session_id=${session_id}`
    )
    // Alert support — cooldown 1 hr per subnet+tile so inbox stays manageable
    alertSupport({
      type: 'subnet-limit',
      subject: 'Subnet rate limit triggered',
      key: key,
      cooldownMs: 60 * 60 * 1000,
      fields: {
        'Subnet (hashed)': key,
        'H3 Tile': h3tile,
        'Unique sessions': String(entry.sessions.size),
        'Blocked session': session_id,
        'Window started': new Date(entry.windowStart).toUTCString(),
      },
    }).catch(() => {})
    return res.status(429).json({
      error: 'Too many people from your network have already posted here recently. Try again in an hour.',
      code: 'SUBNET_LIMIT',
    })
  }

  entry.sessions.add(session_id)
  next()
}
