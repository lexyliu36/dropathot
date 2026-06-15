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

// ── Targeted limiters for sensitive routes ───────────────────────────────────

/** Login: 10 attempts per IP per 15 minutes */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

/** Check-email / resend-verification: 20 per IP per minute */
export const authInfoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** Comments: 20 per session per hour */
export const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.cookies?.session_id ?? req.ip,
  message: { error: 'Too many comments. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** Reports: 30 per session per hour (across different thots) */
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.cookies?.session_id ?? req.ip,
  message: { error: 'Too many reports. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** Follows / DMs / user reports: 60 per session per hour */
export const socialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.cookies?.session_id ?? req.ip,
  message: { error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})
