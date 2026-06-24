import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'
const THOT_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockFrom    = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: (...a) => mockGetUser(...a) },
    from:  (...a) => mockFrom(...a),
  },
}))

vi.mock('../lib/geo.js', () => ({
  neighborCells: vi.fn(() => ['cell1', 'cell2']),
  latLngToH3:   vi.fn(() => 'h3tile'),
  isInUsa:      vi.fn(() => true),
}))

vi.mock('../lib/email.js', () => ({ alertSupport: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/notificationQueue.js', () => ({ enqueueNotification: vi.fn() }))
vi.mock('../lib/webPush.js', () => ({ sendPush: vi.fn() }))
vi.mock('../middleware/moderate.js', () => ({ moderate: (_req, _res, next) => next() }))
vi.mock('../middleware/rateLimit.js', () => ({ smartRateLimit: (_req, _res, next) => next() }))
vi.mock('../middleware/subnetLimit.js', () => ({ subnetLimit: (_req, _res, next) => next() }))

// ─── App setup ────────────────────────────────────────────────────────────────

const mockIo = { to: vi.fn(() => ({ emit: vi.fn() })) }

async function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.io = mockIo; next() })
  const { default: router } = await import('../routes/thots.js')
  app.use('/thots', router)
  return app
}

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(row) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: 'not found' } }),
  }
}

function makeUpdateChain(row, err = null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: err }),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /thots/:id/location', () => {
  let app

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  it('401 when no auth token', async () => {
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(401)
  })

  it('401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer badtoken')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(401)
  })

  it('400 when lat/lng missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/lat and lng/)
  })

  it('400 when id is malformed', async () => {
    const res = await request(app)
      .patch('/thots/not-a-uuid/location')
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7, lng: -74.0 })
    expect(res.status).toBe(400)
  })

  it('404 when thot not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    mockFrom.mockReturnValue(makeSelectChain(null))
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(404)
  })

  it('403 when caller does not own the thot', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OTHER_ID } }, error: null })
    const thot = { id: THOT_ID, user_id: OWNER_ID, lat: 40.7, lng: -74.0, hidden: false, user_deleted: false, is_live_pin: true }
    mockFrom.mockReturnValue(makeSelectChain(thot))
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('not yours')
  })

  it('400 when thot is not a live pin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    const thot = { id: THOT_ID, user_id: OWNER_ID, lat: 40.7, lng: -74.0, hidden: false, user_deleted: false, is_live_pin: false }
    mockFrom.mockReturnValue(makeSelectChain(thot))
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('not a live pin')
  })

  it('410 when thot is deleted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    const thot = { id: THOT_ID, user_id: OWNER_ID, lat: 40.7, lng: -74.0, hidden: true, user_deleted: true, is_live_pin: true }
    mockFrom.mockReturnValue(makeSelectChain(thot))
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(410)
  })

  it('500 when DB update fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    const thot = { id: THOT_ID, user_id: OWNER_ID, lat: 40.7, lng: -74.0, hidden: false, user_deleted: false, is_live_pin: true }
    // First call: select (fetch thot). Second call: update.
    mockFrom
      .mockReturnValueOnce(makeSelectChain(thot))
      .mockReturnValueOnce(makeUpdateChain(null, { message: 'db error' }))
    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })
    expect(res.status).toBe(500)
  })

  it('200 happy path — updates location and emits thot:move', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null })
    const thot = { id: THOT_ID, user_id: OWNER_ID, lat: 40.7, lng: -74.0, hidden: false, user_deleted: false, is_live_pin: true }
    const updated = { ...thot, lat: 40.7128, lng: -74.006 }
    mockFrom
      .mockReturnValueOnce(makeSelectChain(thot))
      .mockReturnValueOnce(makeUpdateChain(updated))
    const emitMock = vi.fn()
    mockIo.to.mockReturnValue({ emit: emitMock })

    const res = await request(app)
      .patch(`/thots/${THOT_ID}/location`)
      .set('Authorization', 'Bearer tok')
      .send({ lat: 40.7128, lng: -74.006 })

    expect(res.status).toBe(200)
    expect(res.body.lat).toBe(40.7128)
    expect(res.body.lng).toBe(-74.006)
    expect(emitMock).toHaveBeenCalledWith('thot:move', updated)
  })
})
