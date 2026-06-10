import { Router } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { neighborCells } from '../lib/geo.js'
import { smartRateLimit } from '../middleware/rateLimit.js'
import { moderate } from '../middleware/moderate.js'

const router = Router()

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns { lat, lng } from IP geolocation, or null if unavailable
async function ipLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null // skip check for local/private IPs (dev environment)
  }
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(3000),
    })
    const data = await r.json()
    if (!data.success || !data.latitude || !data.longitude) return null
    return { lat: data.latitude, lng: data.longitude }
  } catch {
    return null // fail open — don't block posting if geo lookup fails
  }
}


// GET /thots?lat=&lng=&radius=
// GET /thots?session_id=  (returns post history for a session, no location filter)
router.get('/', async (req, res) => {
  // Session history mode
  if (req.query.session_id) {
    const sessionId = req.query.session_id
    if (!/^[0-9a-f-]{36}$/.test(sessionId)) {
      return res.status(400).json({ error: 'invalid session_id' })
    }
    const { data, error } = await supabase
      .from('thots')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return res.status(500).json({ error: 'Failed to fetch thots' })
    return res.json(data)
  }

  // Geo mode
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  const radius = parseFloat(req.query.radius) || 625
  const limit = Math.min(parseInt(req.query.limit) || 30, 100) // hard cap at 100

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const { data, error } = await supabase.rpc('get_thots_nearby', {
    lat,
    lng,
    radius_m: radius,
    max_results: limit,
  })

  if (error) {
    // If the function doesn't support max_results yet (old schema), retry without it
    if (error.message?.includes('max_results')) {
      const { data: fallback, error: fallbackError } = await supabase.rpc('get_thots_nearby', {
        lat,
        lng,
        radius_m: radius,
      })
      if (fallbackError) {
        console.error('get_thots_nearby error:', fallbackError)
        return res.status(500).json({ error: 'Failed to fetch thots' })
      }
      return res.json((fallback ?? []).slice(0, limit))
    }
    console.error('get_thots_nearby error:', error)
    return res.status(500).json({ error: 'Failed to fetch thots' })
  }

  res.json(data)
})

// GET /thots/my-hypes — returns thot IDs the current auth user has hyped
router.get('/my-hypes', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.json([])
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.json([])
  const { data } = await supabase.from('hypes').select('thot_id').eq('user_id', user.id)
  res.json(data?.map(h => h.thot_id) ?? [])
})

// POST /thots/:id/hype — toggle hype; auth users only
router.post('/:id/hype', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Sign up to hype thots', code: 'AUTH_REQUIRED' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Sign up to hype thots', code: 'AUTH_REQUIRED' })

  const thotId = req.params.id
  if (!/^[0-9a-f-]{36}$/.test(thotId)) return res.status(400).json({ error: 'invalid thot id' })

  const { data: existing, error: selectErr } = await supabase
    .from('hypes').select('id').eq('thot_id', thotId).eq('user_id', user.id).maybeSingle()

  if (selectErr) console.error('[hype] select error:', selectErr)

  if (existing) {
    const { error: deleteErr } = await supabase.from('hypes').delete().eq('thot_id', thotId).eq('user_id', user.id)
    if (deleteErr) console.error('[hype] delete error:', deleteErr)
  } else {
    const { error: insertErr } = await supabase.from('hypes').insert({ thot_id: thotId, user_id: user.id })
    if (insertErr) {
      console.error('[hype] insert error:', insertErr)
      return res.status(500).json({ error: 'Failed to hype', detail: insertErr.message })
    }
  }

  const { data: thot } = await supabase.from('thots').select('hype_count').eq('id', thotId).maybeSingle()
  res.json({ hyped: !existing, hype_count: thot?.hype_count ?? 0 })
})

// POST /thots
router.post('/', smartRateLimit, moderate, async (req, res) => {
  const { content, lat, lng, duration_hours } = req.body
  // Cookie is authoritative — prevents session_id spoofing from the client body
  const session_id = req.cookies?.session_id ?? req.body.session_id

  // pen_name is stored in user_metadata — no table query needed
  const pen_name = req.user?.user_metadata?.pen_name ?? null

  // Validate
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'content is required' })
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'content exceeds 280 characters' })
  }
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }
  const claimedLat = parseFloat(lat)
  const claimedLng = parseFloat(lng)
  if (claimedLat < -90 || claimedLat > 90 || claimedLng < -180 || claimedLng > 180) {
    return res.status(400).json({ error: 'invalid coordinates' })
  }
  if (!session_id || !/^[0-9a-f-]{36}$/.test(session_id)) {
    return res.status(400).json({ error: 'valid session_id is required' })
  }

  // Server-side location verification: reject if claimed coords are more than
  // 500 km from the IP's geolocation. Fails open (allows post) if geo lookup fails.
  const MAX_DISTANCE_KM = 500
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress
  const ipGeo = await ipLocation(clientIp)
  if (ipGeo) {
    const distKm = haversineKm(claimedLat, claimedLng, ipGeo.lat, ipGeo.lng)
    if (distKm > MAX_DISTANCE_KM) {
      console.warn(`[location-spoof] session=${session_id} claimed=(${claimedLat},${claimedLng}) ip_geo=(${ipGeo.lat},${ipGeo.lng}) dist=${Math.round(distKm)}km`)
      return res.status(422).json({ error: 'Your claimed location is too far from your actual location.' })
    }
  }

  const ip_hash = createHash('sha256')
    .update((req.ip || '') + (process.env.IP_SALT || ''))
    .digest('hex')

  // Compute expires_at from duration_hours
  // Auth users: default 3 days, max 3 days (72 hours)
  // Anon users: 1–3 hours only (default 3)
  let expires_at
  if (req.user) {
    const h = (duration_hours === null || duration_hours === undefined)
      ? 72
      : parseInt(duration_hours)
    if (isNaN(h) || h < 1 || h > 72) return res.status(400).json({ error: 'duration must be 1–72 hours' })
    expires_at = new Date(Date.now() + h * 3600 * 1000).toISOString()
  } else {
    const h = parseInt(duration_hours) || 3
    if (![1, 2, 3].includes(h)) return res.status(400).json({ error: 'anonymous posts can stay up for 1–3 hours' })
    expires_at = new Date(Date.now() + h * 3600 * 1000).toISOString()
  }

  // Hide previous active thot from this session
  await supabase
    .from('thots')
    .update({ hidden: true })
    .eq('session_id', session_id)
    .eq('hidden', false)
    .gt('expires_at', new Date().toISOString())

  // Insert new thot
  const { data: newThot, error } = await supabase
    .from('thots')
    .insert({
      content: content.trim(),
      pen_name: pen_name || null,
      session_id,
      ip_hash,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      expires_at,
    })
    .select()
    .single()

  if (error) {
    console.error('insert thot error:', error)
    return res.status(500).json({ error: 'Failed to save thot' })
  }

  // Broadcast to nearby Socket.io rooms
  const cells = neighborCells(parseFloat(lat), parseFloat(lng))
  req.io.to(cells).emit('thot:new', newThot)

  res.status(201).json(newThot)
})

// GET /thots/:id — single thot by id (public, for share page)
router.get('/:id', async (req, res) => {
  const { id } = req.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid id' })
  const { data, error } = await supabase
    .from('thots')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return res.status(404).json({ error: 'not found' })
  res.json(data)
})

export default router
