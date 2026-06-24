import { useState, useEffect } from 'react'
import { reverseGeocode } from '../lib/geocode.js'

function GeoLabel({ lat, lng }) {
  const [label, setLabel] = useState(null)
  useEffect(() => {
    if (lat != null && lng != null) reverseGeocode(lat, lng).then(l => { if (l) setLabel(l) })
  }, [lat, lng])
  if (!label) return null
  return <span className="text-slate-600 text-[10px]">{label}</span>
}
import { X, Heart, Upload, Star, MessageCircle, Clock } from 'lucide-react'
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

function ThotRow({ thot, rank, session, onHype, onFlyTo, onClose, onSelectThot, onCommentClick, setShareThot }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      {rank != null && (
        <span className="text-slate-600 text-sm font-mono w-5 mt-0.5 flex-shrink-0">
          #{rank + 1}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => { onFlyTo?.(thot); onClose?.() }}
          className="w-full text-left hover:opacity-80 transition-opacity cursor-pointer text-white text-xs sm:text-sm leading-snug line-clamp-2"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          {thot.content}
        </button>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
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
        <div className="-mt-1.5 mb-1.5"><GeoLabel lat={thot.lat} lng={thot.lng} /></div>
        <div className="flex items-center">
          {/* Heart — fixed 52px holds icon + up to "1.1M" */}
          <div style={{ width: '52px', flexShrink: 0 }}>
            <LeaderboardHeart thot={thot} session={session} onHype={onHype} />
          </div>
          {/* Comment — fixed 52px */}
          <div className="relative group/tip" style={{ width: '52px', flexShrink: 0 }}>
            <button
              onClick={() => { onCommentClick?.(thot); onFlyTo?.(thot) }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <MessageCircle size={17} style={{ flexShrink: 0 }} />
              {(thot.comment_count ?? 0) > 0 && <span className="text-xs tabular-nums">{formatCount(thot.comment_count ?? 0)}</span>}
            </button>
            <span className="action-tip">Comments</span>
          </div>
          {/* Share — fixed 36px, icon only */}
          <div className="relative group/tip" style={{ width: '36px', flexShrink: 0 }}>
            <button
              onClick={() => {
                const liveCount = useAppStore.getState().thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0
                setShareThot({ ...thot, hype_count: liveCount })
              }}
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
  )
}

export default function TopThots({ thots, session, onHype, onClose, onSelectThot, onCommentClick, onFlyTo }) {
  const [tab, setTab] = useState('top') // 'top' | 'latest'
  const [shareThot, setShareThot] = useState(null)

  const ranked = [...thots]
    .sort((a, b) =>
      (b.hype_count ?? 0) - (a.hype_count ?? 0) ||
      new Date(b.created_at) - new Date(a.created_at)
    )
    .slice(0, 10)

  const latest = [...thots]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20)

  const list = tab === 'top' ? ranked : latest

  return (
    <div className="absolute top-3 right-3 bottom-3 z-30 w-72 flex flex-col bg-[#0e0e1a] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden panel-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Star size={16} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
          <span className="text-white font-bold text-sm tracking-tight">Nearby Thots</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          style={{ border: 'none' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-white/[0.05] flex-shrink-0">
        <button
          onClick={() => setTab('top')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
          style={{
            background: 'none', border: 'none',
            color: tab === 'top' ? '#f59e0b' : '#64748b',
            borderBottom: tab === 'top' ? '2px solid #f59e0b' : '2px solid transparent',
          }}
        >
          <Star size={12} style={{ fill: tab === 'top' ? '#f59e0b' : 'none', color: tab === 'top' ? '#f59e0b' : '#64748b' }} />
          Top
        </button>
        <button
          onClick={() => setTab('latest')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
          style={{
            background: 'none', border: 'none',
            color: tab === 'latest' ? '#7c3aed' : '#64748b',
            borderBottom: tab === 'latest' ? '2px solid #7c3aed' : '2px solid transparent',
          }}
        >
          <Clock size={12} />
          Latest
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
          {tab === 'top'
            ? 'Top thots in the current view — zooming out surfaces the best from a wider area.'
            : 'Most recent drops in the current view.'}
        </p>

        {shareThot && <ShareSheet thot={shareThot} onClose={() => setShareThot(null)} />}

        {list.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-10">No drops nearby yet</p>
        ) : (
          list.map((thot, i) => (
            <ThotRow
              key={thot.id}
              thot={thot}
              rank={tab === 'top' ? i : null}
              session={session}
              onHype={onHype}
              onFlyTo={onFlyTo}
              onClose={onClose}
              onSelectThot={onSelectThot}
              onCommentClick={onCommentClick}
              setShareThot={setShareThot}
            />
          ))
        )}
      </div>
    </div>
  )
}
