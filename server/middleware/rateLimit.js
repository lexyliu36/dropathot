import rateLimit from 'express-rate-limit'
import { supabase } from '../lib/supabase.js'

const anonLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `anon:${req.body?.session_id ?? req.ip}`,
  message: { error: 'Too many thots. Take a breath. (3/hr for guests)' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Validates Supabase JWT if present, attaches req.user; auth users are not rate-limited
export async function smartRateLimit(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      req.user = user
      return next()  // no limit for logged-in users
    }
  }
  return anonLimiter(req, res, next)
}
