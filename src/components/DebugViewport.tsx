import { useEffect, useState } from 'react'

// TEMPORARY diagnostic overlay — prints the viewport measurements so we can see
// why a gap appears under the bottom nav on-device. Remove once resolved.
export function DebugViewport() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    window.addEventListener('resize', f)
    window.visualViewport?.addEventListener('resize', f)
    window.visualViewport?.addEventListener('scroll', f)
    const t = setInterval(f, 500)
    return () => {
      window.removeEventListener('resize', f)
      window.visualViewport?.removeEventListener('resize', f)
      window.visualViewport?.removeEventListener('scroll', f)
      clearInterval(t)
    }
  }, [])

  // Read env(safe-area-inset-bottom) via a probe element.
  let safeBottom = '?'
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;padding-bottom:env(safe-area-inset-bottom)'
    document.body.appendChild(probe)
    safeBottom = getComputedStyle(probe).paddingBottom
    document.body.removeChild(probe)
  } catch {
    /* ignore */
  }

  const appH = getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim() || '(unset)'
  const standalone = (navigator as { standalone?: boolean }).standalone ? 'yes' : 'no'
  const shellH = document.getElementById('app-shell')?.offsetHeight ?? '?'

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        zIndex: 99999,
        background: 'rgba(220,38,38,0.92)',
        color: 'white',
        font: '11px/1.4 monospace',
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {[
        `standalone: ${standalone}`,
        `innerHeight: ${window.innerHeight}`,
        `visualVP.h : ${Math.round(window.visualViewport?.height ?? 0)}`,
        `client.h   : ${document.documentElement.clientHeight}`,
        `screen.h   : ${window.screen.height}`,
        `--app-h    : ${appH}`,
        `shell.h    : ${shellH}`,
        `safe-bottom: ${safeBottom}`,
      ].join('\n')}
    </div>
  )
}
