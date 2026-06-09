import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// GET /comments?thot_id=  — fetch comments for a thot
router.get('/', async (req, res) => {
  const { thot_id } = req.query
  if (!thot_id || !/^[0-9a-f-]{36}$/.test(thot_id)) {
    return res.status(400).json({ error: 'valid thot_id required' })
  }
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('thot_id', thot_id)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: 'Failed to fetch comments' })
  res.json(data)
})

// GET /comments/:id — fetch a single comment (for /c/:id share page)
router.get('/:id', async (req, res) => {
  const { id } = req.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid id' })
  const { data, error } = await supabase.from('comments').select('*').eq('id', id).single()
  if (error || !data) return res.status(404).json({ error: 'not found' })
  res.json(data)
})

// POST /comments — post a comment (auth users only)
router.post('/', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Sign in to comment', code: 'AUTH_REQUIRED' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Sign in to comment', code: 'AUTH_REQUIRED' })

  const { thot_id, content, reply_to_pen_name } = req.body
  if (!thot_id || !/^[0-9a-f-]{36}$/.test(thot_id)) return res.status(400).json({ error: 'valid thot_id required' })
  if (!content?.trim()) return res.status(400).json({ error: 'content required' })
  if (content.length > 280) return res.status(400).json({ error: 'content exceeds 280 characters' })

  const { data: userData } = await supabase
    .from('users').select('pen_name').eq('id', user.id).single()

  const row = { thot_id, user_id: user.id, pen_name: userData?.pen_name || 'member', content: content.trim() }
  if (reply_to_pen_name && typeof reply_to_pen_name === 'string') {
    row.reply_to_pen_name = reply_to_pen_name.slice(0, 50)
  }

  const { data, error } = await supabase
    .from('comments')
    .insert(row)
    .select().single()
  if (error) return res.status(500).json({ error: 'Failed to post comment' })
  res.status(201).json(data)
})

// POST /comments/:id/hype — toggle hype on a comment (auth only)
router.post('/:id/hype', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Sign in to hype', code: 'AUTH_REQUIRED' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Sign in to hype', code: 'AUTH_REQUIRED' })

  const commentId = req.params.id
  if (!/^[0-9a-f-]{36}$/.test(commentId)) return res.status(400).json({ error: 'invalid comment id' })

  const { data: existing } = await supabase
    .from('comment_hypes').select('id').eq('comment_id', commentId).eq('user_id', user.id).maybeSingle()

  if (existing) {
    await supabase.from('comment_hypes').delete().eq('comment_id', commentId).eq('user_id', user.id)
  } else {
    const { error: insertErr } = await supabase.from('comment_hypes').insert({ comment_id: commentId, user_id: user.id })
    if (insertErr) return res.status(500).json({ error: 'Failed to hype' })
  }

  const { data: comment } = await supabase.from('comments').select('hype_count').eq('id', commentId).maybeSingle()
  res.json({ hyped: !existing, hype_count: comment?.hype_count ?? 0 })
})

export default router
