import { useState } from 'react'

export function AnonAvatar({ size = 44, color = '#7c3aed', active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="21" fill={color} fillOpacity="0.2" stroke={color} strokeWidth={active ? 2.5 : 1.5} />
      <ellipse cx="22" cy="19" rx="8" ry="7" fill={color} fillOpacity="0.6" />
      <ellipse cx="22" cy="35" rx="11" ry="8" fill={color} fillOpacity="0.4" />
      <ellipse cx="18.5" cy="18.5" rx="2" ry="1.2" fill="white" fillOpacity="0.8" />
      <ellipse cx="25.5" cy="18.5" rx="2" ry="1.2" fill="white" fillOpacity="0.8" />
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
const DOT_SIZE = 4   // isYou marker size
// Bubble bottom = anchor size + tail height
const bubbleBottom = (isYou) => (isYou ? DOT_SIZE : AVATAR_SIZE) + 10
const bubbleLeft   = (isYou) => isYou ? Math.round(DOT_SIZE / 2) - 13 : 0

export default function ThotPin({ thot, isYou = false, onClick, session }) {
  const [dismissed, setDismissed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [hyped, setHyped] = useState(false)

  const accentColor = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#64748b'
  const isAuth = session?.type === 'user'
  const ageHours = pinAgeHours(thot)
  const opacity = Math.max(0.05, 1 - ageHours / 24)

  // isYou uses a small dot anchor; others use the full avatar
  const anchorSize = isYou ? DOT_SIZE : AVATAR_SIZE

  return (
    <div
      style={{
        position: 'relative',
        width: `${anchorSize}px`,
        height: `${anchorSize}px`,
        overflow: 'visible',
        opacity: dismissed ? 0 : opacity,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
      }}
    >
      {/* Bubble — floats above the avatar, visibility:hidden when dismissed to preserve layout */}
      <div
        onMouseEnter={() => !dismissed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !dismissed && onClick(thot)}
        style={{
          position: 'absolute',
          bottom: `${bubbleBottom(isYou)}px`,
          left: `${bubbleLeft(isYou)}px`,
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
        {/* Dismiss button — top-right on hover */}
        {hovered && !dismissed && (
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); setHovered(false) }}
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              zIndex: 2,
              padding: 0,
            }}
          >
            <span style={{ display: 'block', transform: 'translateY(-1px)' }}>×</span>
          </button>
        )}

        <p style={{
          color: '#fff',
          fontSize: '12px',
          lineHeight: '1.45',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 3,
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
            <span style={{ fontSize: '10px', color: accentColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {thot.pen_name || 'anon'}
            </span>
            <span style={{ fontSize: '10px', color: '#475569', whiteSpace: 'nowrap' }}>
              {relativeTime(thot.created_at)}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); if (isAuth) setHyped(h => !h) }}
            title={isAuth ? (hyped ? 'Un-hype' : 'Hype this') : 'Sign up to hype'}
            style={{
              display: 'flex', alignItems: 'center', flexShrink: 0,
              background: hyped ? `${accentColor}25` : 'transparent',
              border: 'none', borderRadius: '6px', padding: '2px 4px',
              cursor: isAuth ? 'pointer' : 'default',
              opacity: isAuth ? 1 : 0.35,
              color: hyped ? accentColor : 'rgba(255,255,255,0.35)',
              fontSize: '11px', pointerEvents: 'auto',
              transition: 'color 0.15s, background 0.15s', lineHeight: 1,
            }}
          >
            ⚡
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

      {/* Anchor — small red dot for your own thot, avatar for others */}
      <div
        onClick={() => onClick(thot)}
        style={{ pointerEvents: 'auto', cursor: 'pointer', width: `${anchorSize}px`, height: `${anchorSize}px` }}
      >
        {isYou ? (
          <div style={{
            width: `${DOT_SIZE}px`,
            height: `${DOT_SIZE}px`,
            borderRadius: '50%',
            background: '#e11d48',
            boxShadow: '0 0 8px #e11d4890, 0 0 16px #e11d4840',
          }} />
        ) : (
          <AnonAvatar size={AVATAR_SIZE} color={accentColor} active={false} />
        )}
      </div>
    </div>
  )
}

// Your location marker — clean avatar, no bubble.
// Thot appears once as a regular ThotPin. Clicking here opens compose or your profile.
export function YouPin({ onAvatarClick, hasThot }) {
  return (
    <div style={{
      position: 'relative',
      width: `${AVATAR_SIZE}px`,
      height: `${AVATAR_SIZE}px`,
      overflow: 'visible',
      pointerEvents: 'none',
    }}>
      <div
        onClick={onAvatarClick}
        title={hasThot ? 'View your thot' : 'Drop a thot'}
        style={{ pointerEvents: 'auto', cursor: 'pointer', width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }}
      >
        <AnonAvatar size={AVATAR_SIZE} color="#e11d48" active />
      </div>
    </div>
  )
}
