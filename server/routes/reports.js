import express from 'express'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// POST /reports — submit a report for a thot
router.post('/', async (req, res) => {
  const { thot_id, reason } = req.body

  if (!thot_id || !/^[0-9a-f-]{36}$/.test(thot_id)) {
    return res.status(400).json({ error: 'invalid thot_id' })
  }

  const reporterSession = req.cookies?.thots_session || null

  const { error } = await supabase.from('reports').insert({
    thot_id,
    reporter_session: reporterSession,
    reason: reason?.slice(0, 200) || null,
  })

  if (error) {
    console.error('Error inserting report:', error.message)
    return res.status(500).json({ error: 'Failed to submit report' })
  }

  res.json({ ok: true })
})

export default router
