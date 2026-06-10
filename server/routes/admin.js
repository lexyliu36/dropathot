import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(503).json({ error: 'Admin not configured — set ADMIN_SECRET env var' })
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

const PERIOD_HOURS = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }

// GET /admin/stats?period=1h|24h|7d|30d
router.get('/stats', requireAdmin, async (req, res) => {
  const period = req.query.period || '24h'
  const hours = PERIOD_HOURS[period]
  if (!hours) return res.status(400).json({ error: 'invalid period — use 1h, 24h, 7d, or 30d' })

  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const activeSince = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min window

  const [
    newThotsRes,
    totalThotsRes,
    hiddenThotsRes,
    newUsersRes,
    totalUsersRes,
    newCommentsRes,
    newReportsRes,
    sessionsThotRes,
    activeSessionsRes,
  ] = await Promise.all([
    supabase.from('thots').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('thots').select('*', { count: 'exact', head: true }),
    supabase.from('thots').select('*', { count: 'exact', head: true }).eq('hidden', true),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', since),
    // Fetch session_ids for thots in the period to count distinct sessions
    supabase.from('thots').select('session_id').gte('created_at', since),
    // Fetch session_ids active in last 30 min
    supabase.from('thots').select('session_id').gte('created_at', activeSince),
  ])

  const newSessions = new Set((sessionsThotRes.data || []).map(r => r.session_id)).size
  const activeSessions = new Set((activeSessionsRes.data || []).map(r => r.session_id)).size

  res.json({
    period,
    since,
    generated_at: new Date().toISOString(),
    stats: {
      new_thots: newThotsRes.count ?? 0,
      total_thots: totalThotsRes.count ?? 0,
      hidden_thots: hiddenThotsRes.count ?? 0,
      new_users: newUsersRes.count ?? 0,
      total_users: totalUsersRes.count ?? 0,
      new_comments: newCommentsRes.count ?? 0,
      new_reports: newReportsRes.count ?? 0,
      new_sessions: newSessions,
      active_sessions: activeSessions,
    },
  })
})

export default router
