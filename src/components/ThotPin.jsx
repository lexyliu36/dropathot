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
  const color = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#334155'
  const borderColor = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#475569'
  const avatarColor = isYou ? '#e11d48' : thot.pen_name ? '#7c3aed' : '#64748b'

  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      style={{ pointerEvents: 'auto' }}
      onClick={() => onClick(thot)}
    >
      <div
        className="relative max-w-[180px] rounded-2xl rounded-bl-none px-3 py-2 mb-1 shadow-lg transition-transform duration-150 group-hover:scale-105"
        style={{ background: '#0e0e1a', border: `1px solid ${borderColor}40` }}
      >
        <p className="text-white text-xs leading-snug line-clamp-2">{thot.content}</p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px]" style={{ color: borderColor }}>
            {thot.pen_name || 'anon'}
          </span>
          <span className="text-[10px] text-slate-600">{relativeTime(thot.created_at)}</span>
        </div>
        <div
          className="absolute -bottom-[6px] left-3 w-3 h-3"
          style={{
            background: '#0e0e1a',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
            borderLeft: `1px solid ${borderColor}40`,
            borderBottom: `1px solid ${borderColor}40`,
          }}
        />
      </div>
      <AnonAvatar size={36} color={avatarColor} active={isYou} />
    </div>
  )
}
