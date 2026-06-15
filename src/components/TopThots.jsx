import { useState } from 'react'
import { X, Heart, Upload, Star, MessageCircle } from 'lucide-react'
import ShareSheet from './ShareSheet'
import useAppStore from '../stores/useAppStore'

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatCount(n) {
  if (!n) return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function LeaderboardHeart({ thot, session, onHype }) {
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  return (
    <div className="relative group/tip">
      <button
        onClick={() => session?.type === 'user'
          ? onHype?.(thot.id)
          : window.dispatchEvent(new CustomEvent('thots:needs-auth'))
        }
        className="flex items-center gap-1 transition-colors cursor-pointer"
        style={{ background: 'none', border: 'none', padding: 0, color: hyped ? '#e11d48' : '#64748b' }}
      >
        <Heart size={17} style={{ fill: hyped ? '#e11d48' : 'none', color: hyped ? '#e11d48' : '#64748b', flexShrink: 0 }} />
        <span className="text-xs tabular-nums" style={{ minWidth: hypeCount > 0 ? '1ch' : 0 }}>{formatCount(hypeCount)}</span>
      </button>
      <span className="action-tip">{hyped ? 'Unlike' : 'Like'}</span>
    </div>
  )
}

export default function TopThots({ thots, session, onHype, onClose, onSelectThot, onCommentClick }) {
  const [shareThot, setShareThot] = useState(null)

  const ranked = [...thots]
    .sort((a, b) =>
      (b.hype_count ?? 0) - (a.hype_count ?? 0) ||
      new Date(b.created_at) - new Date(a.created_at)
    )
    .slice(0, 10)

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Star size={16} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
          <span className="text-white font-bold text-sm tracking-tight">Top Thots</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          style={{ border: 'none' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
          Top thots in the current view — zooming out surfaces the best from a wider area.
        </p>

        {shareThot && <ShareSheet thot={shareThot} onClose={() => setShareThot(null)} />}

        {ranked.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-10">No drops nearby yet</p>
        ) : (
          ranked.map((thot, i) => (
            <div key={thot.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
              <span className="text-slate-600 text-sm font-mono w-5 mt-0.5 flex-shrink-0">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs sm:text-sm leading-snug line-clamp-2">{thot.content}</p>
                {/* Row 1: pen name + timestamp */}
                <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                  {thot.pen_name ? (
                    <button
                      onClick={() => onSelectThot?.(thot)}
                      className="text-xs sm:text-sm font-semibold cursor-pointer hover:opacity-75 transition-opacity truncate"
                      style={{ background: 'none', border: 'none', padding: 0, color: '#7c3aed' }}
                    >
                      {thot.pen_name}
                    </button>
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: '#475569' }}>anon</span>
                  )}
                  <span className="text-slate-600 text-[10px] flex-shrink-0">{relativeTime(thot.created_at)}</span>
                </div>
                {/* Row 2: fixed-width slots so icons always align vertically */}
                <div className="flex items-center mt-1">
                  {/* Heart slot — fixed 48px */}
                  <div style={{ width: '48px', flexShrink: 0 }}>
                    <LeaderboardHeart thot={thot} session={session} onHype={onHype} />
                  </div>
                  {/* Comment slot — fixed 48px */}
                  <div className="relative group/tip" style={{ width: '48px', flexShrink: 0 }}>
                    <button
                      onClick={() => onCommentClick?.(thot)}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      <MessageCircle size={17} style={{ flexShrink: 0 }} />
                      <span className="text-xs tabular-nums">{formatCount(thot.comment_count ?? 0)}</span>
                    </button>
                    <span className="action-tip">Comments</span>
                  </div>
                  {/* Share */}
                  <div className="relative group/tip">
                    <button
                      onClick={() => setShareThot(thot)}
                      className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      <Upload size={17} />
                    </button>
                    <span className="action-tip">Share</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
