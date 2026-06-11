import { Router } from 'express'
import { makeModerate } from '../middleware/moderate.js'
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

// GET /comments/my-hypes?thot_id= — returns comment IDs the current user has hyped
// MUST be before /:id to avoid being captured as id="my-hypes"
router.get('/my-hypes', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.json([])
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.json([])

  const { thot_id } = req.query
  let commentIds = null
  if (thot_id && /^[0-9a-f-]{36}$/.test(thot_id)) {
    const { data: comments } = await supabase
      .from('comments').select('id').eq('thot_id', thot_id)
    commentIds = (comments ?? []).map(c => c.id)
    if (commentIds.length === 0) return res.json([])
  }

  let query = supabase.from('comment_hypes').select('comment_id').eq('user_id', user.id)
  if (commentIds) query = query.in('comment_id', commentIds)
  const { data } = await query
  res.json((data ?? []).map(r => r.comment_id))
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
const moderateComment = makeModerate('comment')
router.post('/', moderateComment, async (req, res) => {
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

// DELETE /comments/:id — delete a comment (owner only)
router.delete('/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Sign in to delete comments', code: 'AUTH_REQUIRED' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session', code: 'AUTH_REQUIRED' })

  const commentId = req.params.id
  if (!/^[0-9a-f-]{36}$/.test(commentId)) return res.status(400).json({ error: 'invalid comment id' })

  const { data: comment, error: fetchErr } = await supabase
    .from('comments').select('id, user_id').eq('id', commentId).maybeSingle()
  if (fetchErr || !comment) return res.status(404).json({ error: 'Comment not found' })
  if (comment.user_id !== user.id) return res.status(403).json({ error: 'You can only delete your own comments' })

  const { error: deleteErr } = await supabase.from('comments').delete().eq('id', commentId)
  if (deleteErr) return res.status(500).json({ error: 'Failed to delete comment' })

  res.json({ ok: true })
})

export default router
