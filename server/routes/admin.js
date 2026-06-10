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

function sinceFromPeriod(period) {
  const hours = PERIOD_HOURS[period]
  return hours ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : null
}

// GET /admin/stats?period=1h|24h|7d|30d
router.get('/stats', requireAdmin, async (req, res) => {
  const period = req.query.period || '24h'
  const since = sinceFromPeriod(period)
  if (!since) return res.status(400).json({ error: 'invalid period — use 1h, 24h, 7d, or 30d' })

  const activeSince = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [
    newThotsRes, totalThotsRes, hiddenThotsRes,
    newUsersRes, totalUsersRes,
    newCommentsRes, newReportsRes,
    sessionsThotRes, activeSessionsRes,
  ] = await Promise.all([
    supabase.from('thots').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('thots').select('*', { count: 'exact', head: true }),
    supabase.from('thots').select('*', { count: 'exact', head: true }).eq('hidden', true),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('thots').select('session_id').gte('created_at', since),
    supabase.from('thots').select('session_id').gte('created_at', activeSince),
  ])

  const newSessions = new Set((sessionsThotRes.data || []).map(r => r.session_id)).size
  const activeSessions = new Set((activeSessionsRes.data || []).map(r => r.session_id)).size

  res.json({
    period, since,
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

// ── Detail endpoints ──────────────────────────────────────────────────────────

const LIMIT = 100

// GET /admin/detail/thots?period=1h|24h|7d|30d|all
router.get('/detail/thots', requireAdmin, async (req, res) => {
  const { period } = req.query
  let q = supabase
    .from('thots')
    .select('id, content, pen_name, session_id, created_at, hidden, hype_count')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (period !== 'all') {
    const since = sinceFromPeriod(period)
    if (!since) return res.status(400).json({ error: 'invalid period' })
    q = q.gte('created_at', since)
  }
  const { data, error } = await q
  if (error) return res.status(500).json({ error: 'query failed' })
  res.json(data || [])
})

// GET /admin/detail/thots/hidden — all thots hidden by reports
router.get('/detail/thots/hidden', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('thots')
    .select('id, content, pen_name, session_id, created_at, hype_count')
    .eq('hidden', true)
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) return res.status(500).json({ error: 'query failed' })
  res.json(data || [])
})

// GET /admin/detail/users?period=1h|24h|7d|30d|all
router.get('/detail/users', requireAdmin, async (req, res) => {
  const { period } = req.query
  let q = supabase
    .from('users')
    .select('id, pen_name, birth_year, created_at, is_banned')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (period !== 'all') {
    const since = sinceFromPeriod(period)
    if (!since) return res.status(400).json({ error: 'invalid period' })
    q = q.gte('created_at', since)
  }
  const { data, error } = await q
  if (error) return res.status(500).json({ error: 'query failed' })
  res.json(data || [])
})

// GET /admin/detail/comments?period=1h|24h|7d|30d
router.get('/detail/comments', requireAdmin, async (req, res) => {
  const since = sinceFromPeriod(req.query.period)
  if (!since) return res.status(400).json({ error: 'invalid period' })
  const { data, error } = await supabase
    .from('comments')
    .select('id, content, thot_id, session_id, created_at, hype_count')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) return res.status(500).json({ error: 'query failed' })
  res.json(data || [])
})

// GET /admin/detail/reports?period=1h|24h|7d|30d
router.get('/detail/reports', requireAdmin, async (req, res) => {
  const since = sinceFromPeriod(req.query.period)
  if (!since) return res.status(400).json({ error: 'invalid period' })
  const { data, error } = await supabase
    .from('reports')
    .select('id, thot_id, reporter_session, reason, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) return res.status(500).json({ error: 'query failed' })
  res.json(data || [])
})

// GET /admin/detail/sessions?period=1h|24h|7d|30d|active
// Returns session activity grouped by session_id
router.get('/detail/sessions', requireAdmin, async (req, res) => {
  const { period } = req.query
  let since
  if (period === 'active') {
    since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  } else {
    since = sinceFromPeriod(period)
    if (!since) return res.status(400).json({ error: 'invalid period' })
  }

  const { data, error } = await supabase
    .from('thots')
    .select('session_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return res.status(500).json({ error: 'query failed' })

  const map = new Map()
  for (const row of (data || [])) {
    if (!map.has(row.session_id)) {
      map.set(row.session_id, { session_id: row.session_id, thot_count: 0, last_seen: row.created_at, first_seen: row.created_at })
    }
    const s = map.get(row.session_id)
    s.thot_count++
    if (row.created_at > s.last_seen) s.last_seen = row.created_at
    if (row.created_at < s.first_seen) s.first_seen = row.created_at
  }

  res.json([...map.values()].sort((a, b) => b.thot_count - a.thot_count))
})

export default router
