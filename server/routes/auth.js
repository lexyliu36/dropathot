import { Router } from 'express'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { sendVerificationEmail } from '../lib/email.js'

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
  sameSite: IS_PROD ? 'none' : 'lax',   // 'none' required for cross-domain (Vercel ↔ Railway)
  secure: IS_PROD,                       // HTTPS-only in production
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (not a year — limits hijack window)
}

// GET /auth/profile — returns the current auth user's pen_name (requires Bearer token)
router.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'invalid token' })

  res.json({ pen_name: user.user_metadata?.pen_name ?? null })
})

// GET /auth/check-email?email= — returns { exists: bool } without revealing sensitive info
router.get('/check-email', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' })
  }
  try {
    // Use the auth admin REST API directly — the JS client's listUsers filter
    // param is silently ignored in some versions, causing false positives
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users?search=${encodeURIComponent(email)}&per_page=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    )
    if (!resp.ok) throw new Error(`Auth API ${resp.status}`)
    const data = await resp.json()
    const exists = data?.users?.some(u => u.email?.toLowerCase() === email) ?? false
    res.json({ exists })
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
  if (authError) return res.status(400).json({ error: authError.message })

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
  const siteUrl = process.env.SITE_URL || 'http://localhost:5173'
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

  res.status(201).json({ user_id: authData.user.id, pen_name })
})

// POST /auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim()
  if (!email) return res.status(400).json({ error: 'email required' })

  const throttle = checkResendAllowed(email)
  if (!throttle.allowed) return res.status(429).json({ error: throttle.reason })

  // Only resend if account exists and is unconfirmed
  const { data: listData } = await supabase.auth.admin.listUsers({
    filter: `email=eq.${email}`,
    page: 1,
    perPage: 1,
  })
  const user = listData?.users?.[0]
  if (!user) return res.status(404).json({ error: 'No account found with that email' })
  if (user.email_confirmed_at) return res.status(400).json({ error: 'Email is already verified. Try logging in.' })

  const siteUrl = process.env.SITE_URL || 'http://localhost:5173'
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
router.post('/login', async (req, res) => {
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
    user_id: data.user.id,
    pen_name,
  })
})

export default router
