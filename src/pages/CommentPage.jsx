import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, MapPin, ArrowLeft } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const ACCENT = '#e11d48'
const PURPLE = '#7c3aed'

function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function CommentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comment, setComment] = useState(null)
  const [parentThot, setParentThot] = useState(null)
  const [location, setLocation] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/comments/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(async c => {
        setComment(c)
        // Fetch parent thot for context
        const tr = await fetch(`${API_URL}/thots/${c.thot_id}`)
        if (tr.ok) setParentThot(await tr.json())
      })
      .catch(() => setNotFound(true))
  }, [id])

  // Reverse-geocode parent thot's location
  useEffect(() => {
    if (!parentThot?.lat || !parentThot?.lng) return
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${parentThot.lat}&lon=${parentThot.lng}&format=json&zoom=12`, {
      headers: { 'Accept-Language': 'en' },
    })
      .then(r => r.json())
      .then(d => {
        const parts = [d.address?.neighbourhood || d.address?.suburb, d.address?.city || d.address?.town].filter(Boolean)
        setLocation(parts.join(', '))
      })
      .catch(() => {})
  }, [parentThot])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#0a0a0f', fontFamily: 'Inter, sans-serif' }}>

      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <MapPin size={20} style={{ color: ACCENT }} />
          <span className="text-white font-bold text-lg tracking-tight">dropathot</span>
        </div>

        {notFound ? (
          <div className="text-center">
            <p className="text-white font-semibold mb-1">Comment not found</p>
            <p className="text-slate-500 text-sm">It may have been removed.</p>
          </div>
        ) : !comment ? (
          <div className="text-center text-slate-500 text-sm animate-pulse">Loading…</div>
        ) : (
          <>
            {/* Parent thot context */}
            {parentThot && (
              <div className="rounded-2xl px-4 py-3 mb-3 opacity-60"
                style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${PURPLE}30`, border: `1px solid ${PURPLE}50` }}>
                    <span style={{ color: PURPLE, fontSize: 9 }}>▲</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: PURPLE }}>
                    {parentThot.pen_name || 'anon'}
                  </span>
                  <span className="text-slate-600 text-[10px]">{relativeTime(parentThot.created_at)}</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{parentThot.content}</p>
              </div>
            )}

            {/* The comment — highlighted */}
            <div className="rounded-2xl px-4 py-4 mb-6"
              style={{ background: '#0e0e1a', border: `1px solid ${ACCENT}40` }}>
              {/* Author */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${ACCENT}25`, border: `1px solid ${ACCENT}50` }}>
                  <span style={{ color: ACCENT, fontSize: 11 }}>◆</span>
                </div>
                <div>
                  <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                    {comment.pen_name}
                  </span>
                  <span className="text-slate-600 text-[10px] ml-2">{relativeTime(comment.created_at)}</span>
                </div>
              </div>

              {/* Content */}
              <p className="text-white text-sm leading-relaxed">
                {comment.reply_to_pen_name && (
                  <span className="font-semibold mr-1" style={{ color: ACCENT }}>
                    @{comment.reply_to_pen_name}
                  </span>
                )}
                {comment.reply_to_pen_name
                  ? comment.content.replace(new RegExp(`^@${comment.reply_to_pen_name}\\s*`), '')
                  : comment.content}
              </p>

              {/* Hype count */}
              {comment.hype_count > 0 && (
                <div className="flex items-center gap-1 mt-3">
                  <Heart size={13} style={{ fill: ACCENT, color: ACCENT }} />
                  <span className="text-xs" style={{ color: ACCENT }}>{comment.hype_count}</span>
                </div>
              )}

              {/* Location */}
              {location && (
                <p className="text-slate-600 text-[10px] mt-3">{location}</p>
              )}
            </div>

            {/* CTA */}
            <a
              href="/"
              className="block w-full text-center py-3.5 rounded-2xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: ACCENT }}
            >
              Open dropathot
            </a>
          </>
        )}
      </div>
    </div>
  )
}
