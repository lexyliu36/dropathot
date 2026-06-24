/**
 * Content moderation middleware.
 *
 * Uses the OpenAI Moderation API (free, actively maintained).
 * Perspective API was removed — it sunset after 2026.
 *
 * Fails open: if the API is unavailable, the post goes through.
 * Blocked content is logged to moderation_logs with specific violation categories.
 */

import { supabase } from '../lib/supabase.js'
import { alertSupport } from '../lib/email.js'
import crypto from 'crypto'

async function checkOpenAI(content, apiKey) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: content }),
  })
  const data = await res.json()
  const result = data.results?.[0]
  const flagged = result?.flagged === true

  // Extract specific violation categories (e.g. "hate", "violence", "self-harm")
  const categories = flagged
    ? Object.entries(result?.categories ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : []

  return { blocked: flagged, categories, scores: result?.category_scores ?? {} }
}

async function logBlocked({ sessionId, ipHash, content, categories, context }) {
  try {
    await supabase.from('moderation_logs').insert({
      session_id: sessionId || null,
      ip_hash: ipHash || null,
      content: content?.slice(0, 280),
      reason: 'openai',
      categories: categories?.length ? categories : null,
      context,
    })
  } catch (err) {
    console.error('Failed to log blocked attempt:', err.message)
  }
}

export function makeModerate(context = 'thot') {
  return async function moderate(req, res, next) {
    const { content } = req.body
    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey || openaiKey.includes('REPLACE')) return next() // skip in dev

    try {
      const result = await checkOpenAI(content, openaiKey)

      if (result.blocked) {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
        const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'thots-salt')).digest('hex')
        const sessionId = req.cookies?.thots_session || req.body?.session_id || null

        await logBlocked({ sessionId, ipHash, content, categories: result.categories, context })

        alertSupport({
          type: 'moderation-block',
          subject: `Content blocked by moderation (openai)`,
          key: sessionId,
          cooldownMs: 5 * 60 * 1000,
          fields: {
            'Categories': result.categories.length ? result.categories.join(', ') : 'n/a',
            'Context': context,
            'Session ID': sessionId,
            'Content (truncated)': content?.slice(0, 120) + (content?.length > 120 ? '…' : ''),
          },
        }).catch(() => {})

        return res.status(422).json({ error: 'Content flagged by moderation.' })
      }

      next()
    } catch (err) {
      console.error('Moderation error (failing open):', err.message)
      next()
    }
  }
}

// Backwards-compatible default export for existing thots route
export const moderate = makeModerate('thot')
