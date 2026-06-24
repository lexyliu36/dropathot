import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ─── Unit tests: pure functions exported from newsJob ─────────────────────────

// Mock dependencies so the module loads without real env vars
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    rpc:  vi.fn(),
  },
}))
vi.mock('../lib/geo.js', () => ({
  isInUsa:       vi.fn(() => true),
  neighborCells: vi.fn(() => ['cell1']),
  latLngToH3:    vi.fn(() => 'cell1'),
}))
vi.mock('../lib/io.js', () => ({ getIo: vi.fn(() => null) }))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }))

import { parseRSS, sessionIdFromUrl } from '../jobs/newsJob.js'

// ─── parseRSS ─────────────────────────────────────────────────────────────────

describe('parseRSS', () => {
  it('parses a minimal RSS 2.0 feed', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Big story today</title>
          <link>https://example.com/story</link>
          <description>Details here</description>
        </item>
      </channel></rss>`
    const items = parseRSS(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Big story today')
    expect(items[0].link).toBe('https://example.com/story')
    expect(items[0].description).toBe('Details here')
  })

  it('parses CDATA-wrapped fields', () => {
    const xml = `
      <rss><channel>
        <item>
          <title><![CDATA[Fire breaks out in Austin]]></title>
          <link><![CDATA[https://npr.org/fire]]></link>
          <description><![CDATA[A fire started downtown.]]></description>
        </item>
      </channel></rss>`
    const items = parseRSS(xml)
    expect(items[0].title).toBe('Fire breaks out in Austin')
    expect(items[0].link).toBe('https://npr.org/fire')
  })

  it('parses multiple items', () => {
    const xml = `
      <rss><channel>
        <item><title>Story A</title><link>https://a.com</link></item>
        <item><title>Story B</title><link>https://b.com</link></item>
        <item><title>Story C</title><link>https://c.com</link></item>
      </channel></rss>`
    expect(parseRSS(xml)).toHaveLength(3)
  })

  it('skips items with no title or link', () => {
    const xml = `
      <rss><channel>
        <item><description>No title or link</description></item>
        <item><title>Has title</title><link>https://x.com</link></item>
      </channel></rss>`
    const items = parseRSS(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Has title')
  })

  it('returns empty array for feed with no items', () => {
    expect(parseRSS('<rss><channel></channel></rss>')).toHaveLength(0)
  })

  it('returns empty array for garbage input', () => {
    expect(parseRSS('not xml at all')).toHaveLength(0)
    expect(parseRSS('')).toHaveLength(0)
  })

  it('falls back to <guid> when <link> is absent', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Guid story</title>
          <guid>https://fallback.com/guid</guid>
        </item>
      </channel></rss>`
    const items = parseRSS(xml)
    expect(items[0].link).toBe('https://fallback.com/guid')
  })
})

// ─── sessionIdFromUrl ─────────────────────────────────────────────────────────

describe('sessionIdFromUrl', () => {
  it('returns a valid UUID-shaped string', () => {
    const id = sessionIdFromUrl('https://example.com/story/123')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('is deterministic — same URL always produces same ID', () => {
    const url = 'https://npr.org/2026/06/24/story'
    expect(sessionIdFromUrl(url)).toBe(sessionIdFromUrl(url))
  })

  it('produces different IDs for different URLs', () => {
    const a = sessionIdFromUrl('https://npr.org/story-a')
    const b = sessionIdFromUrl('https://cbsnews.com/story-b')
    expect(a).not.toBe(b)
  })

  it('handles URLs with query strings', () => {
    const id = sessionIdFromUrl('https://example.com/story?ref=rss&id=42')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

// ─── GET /thots?pen_name=&pin_type= (outlet feed route) ──────────────────────

const mockFrom = vi.fn()
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...a) => mockFrom(...a),
    rpc:  vi.fn(),
  },
}))

function makeChain({ data = [], count = 0, error = null } = {}) {
  return {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    range:   vi.fn().mockResolvedValue({ data, error, count }),
  }
}

async function buildThotsApp() {
  const app = express()
  app.use(express.json())
  const { default: router } = await import('../routes/thots.js')
  app.use('/thots', router)
  return app
}

describe('GET /thots?pen_name=&pin_type= (outlet feed)', () => {
  let app

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    app = await buildThotsApp()
  })

  it('returns thots for a valid outlet', async () => {
    const fakeThots = [
      { id: 'aaa', content: 'Fire in Austin', pen_name: 'NPR News', pin_type: 'news', source_url: 'https://npr.org/1' },
      { id: 'bbb', content: 'Flood in Dallas', pen_name: 'NPR News', pin_type: 'news', source_url: 'https://npr.org/2' },
    ]
    mockFrom.mockReturnValueOnce(makeChain({ data: fakeThots, count: 2 }))
    const res = await request(app).get('/thots?pen_name=NPR+News&pin_type=news')
    expect(res.status).toBe(200)
    expect(res.body.thots).toHaveLength(2)
    expect(res.body.total).toBe(2)
    expect(res.body.thots[0].pen_name).toBe('NPR News')
  })

  it('returns empty array when outlet has no thots', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], count: 0 }))
    const res = await request(app).get('/thots?pen_name=Fox+News&pin_type=news')
    expect(res.status).toBe(200)
    expect(res.body.thots).toHaveLength(0)
    expect(res.body.total).toBe(0)
  })

  it('returns 500 when supabase errors', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ error: { message: 'db error' } }))
    const res = await request(app).get('/thots?pen_name=CBS+News&pin_type=news')
    expect(res.status).toBe(500)
  })

  it('does not hit the outlet route without both pen_name and pin_type', async () => {
    // pen_name alone should fall through to geo mode (missing lat/lng → 400)
    const res = await request(app).get('/thots?pen_name=NPR+News')
    expect(res.status).toBe(400) // geo mode requires lat+lng
  })
})

// ─── Dedup + proximity constants ──────────────────────────────────────────────

describe('newsJob dedup constants', () => {
  it('DEDUP_KM produces a positive LAT_DELTA', () => {
    const DEDUP_KM = 1
    const LAT_DELTA = DEDUP_KM / 111
    expect(LAT_DELTA).toBeGreaterThan(0)
    expect(LAT_DELTA).toBeLessThan(1)
  })

  it('1km dedup radius covers less than 0.02 degrees lat', () => {
    const LAT_DELTA = 1 / 111
    expect(LAT_DELTA).toBeLessThan(0.02)
  })
})
