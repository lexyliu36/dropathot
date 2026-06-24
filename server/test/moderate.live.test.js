/**
 * Live integration tests — OpenAI Moderation API only.
 * (Perspective API was removed: it sunset after 2026)
 *
 * Skipped automatically when OPENAI_API_KEY is not set.
 *
 * Run:
 *   cd server && node --env-file=.env node_modules/.bin/vitest run test/moderate.live.test.js --reporter=verbose
 */

import { describe, it, expect } from 'vitest'

async function checkOpenAI(content, apiKey) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: content }),
  })
  const data = await res.json()
  const result = data.results?.[0]
  const categories = Object.entries(result?.categories ?? {})
    .filter(([, v]) => v === true).map(([k]) => k)
  return { blocked: result?.flagged === true, categories, scores: result?.category_scores ?? {} }
}

const hasKey = !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('REPLACE')

describe.skipIf(!hasKey)('OpenAI Moderation API — live', () => {
  const key = () => process.env.OPENAI_API_KEY

  // ── should PASS ─────────────────────────────────────────────────────────
  it('allows a normal everyday post', async () => {
    const r = await checkOpenAI('Just grabbed coffee at the corner deli', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(false)
  })

  it('allows mild frustration', async () => {
    const r = await checkOpenAI('Ugh the subway is delayed again, classic MTA', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(false)
  })

  it('allows edgy but benign opinion', async () => {
    const r = await checkOpenAI('Hot take: this neighborhood has gotten way too expensive', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(false)
  })

  it('logs result for dark humor (no assertion — for manual review)', async () => {
    const r = await checkOpenAI('This commute is literally killing me (it is not)', key())
    console.log('  blocked:', r.blocked, '  categories:', r.categories)
    // intentionally no expect() — useful to see where the model draws the line
  })

  // ── should be BLOCKED ────────────────────────────────────────────────────
  it('blocks a direct violent threat', async () => {
    const r = await checkOpenAI('I am going to kill you when I see you tonight', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(true)
  })

  it('blocks hate speech', async () => {
    const r = await checkOpenAI('I hate [group], they should all disappear', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(true)
  })

  it('blocks self-harm content', async () => {
    const r = await checkOpenAI('I want to hurt myself, I have a plan to do it tonight', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(true)
    expect(r.categories.some(c => c.includes('self-harm'))).toBe(true)
  })

  it('blocks explicit sexual content', async () => {
    const r = await checkOpenAI('Meet me in the bathroom for sex right now', key())
    console.log('  categories:', r.categories)
    expect(r.blocked).toBe(true)
  })

  // ── response shape ───────────────────────────────────────────────────────
  it('returns boolean blocked and array categories', async () => {
    const r = await checkOpenAI('hello world', key())
    expect(typeof r.blocked).toBe('boolean')
    expect(Array.isArray(r.categories)).toBe(true)
    expect(typeof r.scores).toBe('object')
  })
})
