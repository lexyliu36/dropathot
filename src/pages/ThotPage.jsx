import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Upload, MapPin } from 'lucide-react'
import { AnonAvatar } from '../components/ThotPin'
import ShareSheet from '../components/ShareSheet'
import { reverseGeocode } from '../lib/geocode.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ThotPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [thot, setThot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [locationName, setLocationName] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/thots/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(data => setThot(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!thot?.lat || !thot?.lng) return
    reverseGeocode(thot.lat, thot.lng).then(label => {
      if (label) setLocationName(label)
    })
  }, [thot?.lat, thot?.lng])

  const accentColor = thot?.pen_name ? '#7c3aed' : '#64748b'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: '#0a0a0f', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-black tracking-tight" style={{ color: '#e11d48' }}>
          drop-a-thot
        </span>
        <p className="text-slate-500 text-xs mt-1">anonymous thoughts, dropped on a map</p>
      </div>

      {loading && <div className="text-slate-500 text-sm">Loading…</div>}

      {notFound && (
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-1">This thot has been removed or doesn't exist.</p>
          <p className="text-slate-600 text-xs">The author may have deleted it.</p>
        </div>
      )}

      {thot && (
        <div
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Thot card */}
          <div className="px-5 py-5">
            <div className="flex items-start gap-3 mb-3">
              <AnonAvatar size={36} color={accentColor} />
              <div>
                <span className="text-xs font-semibold" style={{ color: accentColor }}>
                  {thot.pen_name || 'anon'}
                </span>
                <p className="text-slate-600 text-[10px]">{relativeTime(thot.created_at)}</p>
              </div>
            </div>

            <p className="text-white text-sm leading-relaxed mb-4">{thot.content}</p>

            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Heart size={15} />
                <span className="text-xs">{thot.hype_count ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <MessageCircle size={15} />
                <span className="text-xs">{thot.comment_count ?? 0}</span>
              </div>
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer ml-auto"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <Upload size={15} />
                <span className="text-xs">Share</span>
              </button>
            </div>
          </div>

          {/* Location footer */}
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <MapPin size={12} className="text-slate-600 flex-shrink-0" />
            <span className="text-slate-600 text-[11px]">
              {locationName ?? 'Dropped somewhere on the map'}
            </span>
          </div>
        </div>
      )}

      {!loading && !notFound && (
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            style={{ background: '#e11d48', color: '#fff', border: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = '#be123c'}
            onMouseLeave={e => e.currentTarget.style.background = '#e11d48'}
          >
            Open drop-a-thot
          </button>
          <p className="text-slate-600 text-xs mt-3">See where this was dropped on the map</p>
        </div>
      )}

      {showShare && thot && <ShareSheet thot={thot} onClose={() => setShowShare(false)} />}
    </div>
  )
}
