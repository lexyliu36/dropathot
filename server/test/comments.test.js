import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const OWNER_ID   = '11111111-1111-1111-1111-111111111111'
const OTHER_ID   = '22222222-2222-2222-2222-222222222222'
const COMMENT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// Supabase mock — behaviour is overridden per-test via mockResolvedValueOnce
const mockGetUser   = vi.fn()
const mockFrom      = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: (...a) => mockGetUser(...a) },
    from:  (...a) => mockFrom(...a),
  },
}))

// Silence moderation in POST tests
vi.mock('../lib/email.js', () => ({ alertSupport: vi.fn().mockResolvedValue(undefined) }))

// ─── App setup ────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express()
  app.use(express.json())
  const { default: router } = await import('../routes/comments.js')
  app.use('/comments', router)
  return app
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chainFor({ comment = null, deleteErr = null } = {}) {
  // Returns a mock Supabase query-builder chain
  const chain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: comment, error: null }),
    delete:      vi.fn().mockReturnThis(),
    // delete() then eq() resolves to { error: deleteErr }
  }
  // Make delete().eq() resolve
  chain.delete.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: deleteErr }),
  })
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DELETE /comments/:id', () => {
  let app

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).delete(`/comments/${COMMENT_ID}`)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('AUTH_REQUIRED')
  })

  it('returns 401 when the JWT is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    const res = await request(app)
      .delete(`/comments/${COMMENT_ID}`)
      .set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
  })

  it('returns 400 for a malformed comment id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: OWNER_ID } }, error: null })
    const res = await request(app)
      .delete('/comments/not-a-uuid')
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(400)
  })

  it('returns 404 when comment does not exist', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: OWNER_ID } }, error: null })
    // from('comments').select().eq().maybeSingle() → null
    mockFrom.mockReturnValueOnce(chainFor({ comment: null }))
    const res = await request(app)
      .delete(`/comments/${COMMENT_ID}`)
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(404)
  })

  it('returns 403 when the requesting user does not own the comment', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: OTHER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(
      chainFor({ comment: { id: COMMENT_ID, user_id: OWNER_ID } })
    )
    const res = await request(app)
      .delete(`/comments/${COMMENT_ID}`)
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/own/i)
  })

  it('returns 200 and { ok: true } when the owner deletes their comment', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: OWNER_ID } }, error: null })
    // First from() call: fetch the comment
    mockFrom.mockReturnValueOnce(
      chainFor({ comment: { id: COMMENT_ID, user_id: OWNER_ID } })
    )
    // Second from() call: delete
    mockFrom.mockReturnValueOnce(chainFor({ deleteErr: null }))
    const res = await request(app)
      .delete(`/comments/${COMMENT_ID}`)
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 500 when the DB delete fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: OWNER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(
      chainFor({ comment: { id: COMMENT_ID, user_id: OWNER_ID } })
    )
    mockFrom.mockReturnValueOnce(chainFor({ deleteErr: { message: 'db error' } }))
    const res = await request(app)
      .delete(`/comments/${COMMENT_ID}`)
      .set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(500)
  })
})
