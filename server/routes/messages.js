import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'Auth required', code: 'AUTH_REQUIRED' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Invalid session', code: 'AUTH_REQUIRED' }); return null }
  return user
}

// GET /messages/:userId — fetch conversation with a user (both directions)
router.get('/:userId', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })

  const { data, error } = await supabase.from('messages')
    .select('*')
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${user.id})`)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) return res.status(500).json({ error: 'Failed to fetch messages' })

  // Mark unread messages as read
  await supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_user_id', user.id).eq('from_user_id', userId).is('read_at', null)

  res.json(data ?? [])
})

// GET /messages — list all conversations (most recent message per thread)
router.get('/', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return

  // Get all messages involving this user, ordered by most recent
  const { data, error } = await supabase.from('messages')
    .select('*, from_user:from_user_id(id, pen_name), to_user:to_user_id(id, pen_name)')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return res.status(500).json({ error: 'Failed to fetch conversations' })

  // Deduplicate: keep only the most recent message per conversation partner
  const seen = new Set()
  const threads = []
  for (const msg of data ?? []) {
    const partnerId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id
    if (!seen.has(partnerId)) {
      seen.add(partnerId)
      const partner = msg.from_user_id === user.id ? msg.to_user : msg.from_user
      const unread = msg.to_user_id === user.id && !msg.read_at ? 1 : 0
      threads.push({ ...msg, partner, unread })
    }
  }
  res.json(threads)
})

// POST /messages/:userId — send a message
router.post('/:userId', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { userId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(userId)) return res.status(400).json({ error: 'invalid user id' })
  if (userId === user.id) return res.status(400).json({ error: 'cannot message yourself' })

  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'content required' })
  if (content.length > 1000) return res.status(400).json({ error: 'message too long' })

  const { data, error } = await supabase.from('messages')
    .insert({ from_user_id: user.id, to_user_id: userId, content: content.trim() })
    .select().single()
  if (error) return res.status(500).json({ error: 'Failed to send message' })
  res.status(201).json(data)
})

// POST /messages/:messageId/hype — heart a message
router.post('/:messageId/hype', async (req, res) => {
  const user = await requireAuth(req, res); if (!user) return
  const { messageId } = req.params
  if (!/^[0-9a-f-]{36}$/.test(messageId)) return res.status(400).json({ error: 'invalid message id' })

  // Verify user is part of this conversation
  const { data: msg } = await supabase.from('messages').select('from_user_id, to_user_id, hype_count')
    .eq('id', messageId).maybeSingle()
  if (!msg) return res.status(404).json({ error: 'Message not found' })
  if (msg.from_user_id !== user.id && msg.to_user_id !== user.id)
    return res.status(403).json({ error: 'Not part of this conversation' })

  const { data: existing } = await supabase.from('message_hypes')
    .select('user_id').eq('message_id', messageId).eq('user_id', user.id).maybeSingle()

  if (existing) {
    await supabase.from('message_hypes').delete().eq('message_id', messageId).eq('user_id', user.id)
  } else {
    await supabase.from('message_hypes').insert({ message_id: messageId, user_id: user.id })
  }

  const { data: updated } = await supabase.from('messages').select('hype_count').eq('id', messageId).maybeSingle()
  res.json({ hyped: !existing, hype_count: updated?.hype_count ?? 0 })
})

export default router
