import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'Auth required', code: 'AUTH_REQUIRED' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Invalid session', code: 'AUTH_REQUIRED' }); return null }
  return user
}

// GET /follows/:userId/stats — follower + following counts, and whether current user follows them
router.get('/:userId/stats', async (req, res) => {
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })

  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])

  let isFollowing = false
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data } = await supabase.from('follows')
        .select('id').eq('follower_id', user.id).eq('following_id', userId).maybeSingle()
      isFollowing = !!data
    }
  }

  res.json({
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
    isFollowing,
  })
})

// POST /follows/:userId — follow a user
router.post('/:userId', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })
  if (userId === user.id) return res.status(400).json({ error: 'cannot follow yourself' })

  const { error } = await supabase.from('follows')
    .insert({ follower_id: user.id, following_id: userId })
  if (error?.code === '23505') return res.json({ ok: true, isFollowing: true }) // already following
  if (error) return res.status(500).json({ error: 'Failed to follow' })
  res.json({ ok: true, isFollowing: true })
})

// DELETE /follows/:userId — unfollow a user
router.delete('/:userId', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })

  await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
  res.json({ ok: true, isFollowing: false })
})

// POST /follows/:userId/report — report a user
router.post('/:userId/report', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })
  const { reason } = req.body

  const { error } = await supabase.from('user_reports')
    .insert({ reporter_id: user.id, reported_id: userId, reason: reason?.slice(0, 200) || null })
  if (error) return res.status(500).json({ error: 'Failed to submit report' })
  res.json({ ok: true })
})

export default router
