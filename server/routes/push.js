import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'unauthorized' }); return null }
  return user
}

// GET /push/vapid-public-key — client needs this to subscribe
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return res.status(503).json({ error: 'Push not configured' })
  res.json({ key })
})

// POST /push/subscribe
router.post('/subscribe', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh and keys.auth required' })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) {
    console.error('[push] upsert error:', error.message)
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

// DELETE /push/subscribe
router.delete('/subscribe', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })

  await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  res.json({ ok: true })
})

export default router
