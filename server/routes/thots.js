import { Router } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { neighborCells } from '../lib/geo.js'
import { smartRateLimit } from '../middleware/rateLimit.js'
import { moderate } from '../middleware/moderate.js'

const router = Router()

// GET /thots?lat=&lng=&radius=
router.get('/', async (req, res) => {
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  const radius = parseFloat(req.query.radius) || 2000

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const { data, error } = await supabase.rpc('get_thots_nearby', {
    lat,
    lng,
    radius_m: radius,
  })

  if (error) {
    console.error('get_thots_nearby error:', error)
    return res.status(500).json({ error: 'Failed to fetch thots' })
  }

  res.json(data)
})

// POST /thots
router.post('/', smartRateLimit, moderate, async (req, res) => {
  const { content, lat, lng } = req.body
  // Cookie is authoritative — prevents session_id spoofing from the client body
  const session_id = req.cookies?.session_id ?? req.body.session_id

  // Anon users always post without a pen name; auth users get theirs from the DB
  let pen_name = null
  if (req.user) {
    const { data } = await supabase
      .from('users')
      .select('pen_name')
      .eq('id', req.user.id)
      .single()
    pen_name = data?.pen_name ?? null
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
  if (!session_id || !/^[0-9a-f-]{36}$/.test(session_id)) {
    return res.status(400).json({ error: 'valid session_id is required' })
  }

  const ip_hash = createHash('sha256')
    .update((req.ip || '') + (process.env.IP_SALT || ''))
    .digest('hex')

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

export default router
