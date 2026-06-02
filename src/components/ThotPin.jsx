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

export default function ThotPin({ thot, isYou = false, onClick }) {
  const accentColor = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#64748b'
  const avatarColor = accentColor

  return (
    <div
      onClick={() => onClick(thot)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        cursor: 'pointer',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {/* Bubble */}
      <div
        style={{
          position: 'relative',
          maxWidth: '200px',
          minWidth: '80px',
          background: 'rgba(10, 10, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${accentColor}55`,
          borderRadius: '14px 14px 14px 2px',
          padding: '8px 12px',
          marginBottom: '6px',
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}22`,
        }}
      >
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
        }}>
          {thot.content}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '5px' }}>
          <span style={{ fontSize: '10px', color: accentColor, fontWeight: 600 }}>
            {thot.pen_name || 'anon'}
          </span>
          <span style={{ fontSize: '10px', color: '#475569' }}>
            {relativeTime(thot.created_at)}
          </span>
        </div>

        {/* Tail — bottom-left pointing down */}
        <svg
          width="12"
          height="10"
          viewBox="0 0 12 10"
          style={{ position: 'absolute', bottom: '-10px', left: '14px' }}
        >
          <path
            d="M0 0 L12 0 L0 10 Z"
            fill="rgba(10, 10, 26, 0.92)"
          />
          <line x1="0" y1="0" x2="0" y2="10" stroke={`${accentColor}55`} strokeWidth="1" />
          <line x1="0" y1="0" x2="12" y2="0" stroke={`${accentColor}55`} strokeWidth="1" />
        </svg>
      </div>

      {/* Avatar */}
      <AnonAvatar size={36} color={avatarColor} active={isYou} />
    </div>
  )
}
