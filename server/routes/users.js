import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// GET /users/search?q=<prefix> — find users by pen name, requires auth
router.get('/search', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Auth required' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' })

  const q = (req.query.q ?? '').trim()
  if (!q || q.length < 1) return res.json([])

  const { data, error } = await supabase
    .from('users')
    .select('id, pen_name')
    .ilike('pen_name', `${q}%`)
    .eq('is_banned', false)
    .neq('id', user.id)   // exclude self
    .limit(10)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data ?? [])
})

// PUT /users/me/heartbeat — update last_seen_at for online presence tracking
router.put('/me/heartbeat', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Auth required' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' })

  const { error } = await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
