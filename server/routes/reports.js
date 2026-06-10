import express from 'express'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

// POST /reports — submit a report for a thot
router.post('/', async (req, res) => {
  const { thot_id, reason } = req.body

  if (!thot_id || !/^[0-9a-f-]{36}$/.test(thot_id)) {
    return res.status(400).json({ error: 'invalid thot_id' })
  }

  const reporterSession = req.cookies?.session_id || null

  // Check for duplicate before inserting
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('thot_id', thot_id)
    .eq('reporter_session', reporterSession)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'already_reported' })

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

// DELETE /reports/:thotId — remove the current session's report for a thot
router.delete('/:thotId', async (req, res) => {
  const { thotId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(thotId)) {
    return res.status(400).json({ error: 'invalid thot_id' })
  }

  const reporterSession = req.cookies?.session_id || null
  if (!reporterSession) return res.status(401).json({ error: 'no session' })

  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('thot_id', thotId)
    .eq('reporter_session', reporterSession)

  if (error) {
    console.error('Error deleting report:', error.message)
    return res.status(500).json({ error: 'Failed to remove report' })
  }

  // Note: auto-hide trigger already fired if 3+ reports existed.
  // We do NOT un-hide the thot when a report is retracted — that requires manual mod review.

  res.json({ ok: true })
})

export default router
