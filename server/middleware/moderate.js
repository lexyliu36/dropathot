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
  return { blocked: toxicity > 0.85 || threat > 0.7 || severe > 0.7 }
}

async function checkOpenAI(content, apiKey) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: content }),
  })
  const data = await res.json()
  return { blocked: data.results?.[0]?.flagged === true }
}

export async function moderate(req, res, next) {
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
    if (results.some((r) => r.blocked)) {
      return res.status(422).json({ error: 'Content flagged by moderation.' })
    }
    next()
  } catch (err) {
    console.error('Moderation error (failing open):', err.message)
    next()
  }
}
