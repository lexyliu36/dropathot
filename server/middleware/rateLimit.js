import rateLimit from 'express-rate-limit'

export const thotRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.body?.session_id ?? req.ip,
  message: { error: 'Too many thots. Take a breath.' },
  standardHeaders: true,
  legacyHeaders: false,
})
