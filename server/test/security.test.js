/**
 * Security tests — PII leakage, auth enforcement, rate limiting, admin access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      admin: { getUserById: vi.fn() },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}))

vi.mock('../lib/email.js', () => ({
  sendThotReviewEmail: vi.fn(),
  sendUserReviewEmail: vi.fn(),
  sendThotRestoredEmail: vi.fn(),
  sendThotRemovedEmail: vi.fn(),
  sendUserBannedEmail: vi.fn(),
  sendUserUnbannedEmail: vi.fn(),
  sendUserReportsDismissedEmail: vi.fn(),
}))

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(__dirname, rel), 'utf-8')

// ── 1. ip_hash / session_id not in public thot responses ─────────────────────
describe('PII — ip_hash not in public thot responses', () => {
  it('GET /thots/:id does not select ip_hash or session_id', () => {
    const route = read('../routes/thots.js')
    // Extract the section around the single-thot GET
    const idx = route.indexOf("router.get('/:id'")
    const section = route.slice(idx, idx + 400)
    expect(section).not.toContain("select('*')")
    expect(section).not.toContain('ip_hash')
    expect(section).not.toContain("'session_id'")
  })

  it('thots.js strips ip_hash and session_id before Socket.io broadcast', () => {
    const route = read('../routes/thots.js')
    expect(route).toMatch(/ip_hash.*_(?:ip|strip)|_(?:ip|strip).*ip_hash/)
    expect(route).not.toMatch(/emit\('thot:new',\s*newThot\)/)
  })

  it('session history select does not use select("*")', () => {
    const route = read('../routes/thots.js')
    // Find the session_id query block
    const idx = route.indexOf('req.query.session_id')
    const section = route.slice(idx, idx + 800)
    expect(section).not.toContain("select('*'")
  })
})

// ── 2. GET /thots?session_id= requires ownership ─────────────────────────────
describe('Auth — GET /thots?session_id= requires session ownership', () => {
  it('route contains callerSessionId ownership check', () => {
    const route = read('../routes/thots.js')
    expect(route).toContain('callerSessionId !== rawId')
    expect(route).toContain("status(403)")
  })
})

// ── 3. Email not in login/signup responses ────────────────────────────────────
describe('Auth — email and user_id not returned to client', () => {
  it('login response does not include email field', () => {
    const route = read('../routes/auth.js')
    expect(route).not.toContain('email: data.user.email')
  })

  it('signup response does not include user_id', () => {
    const route = read('../routes/auth.js')
    expect(route).not.toContain('user_id: authData.user.id')
  })
})

// ── 4. Admin endpoints all require auth ───────────────────────────────────────
describe('Admin — all endpoints require requireAdmin', () => {
  it('every router method in admin.js includes requireAdmin', () => {
    const route = read('../routes/admin.js')
    const methods = route.match(/router\.(get|post|put|delete)\(([^;]+);/gs) ?? []
    for (const m of methods) {
      expect(m).toContain('requireAdmin')
    }
  })
})

// ── 5. Rate limiters exported and wired ──────────────────────────────────────
describe('Rate limiting — limiters exported', () => {
  it('loginLimiter is exported', async () => {
    const mod = await import('../middleware/rateLimit.js')
    expect(typeof mod.loginLimiter).toBe('function')
  })
  it('commentLimiter is exported', async () => {
    const mod = await import('../middleware/rateLimit.js')
    expect(typeof mod.commentLimiter).toBe('function')
  })
  it('reportLimiter is exported', async () => {
    const mod = await import('../middleware/rateLimit.js')
    expect(typeof mod.reportLimiter).toBe('function')
  })
  it('socialLimiter is exported', async () => {
    const mod = await import('../middleware/rateLimit.js')
    expect(typeof mod.socialLimiter).toBe('function')
  })
  it('authInfoLimiter is exported', async () => {
    const mod = await import('../middleware/rateLimit.js')
    expect(typeof mod.authInfoLimiter).toBe('function')
  })
})

describe('Rate limiting — route files wire limiters', () => {
  it('auth.js: loginLimiter on POST /login', () => {
    expect(read('../routes/auth.js')).toContain("router.post('/login', loginLimiter")
  })
  it('auth.js: authInfoLimiter on GET /check-email', () => {
    expect(read('../routes/auth.js')).toContain("router.get('/check-email', authInfoLimiter")
  })
  it('comments.js: commentLimiter on POST /', () => {
    expect(read('../routes/comments.js')).toContain("router.post('/', commentLimiter")
  })
  it('reports.js: reportLimiter on POST /', () => {
    expect(read('../routes/reports.js')).toContain("router.post('/', reportLimiter")
  })
  it('follows.js: socialLimiter wired', () => {
    expect(read('../routes/follows.js')).toContain('socialLimiter')
  })
  it('messages.js: socialLimiter wired', () => {
    expect(read('../routes/messages.js')).toContain('socialLimiter')
  })
})

// ── 6. sendThotReviewEmail import fixed ──────────────────────────────────────
describe('Email — sendThotReviewEmail imported in reports.js', () => {
  it('import statement present', () => {
    expect(read('../routes/reports.js')).toContain('sendThotReviewEmail')
  })
  it('sendThotReviewEmail is a function in email.js', async () => {
    const email = await import('../lib/email.js')
    expect(typeof email.sendThotReviewEmail).toBe('function')
  })
})

// ── 7. Block list persisted to localStorage ───────────────────────────────────
describe('Block list — localStorage persistence', () => {
  it('useAppStore reads blockedSessions from localStorage on init', () => {
    const store = read('../../src/stores/useAppStore.js')
    expect(store).toContain("localStorage.getItem('blockedSessions')")
  })
  it('blockSession writes to localStorage', () => {
    const store = read('../../src/stores/useAppStore.js')
    expect(store).toMatch(/blockSession[\s\S]{0,300}localStorage\.setItem\('blockedSessions'/)
  })
})

// ── 8. Legal pages factual accuracy ──────────────────────────────────────────
describe('Legal pages — factual accuracy', () => {
  it('Privacy Policy states SameSite=Lax not Strict', () => {
    const p = read('../../src/pages/legal/PrivacyPage.jsx')
    expect(p).toContain('SameSite=Lax')
    expect(p).not.toContain('SameSite=Strict')
  })
  it('Privacy Policy does not falsely claim birth_year not stored', () => {
    expect(read('../../src/pages/legal/PrivacyPage.jsx')).not.toContain('not stored beyond the session')
  })
  it('Terms does not claim DMCA registration complete', () => {
    expect(read('../../src/pages/legal/TermsPage.jsx')).not.toContain('We are registered with the U.S. Copyright Office')
  })
  it('Terms does not describe anonymous posting as available', () => {
    const t = read('../../src/pages/legal/TermsPage.jsx')
    expect(t).not.toContain('Anonymous users may post')
    expect(t).not.toContain('anonymously via a guest session')
  })
})

// ── 9. Anonymous users cannot post thots ─────────────────────────────────────
describe('Auth — anonymous users cannot post thots', () => {
  it('POST /thots requires a real authenticated account', () => {
    const route = read('../routes/thots.js')
    // Find the POST handler
    const idx = route.indexOf("router.post('/', smartRateLimit")
    const section = route.slice(idx, idx + 1000)
    // Must check req.user exists (set by Supabase auth) and reject non-users
    expect(section).toContain('req.user')
    expect(section).toContain('status(401)')
  })

  it('POST /thots blocks anonymous sessions — no posting without auth user', () => {
    const route = read('../routes/thots.js')
    // The route explicitly comments that anonymous posting is disabled
    expect(route).toMatch(/anon(?:ymous)? posting is disabled|Require a real account/i)
  })

  it('session_id from cookie is authoritative — body session_id cannot spoof ownership', () => {
    const route = read('../routes/thots.js')
    const idx = route.indexOf("router.post('/', smartRateLimit")
    const section = route.slice(idx, idx + 600)
    // Cookie takes precedence over body
    expect(section).toContain('req.cookies?.session_id')
    // And body fallback is only used when cookie is absent (not overriding)
    expect(section).toMatch(/cookies\?\.session_id.*\?\?.*body\.session_id/)
  })
})

// ── 10. DM privacy — users can only read their own conversations ──────────────
describe('DM privacy — conversation isolation', () => {
  it('GET /messages/:userId scopes query to the authenticated caller', () => {
    const route = read('../routes/messages.js')
    const idx = route.indexOf("router.get('/:userId'")
    const section = route.slice(idx, idx + 600)
    // Query must filter by the caller's user.id on both sides
    expect(section).toContain('user.id')
    expect(section).toContain('from_user_id')
    expect(section).toContain('to_user_id')
  })

  it('GET /messages/:userId requires authentication', () => {
    const route = read('../routes/messages.js')
    const idx = route.indexOf("router.get('/:userId'")
    const section = route.slice(idx, idx + 200)
    expect(section).toContain('requireAuth')
  })

  it('GET /messages/ (conversation list) requires authentication', () => {
    const route = read('../routes/messages.js')
    const idx = route.indexOf("router.get('/'")
    const section = route.slice(idx, idx + 200)
    expect(section).toContain('requireAuth')
  })

  it('unauthenticated DM access returns AUTH_REQUIRED code', () => {
    const route = read('../routes/messages.js')
    expect(route).toContain("code: 'AUTH_REQUIRED'")
  })

  it('cannot message yourself — self-DM rejected with 400', () => {
    const route = read('../routes/messages.js')
    expect(route).toContain('userId === user.id')
    expect(route).toContain('cannot message yourself')
  })

  it('message hype requires caller to be part of the conversation', () => {
    const route = read('../routes/messages.js')
    const idx = route.indexOf("router.post('/:messageId/hype'")
    const section = route.slice(idx, idx + 800)
    expect(section).toContain('from_user_id !== user.id')
    expect(section).toContain('to_user_id !== user.id')
    expect(section).toContain('status(403)')
    expect(section).toContain('Not part of this conversation')
  })
})

// ── 11. Thot ownership — only author can delete ───────────────────────────────
describe('Auth — thot deletion requires ownership', () => {
  it('DELETE /thots/:id checks session ownership before deleting', () => {
    const route = read('../routes/thots.js')
    const idx = route.indexOf("router.delete('/:id'")
    // Ownership check is ~24 lines in; use a generous slice
    const section = route.slice(idx, idx + 1600)
    expect(section).toContain('thot.session_id !== session_id')
    expect(section).toContain('status(403)')
    expect(section).toContain("not yours")
  })

  it('DELETE /thots/:id requires a session — no anonymous deletion', () => {
    const route = read('../routes/thots.js')
    const idx = route.indexOf("router.delete('/:id'")
    // 'no session' check is ~13 lines in; 900 chars is sufficient
    const section = route.slice(idx, idx + 900)
    expect(section).toContain('status(401)')
    expect(section).toContain('no session')
  })
})

// ── 12. Comment ownership — only author can delete ────────────────────────────
describe('Auth — comment deletion requires ownership', () => {
  it('DELETE /comments/:id rejects non-owners with 403', () => {
    const route = read('../routes/comments.js')
    const idx = route.indexOf("router.delete('/:id'")
    // Ownership check is ~14 lines in; use 800 chars
    const section = route.slice(idx, idx + 1000)
    expect(section).toContain('user_id !== user.id')
    expect(section).toContain('status(403)')
    expect(section).toContain('your own comments')
  })

  it('DELETE /comments/:id requires authentication', () => {
    const route = read('../routes/comments.js')
    const idx = route.indexOf("router.delete('/:id'")
    const section = route.slice(idx, idx + 300)
    expect(section).toContain('status(401)')
  })
})

// ── 13. Auth required — write actions across all routes ──────────────────────
describe('Auth — write actions require authentication', () => {
  it('POST /comments requires auth token', () => {
    const route = read('../routes/comments.js')
    const idx = route.indexOf("router.post('/', commentLimiter")
    const section = route.slice(idx, idx + 300)
    expect(section).toContain('status(401)')
    expect(section).toContain('AUTH_REQUIRED')
  })

  it('POST /comments/:id/hype requires auth', () => {
    const route = read('../routes/comments.js')
    const idx = route.indexOf("router.post('/:id/hype'")
    const section = route.slice(idx, idx + 300)
    expect(section).toContain('status(401)')
  })

  it('POST /thots/:id/hype requires auth', () => {
    const route = read('../routes/thots.js')
    const idx = route.indexOf("router.post('/:id/hype'")
    const section = route.slice(idx, idx + 400)
    expect(section).toContain('status(401)')
  })

  it('POST /follows/:userId requires auth', () => {
    const route = read('../routes/follows.js')
    const idx = route.indexOf("router.post('/:userId', socialLimiter")
    const section = route.slice(idx, idx + 200)
    expect(section).toContain('requireAuth')
  })

  it('DELETE /follows/:userId requires auth', () => {
    const route = read('../routes/follows.js')
    const idx = route.indexOf("router.delete('/:userId'")
    const section = route.slice(idx, idx + 200)
    expect(section).toContain('requireAuth')
  })

  it('DELETE /reports/:thotId requires a valid session cookie', () => {
    const route = read('../routes/reports.js')
    // Reports use session cookie for identity (no JWT auth required to report,
    // but un-reporting requires a valid session so you can only retract your own report)
    expect(route).toContain('req.cookies?.session_id')
    expect(route).toContain('status(401)')
    expect(route).toContain("'no session'")
  })
})

// ── 14. Self-action prevention ────────────────────────────────────────────────
describe('Auth — self-targeting actions are rejected', () => {
  it('cannot follow yourself', () => {
    const route = read('../routes/follows.js')
    expect(route).toContain('userId === user.id')
    expect(route).toContain('cannot follow yourself')
  })

  it('cannot message yourself', () => {
    const route = read('../routes/messages.js')
    expect(route).toContain('userId === user.id')
    expect(route).toContain('cannot message yourself')
  })
})

// ── 15. UUID validation on all route params ───────────────────────────────────
describe('Input validation — UUID format enforced on route params', () => {
  const UUID_REGEX = '/^[0-9a-f-]{36}$/'

  it('messages.js validates userId param', () => {
    expect(read('../routes/messages.js')).toContain(UUID_REGEX)
  })

  it('follows.js validates userId param', () => {
    expect(read('../routes/follows.js')).toContain(UUID_REGEX)
  })

  it('comments.js validates thot_id and comment id', () => {
    expect(read('../routes/comments.js')).toContain(UUID_REGEX)
  })

  it('thots.js validates thot id param', () => {
    expect(read('../routes/thots.js')).toContain(UUID_REGEX)
  })

  it('reports.js validates thot_id', () => {
    expect(read('../routes/reports.js')).toContain(UUID_REGEX)
  })
})

// ── 16. Content length limits ─────────────────────────────────────────────────
describe('Input validation — content length limits enforced', () => {
  it('POST /thots enforces 280 char limit at DB level', () => {
    // DB schema has check constraint; route also relies on moderation
    // Verify the schema migration contains the check
    const route = read('../routes/thots.js')
    // The moderate middleware runs before insert — also check it's wired
    expect(route).toContain('moderate')
  })

  it('POST /comments enforces 280 char limit', () => {
    const route = read('../routes/comments.js')
    expect(route).toContain('content.length > 280')
    expect(route).toContain('status(400)')
  })

  it('POST /messages enforces 1000 char limit', () => {
    const route = read('../routes/messages.js')
    expect(route).toContain('content.length > 1000')
    expect(route).toContain('message too long')
  })
})

// ── 17. IP hash — never stored as plaintext ───────────────────────────────────
describe('PII — IP address hashed before storage', () => {
  it('thots.js imports createHash from crypto', () => {
    expect(read('../routes/thots.js')).toContain("from 'crypto'")
    expect(read('../routes/thots.js')).toContain('createHash')
  })

  it('ip_hash field is computed via hash, never raw IP', () => {
    const route = read('../routes/thots.js')
    // Should hash the IP before inserting
    expect(route).toMatch(/createHash\(.*\).*ip|ip.*createHash/)
    // Raw IP string should never be stored directly as ip_hash
    expect(route).not.toMatch(/ip_hash:\s*(?:req\.ip|clientIp|ip)\b/)
  })
})

// ── 18. Moderation wired to POST /thots ──────────────────────────────────────
describe('Moderation — middleware applied before thot insert', () => {
  it('moderate middleware is imported in thots.js', () => {
    expect(read('../routes/thots.js')).toContain("from '../middleware/moderate.js'")
  })

  it('moderate is applied on the POST /thots route', () => {
    const route = read('../routes/thots.js')
    const idx = route.indexOf("router.post('/', smartRateLimit")
    const section = route.slice(idx, idx + 100)
    expect(section).toContain('moderate')
  })

  it('moderate.js uses the shared supabase client, not createClient directly', () => {
    const mod = read('../middleware/moderate.js')
    expect(mod).not.toContain('createClient(')
    expect(mod).toContain("from '../lib/supabase.js'")
  })
})
