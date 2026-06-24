import { useState, useRef } from 'react'
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

function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function pinAgeHours(thot) {
  return (Date.now() - new Date(thot.created_at).getTime()) / 3_600_000
}

const AVATAR_SIZE = 36
const bubbleBottom = AVATAR_SIZE + 10
const bubbleLeft   = 0

export default function ThotPin({ thot, isYou = false, onClick, onHype, session }) {
  const [dismissed, setDismissed] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Read live hype state + count from store so updates from any hype action reflect immediately
  const hyped = useAppStore((s) => s.hypedThotIds.has(thot.id))
  const hypeCount = useAppStore((s) => s.thots.find(t => t.id === thot.id)?.hype_count ?? thot.hype_count ?? 0)
  const [heartAnim, setHeartAnim] = useState(false)
  const isAuth = useAppStore((s) => s.session?.type === 'user')

  const accentColor = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#64748b'
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
        opacity: dismissed ? 0 : 1,
        transition: 'opacity 0.3s ease',
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
          maxWidth: '200px',
          minWidth: '80px',
          background: 'rgba(10, 10, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${accentColor}55`,
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
          paddingRight: hovered ? '6px' : 0,
          transition: 'padding-right 0.1s ease',
        }}>
          {thot.content}
        </p>

        {/* Meta row + hype button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <span style={{ fontSize: mob ? '14px' : '12px', color: accentColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {thot.pen_name || 'anon'}
            </span>
            <span style={{ fontSize: mob ? '14px' : '12px', color: '#475569', whiteSpace: 'nowrap' }}>
              {relativeTime(thot.created_at)}
            </span>
          </div>
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
              display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0,
              background: hyped ? `${accentColor}25` : 'transparent',
              border: 'none', borderRadius: '6px', padding: '2px 4px',
              cursor: isAuth ? 'pointer' : 'default',
              color: hyped ? accentColor : 'rgba(255,255,255,0.35)',
              fontSize: mob ? '14px' : '13px', pointerEvents: 'auto',
              transition: 'color 0.15s, background 0.15s', lineHeight: 1,
            }}
          >
            <Heart size={14} className={heartAnim ? 'heart-pop' : ''} onAnimationEnd={() => setHeartAnim(false)} style={{ fill: hyped ? accentColor : 'none', strokeWidth: 1.5 }} />
            {hypeCount > 0 && <span>{hypeCount}</span>}
          </button>
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

      {/* Anchor — hidden for your own thot, space preserved so bubble stays in position */}
      <div
        onClick={() => onClick(thot)}
        style={{ pointerEvents: 'auto', cursor: 'pointer', width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px`, visibility: isYou ? 'hidden' : 'visible' }}
      >
        <AnonAvatar size={AVATAR_SIZE} color={accentColor} active={false} />
      </div>
    </div>
  )
}

// Your location marker — clean avatar, no bubble.
// Thot appears once as a regular ThotPin. Clicking here opens compose or your profile.
export function YouPin({ onAvatarClick, hasThot, isAnon = false }) {
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
        <AnonAvatar size={AVATAR_SIZE} color={isAnon ? '#64748b' : '#e11d48'} active={!isAnon} />
      </div>
    </div>
  )
}
