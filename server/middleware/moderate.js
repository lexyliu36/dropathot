import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkPerspective(content, apiKey) {
  const res = await fetch(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: { text: content },
        requestedAttributes: { TOXICITY: {}, THREAT: {}, SEVERE_TOXICITY: {} },
      }),
    }
  )
  const data = await res.json()
  const toxicity = data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0
  const threat = data.attributeScores?.THREAT?.summaryScore?.value ?? 0
  const severe = data.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value ?? 0
  return { blocked: toxicity > 0.85 || threat > 0.7 || severe > 0.7, source: 'perspective' }
}

async function checkOpenAI(content, apiKey) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: content }),
  })
  const data = await res.json()
  return { blocked: data.results?.[0]?.flagged === true, source: 'openai' }
}

async function logBlocked({ sessionId, ipHash, content, reason, context }) {
  try {
    await supabase.from('moderation_logs').insert({
      session_id: sessionId || null,
      ip_hash: ipHash || null,
      content: content?.slice(0, 280),
      reason,
      context,
    })
  } catch (err) {
    console.error('Failed to log blocked attempt:', err.message)
  }
}

export function makeModerate(context = 'thot') {
  return async function moderate(req, res, next) {
    const { content } = req.body
    const perspectiveKey = process.env.PERSPECTIVE_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    const hasRealKeys =
      (perspectiveKey && !perspectiveKey.includes('REPLACE')) ||
      (openaiKey && !openaiKey.includes('REPLACE'))

    if (!hasRealKeys) return next() // skip in dev

    try {
      const checks = []
      if (perspectiveKey && !perspectiveKey.includes('REPLACE')) checks.push(checkPerspective(content, perspectiveKey))
      if (openaiKey && !openaiKey.includes('REPLACE')) checks.push(checkOpenAI(content, openaiKey))

      const results = await Promise.all(checks)
      const blocked = results.filter((r) => r.blocked)

      if (blocked.length > 0) {
        const reason = blocked.map((r) => r.source).join('+')
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
        const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'thots-salt')).digest('hex')
        const sessionId = req.cookies?.thots_session || req.body?.session_id || null

        await logBlocked({ sessionId, ipHash, content, reason, context })

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
