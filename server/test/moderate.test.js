import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase before importing moderate
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: 'no user' }) },
  },
}))

vi.mock('../lib/email.js', () => ({
  alertSupport: vi.fn().mockResolvedValue(undefined),
}))

// Helper to build a minimal Express-style req/res/next
function makeReq(content, { token, cookie } = {}) {
  return {
    body: { content, session_id: 'test-session' },
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
      'x-forwarded-for': '1.2.3.4',
    },
    cookies: { thots_session: cookie || 'test-cookie' },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe('makeModerate', () => {
  let originalPerspective, originalOpenAI

  beforeEach(() => {
    originalPerspective = process.env.PERSPECTIVE_API_KEY
    originalOpenAI = process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    process.env.PERSPECTIVE_API_KEY = originalPerspective
    process.env.OPENAI_API_KEY = originalOpenAI
    vi.restoreAllMocks()
  })

  it('calls next() immediately when no real API keys are set', async () => {
    process.env.PERSPECTIVE_API_KEY = 'REPLACE_ME'
    process.env.OPENAI_API_KEY = 'REPLACE_ME'

    const { makeModerate } = await import('../middleware/moderate.js')
    const middleware = makeModerate('thot')
    const next = vi.fn()
    await middleware(makeReq('hello world'), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('calls next() when Perspective deems content clean', async () => {
    process.env.PERSPECTIVE_API_KEY = 'real-key'
    delete process.env.OPENAI_API_KEY

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        attributeScores: {
          TOXICITY: { summaryScore: { value: 0.1 } },
          THREAT: { summaryScore: { value: 0.05 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.02 } },
        },
      }),
    })

    const { makeModerate } = await import('../middleware/moderate.js')
    const middleware = makeModerate('thot')
    const next = vi.fn()
    const res = makeRes()
    await middleware(makeReq('Nice weather today!'), res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('blocks and returns 422 when toxicity exceeds threshold', async () => {
    process.env.PERSPECTIVE_API_KEY = 'real-key'
    delete process.env.OPENAI_API_KEY

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        attributeScores: {
          TOXICITY: { summaryScore: { value: 0.95 } },
          THREAT: { summaryScore: { value: 0.1 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
        },
      }),
    })

    const { makeModerate } = await import('../middleware/moderate.js')
    const middleware = makeModerate('thot')
    const next = vi.fn()
    const res = makeRes()
    await middleware(makeReq('hateful content'), res, next)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }))
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when fetch throws (fail-open behavior)', async () => {
    process.env.PERSPECTIVE_API_KEY = 'real-key'
    delete process.env.OPENAI_API_KEY

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    const { makeModerate } = await import('../middleware/moderate.js')
    const middleware = makeModerate('thot')
    const next = vi.fn()
    await middleware(makeReq('some content'), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks when OpenAI flags content', async () => {
    delete process.env.PERSPECTIVE_API_KEY
    process.env.OPENAI_API_KEY = 'real-key'

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        results: [{ flagged: true }],
      }),
    })

    const { makeModerate } = await import('../middleware/moderate.js')
    const middleware = makeModerate('thot')
    const next = vi.fn()
    const res = makeRes()
    await middleware(makeReq('bad content'), res, next)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })
})
