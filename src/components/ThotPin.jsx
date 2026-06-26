import { useState, useRef, useEffect } from 'react'
import { Heart } from 'lucide-react'
import useAppStore from '../stores/useAppStore'

export function AnonAvatar({ size = 44, color = '#7c3aed', active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Pin outer shape: circle top, tapers to point at bottom */}
      <path
        d="M22 1 A17 17 0 0 1 39 18 C39 28 30 38 22 43 C14 38 5 28 5 18 A17 17 0 0 1 22 1 Z"
        fill={color} fillOpacity="0.18"
        stroke={color} strokeWidth={active ? 2.5 : 2}
      />

      {/* Inner ring */}
      <circle cx="22" cy="18" r="13" stroke={color} strokeWidth="1" strokeOpacity="0.35" fill="none"/>

      {/* Person silhouette — head */}
      <circle cx="22" cy="13" r="5" fill={color} fillOpacity="0.65"/>

      {/* Person silhouette — shoulders */}
      <ellipse cx="22" cy="25" rx="9" ry="6" fill={color} fillOpacity="0.5"/>
    </svg>
  )
}


// Sunglasses overlay — rendered on top of any pin in incognito mode
function GlassesOverlay({ size = 36 }) {
  // Sunglasses positioned over the "head" circle of AnonAvatar (cx=22 cy=13 r=5 in 44-unit space)
  // Scale factor from 44-unit viewBox to rendered size
  const scale = size / 44
  const w = size
  const h = size * 0.5  // only need top half
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 44 22"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      {/* Left lens */}
      <rect x="8" y="10" width="11" height="7" rx="3.5" fill="#1a1a2e" fillOpacity="0.95" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Right lens */}
      <rect x="25" y="10" width="11" height="7" rx="3.5" fill="#1a1a2e" fillOpacity="0.95" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Bridge */}
      <line x1="19" y1="13" x2="25" y2="13" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Left arm */}
      <line x1="8" y1="13" x2="4" y2="13" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Right arm */}
      <line x1="36" y1="13" x2="40" y2="13" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Left lens shine */}
      <line x1="10" y1="12" x2="13" y2="12" stroke="white" strokeWidth="0.8" strokeOpacity="0.4"/>
      {/* Right lens shine */}
      <line x1="27" y1="12" x2="30" y2="12" stroke="white" strokeWidth="0.8" strokeOpacity="0.4"/>
    </svg>
  )
}

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Returns 'online', a relative string like '5m ago', or 'offline' (>24h or null)
export function onlineStatus(lastSeen) {
  if (!lastSeen) return null
  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const diffMin = diffMs / 60_000
  if (diffMin < 2) return 'online'
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`
  const diffHr = diffMin / 60
  if (diffHr < 24) return `${Math.floor(diffHr)}h ago`
  return 'offline'
}

export function pinAgeHours(thot) {
  return (Date.now() - new Date(thot.created_at).getTime()) / 3_600_000
}

const AVATAR_SIZE = 36
const bubbleBottom = AVATAR_SIZE + 10
const bubbleLeft   = 0

export default function ThotPin({ thot, isYou = false, onClick, onHype, session }) {
  const isIncognito = thot?.is_incognito ?? false
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed when this pin is explicitly revealed (e.g. clicked from ProfileSheet)
  useEffect(() => {
    const handler = (e) => { if (e.detail?.thotId === thot.id) setDismissed(false) }
    window.addEventListener('thot:reveal', handler)
    return () => window.removeEventListener('thot:reveal', handler)
  }, [thot.id])
  const [hovered, setHovered] = useState(false)

  // Read live hype state + count from store so updates from any hype action reflect immediately
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)
  const isAuth = useAppStore((s) => s.session?.type === 'user')

  const pinType = thot.pin_type || null
  const isPending = thot._pending === true
  // Color map — add new pin_type entries here as automated sources are added
  const PIN_COLORS = { news: '#16a34a', event: '#d97706' }
  const accentColor = isPending ? '#fbbf24' : isYou ? '#e11d48' : PIN_COLORS[pinType] ?? (thot.pen_name ? '#7c3aed' : '#64748b')
  const isNew = thot._isNew || (Date.now() - new Date(thot.created_at).getTime()) < 15_000
  const mob = typeof window !== 'undefined' && window.innerWidth <= 640

  // Accidental-tap guards:
  //   touchOrigin — records where the finger landed so we can measure drift
  //   wasPinch    — set true if >1 finger was ever on screen during this touch sequence
  const touchOrigin = useRef(null)
  const wasPinch = useRef(false)

  return (
    <div
      style={{
        position: 'relative',
        width: `${AVATAR_SIZE}px`,
        height: `${AVATAR_SIZE}px`,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {/* Bubble — floats above the avatar, visibility:hidden when dismissed to preserve layout */}
      <div
        onMouseEnter={() => !dismissed && setHovered(true)}
        onTouchStart={(e) => {
          wasPinch.current = e.touches.length > 1
          touchOrigin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 1) wasPinch.current = true
        }}
        onTouchEnd={(e) => {
          if (dismissed) return
          if (wasPinch.current) return // pinch-zoom — ignore
          const o = touchOrigin.current
          if (o) {
            const t = e.changedTouches[0]
            if (Math.hypot(t.clientX - o.x, t.clientY - o.y) > 8) return // pan — ignore
          }
          e.preventDefault()
          onClick(thot)
        }}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !dismissed && onClick(thot)}
        className={`thot-bubble${isNew ? ' thot-bubble-pop' : ''}`}
        style={{
          position: 'absolute',
          bottom: `${bubbleBottom}px`,
          left: `${bubbleLeft}px`,
          maxWidth: '260px',
          minWidth: '80px',
          background: 'rgba(10, 10, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          border: isPending ? `1.5px dashed ${accentColor}` : `1px solid ${accentColor}55`,
          borderRadius: '14px 14px 14px 2px',
          padding: '8px 12px 6px',
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}22`,
          pointerEvents: dismissed ? 'none' : 'auto',
          cursor: dismissed ? 'default' : 'pointer',
          visibility: dismissed ? 'hidden' : 'visible',
        }}
      >
        {/* Dismiss button — always visible */}
        {!dismissed && (
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); setHovered(false) }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setDismissed(true); setHovered(false) }}
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.2)',
              color: hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
              fontSize: '14px',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              zIndex: 2,
              padding: 0,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ display: 'block', transform: 'translateY(-1px)' }}>×</span>
          </button>
        )}

        <p style={{
          color: '#fff',
          fontSize: '14px',
          lineHeight: '1.45',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',

        }}>
          {thot.content}
        </p>
        {pinType && thot.source_url && (
          <a
            href={thot.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', color: '#4ade80', opacity: 0.75, textDecoration: 'none' }}
          >
            Read full story ↗
          </a>
        )}

        {/* Meta row + hype button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, overflow: 'hidden' }}>
            {pinType && (
              <span style={{ fontSize: '10px', background: `${accentColor}22`, border: `1px solid ${accentColor}55`, color: accentColor, borderRadius: '4px', padding: '0 4px', lineHeight: '16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {pinType.toUpperCase()}
              </span>
            )}
            {thot.is_incognito && (
              <svg width="14" height="8" viewBox="0 0 18 10" fill="none" style={{ flexShrink: 0 }} aria-label="incognito">
                <rect x="0.5" y="1.5" width="6" height="5" rx="2.5" stroke="#a78bfa" strokeWidth="1.2"/>
                <rect x="11.5" y="1.5" width="6" height="5" rx="2.5" stroke="#a78bfa" strokeWidth="1.2"/>
                <path d="M6.5 4H11.5" stroke="#a78bfa" strokeWidth="1.2"/>
                <path d="M0.5 4H-1" stroke="#a78bfa" strokeWidth="1.2"/>
                <path d="M17.5 4H19" stroke="#a78bfa" strokeWidth="1.2"/>
              </svg>
            )}
            <span style={{ fontSize: mob ? '14px' : '12px', color: accentColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {thot.pen_name || 'anon'}
            </span>
            {!thot.is_incognito && thot.last_seen_at && (() => {
              const status = onlineStatus(thot.last_seen_at)
              if (!status) return null
              const isOnline = status === 'online'
              const isOffline = status === 'offline'
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                    background: isOnline ? '#22c55e' : '#475569',
                  }} />
                  {isOffline && (
                    <span style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>offline</span>
                  )}
                </span>
              )
            })()}
            <span style={{ fontSize: mob ? '14px' : '12px', color: '#475569', whiteSpace: 'nowrap' }}>
              {relativeTime(thot.created_at)}
            </span>
          </div>
          {isPending ? (
            <span style={{ fontSize: '11px', color: '#fbbf24', opacity: 0.85, flexShrink: 0, marginLeft: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '12px' }}>⏳</span> queued
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isAuth) {
                  window.dispatchEvent(new CustomEvent('thots:needs-auth'))
                } else {
                  setHeartAnim(true)
                  onHype?.(thot.id)
                }
              }}
              title={isAuth ? (hyped ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '6px',
                background: hyped ? `${accentColor}25` : 'transparent',
                border: 'none', borderRadius: '6px', padding: '2px 4px',
                cursor: isAuth ? 'pointer' : 'default',
                color: hyped ? accentColor : 'rgba(255,255,255,0.35)',
                fontSize: mob ? '14px' : '13px', pointerEvents: 'auto',
                transition: 'color 0.15s, background 0.15s', lineHeight: 1,
              }}
            >
              <Heart size={14} className={heartAnim ? 'heart-pop' : ''} onAnimationEnd={() => setHeartAnim(false)} style={{ fill: hyped ? accentColor : 'none', strokeWidth: 1.5 }} />
              <span style={{ minWidth: '12px', display: 'inline-block', textAlign: 'left' }}>{hypeCount > 0 ? hypeCount : ''}</span>
            </button>
          )}
        </div>

        {/* Tail — bridges bubble bottom to avatar top */}
        <svg
          width="12" height="10" viewBox="0 0 12 10"
          style={{ position: 'absolute', bottom: '-10px', left: '14px', pointerEvents: 'none' }}
        >
          <path d="M0 0 L12 0 L0 10 Z" fill="rgba(10, 10, 26, 0.92)" />
          <line x1="0" y1="0" x2="0" y2="10" stroke={`${accentColor}55`} strokeWidth="1" />
          <line x1="0" y1="0" x2="12" y2="0" stroke={`${accentColor}55`} strokeWidth="1" />
        </svg>
      </div>

      {/* Recall dot — sits at the pin tip when bubble is dismissed; click to restore */}
      {dismissed && (
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(false) }}
          title="Show thot"
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: accentColor,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            pointerEvents: 'auto',
            opacity: 0.9,
            boxShadow: `0 0 8px ${accentColor}99`,
            transition: 'transform 0.15s, opacity 0.15s',
            zIndex: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.4)'; e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.opacity = '0.9' }}
        />
      )}

      {/* Anchor — hidden when dismissed or for your own thot */}
      <div
        onClick={() => onClick(thot)}
        style={{ pointerEvents: 'auto', cursor: 'pointer', width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px`, visibility: (isYou || dismissed) ? 'hidden' : 'visible', position: 'relative' }}
      >
        <AnonAvatar size={AVATAR_SIZE} color={accentColor} active={false} />
        {isIncognito && <GlassesOverlay size={AVATAR_SIZE} />}
      </div>
    </div>
  )
}

// Your location marker — clean avatar, no bubble.
// Thot appears once as a regular ThotPin. Clicking here opens compose or your profile.
export function YouPin({ onAvatarClick, hasThot, isAnon = false, incognito = false }) {
  return (
    <div style={{
      position: 'relative',
      width: `${AVATAR_SIZE}px`,
      height: `${AVATAR_SIZE}px`,
      overflow: 'visible',
      pointerEvents: 'none',
      opacity: isAnon ? 0.45 : 1,
    }}>
      {/* Sonar pulse rings — three staggered rings radiating outward */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${AVATAR_SIZE}px`,
          height: `${AVATAR_SIZE}px`,
          borderRadius: '50%',
          border: '1.5px solid rgba(200, 200, 210, 0.35)',
          animation: `youpin-sonar 3s ease-out ${i * 1}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
      <style>{`
        @keyframes youpin-sonar {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
        }
      `}</style>
      <div
        onClick={isAnon ? undefined : onAvatarClick}
        title={isAnon ? 'Browsing anonymously' : hasThot ? 'View your thot' : 'Drop a thot'}
        style={{ pointerEvents: isAnon ? 'none' : 'auto', cursor: isAnon ? 'default' : 'pointer', width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px`, position: 'relative', zIndex: 1 }}
      >
        <AnonAvatar size={AVATAR_SIZE} color={incognito ? '#7c3aed' : (isAnon ? '#64748b' : '#e11d48')} active={!isAnon} />
        {incognito && <GlassesOverlay size={AVATAR_SIZE} />}
      </div>
    </div>
  )
}
