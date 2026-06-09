import { useState } from 'react'
import { X, Link2, Share2 } from 'lucide-react'

export default function ShareSheet({ thot, onClose, urlOverride, titleOverride }) {
  const [copied, setCopied] = useState(false)
  const url = urlOverride ?? `${window.location.origin}/t/${thot.id}`
  const title = titleOverride ?? 'Share this thot'

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        {/* Modal — stop clicks bubbling to backdrop */}
        <div
          className="w-full max-w-sm rounded-2xl px-5 pt-5 pb-6"
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

          {/* Thot preview */}
          <div
            className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-white/75 text-xs leading-relaxed line-clamp-3">{thot.content}</p>
            <p className="text-slate-600 text-[10px] mt-1.5 break-all font-mono">{url}</p>
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
    </>
  )
}
