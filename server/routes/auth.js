import { Router } from 'express'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase.js'

const router = Router()

const IS_PROD = process.env.NODE_ENV === 'production'

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: IS_PROD,          // HTTPS-only in production
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (not a year — limits hijack window)
}

// GET /auth/check-email?email= — returns { exists: bool } without revealing sensitive info
router.get('/check-email', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' })
  }
  try {
    // listUsers with filter is supported in supabase-js v2.50+
    const { data, error } = await supabase.auth.admin.listUsers({
      filter: `email=eq.${email}`,
      page: 1,
      perPage: 1,
    })
    if (error) throw error
    res.json({ exists: (data?.users?.length ?? 0) > 0 })
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

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return res.status(400).json({ error: authError.message })

  const { error: userError } = await supabase.from('users').insert({
    id: authData.user.id,
    pen_name,
    birth_year,
  })
  if (userError) return res.status(400).json({ error: userError.message })

  res.status(201).json({ user_id: authData.user.id, pen_name })
})

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })

  // Fetch pen_name from our users table
  const { data: userData } = await supabase
    .from('users')
    .select('pen_name')
    .eq('id', data.user.id)
    .single()

  // Issue httpOnly session cookie used server-side for rate limiting
  const session_id = randomUUID()
  res.cookie('session_id', session_id, SESSION_COOKIE_OPTS)

  res.json({
    session_id,
    access_token: data.session.access_token,
    user_id: data.user.id,
    pen_name: userData?.pen_name ?? null,
  })
})

export default router
