import { useState, useEffect, useRef } from 'react'
import { Heart, Send, Loader2, CornerDownRight, Upload, Trash2 } from 'lucide-react'
import ShareSheet from './ShareSheet'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CommentItem({ comment, session, accentColor, onReply, onShare, onDelete, initialHyped }) {
  const [hyped, setHyped] = useState(initialHyped ?? false)
  const [count, setCount] = useState(comment.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hypeTimerRef = useRef(null)
  const hypeServerRef = useRef(initialHyped ?? false)
  const isAuth = session?.type === 'user'
  const isOwner = isAuth && session?.userId && comment.user_id === session.userId

  function toggleHype() {
    if (!isAuth) {
      window.dispatchEvent(new CustomEvent('thots:needs-auth'))
      return
    }
    const token = useAppStore.getState().session?.supabaseToken
    if (!token) { window.dispatchEvent(new CustomEvent('thots:needs-auth')); return }

    // Optimistic: flip immediately, play animation
    const currentHyped = !hypeTimerRef.current
      ? hypeServerRef.current
      : (hyped) // use current UI state if timer pending
    const next = !hyped
    setHyped(next)
    setCount(c => next ? c + 1 : Math.max(0, c - 1))
    setHeartAnim(true)

    // Debounce: only fire API if net change vs last known server state
    clearTimeout(hypeTimerRef.current)
    hypeTimerRef.current = setTimeout(async () => {
      hypeTimerRef.current = null
      const desired = next
      const serverState = hypeServerRef.current
      if (desired === serverState) return // no net change, skip

      const res = await fetch(`${API_URL}/comments/${comment.id}/hype`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        // Revert to server state
        setHyped(serverState)
        setCount(c => desired ? Math.max(0, c - 1) : c + 1)
        return
      }
      const data = await res.json()
      hypeServerRef.current = data.hyped
      setHyped(data.hyped)
      setCount(data.hype_count)
    }, 350)
  }

  async function handleDelete() {
    if (!isOwner || deleting) return
    setDeleting(true)
    try {
      const token = useAppStore.getState().session?.supabaseToken
      const res = await fetch(`${API_URL}/comments/${comment.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onDelete(comment.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 py-2.5 border-b border-white/5 last:border-0">
      {/* Author + timestamp */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] sm:text-xs font-semibold" style={{ color: accentColor }}>
          {comment.pen_name}
        </span>
        <span className="text-slate-600 text-[10px]">{relativeTime(comment.created_at)}</span>
      </div>

      {/* Content */}
      <p className="text-white text-xs sm:text-sm leading-snug">
        {comment.reply_to_pen_name && (
          <span className="font-semibold mr-1" style={{ color: accentColor }}>
            @{comment.reply_to_pen_name}
          </span>
        )}
        {comment.reply_to_pen_name
          ? comment.content.replace(new RegExp(`^@${comment.reply_to_pen_name}\\s*`), '')
          : comment.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-0.5">
        <div className="relative group/tip">
          <button
            onClick={toggleHype}
            className="flex items-center gap-1 transition-colors"
            style={{
              color: hyped ? accentColor : '#64748b',
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer',
            }}
          >
            <Heart size={14} className={heartAnim ? 'heart-pop' : ''} onAnimationEnd={() => setHeartAnim(false)} style={{ fill: hyped ? accentColor : 'none', strokeWidth: 1.5 }} />
            {count > 0 && <span className="text-xs">{count}</span>}
          </button>
          <span className="action-tip">{hyped ? 'Unlike' : 'Like'}</span>
        </div>

        {isAuth && (
          <button
            onClick={() => onReply(comment.pen_name)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <CornerDownRight size={13} />
            Reply
          </button>
        )}

        <button
          onClick={() => onShare(comment)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Upload size={13} />
          Share
        </button>

        {isOwner && (
          <div className="relative group/tip ml-auto">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {deleting
                ? <Loader2 size={11} className="animate-spin" />
                : <Trash2 size={13} />
              }
            </button>
            <span className="action-tip">Delete</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommentThread({ thotId, accentColor, session, autoFocus }) {
  const [comments, setComments] = useState([])
  const [hypedIds, setHypedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [sharingComment, setSharingComment] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (autoFocus && !loading) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [autoFocus, loading])

  function autoResize(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }
  const isAuth = session?.type === 'user'

  useEffect(() => {
    const token = useAppStore.getState().session?.supabaseToken

    const fetchComments = fetch(`${API_URL}/comments?thot_id=${thotId}`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])

    const fetchHyped = token
      ? fetch(`${API_URL}/comments/my-hypes?thot_id=${thotId}`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : []).catch(() => [])
      : Promise.resolve([])

    Promise.all([fetchComments, fetchHyped]).then(([commentData, hypedData]) => {
      setComments(commentData)
      setHypedIds(new Set(hypedData))
    }).finally(() => setLoading(false))
  }, [thotId])

  function handleReply(penName) {
    setReplyingTo(penName)
    setText(`@${penName} `)
    textareaRef.current?.focus()
    setTimeout(() => {
      const el = textareaRef.current
      if (el) el.selectionStart = el.selectionEnd = el.value.length
    }, 0)
  }

  function handleTextChange(val) {
    setText(val.slice(0, 280))
    if (replyingTo && !val.startsWith(`@${replyingTo}`)) setReplyingTo(null)
  }

  function handleCommentDeleted(commentId) {
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  async function postComment() {
    if (!text.trim() || posting || !isAuth) return
    setPosting(true)
    try {
      const token = useAppStore.getState().session?.supabaseToken
      const body = { thot_id: thotId, content: text.trim() }
      if (replyingTo) body.reply_to_pen_name = replyingTo
      const res = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      const newComment = await res.json()
      setComments(prev => [...prev, newComment])
      setText('')
      setReplyingTo(null)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04]">
      {!loading && comments.length > 0 && (
        <p className="text-slate-500 text-[10px] mb-2">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </p>
      )}

      {!loading && comments.length > 0 && (
        <div className="mb-3">
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              session={session}
              accentColor={accentColor}
              onReply={handleReply}
              onShare={setSharingComment}
              onDelete={handleCommentDeleted}
              initialHyped={hypedIds.has(c.id)}
            />
          ))}
        </div>
      )}

      {isAuth ? (
        <div className="flex flex-col gap-1.5">
          {replyingTo && (
            <div className="flex items-center justify-between px-2 py-1 rounded-lg" style={{ background: `${accentColor}15` }}>
              <span className="text-[10px]" style={{ color: accentColor }}>Replying to @{replyingTo}</span>
              <button
                onClick={() => { setReplyingTo(null); setText('') }}
                className="text-slate-500 hover:text-slate-300 text-[10px] transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >Cancel</button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => { handleTextChange(e.target.value); autoResize(e.target) }}
              onKeyDown={e => {}}
              placeholder={replyingTo ? `@${replyingTo}…` : 'Comment…'}
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-white/20 transition-colors"
              style={{ minHeight: 34, maxHeight: 160, overflowY: 'auto', fontSize: 16 }}
            />
            <button
              onClick={postComment}
              disabled={!text.trim() || posting}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              style={{ background: accentColor, color: '#fff' }}
            >
              {posting ? <Loader2 size={13} className="animate-spin" /> : <><Send size={12} />Reply</>}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-slate-600 text-[10px]">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thots:needs-auth'))}
            className="text-brand-purple underline cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0 }}
          >Sign in</button>{' '}to comment
        </p>
      )}

      {sharingComment && (
        <ShareSheet
          thot={sharingComment}
          urlOverride={`${window.location.origin}/c/${sharingComment.id}`}
          titleOverride="Share this comment"
          onClose={() => setSharingComment(null)}
        />
      )}
    </div>
  )
}
