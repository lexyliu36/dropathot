import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Heart } from 'lucide-react'
import { AnonAvatar } from './ThotPin'
import useAppStore from '../stores/useAppStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const CLUMP_MS = 60_000 // messages within 60s from same sender are grouped

function clumpMessages(messages) {
  return messages.map((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const clumpedWithPrev = prev &&
      prev.from_user_id === msg.from_user_id &&
      new Date(msg.created_at) - new Date(prev.created_at) < CLUMP_MS
    const clumpedWithNext = next &&
      next.from_user_id === msg.from_user_id &&
      new Date(next.created_at) - new Date(msg.created_at) < CLUMP_MS
    return { ...msg, isFirst: !clumpedWithPrev, isLast: !clumpedWithNext }
  })
}

function MessageBubble({ msg, isOwn, isFirst, isLast }) {
  const [hyped, setHyped] = useState(msg.i_hyped ?? false)
  const [count, setCount] = useState(msg.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)
  const hypeTimerRef = useRef(null)
  const hypeServerRef = useRef(msg.i_hyped ?? false)

  function toggleHype() {
    const token = useAppStore.getState().session?.supabaseToken
    if (!token) return
    const next = !hyped
    setHyped(next)
    setCount(c => next ? c + 1 : Math.max(0, c - 1))
    setHeartAnim(true)
    clearTimeout(hypeTimerRef.current)
    hypeTimerRef.current = setTimeout(async () => {
      hypeTimerRef.current = null
      if (next === hypeServerRef.current) return
      const res = await fetch(`${API_URL}/messages/${msg.id}/hype`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setHyped(hypeServerRef.current)
        setCount(c => next ? Math.max(0, c - 1) : c + 1)
        return
      }
      const data = await res.json()
      hypeServerRef.current = data.hyped
      setHyped(data.hyped)
      setCount(data.hype_count)
    }, 350)
  }

  // Border radius: "tail" corner is on last bubble in a group; middle bubbles lose both same-side corners
  const ownRadius = isFirst && isLast ? 'rounded-2xl rounded-tr-sm'
    : isFirst ? 'rounded-2xl rounded-tr-sm rounded-br-sm'
    : isLast  ? 'rounded-2xl'
    : 'rounded-2xl rounded-r-[5px]'
  const otherRadius = isFirst && isLast ? 'rounded-2xl rounded-tl-sm'
    : isFirst ? 'rounded-2xl rounded-tl-sm rounded-bl-sm'
    : isLast  ? 'rounded-2xl'
    : 'rounded-2xl rounded-l-[5px]'

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${isLast ? 'mb-4' : 'mb-0.5'}`}>
      <div
        className={`relative group max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
          isOwn
            ? `bg-brand-red/20 text-white ${ownRadius}`
            : `bg-white/[0.07] text-slate-200 ${otherRadius}`
        }`}
      >
        {msg.content}
        {/* hype button */}
        <button
          onClick={toggleHype}
          className={`absolute -bottom-4 ${isOwn ? 'left-1' : 'right-1'} flex items-center gap-0.5 cursor-pointer transition-opacity ${
            hyped || count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
            hyped ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/10 border border-white/10'
          }`}>
            <Heart
              size={9}
              className={`${hyped ? 'text-red-400 fill-red-400' : 'text-slate-400'}`}
              style={{ transform: heartAnim ? 'scale(1.5)' : 'scale(1)', transition: 'transform 0.15s ease' }}
              onTransitionEnd={() => setHeartAnim(false)}
            />
            {count > 0 && <span className={hyped ? 'text-red-400' : 'text-slate-500'}>{count}</span>}
          </div>
        </button>
      </div>
      {isLast && <span className="text-slate-700 text-[9px] mt-1.5 px-1">{relativeTime(msg.created_at)}</span>}
    </div>
  )
}

export default function DMDrawer({ partner, onClose }) {
  // partner: { userId, penName, accentColor }
  const session = useAppStore(s => s.session)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const token = session?.supabaseToken
  const myId = session?.id

  const loadMessages = useCallback(async () => {
    if (!token || !partner?.userId) return
    try {
      const res = await fetch(`${API_URL}/messages/${partner.userId}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (e) {
      console.error('DM load failed', e)
    } finally {
      setLoading(false)
    }
  }, [token, partner?.userId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // poll every 8s for new messages
  useEffect(() => {
    const id = setInterval(loadMessages, 8000)
    return () => clearInterval(id)
  }, [loadMessages])

  async function sendMessage(e) {
    e?.preventDefault()
    const content = text.trim()
    if (!content || sending || !token) return
    setSending(true)
    setText('')
    const optimistic = {
      id: `opt-${Date.now()}`,
      from_user_id: myId,
      to_user_id: partner.userId,
      content,
      hype_count: 0,
      i_hyped: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    try {
      const res = await fetch(`${API_URL}/messages/${partner.userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const saved = await res.json()
        setMessages(prev => prev.map(m => m.id === optimistic.id ? saved : m))
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setText(content)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const accentColor = partner?.accentColor || '#7c3aed'

  return (
    <div className="absolute top-3 bottom-3 left-3 right-3 z-50 flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden panel-fade-overlay sm:left-auto sm:w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <AnonAvatar size={28} color={accentColor} active={false} />
          <div>
            <span className="font-semibold text-sm" style={{ color: accentColor }}>
              {partner?.penName || 'Anonymous'}
            </span>
            <p className="text-slate-600 text-[10px]">private message</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
          style={{ background: 'none', border: 'none' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-600 text-xs">Loading…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-60">
            <div className="text-3xl">✉️</div>
            <p className="text-slate-600 text-xs text-center">
              Start a conversation with {partner?.penName || 'them'}
            </p>
          </div>
        ) : (
          clumpMessages(messages).map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.from_user_id === myId}
              isFirst={msg.isFirst}
              isLast={msg.isLast}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <form
        onSubmit={sendMessage}
        className="flex items-end gap-2 px-3 pb-3 pt-2 border-t border-white/[0.05] flex-shrink-0"
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder="Say something…"
          maxLength={1000}
          rows={1}
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 resize-none outline-none focus:border-white/20 transition-colors leading-relaxed"
          style={{ minHeight: '36px', maxHeight: '100px', overflowY: 'auto', fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="p-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer flex-shrink-0"
          style={{
            background: text.trim() ? 'rgba(225,29,72,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${text.trim() ? 'rgba(225,29,72,0.4)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <Send size={14} className={text.trim() ? 'text-brand-red' : 'text-slate-500'} />
        </button>
      </form>
    </div>
  )
}
