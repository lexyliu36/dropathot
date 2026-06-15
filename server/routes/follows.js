import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { sendUserReviewEmail } from '../lib/email.js'
import { enqueueNotification } from '../lib/notificationQueue.js'

const router = Router()

async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'Auth required', code: 'AUTH_REQUIRED' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Invalid session', code: 'AUTH_REQUIRED' }); return null }
  return user
}

// GET /follows/following — list users the current user follows
router.get('/following', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { data, error } = await supabase
    .from('follows')
    .select('following_id, users!follows_following_id_fkey(id, pen_name)')
    .eq('follower_id', user.id)

  if (error) { console.error('[follows/following]', error); return res.status(500).json({ error: 'Server error' }) }

  const users = (data ?? []).map(row => row.users).filter(Boolean)
  res.json(users)
})

// GET /follows/followers — list users who follow the current user
router.get('/followers', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, users!follows_follower_id_fkey(id, pen_name)')
    .eq('following_id', user.id)

  if (error) { console.error('[follows/followers]', error); return res.status(500).json({ error: 'Server error' }) }

  const users = (data ?? []).map(row => row.users).filter(Boolean)
  res.json(users)
})

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
  if (error?.code === '23503') return res.status(400).json({ error: 'not_followable', detail: 'This user cannot be followed (demo account)' })
  if (error) {
    console.error('[follows] insert error:', error)
    return res.status(500).json({ error: 'Failed to follow', detail: error.message, code: error.code })
  }

  // Notify the followed user (async)
  const actorName = user.user_metadata?.pen_name ?? 'Someone'
  enqueueNotification(userId, 'follow', actorName, null, null)

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

  // Email admin at exactly 3 reports
  try {
    const { count } = await supabase
      .from('user_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_id', userId)
    if (count === 3) {
      const { data: reportedUser } = await supabase
        .from('users')
        .select('id, pen_name, created_at')
        .eq('id', userId)
        .maybeSingle()
      if (reportedUser) await sendUserReviewEmail(reportedUser, count)
    }
  } catch (e) { console.error('[user report] email trigger failed:', e.message) }

  res.json({ ok: true })
})

export default router
