/**
 * newsJob.js — Automated news thots from RSS feeds
 *
 * Every 30 minutes:
 *   1. Fetch RSS feeds from major US news outlets
 *   2. For each article, use OpenAI to extract a US location of the incident
 *   3. Geocode via Nominatim (free, no key needed)
 *   4. Insert as a thot with pin_type='news' and the outlet pen_name
 *
 * News thots appear as green pins on the map.
 * Deduplication: articles with an existing source_url are skipped.
 * US-only: stories with no extractable US location are skipped.
 */

import cron from 'node-cron'
import { createHash } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { isInUsa } from '../lib/geo.js'
import { getIo } from '../lib/io.js'
import { neighborCells } from '../lib/geo.js'

// ── RSS feed sources ──────────────────────────────────────────────────────────
const FEEDS = [
  { outlet: 'NPR News',      url: 'https://feeds.npr.org/1001/rss.xml' },
  { outlet: 'ABC News',      url: 'https://abcnews.go.com/abcnews/topstories' },
  { outlet: 'CBS News',      url: 'https://www.cbsnews.com/latest/rss/main' },
  { outlet: 'USA Today',     url: 'https://rssfeeds.usatoday.com/usatoday-newstopstories' },
  { outlet: 'NBC News',      url: 'https://feeds.nbcnews.com/nbcnews/public/news' },
  { outlet: 'Fox News',      url: 'https://moxie.foxnews.com/google-publisher/latest.xml' },
]

// ── Minimal RSS XML parser (no dependencies) ──────────────────────────────────
function parseRSS(xml) {
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]
    const get = (tag) => {
      // Handles plain text and CDATA
      const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
      const hit = block.match(re)
      return hit ? hit[1].trim() : null
    }
    // <link> in RSS 2.0 is sometimes text-node, sometimes after a <![CDATA or url tag
    let link = get('link')
    if (!link) link = get('guid')
    const title = get('title')
    const description = get('description') || ''
    if (title && link) items.push({ title, link, description })
  }
  return items
}

// ── OpenAI: extract a US location from headline + snippet ────────────────────
async function extractUsLocation(title, description, apiKey) {
  const prompt = `You are a location extractor. Given a news headline and snippet, return ONLY a plain US city and state (e.g. "Austin, TX") where the main event occurred. If the story is not about a specific US location, return exactly the word "NONE". No explanation, no punctuation other than a comma.

Headline: ${title}
Snippet: ${description.slice(0, 300)}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 20,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(8000),
  })
  const data = await res.json()
  const answer = data.choices?.[0]?.message?.content?.trim()
  if (!answer || answer === 'NONE' || answer.toUpperCase().includes('NONE')) return null
  return answer
}

// ── Nominatim geocoding (free, OpenStreetMap) ─────────────────────────────────
async function geocode(locationStr) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&countrycodes=us&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'dropathot-news-bot/1.0 (dev.lexliu@gmail.com)' },
    signal: AbortSignal.timeout(6000),
  })
  const data = await res.json()
  if (!data?.length) return null
  const lat = parseFloat(data[0].lat)
  const lng = parseFloat(data[0].lon)
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

// ── Check if a source_url already exists ────────────────────────────────────────
async function urlAlreadyPosted(url) {
  const { data } = await supabase
    .from('thots')
    .select('id')
    .eq('source_url', url)
    .limit(1)
  return !!(data && data.length > 0)
}

// ── Check if an active auto-pin already exists near these coords ──────────────
// Uses a bounding box on denormalized lat/lng columns (~1km radius).
// Prevents multiple outlets covering the same story from stacking pins.
const DEDUP_KM = 1
const LAT_DELTA = DEDUP_KM / 111          // 1 degree lat ≈ 111km
const LNG_DELTA = DEDUP_KM / 85           // 1 degree lng ≈ 85km at ~40°N (conservative US avg)

async function autoPinNearby(lat, lng) {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('thots')
    .select('id')
    .not('pin_type', 'is', null)
    .gt('expires_at', now)
    .eq('hidden', false)
    .gte('lat', lat - LAT_DELTA)
    .lte('lat', lat + LAT_DELTA)
    .gte('lng', lng - LNG_DELTA)
    .lte('lng', lng + LNG_DELTA)
    .limit(1)
  return !!(data && data.length > 0)
}

// ── Deterministic session_id from article URL ─────────────────────────────────
function sessionIdFromUrl(url) {
  const hex = createHash('sha256').update(url).digest('hex')
  // Format as UUID v4-ish: 8-4-4-4-12
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}

// ── Process one RSS feed ───────────────────────────────────────────────────────
async function processFeed(outlet, feedUrl, apiKey, io) {
  let xml
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'dropathot-news-bot/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    xml = await res.text()
  } catch (err) {
    console.warn(`[newsJob] Feed fetch failed for ${outlet}: ${err.message}`)
    return 0
  }

  const items = parseRSS(xml)
  let posted = 0

  for (const item of items.slice(0, 15)) {  // cap at 15 items per feed per run
    try {
      // Skip if already in DB
      if (await urlAlreadyPosted(item.link)) continue

      // Extract US location via OpenAI
      const locationStr = await extractUsLocation(item.title, item.description, apiKey)
      if (!locationStr) continue

      // Geocode the location
      const coords = await geocode(locationStr)
      if (!coords) continue

      // Verify it's actually in the US
      if (!isInUsa(coords.lat, coords.lng)) continue

      // Skip if another auto-pin already covers this area (different outlet, same story)
      if (await autoPinNearby(coords.lat, coords.lng)) {
        console.log(`[newsJob] Skipping [${outlet}] "${item.title.slice(0, 60)}" — auto-pin already near ${locationStr}`)
        continue
      }

      // Truncate content to 280 chars
      const content = item.title.slice(0, 280)

      // Insert directly via service role (bypasses auth/rate limits)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { data: newThot, error } = await supabase
        .from('thots')
        .insert({
          content,
          pen_name: outlet,
          session_id: sessionIdFromUrl(item.link),
          ip_hash: createHash('sha256').update(`news-bot-${outlet}`).digest('hex'),
          location: `SRID=4326;POINT(${coords.lng} ${coords.lat})`,
          expires_at: expiresAt,
          is_seed: false,
          pin_type: 'news',
          source_url: item.link,
          user_id: null,
        })
        .select('id, content, pen_name, user_id, lat, lng, hype_count, comment_count, created_at, expires_at, pin_type, source_url')
        .single()

      if (error) {
        console.warn(`[newsJob] Insert failed for "${item.title}": ${error.message}`)
        continue
      }

      // Broadcast to map clients in the area
      if (io && newThot) {
        const cells = neighborCells(coords.lat, coords.lng)
        io.to(cells).emit('thot:new', newThot)
      }

      posted++
      console.log(`[newsJob] Posted [${outlet}] "${content.slice(0, 60)}…" @ ${locationStr}`)

      // Polite delay between OpenAI calls
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.warn(`[newsJob] Error processing item "${item.title}": ${err.message}`)
    }
  }

  return posted
}

// ── Main run ──────────────────────────────────────────────────────────────────
async function runNewsJob() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.includes('REPLACE')) {
    console.log('[newsJob] No OPENAI_API_KEY — skipping news run')
    return
  }

  console.log('[newsJob] Starting news fetch run…')
  const io = getIo()
  let total = 0

  for (const { outlet, url } of FEEDS) {
    const count = await processFeed(outlet, url, apiKey, io)
    total += count
    // Be polite to Nominatim — 1 req/sec limit
    await new Promise(r => setTimeout(r, 1100))
  }

  console.log(`[newsJob] Run complete — posted ${total} new thot(s)`)
}

// ── Export to wire into index.js ──────────────────────────────────────────────
export function startNewsJob() {
  // Run immediately on startup (after a short delay for the server to settle)
  setTimeout(() => runNewsJob().catch(err => console.error('[newsJob] startup run error:', err)), 15_000)

  // Then every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    runNewsJob().catch(err => console.error('[newsJob] scheduled run error:', err))
  })

  console.log('[newsJob] News cron scheduled — runs every 30 minutes')
}
