import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: 'no user' }) },
  },
}))

vi.mock('../lib/email.js', () => ({
  alertSupport: vi.fn().mockResolvedValue(undefined),
}))

function makeReq(content) {
  return {
    body: { content, session_id: 'test-session' },
    headers: { 'x-forwarded-for': '1.2.3.4' },
    cookies: { thots_session: 'test-cookie' },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe('makeModerate', () => {
  let originalOpenAI

  beforeEach(() => { originalOpenAI = process.env.OPENAI_API_KEY })
  afterEach(() => { process.env.OPENAI_API_KEY = originalOpenAI; vi.restoreAllMocks() })

  it('skips moderation and calls next() when no API key is set', async () => {
    process.env.OPENAI_API_KEY = 'REPLACE_ME'
    const { makeModerate } = await import('../middleware/moderate.js')
    const next = vi.fn()
    await makeModerate('thot')(makeReq('anything'), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('calls next() when OpenAI says content is clean', async () => {
    process.env.OPENAI_API_KEY = 'real-key'
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ results: [{ flagged: false, categories: {}, category_scores: {} }] }),
    })
    const { makeModerate } = await import('../middleware/moderate.js')
    const next = vi.fn()
    await makeModerate('thot')(makeReq('Nice day today'), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks with 422 when OpenAI flags content', async () => {
    process.env.OPENAI_API_KEY = 'real-key'
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        results: [{
          flagged: true,
          categories: { 'violence': true, 'hate': false },
          category_scores: {},
        }],
      }),
    })
    const { makeModerate } = await import('../middleware/moderate.js')
    const next = vi.fn()
    const res = makeRes()
    await makeModerate('thot')(makeReq('violent content'), res, next)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(next).not.toHaveBeenCalled()
  })

  it('extracts specific violation categories from OpenAI response', async () => {
    process.env.OPENAI_API_KEY = 'real-key'
    const { alertSupport } = await import('../lib/email.js')
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        results: [{
          flagged: true,
          categories: { 'hate': true, 'violence': true, 'sexual': false },
          category_scores: {},
        }],
      }),
    })
    const { makeModerate } = await import('../middleware/moderate.js')
    await makeModerate('thot')(makeReq('bad content'), makeRes(), vi.fn())
    expect(alertSupport).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ 'Categories': 'hate, violence' }),
    }))
  })

  it('fails open and calls next() when the API throws', async () => {
    process.env.OPENAI_API_KEY = 'real-key'
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    const { makeModerate } = await import('../middleware/moderate.js')
    const next = vi.fn()
    await makeModerate('thot')(makeReq('some content'), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })
})
