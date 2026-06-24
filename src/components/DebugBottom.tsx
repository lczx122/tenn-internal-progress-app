// TEMPORARY: a bar pinned to bottom:0 to test whether the physical screen edge
// is reachable by the web app. If this magenta bar sits flush with the bottom of
// the screen, we can pin the nav there; if there's blank space BELOW it, the
// bottom region is outside the drawable area (an iOS PWA limit). Remove after.
export function DebugBottom() {
  const vv = Math.round(window.visualViewport?.height ?? 0)
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '26px',
        background: 'magenta',
        color: 'white',
        font: '11px monospace',
        textAlign: 'center',
        lineHeight: '26px',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      bottom:0 · inner {window.innerHeight} · vv {vv} · screen {window.screen.height}
    </div>
  )
}
