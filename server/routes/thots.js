import { Router } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { enqueueNotification } from '../lib/notificationQueue.js'
import { sendPush } from '../lib/webPush.js'
import { neighborCells, latLngToH3, isInUsa } from '../lib/geo.js'
import { subnetLimit } from '../middleware/subnetLimit.js'
import { smartRateLimit } from '../middleware/rateLimit.js'
import { moderate } from '../middleware/moderate.js'
import { alertSupport } from '../lib/email.js'

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


// Enrich thots: fill in user_id for named users whose thot predates migration 012
async function enrichWithUserId(thots) {
  if (!thots?.length) return thots
  const missing = thots.filter(t => t.pen_name && !t.user_id).map(t => t.pen_name)
  if (!missing.length) return thots
  const unique = [...new Set(missing)]
  const { data: users } = await supabase
    .from('users')
    .select('id, pen_name')
    .in('pen_name', unique)
  if (!users?.length) return thots
  const map = Object.fromEntries(users.map(u => [u.pen_name, u.id]))
  return thots.map(t => (!t.user_id && t.pen_name && map[t.pen_name])
    ? { ...t, user_id: map[t.pen_name] }
    : t)
}

// GET /thots?lat=&lng=&radius=
// GET /thots?session_id=   (own history — auth required, session_id must match caller)
// GET /thots?user_id=      (any named user's public history — no auth required)
router.get('/', async (req, res) => {
  // Outlet feed mode — all thots from an auto-pin source (e.g. all NPR News thots)
  if (req.query.pen_name && req.query.pin_type) {
    const pen_name = req.query.pen_name.trim().slice(0, 100)
    const pin_type = req.query.pin_type.trim().slice(0, 50)
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const offset = parseInt(req.query.offset) || 0
    const COLS = 'id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted, pin_type, source_url'
    const { data, error, count } = await supabase
      .from('thots')
      .select(COLS, { count: 'exact' })
      .eq('pen_name', pen_name)
      .eq('pin_type', pin_type)
      .eq('hidden', false)
      .eq('user_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) return res.status(500).json({ error: 'Failed to fetch thots' })
    return res.json({ thots: data ?? [], total: count ?? data?.length ?? 0, offset, limit })
  }

  // Session history mode
  if (req.query.session_id || req.query.user_id) {
    const byUserId = !!req.query.user_id
    const rawId = req.query.session_id ?? req.query.user_id
    if (!/^[0-9a-f-]{36}$/.test(rawId)) {
      return res.status(400).json({ error: 'invalid id' })
    }

    // Own-history auth guard: only the session owner may fetch by session_id
    if (!byUserId) {
      const token = req.headers.authorization?.replace('Bearer ', '').trim()
      let callerSessionId = req.cookies?.session_id
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) callerSessionId = user.id
      }
      if (!callerSessionId || callerSessionId !== rawId) {
        return res.status(403).json({ error: 'forbidden' })
      }
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const offset = parseInt(req.query.offset) || 0
    const COLS = 'id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted, pin_type, source_url'

    // Build query: own history uses session_id OR user_id (covers anon→registered transition),
    // public profile uses user_id only (non-hidden posts only)
    let query = supabase.from('thots').select(COLS, { count: 'exact' })
    query = byUserId
      ? query.eq('user_id', rawId).eq('hidden', false).eq('user_deleted', false)
      : query.or(`session_id.eq.${rawId},user_id.eq.${rawId}`).eq('user_deleted', false)

    let { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error?.message?.includes('user_deleted')) {
      // Graceful fallback if column not yet migrated
      query = supabase.from('thots').select(COLS, { count: 'exact' })
      query = byUserId
        ? query.eq('user_id', rawId).eq('hidden', false)
        : query.or(`session_id.eq.${rawId},user_id.eq.${rawId}`).eq('hidden', false)
      ;({ data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1))
    }
    if (error) return res.status(500).json({ error: 'Failed to fetch thots' })
    const enriched = await enrichWithUserId(data)
    return res.json({ thots: enriched, total: count ?? enriched.length, offset, limit })
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
    p_lat: lat,
    p_lng: lng,
    radius_m: radius,
    max_results: limit,
  })

  if (error) {
    // If the function doesn't support max_results yet (old schema), retry without it
    if (error.message?.includes('max_results')) {
      const { data: fallback, error: fallbackError } = await supabase.rpc('get_thots_nearby', {
        p_lat: lat,
        p_lng: lng,
        radius_m: radius,
      })
      if (fallbackError) {
        console.error('get_thots_nearby error:', fallbackError)
        return res.status(500).json({ error: 'Failed to fetch thots' })
      }
      return res.json(await enrichWithUserId((fallback ?? []).slice(0, limit)))
    }
    console.error('get_thots_nearby error:', error)
    return res.status(500).json({ error: 'Failed to fetch thots' })
  }

  res.json(data)
})


// GET /thots/liked — returns full thot objects the current auth user has hyped
router.get('/liked', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.json([])
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.json([])
  const { data } = await supabase
    .from('hypes')
    .select('thot_id, thots(id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted, pin_type, source_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  res.json(data?.map(h => h.thots).filter(Boolean) ?? [])
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
    // Notify thot owner (async, don't await)
    supabase.from('thots').select('session_id, content, user_id').eq('id', thotId).maybeSingle()
      .then(({ data: thotRow }) => {
        const ownerId = thotRow?.user_id
        if (ownerId && ownerId !== user.id) {
          const actorName = user.user_metadata?.pen_name ?? 'Someone'
          enqueueNotification(ownerId, 'like', actorName, thotRow.content, thotId)
          sendPush(ownerId, { title: `${actorName} hyped your thot`, body: thotRow.content?.slice(0, 80) ?? '', url: '/map' })
        }
      })
  }

  const { data: thot } = await supabase.from('thots').select('hype_count').eq('id', thotId).maybeSingle()
  res.json({ hyped: !existing, hype_count: thot?.hype_count ?? 0 })
})

// POST /thots
router.post('/', smartRateLimit, subnetLimit, moderate, async (req, res) => {
  const { content, lat, lng, duration_hours } = req.body
  // Cookie is authoritative — prevents session_id spoofing from the client body
  const session_id = req.cookies?.session_id ?? req.body.session_id

  // Only authenticated named users can post
  if (!req.user) {
    return res.status(401).json({ error: 'You must be signed in to post a thot.', code: 'AUTH_REQUIRED' })
  }
  const pen_name = req.user?.user_metadata?.pen_name ?? null
  if (!pen_name) {
    return res.status(403).json({ error: 'You must have a pen name to post.', code: 'NO_PEN_NAME' })
  }

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
  if (!isInUsa(claimedLat, claimedLng)) {
    return res.status(403).json({ error: 'dropathot is only available in the United States.', code: 'OUTSIDE_US' })
  }
  if (!session_id || !/^[0-9a-f-]{36}$/.test(session_id)) {
    return res.status(400).json({ error: 'valid session_id is required' })
  }

  // Require a real account — anonymous posting is disabled
  if (!req.user) {
    return res.status(401).json({ error: 'Sign up to drop a thot', code: 'AUTH_REQUIRED' })
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
      alertSupport({
        type: 'location-spoof',
        subject: 'Location spoof attempt detected',
        key: session_id,
        cooldownMs: 10 * 60 * 1000,
        fields: {
          'Session ID': session_id,
          'Claimed coords': `${claimedLat}, ${claimedLng}`,
          'IP geolocation': `${ipGeo.lat}, ${ipGeo.lng}`,
          'Distance': `${Math.round(distKm)} km`,
          'Client IP (partial)': clientIp?.slice(0, 8) + '…',
        },
      }).catch(() => {})
      return res.status(422).json({ error: 'Your claimed location is too far from your actual location.' })
    }
  }

  const ip_hash = createHash('sha256')
    .update((req.ip || '') + (process.env.IP_SALT || ''))
    .digest('hex')

  // Compute expires_at from duration_hours
  // Auth users: default 1 day, max 1 day (24 hours) — no long-lived thots
  let expires_at
  if (req.user) {
    const h = (duration_hours === null || duration_hours === undefined)
      ? 24
      : parseFloat(duration_hours)
    if (isNaN(h) || h < 0.25 || h > 24) return res.status(400).json({ error: 'duration must be 0.25–24 hours' })
    expires_at = new Date(Date.now() + h * 3600 * 1000).toISOString()
  }

  // Hide previous active thots from this session that are within the block radius.
  // Posts far enough apart can coexist — one pin per ~150m area, not one pin total.
  // Use RPC so ST_DWithin runs server-side with unambiguous geography meter units.
  // The PostgREST st.dwithin filter string format is unreliable for geography columns.
  await supabase.rpc('hide_nearby_session_thots', {
    p_session_id: session_id,
    p_lat: claimedLat,
    p_lng: claimedLng,
    p_radius_m: 150,
  })

  // Insert new thot
  let { data: newThot, error } = await supabase
    .from('thots')
    .insert({
      content: content.trim(),
      pen_name: pen_name || null,
      session_id,
      user_id: req.user?.id ?? null,
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
  // Strip internal fields from the value broadcast + returned to client
  const { ip_hash: _stripIp, session_id: _stripSid, ...safeNewThot } = newThot
  newThot = safeNewThot

  // Broadcast sanitized thot (strip internal fields before sending to clients)
  const { ip_hash: _ip, session_id: _sid, ...publicThot } = newThot
  const cells = neighborCells(parseFloat(lat), parseFloat(lng))
  req.io.to(cells).emit('thot:new', publicThot)

  // Velocity spike detection — async, never blocks the response
  checkVelocitySpike(parseFloat(lat), parseFloat(lng), req.io).catch(() => {})

  res.status(201).json(newThot)
})

// GET /thots/:id — single thot by id (public, for share page)
router.get('/:id', async (req, res) => {
  const { id } = req.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid id' })
  const { data, error } = await supabase
    .from('thots')
    .select('id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted, pin_type, source_url')
    .eq('id', id)
    .single()
  if (error || !data) return res.status(404).json({ error: 'not found' })
  res.json(await enrichWithUserId(data))
})

// DELETE /thots/:id — soft-delete (hide) a thot the requester owns.
// The record is kept for moderation/legal; hidden=true removes it from all feeds.
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid id' })

  // Prefer JWT (auth users); fall back to session cookie (anon users).
  // This mirrors the hype route and fixes cases where the cookie is not forwarded
  // for DELETE requests in cross-origin setups.
  let session_id = req.cookies?.session_id
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (token) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (!authErr && user) session_id = user.id
  }
  if (!session_id) return res.status(401).json({ error: 'no session' })

  // Verify the thot belongs to this session before hiding
  const { data: thot, error: fetchErr } = await supabase
    .from('thots')
    .select('id, session_id, hidden, user_deleted')
    .eq('id', id)
    .single()

  if (fetchErr || !thot) return res.status(404).json({ error: 'not found' })
  if (thot.session_id !== session_id) return res.status(403).json({ error: 'not yours' })
  if (thot.hidden) {
    // Stamp user_deleted even if hidden was set before the column existed
    if (!thot.user_deleted) {
      await supabase.from('thots').update({ user_deleted: true }).eq('id', id)
    }
    return res.json({ ok: true, restored: null })
  }

  let { error: updateErr } = await supabase
    .from('thots')
    .update({ hidden: true, user_deleted: true })
    .eq('id', id)

  // Fallback: if user_deleted column doesn't exist yet, just set hidden
  if (updateErr?.message?.includes('user_deleted')) {
    ;({ error: updateErr } = await supabase
      .from('thots')
      .update({ hidden: true })
      .eq('id', id))
  }
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // Restore the most recent prior thot from the same session that was auto-hidden
  // when this thot was posted, provided it hasn't expired yet.
  const { data: restored } = await supabase
    .from('thots')
    .select('id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, hidden, user_deleted, pin_type, source_url')
    .eq('session_id', session_id)
    .eq('hidden', true)
    .eq('user_deleted', false)
    .neq('id', id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (restored) {
    // Only restore if no other live thot from this session is within 150m of the candidate.
    // Restoring it otherwise would break the one-thot-per-block-radius rule.
    const { data: nearbyLive } = await supabase.rpc('count_nearby_session_thots', {
      p_session_id: session_id,
      p_lat: restored.lat,
      p_lng: restored.lng,
      p_radius_m: 150,
    })

    const hasNearbyLive = (nearbyLive ?? 0) > 0

    if (!hasNearbyLive) {
      await supabase
        .from('thots')
        .update({ hidden: false })
        .eq('id', restored.id)
    } else {
      // A live thot already covers this area — don't restore
      return res.json({ ok: true, restored: null })
    }
  }

  res.json({ ok: true, restored: restored ?? null })
})

// ---------------------------------------------------------------------------
// Velocity spike detection
// If >15 thots appear in the same H3 tile within 10 minutes, log a flag.
// A cooldown prevents flooding the flags table with repeat entries for the
// same ongoing spike (one flag per tile per 10-minute window).
// ---------------------------------------------------------------------------
const VELOCITY_THRESHOLD = 15
const VELOCITY_WINDOW_MINS = 10
const flagCooldown = new Map() // h3tile → timestamp of last flag

async function checkVelocitySpike(lat, lng, io) {
  const h3tile = latLngToH3(lat, lng)

  // Cooldown: skip if we already flagged this tile in the current window
  const lastFlagged = flagCooldown.get(h3tile) ?? 0
  if (Date.now() - lastFlagged < VELOCITY_WINDOW_MINS * 60 * 1000) return

  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MINS * 60 * 1000).toISOString()

  // Count thots in this tile posted in the last VELOCITY_WINDOW_MINS minutes
  // Using ST_DWithin with a ~600m radius (approximate H3 res-7 hex radius)
  const { count, error } = await supabase
    .from('thots')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', windowStart)
    .eq('hidden', false)
    .filter('location', 'st.dwithin', `SRID=4326;POINT(${lng} ${lat}),600`) // 600m — geography uses meters

  if (error || count === null) return
  if (count < VELOCITY_THRESHOLD) return

  // Log the flag
  flagCooldown.set(h3tile, Date.now())
  console.warn(`[velocity] spike detected: tile=${h3tile} count=${count} in ${VELOCITY_WINDOW_MINS}min`)

  await supabase.from('velocity_flags').insert({
    h3_tile: h3tile,
    thot_count: count,
    window_mins: VELOCITY_WINDOW_MINS,
    lat,
    lng,
  })

  // Email support
  alertSupport({
    type: 'velocity-spike',
    subject: `Velocity spike: ${count} posts in ${VELOCITY_WINDOW_MINS}min`,
    key: h3tile,
    cooldownMs: VELOCITY_WINDOW_MINS * 60 * 1000,
    fields: {
      'H3 Tile': h3tile,
      'Post count': `${count} in last ${VELOCITY_WINDOW_MINS} minutes`,
      'Coordinates': `${lat}, ${lng}`,
      'Threshold': String(VELOCITY_THRESHOLD),
    },
  }).catch(() => {})

  // Notify any connected admin clients
  io.to('admin').emit('velocity:spike', { h3tile, count, lat, lng, at: new Date().toISOString() })
}

export default router
