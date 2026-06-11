import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Auto-refresh after idle.
//
// When iOS suspends the app (screen lock, app switch), the Supabase realtime
// socket dies silently — on waking, the screen shows stale data and no events
// arrive until a manual reload. This hook refetches whenever the app wakes:
//   - the tab/app becomes visible again after being hidden for a while
//   - the page is restored from the back/forward cache
//   - the network comes back
// plus a slow interval while visible, as a backstop for a realtime socket
// that died without us noticing. It also nudges the realtime client to
// reconnect so live updates resume.
const HIDDEN_MS = 30_000 // refetch if hidden longer than this
const STALE_MS = 180_000 // backstop: refetch if no refresh in this long
const TICK_MS = 60_000

export function useAutoRefresh(refetch: () => void) {
  // Keep the latest callback without re-binding listeners every render.
  const fnRef = useRef(refetch)
  fnRef.current = refetch

  useEffect(() => {
    let hiddenAt = 0
    let last = Date.now()

    const run = () => {
      last = Date.now()
      // Revive the realtime socket if the OS killed it (no-op when healthy).
      try {
        supabase.realtime.connect()
      } catch {
        // never let a socket hiccup break the refetch
      }
      fnRef.current()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_MS) run()
      hiddenAt = 0
    }
    const onPageshow = (e: PageTransitionEvent) => {
      if (e.persisted) run() // restored from bfcache
    }
    const onOnline = () => run()
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last > STALE_MS) run()
    }, TICK_MS)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageshow)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageshow)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}
