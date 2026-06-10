/**
 * Explode a thot bubble at a given viewport position.
 * cx, cy = center of the bubble in viewport (px).
 * onDone  = called after particles finish.
 */
export function explodeBubbleAt(cx, cy, onDone) {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:9999'
  document.body.appendChild(wrap)

  const COUNT  = 22
  const COLORS = ['#e11d48','#ff4d6d','#fda4af','#ffffff','#fb7185','#7c3aed','#c4b5fd']
  const MAX_DUR = 0  // track longest animation for cleanup

  const animations = []

  for (let i = 0; i < COUNT; i++) {
    const p     = document.createElement('div')
    const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
    const dist  = 28 + Math.random() * 72
    const size  = 3 + Math.random() * 9
    const dur   = 420 + Math.random() * 280
    const delay = Math.random() * 60
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const shape = Math.random() > 0.4 ? '50%' : '3px'
    const rx    = Math.cos(angle) * dist
    const ry    = Math.sin(angle) * dist
    const rot   = (Math.random() - 0.5) * 720

    p.style.cssText = `
      position: absolute;
      left: ${cx}px;
      top: ${cy}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: ${shape};
      background: ${color};
    `
    wrap.appendChild(p)

    const anim = p.animate([
      { transform: 'translate(-50%,-50%) scale(1)',                                                        opacity: 1 },
      { transform: `translate(calc(-50% + ${rx * 0.6}px), calc(-50% + ${ry * 0.6}px)) scale(1.2)`,       opacity: 1,  offset: 0.25 },
      { transform: `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px)) rotate(${rot}deg) scale(0)`,    opacity: 0 },
    ], {
      duration: dur,
      delay,
      fill: 'forwards',
      easing: 'cubic-bezier(0.15, 0.85, 0.35, 1)',
    })
    animations.push(anim)
  }

  const totalDur = Math.max(...animations.map((a, i) =>
    (a.effect?.getTiming?.()?.duration ?? 500) + (a.effect?.getTiming?.()?.delay ?? 0)
  ))

  setTimeout(() => {
    if (document.body.contains(wrap)) document.body.removeChild(wrap)
    onDone?.()
  }, totalDur + 50)
}

/**
 * Convenience wrapper: takes a Mapbox marker + map instance,
 * projects the marker position to screen coords, then explodes.
 */
export function explodeMarker(marker, map, onDone) {
  try {
    // Instantly hide the bubble div so it doesn't linger during particle flight
    const bubbleEl = marker.getElement().querySelector('.thot-bubble')
    if (bubbleEl) bubbleEl.style.opacity = '0'

    const lngLat = marker.getLngLat()
    const pt     = map.project(lngLat)
    // Bubble center sits ~55px above the avatar anchor
    explodeBubbleAt(pt.x, pt.y - 55, onDone)
  } catch {
    onDone?.()
  }
}
