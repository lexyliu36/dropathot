import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase.js'
import { smartRateLimit } from '../middleware/rateLimit.js'

function makeReq({ token, ip = '1.2.3.4', body = {} } = {}) {
  return {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
    ip,
    body,
  }
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe('smartRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls next() without rate limiting for a valid JWT user', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    const req = makeReq({ token: 'valid-jwt' })
    const next = vi.fn()
    // smartRateLimit calls next() directly for authenticated users
    await smartRateLimit(req, makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
    expect(req.user).toEqual({ id: 'user-123' })
  })

  it('attaches req.user for authenticated requests', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-456', email: 'a@b.com' } },
      error: null,
    })

    const req = makeReq({ token: 'valid-jwt' })
    const next = vi.fn()
    await smartRateLimit(req, makeRes(), next)
    expect(req.user.id).toBe('user-456')
  })

  it('falls through to anon limiter when no token is provided', async () => {
    // No token — we can't easily test the express-rate-limit internals here,
    // so we just verify it does NOT short-circuit with req.user set
    const req = makeReq()
    const next = vi.fn()
    const res = makeRes()

    // The anon limiter will call next() (no prior hits in test env)
    await smartRateLimit(req, res, next)
    expect(req.user).toBeUndefined()
  })

  it('falls through to anon limiter when JWT is invalid', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    })

    const req = makeReq({ token: 'bad-jwt' })
    const next = vi.fn()
    await smartRateLimit(req, makeRes(), next)
    expect(req.user).toBeUndefined()
  })
})
