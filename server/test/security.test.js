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
    expect(route).toContain('callerSessionId !== sessionId')
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
