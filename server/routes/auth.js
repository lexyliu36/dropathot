import { Router } from 'express'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase.js'

const router = Router()

// POST /auth/anon — create or validate anonymous session
router.post('/anon', (req, res) => {
  const existing = req.cookies?.session_id
  if (existing) return res.json({ session_id: existing, type: 'anon' })

  const session_id = randomUUID()
  res.cookie('session_id', session_id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  })
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

  res.json({ session: data.session, user: data.user })
})

export default router
