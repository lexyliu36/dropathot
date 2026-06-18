import { Router } from 'express'
import { loginLimiter, authInfoLimiter } from '../middleware/rateLimit.js'
import { randomUUID, createHash } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { sendVerificationEmail, alertSupport } from '../lib/email.js'

// In-memory resend throttle: { email → lastSentAt ms }
// Max 1 resend per 60s per email, 3 per hour per email
const resendLog = new Map()
const RESEND_COOLDOWN_MS = 60_000
const RESEND_HOUR_MAX = 3

function checkResendAllowed(email) {
  const now = Date.now()
  const log = resendLog.get(email) ?? { lastSent: 0, hourCount: 0, hourStart: now }
  if (now - log.lastSent < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - log.lastSent)) / 1000)
    return { allowed: false, reason: `Please wait ${wait}s before requesting another email.` }
  }
  // Reset hourly counter if >1 hour has passed
  const hourCount = now - log.hourStart > 3_600_000 ? 0 : log.hourCount
  if (hourCount >= RESEND_HOUR_MAX) {
    return { allowed: false, reason: 'Too many verification emails. Try again in an hour.' }
  }
  return { allowed: true, log, hourCount }
}

function recordResend(email) {
  const now = Date.now()
  const existing = resendLog.get(email) ?? { hourCount: 0, hourStart: now }
  const hourCount = now - existing.hourStart > 3_600_000 ? 1 : existing.hourCount + 1
  const hourStart = now - existing.hourStart > 3_600_000 ? now : existing.hourStart
  resendLog.set(email, { lastSent: now, hourCount, hourStart })
}

const router = Router()

const IS_PROD = process.env.NODE_ENV === 'production'

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',    // api.dropathot.com shares the same site as dropathot.com — lax is safe and more secure than none
  secure: IS_PROD,    // HTTPS-only in production
  maxAge: 30 * 24 * 60 * 60 * 1000,
}

// GET /auth/profile — returns the current auth user's pen_name (requires Bearer token)
router.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'invalid token' })

  // Also fetch notification prefs from users table
  const { data: userRow } = await supabase
    .from('users')
    .select('email_dm_digest, email_activity_digest')
    .eq('id', user.id)
    .maybeSingle()

  res.json({
    user_id: user.id,
    pen_name: user.user_metadata?.pen_name ?? null,
    email: user.email ?? null,
    email_dm_digest: userRow?.email_dm_digest ?? true,
    email_activity_digest: userRow?.email_activity_digest ?? true,
  })
})

// PATCH /auth/preferences — update notification prefs
router.patch('/preferences', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'invalid token' })

  const allowed = ['email_dm_digest', 'email_activity_digest']
  const updates = {}
  for (const key of allowed) {
    if (typeof req.body[key] === 'boolean') updates[key] = req.body[key]
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no valid fields' })

  const { error: updateErr } = await supabase.from('users').update(updates).eq('id', user.id)
  if (updateErr) return res.status(500).json({ error: updateErr.message })
  res.json({ ok: true, ...updates })
})

// GET /auth/check-email?email= — returns { exists: bool } without revealing sensitive info
router.get('/check-email', authInfoLimiter, async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' })
  }
  try {
    // Use the auth admin REST API directly — the JS client's listUsers filter
    // param is silently ignored in some versions, causing false positives
    // Use per_page=50 — the search param does substring matching so we need enough
    // results to find the exact match via the .find() below
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users?search=${encodeURIComponent(email)}&per_page=50`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    )
    if (!resp.ok) throw new Error(`Auth API ${resp.status}`)
    const data = await resp.json()
    const match = data?.users?.find(u => u.email?.toLowerCase() === email)
    const exists = !!match
    const confirmed = match ? !!match.email_confirmed_at : false
    res.json({ exists, confirmed })
  } catch {
    res.status(500).json({ error: 'Could not verify email availability' })
  }
})

// POST /auth/anon — issue or refresh httpOnly session cookie
router.post('/anon', (req, res) => {
  // Cookie already set — return it; never let the request body override
  if (req.cookies?.session_id) {
    return res.json({ session_id: req.cookies.session_id, type: 'anon' })
  }

  // Always generate server-side — never trust client-provided UUIDs
  // (prevents session fixation: attacker can't claim a known victim UUID)
  const session_id = randomUUID()
  res.cookie('session_id', session_id, SESSION_COOKIE_OPTS)
  res.json({ session_id, type: 'anon' })
})

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, pen_name, birth_year } = req.body

  if (!email || !password || !pen_name || !birth_year) {
    return res.status(400).json({ error: 'email, password, pen_name, birth_year are required' })
  }
  if (new Date().getFullYear() - birth_year < 18) {
    return res.status(400).json({ error: 'Must be 18 or older' })
  }

  // Create user — store pen_name in user_metadata so it's readable directly from the
  // auth response without needing a separate users-table query
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { pen_name, birth_year },
  })
  if (authError) {
    // If account exists but email is unconfirmed, resend the verification link
    if (authError.message?.toLowerCase().includes('already registered') ||
        authError.message?.toLowerCase().includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (existing && !existing.email_confirmed_at) {
        const siteUrl = process.env.SITE_URL || (process.env.NODE_ENV === 'production' ? 'https://dropathot.com' : 'http://localhost:5173')
        const { data: linkData } = await supabase.auth.admin.generateLink({ type: 'signup', email, options: { redirectTo: siteUrl } })
        if (linkData) {
          try { await sendVerificationEmail(email, linkData.properties.action_link) } catch {}
        }
        return res.status(409).json({ error: 'unconfirmed', message: 'A verification email has been resent. Please check your inbox.' })
      }
    }
    return res.status(400).json({ error: authError.message })
  }

  const { error: userError } = await supabase.from('users').insert({
    id: authData.user.id,
    pen_name,
    birth_year,
  })
  if (userError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return res.status(400).json({ error: userError.message })
  }

  // Generate verification link and send via Resend
  const siteUrl = process.env.SITE_URL || (process.env.NODE_ENV === 'production' ? 'https://dropathot.com' : 'http://localhost:5173')
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    options: { redirectTo: siteUrl },
  })
  if (linkError) return res.status(500).json({ error: 'Account created but failed to send verification email' })

  try {
    await sendVerificationEmail(email, linkData.properties.action_link)
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message)
    // Non-fatal — user can request resend
  }

  res.status(201).json({ pen_name })
})

// POST /auth/resend-verification
router.post('/resend-verification', authInfoLimiter, async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim()
  if (!email) return res.status(400).json({ error: 'email required' })

  const throttle = checkResendAllowed(email)
  if (!throttle.allowed) return res.status(429).json({ error: throttle.reason })

  // Only resend if account exists and is unconfirmed.
  // listUsers filter param is silently ignored by the JS client — use the REST API directly
  // with exact-match find(), same pattern as check-email.
  const searchResp = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users?search=${encodeURIComponent(email)}&per_page=50`,
    { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  )
  if (!searchResp.ok) return res.status(500).json({ error: 'Could not look up account' })
  const searchData = await searchResp.json()
  const user = searchData?.users?.find(u => u.email?.toLowerCase() === email)
  if (!user) return res.status(404).json({ error: 'No account found with that email' })
  if (user.email_confirmed_at) return res.status(400).json({ error: 'Email is already verified. Try logging in.' })

  const siteUrl = process.env.SITE_URL || (process.env.NODE_ENV === 'production' ? 'https://dropathot.com' : 'http://localhost:5173')
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    options: { redirectTo: siteUrl },
  })
  if (linkError) return res.status(500).json({ error: 'Failed to generate verification link' })

  try {
    await sendVerificationEmail(email, linkData.properties.action_link)
    recordResend(email)
  } catch (emailErr) {
    return res.status(500).json({ error: 'Failed to send email' })
  }

  res.json({ message: 'Verification email sent' })
})

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })

  const pen_name = data.user.user_metadata?.pen_name ?? null

  // Use the auth user's UUID as the persistent session_id so thots are always
  // linked to the same identity regardless of which login session created them.
  // (Anon users still get a random UUID from /auth/anon.)
  const session_id = data.user.id
  res.cookie('session_id', session_id, SESSION_COOKIE_OPTS)

  res.json({
    session_id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    pen_name,
  })
})


// POST /auth/refresh — exchange a refresh_token for a new access_token
// Used by the frontend when the stored access_token has expired
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' })

  const { data, error } = await supabase.auth.refreshSession({ refresh_token })
  if (error || !data?.session) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' })
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
})

// POST /auth/logout — clear session cookie so /auth/anon issues a fresh UUID
router.post('/logout', (req, res) => {
  res.clearCookie('session_id', {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
  })
  res.json({ ok: true })
})

// ── Account deletion (30-day soft delete, Twitter model) ──────────────────────

function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return null }
  return token
}

// DELETE /auth/account — schedule deletion in 30 days
router.delete('/account', async (req, res) => {
  const token = requireAuth(req, res)
  if (!token) return

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'unauthorized' })

  const { error: updateErr } = await supabase
    .from('users')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateErr) return res.status(500).json({ error: 'Failed to schedule deletion' })

  const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Email confirmation
  try {
    await alertSupport({
      type: 'account-deletion',
      subject: `Account deletion scheduled: ${user.email}`,
      key: user.id,
      cooldownMs: 0,
      fields: {
        'User ID': user.id,
        'Email': user.email,
        'Pen name': user.user_metadata?.pen_name ?? 'unknown',
        'Hard delete on': deletionDate,
      },
    })
  } catch {}

  res.json({ ok: true, deletion_date: deletionDate })
})

// POST /auth/account/cancel-deletion — reactivate within 30-day window
router.post('/account/cancel-deletion', async (req, res) => {
  const token = requireAuth(req, res)
  if (!token) return

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: profile } = await supabase
    .from('users')
    .select('deletion_requested_at')
    .eq('id', user.id)
    .single()

  if (!profile?.deletion_requested_at) {
    return res.status(400).json({ error: 'No pending deletion found' })
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ deletion_requested_at: null })
    .eq('id', user.id)

  if (updateErr) return res.status(500).json({ error: 'Failed to cancel deletion' })

  res.json({ ok: true })
})

// GET /auth/account/deletion-status — returns pending deletion info if scheduled
router.get('/account/deletion-status', async (req, res) => {
  const token = requireAuth(req, res)
  if (!token) return

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: profile } = await supabase
    .from('users')
    .select('deletion_requested_at')
    .eq('id', user.id)
    .single()

  if (!profile?.deletion_requested_at) return res.json({ pending: false })

  const scheduledAt = new Date(profile.deletion_requested_at)
  const hardDeleteAt = new Date(scheduledAt.getTime() + 30 * 24 * 60 * 60 * 1000)
  const daysLeft = Math.max(0, Math.ceil((hardDeleteAt - Date.now()) / (1000 * 60 * 60 * 24)))

  res.json({ pending: true, hard_delete_at: hardDeleteAt.toISOString(), days_left: daysLeft })
})


// ── Audit log helper ─────────────────────────────────────────────────────────

function sha256(val) {
  return val ? createHash('sha256').update(String(val)).digest('hex') : null
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null
}

async function writeAuditLog({ userId, eventType, oldValueHash, newValueHash, req, metadata = {} }) {
  const ip = getIp(req)
  await supabase.from('account_audit_log').insert({
    user_id: userId,
    event_type: eventType,
    old_value_hash: oldValueHash ?? null,
    new_value_hash: newValueHash ?? null,
    ip_hash: sha256(ip),
    user_agent_hash: sha256(req.headers['user-agent']),
    metadata,
  })
}

// PUT /auth/email — change email address (requires current password verification)
router.put('/email', async (req, res) => {
  const token = requireAuth(req, res)
  if (!token) return

  const { current_password, new_email } = req.body
  if (!current_password || !new_email) {
    return res.status(400).json({ error: 'current_password and new_email are required' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // Verify current password
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  })
  if (signInErr) return res.status(403).json({ error: 'Current password is incorrect' })

  // Check new email not already taken
  const checkResp = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users?search=${encodeURIComponent(new_email)}&per_page=1`,
    { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  )
  if (checkResp.ok) {
    const checkData = await checkResp.json()
    const existing = checkData?.users?.find(u => u.email?.toLowerCase() === new_email.toLowerCase())
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ error: 'That email is already in use' })
    }
  }

  // Update email
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, { email: new_email })
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // Audit log
  await writeAuditLog({
    userId: user.id,
    eventType: 'email_change',
    oldValueHash: sha256(user.email),
    newValueHash: sha256(new_email),
    req,
    metadata: {
      pen_name: user.user_metadata?.pen_name ?? null,
      old_domain: user.email?.split('@')[1] ?? null,
      new_domain: new_email.split('@')[1] ?? null,
    },
  })

  await alertSupport({
    type: 'email-change',
    subject: `Email changed: ${user.user_metadata?.pen_name ?? user.id}`,
    key: user.id,
    cooldownMs: 0,
    fields: {
      'User ID': user.id,
      'Pen name': user.user_metadata?.pen_name ?? 'unknown',
      'Old email (hashed)': sha256(user.email),
      'New email (hashed)': sha256(new_email),
      'New domain': new_email.split('@')[1],
    },
  }).catch(() => {})

  res.json({ ok: true, message: 'Email updated. A confirmation email may be sent to your new address.' })
})

// PUT /auth/password — change password (requires current password verification)
router.put('/password', async (req, res) => {
  const token = requireAuth(req, res)
  if (!token) return

  const { current_password, new_password } = req.body
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' })
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  }
  if (current_password === new_password) {
    return res.status(400).json({ error: 'New password must be different from current password' })
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // Verify current password
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  })
  if (signInErr) return res.status(403).json({ error: 'Current password is incorrect' })

  // Update password
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, { password: new_password })
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // Audit log (never store passwords — just that it changed)
  await writeAuditLog({
    userId: user.id,
    eventType: 'password_change',
    oldValueHash: null,
    newValueHash: null,
    req,
    metadata: { pen_name: user.user_metadata?.pen_name ?? null },
  })

  await alertSupport({
    type: 'password-change',
    subject: `Password changed: ${user.user_metadata?.pen_name ?? user.id}`,
    key: user.id,
    cooldownMs: 0,
    fields: {
      'User ID': user.id,
      'Email (hashed)': sha256(user.email),
      'Pen name': user.user_metadata?.pen_name ?? 'unknown',
    },
  }).catch(() => {})

  res.json({ ok: true, message: 'Password updated successfully.' })
})



// GET /auth/user-by-pen-name/:penName — look up user_id by pen name (for follow/DM on old thots)
router.get('/user-by-pen-name/:penName', async (req, res) => {
  const { penName } = req.params
  if (!penName) return res.status(400).json({ error: 'penName required' })
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('pen_name', penName)
    .maybeSingle()
  if (error || !data) return res.status(404).json({ error: 'not found' })
  res.json({ userId: data.id })
})

export default router
