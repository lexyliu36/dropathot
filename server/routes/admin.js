import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { sendThotRestoredEmail, sendThotRemovedEmail, sendUserBannedEmail, sendUserUnbannedEmail, sendUserReportsDismissedEmail } from '../lib/email.js'

const router = Router()

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 10 * 60 * 1000 // 10 minutes
const adminAttempts = new Map() // ip -> { attempts, lockedUntil }

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(503).json({ error: 'Admin not configured — set ADMIN_SECRET env var' })

  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const state = adminAttempts.get(ip) || { attempts: 0, lockedUntil: null }

  // Check lockout
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    const retryAfter = Math.ceil((state.lockedUntil - Date.now()) / 1000)
    return res.status(429).json({ error: 'Too many failed attempts', retryAfter })
  }

  // Reset expired lockout
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    adminAttempts.delete(ip)
  }

  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${secret}`) {
    const attempts = (state.attempts || 0) + 1
    const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : state.lockedUntil
    adminAttempts.set(ip, { attempts, lockedUntil })
    if (lockedUntil) {
      const retryAfter = Math.ceil(LOCKOUT_MS / 1000)
      return res.status(429).json({ error: 'Too many failed attempts', retryAfter })
    }
    return res.status(401).json({ error: 'Unauthorized', attemptsLeft: MAX_ATTEMPTS - attempts })
  }

  // Correct — clear any prior failures for this IP
  adminAttempts.delete(ip)
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


// GET /admin/seed/status — are seed thots currently visible?
router.get('/seed/status', requireAdmin, async (req, res) => {
  const { count } = await supabase
    .from('thots')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true)
    .eq('hidden', false)
  res.json({ visible: (count ?? 0) > 0, count: count ?? 0 })
})

// POST /admin/seed/toggle — flip visibility of all seed thots
router.post('/seed/toggle', requireAdmin, async (req, res) => {
  // Check current state first
  const { count: visibleCount } = await supabase
    .from('thots')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true)
    .eq('hidden', false)

  const nowHiding = (visibleCount ?? 0) > 0  // if any are visible, we hide; else we show
  const { error } = await supabase
    .from('thots')
    .update({ hidden: nowHiding })
    .eq('is_seed', true)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, visible: !nowHiding })
})

export default router

// ---------------------------------------------------------------------------
// Moderation review endpoints
// ---------------------------------------------------------------------------


// Helper: look up a user's auth email by their UUID
async function getUserEmail(userId) {
  if (!userId) return null
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return null
  return data.user.email || null
}

// ── Thot review ──────────────────────────────────────────────────────────────

// GET /admin/review/thot/:id — thot + all reports
router.get('/review/thot/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const [thotRes, reportsRes] = await Promise.all([
    supabase.from('thots').select('id, content, pen_name, session_id, user_id, created_at, hidden, hype_count').eq('id', id).maybeSingle(),
    supabase.from('reports').select('id, reason, reporter_session, created_at').eq('thot_id', id).order('created_at', { ascending: false }),
  ])
  if (!thotRes.data) return res.status(404).json({ error: 'not found' })
  res.json({ thot: thotRes.data, reports: reportsRes.data || [] })
})

// POST /admin/review/thot/:id/unhide — restore + enforce proximity rule + email author
router.post('/review/thot/:id/unhide', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { data: thot } = await supabase
    .from('thots')
    .select('id, content, pen_name, user_id, session_id, location')
    .eq('id', id).maybeSingle()
  if (!thot) return res.status(404).json({ error: 'not found' })

  const authorId = thot.user_id || thot.session_id

  // Find any other non-hidden thots by this user within 250m — hide them first
  // so we don't violate the "one active thot per user per area" rule
  if (authorId) {
    const { data: conflicts } = await supabase.rpc('get_nearby_user_thots', {
      p_session_id: authorId,
      p_exclude_id: id,
      p_meters: 250,
    }).catch(() => ({ data: null }))

    if (conflicts?.length) {
      await supabase
        .from('thots')
        .update({ hidden: true })
        .in('id', conflicts.map(c => c.id))
    }
  }

  const { error } = await supabase.from('thots').update({ hidden: false }).eq('id', id)
  if (error) return res.status(500).json({ error: 'Update failed' })

  // Email the author
  const email = await getUserEmail(authorId)
  if (email && thot.pen_name) {
    await sendThotRestoredEmail(email, thot.pen_name, thot.content)
  }

  res.json({ ok: true, emailed: !!email })
})

// POST /admin/review/thot/:id/remove — permanently hide + clear reports + email author
router.post('/review/thot/:id/remove', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const { data: thot } = await supabase.from('thots').select('id, content, pen_name, user_id, session_id').eq('id', id).maybeSingle()
  if (!thot) return res.status(404).json({ error: 'not found' })

  // Mark hidden and add a permanent flag via a note in the DB (hidden = true is sufficient)
  const { error } = await supabase.from('thots').update({ hidden: true }).eq('id', id)
  if (error) return res.status(500).json({ error: 'Update failed' })

  // Email the author
  const authorId = thot.user_id || thot.session_id
  const email = await getUserEmail(authorId)
  if (email && thot.pen_name) {
    await sendThotRemovedEmail(email, thot.pen_name, thot.content, reason || null)
  }

  res.json({ ok: true, emailed: !!email })
})

// ── User review ───────────────────────────────────────────────────────────────

// GET /admin/review/user/:id — user profile + their thots + comments
router.get('/review/user/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const [userRes, reportsRes, thotsRes, commentsRes] = await Promise.all([
    supabase.from('users').select('id, pen_name, birth_year, created_at, is_banned').eq('id', id).maybeSingle(),
    supabase.from('user_reports').select('id, reason, reporter_id, created_at').eq('reported_id', id).order('created_at', { ascending: false }),
    supabase.from('thots').select('id, content, created_at, hidden, hype_count').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('comments').select('id, content, created_at, hype_count').eq('session_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  if (!userRes.data) return res.status(404).json({ error: 'not found' })
  res.json({
    user: userRes.data,
    reports: reportsRes.data || [],
    thots: thotsRes.data || [],
    comments: commentsRes.data || [],
  })
})

// POST /admin/review/user/:id/ban — ban user + hide their thots + email them
router.post('/review/user/:id/ban', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const { data: user } = await supabase.from('users').select('id, pen_name, is_banned').eq('id', id).maybeSingle()
  if (!user) return res.status(404).json({ error: 'not found' })

  // Ban + hide all their thots
  const [banRes] = await Promise.all([
    supabase.from('users').update({ is_banned: true }).eq('id', id),
    supabase.from('thots').update({ hidden: true }).eq('user_id', id),
  ])
  if (banRes.error) return res.status(500).json({ error: 'Ban failed' })

  const email = await getUserEmail(id)
  if (email) await sendUserBannedEmail(email, user.pen_name, reason || null)

  res.json({ ok: true, emailed: !!email })
})

// POST /admin/review/user/:id/unban — restore previously-banned user + email them
router.post('/review/user/:id/unban', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { data: user } = await supabase.from('users').select('id, pen_name, is_banned').eq('id', id).maybeSingle()
  if (!user) return res.status(404).json({ error: 'not found' })
  if (!user.is_banned) return res.status(400).json({ error: 'User is not banned' })

  const { error } = await supabase.from('users').update({ is_banned: false }).eq('id', id)
  if (error) return res.status(500).json({ error: 'Unban failed' })

  const email = await getUserEmail(id)
  if (email) await sendUserUnbannedEmail(email, user.pen_name)

  res.json({ ok: true, emailed: !!email })
})

// POST /admin/review/user/:id/dismiss — no action taken, email user that reports were reviewed and cleared
router.post('/review/user/:id/dismiss', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { data: user } = await supabase.from('users').select('id, pen_name').eq('id', id).maybeSingle()
  if (!user) return res.status(404).json({ error: 'not found' })

  const email = await getUserEmail(id)
  if (email) await sendUserReportsDismissedEmail(email, user.pen_name)

  res.json({ ok: true, emailed: !!email })
})
