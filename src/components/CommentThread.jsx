import { useState, useEffect, useRef } from 'react'
import { Heart, Send, Loader2, CornerDownRight, Upload } from 'lucide-react'
import ShareSheet from './ShareSheet'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CommentItem({ comment, session, accentColor, onReply, onShare }) {
  const [hyped, setHyped] = useState(false)
  const [count, setCount] = useState(comment.hype_count ?? 0)
  const isAuth = session?.type === 'user'

  async function toggleHype() {
    if (!isAuth) return
    const res = await fetch(`${API_URL}/comments/${comment.id}/hype`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${session.supabaseToken}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setHyped(data.hyped)
    setCount(data.hype_count)
  }

  return (
    <div className="flex flex-col gap-1 py-2.5 border-b border-white/5 last:border-0">
      {/* Author + timestamp */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold" style={{ color: accentColor }}>
          {comment.pen_name}
        </span>
        <span className="text-slate-600 text-[10px]">{relativeTime(comment.created_at)}</span>
      </div>

      {/* Content */}
      <p className="text-white text-xs leading-snug">
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
        <button
          onClick={toggleHype}
          className="flex items-center gap-1 transition-colors"
          style={{
            color: hyped ? accentColor : 'rgba(255,255,255,0.3)',
            background: 'none', border: 'none', padding: 0,
            cursor: isAuth ? 'pointer' : 'default',
            opacity: isAuth ? 1 : 0.5,
          }}
        >
          <Heart size={11} style={{ fill: hyped ? accentColor : 'none', strokeWidth: 1.5 }} />
          {count > 0 && <span className="text-[10px]">{count}</span>}
        </button>

        {isAuth && (
          <button
            onClick={() => onReply(comment.pen_name)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <CornerDownRight size={11} />
            Reply
          </button>
        )}

        <button
          onClick={() => onShare(comment)}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Upload size={11} />
          Share
        </button>
      </div>
    </div>
  )
}

export default function CommentThread({ thotId, accentColor, session }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [sharingComment, setSharingComment] = useState(null)
  const textareaRef = useRef(null)
  const isAuth = session?.type === 'user'

  useEffect(() => {
    fetch(`${API_URL}/comments?thot_id=${thotId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setComments(data))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
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

  async function postComment() {
    if (!text.trim() || posting || !isAuth) return
    setPosting(true)
    try {
      const body = { thot_id: thotId, content: text.trim() }
      if (replyingTo) body.reply_to_pen_name = replyingTo
      const res = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.supabaseToken}` },
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
    <div className="mt-2 pt-2 border-t border-white/8">
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
              onChange={e => handleTextChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
              placeholder={replyingTo ? `Reply to @${replyingTo}…` : 'Add a comment…'}
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-white/20 text-xs transition-colors"
              style={{ minHeight: 34 }}
            />
            <button
              onClick={postComment}
              disabled={!text.trim() || posting}
              className="flex-shrink-0 rounded-xl p-2 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              style={{ background: accentColor }}
            >
              {posting ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} className="text-white" />}
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
