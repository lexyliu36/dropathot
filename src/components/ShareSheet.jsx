import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Link2, Share2, Heart, MessageCircle, MapPin } from 'lucide-react'
import { AnonAvatar } from './ThotPin'
import { reverseGeocode } from '../lib/geocode.js'

function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function accentFor(penName) {
  return penName ? '#7c3aed' : '#64748b'
}

export default function ShareSheet({ thot, onClose, urlOverride, titleOverride }) {
  const [copied, setCopied] = useState(false)
  const [locationLabel, setLocationLabel] = useState(thot.city ?? null)

  const url = urlOverride ?? `${window.location.origin}/t/${thot.id}`
  const title = titleOverride ?? 'Share this thot'
  const accent = accentFor(thot.pen_name)

  useEffect(() => {
    if (locationLabel) return
    if (!thot.lat || !thot.lng) return
    reverseGeocode(thot.lat, thot.lng).then(label => {
      if (label) setLocationLabel(label)
    })
  }, [thot.lat, thot.lng])

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareVia() {
    if (navigator.share) {
      navigator.share({ title: 'drop-a-thot', text: thot.content, url }).catch(() => {})
    } else {
      copyLink()
    }
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-2xl px-5 pt-5 pb-6 panel-slide-up"
          style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.1)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-sm">{title}</span>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-1 cursor-pointer"
              style={{ background: 'none', border: 'none' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Thot card preview */}
          <div
            className="rounded-xl px-4 py-3.5 mb-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <AnonAvatar size={28} color={accent} />
              <div>
                <span className="text-sm font-semibold leading-tight" style={{ color: accent }}>
                  {thot.pen_name || 'Anonymous'}
                </span>
                <p className="text-slate-500 text-[10px]">{relativeTime(thot.created_at)}</p>
              </div>
            </div>

            <p className="text-white text-sm font-semibold leading-snug line-clamp-4 mb-3">
              {thot.content}
            </p>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                <Heart size={11} /> {thot.hype_count ?? 0}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                <MessageCircle size={11} /> {thot.comment_count ?? 0}
              </span>
              {locationLabel && (
                <span className="flex items-center gap-1 text-slate-500 text-[11px] ml-auto">
                  <MapPin size={10} />
                  {locationLabel}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              style={{
                background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)',
                border: copied ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: copied ? '#4ade80' : '#fff',
              }}
            >
              <Link2 size={15} />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={shareVia}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            >
              <Share2 size={15} />
              Share via...
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
