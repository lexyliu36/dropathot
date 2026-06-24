/**
 * GET /vibe?lat=&lng=&radius=
 *
 * Fetches recent thots near a location and uses OpenAI to generate a
 * natural-language "area vibe" summary. Responses are cached per H3 cell
 * (resolution 7, ~1.2 km hex) for 5 minutes to avoid hammering the API.
 *
 * Returns:
 *   { summary: string, thotCount: number, cached: boolean }
 */

import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { latLngToH3 } from '../lib/geo.js'

const router = Router()

const vibeCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

const ipHits = new Map()
setInterval(() => ipHits.clear(), 60_000)

function rateCheck(ip) {
  const hits = (ipHits.get(ip) || 0) + 1
  ipHits.set(ip, hits)
  return hits <= 10
}

async function fetchNearby(lat, lng, radius) {
  // Try with max_results first; fall back if the RPC doesn't support it yet
  const { data, error } = await supabase.rpc('get_thots_nearby', {
    p_lat: lat,
    p_lng: lng,
    radius_m: radius,
    max_results: 40,
  })
  if (!error) return data ?? []

  if (error.message?.includes('max_results')) {
    const { data: fallback, error: fallbackError } = await supabase.rpc('get_thots_nearby', {
      p_lat: lat,
      p_lng: lng,
      radius_m: radius,
    })
    if (fallbackError) throw new Error(fallbackError.message)
    return (fallback ?? []).slice(0, 40)
  }

  throw new Error(error.message)
}

router.get('/', async (req, res) => {
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  const radius = Math.min(parseInt(req.query.radius) || 1500, 5000)

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (!rateCheck(ip)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const cell = latLngToH3(lat, lng)
  const cached = vibeCache.get(cell)
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ summary: cached.summary, thotCount: cached.thotCount, cached: true })
  }

  let thots
  try {
    thots = await fetchNearby(lat, lng, radius)
  } catch (err) {
    console.error('vibe: get_thots_nearby error', err.message)
    return res.status(500).json({ error: 'Failed to fetch nearby thots' })
  }

  const visible = thots.filter(t => !t.hidden)

  if (visible.length === 0) {
    return res.json({ summary: 'Pretty quiet around here — no thots yet.', thotCount: 0, cached: false })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey || openaiKey.includes('REPLACE')) {
    return res.json({
      summary: `${visible.length} thot${visible.length !== 1 ? 's' : ''} nearby. (AI vibe summary requires OPENAI_API_KEY)`,
      thotCount: visible.length,
      cached: false,
    })
  }

  const contentList = visible
    .slice(0, 30)
    .map((t, i) => `${i + 1}. "${t.content}"`)
    .join('\n')

  const prompt = `You are summarizing the anonymous social vibe of a neighborhood based on what people are posting nearby.

Here are ${visible.length} recent anonymous posts from this area:
${contentList}

Write a single short paragraph (2-3 sentences, max 80 words) describing the current vibe, mood, and topics people are talking about here. Be observational and specific. Do not list the posts — synthesize them. Keep it casual and interesting, like you are telling a friend what the neighborhood feels like right now. Do not mention any names. Do not use bullet points.`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(8000),
    })

    const aiData = await aiRes.json()
    console.log('vibe: OpenAI status', aiRes.status, JSON.stringify(aiData).slice(0, 200))

    const summary = aiData.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      console.error('vibe: no summary in OpenAI response', JSON.stringify(aiData).slice(0, 300))
      return res.status(500).json({ error: 'AI summary unavailable' })
    }

    vibeCache.set(cell, { summary, thotCount: visible.length, expiresAt: Date.now() + CACHE_TTL_MS })
    return res.json({ summary, thotCount: visible.length, cached: false })
  } catch (err) {
    console.error('vibe: OpenAI error', err.message)
    return res.status(500).json({ error: 'AI summary unavailable' })
  }
})

export default router
