import { useEffect, useRef, useState } from 'react'

// Swipe-down-to-refresh for a scroll container. Activates only when the
// container is scrolled to the very top and the finger drags downward, so it
// never fights normal scrolling. Returns the live pull distance (px) plus
// flags the shell uses to render the spinner and animate the content.
export interface PullState {
  pull: number
  refreshing: boolean
  dragging: boolean
}

const THRESHOLD = 70 // px past which a release triggers a refresh
const MAX = 110 // clamp the rubber-band
const SLOP = 6 // ignore tiny moves so taps/horizontal scrolls pass through
const MIN_SPIN_MS = 600 // keep the spinner visible long enough to read

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement>,
  onRefresh?: () => void | Promise<void>,
): PullState {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Refs mirror state so the touch handlers (bound once) read fresh values.
  const pullRef = useRef(0)
  const startY = useRef<number | null>(null)
  const active = useRef(false)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onRefresh) return

    const setPullBoth = (v: number) => {
      pullRef.current = v
      setPull(v)
    }

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || el.scrollTop > 0) {
        active.current = false
        return
      }
      startY.current = e.touches[0].clientY
      active.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      // Bail if they scrolled away from the top or are dragging upward.
      if (el.scrollTop > 0 || dy <= SLOP) {
        if (pullRef.current) setPullBoth(0)
        if (dy <= 0) active.current = el.scrollTop <= 0
        return
      }
      setDragging(true)
      const eased = Math.min(MAX, (dy - SLOP) * 0.5) // resistance
      setPullBoth(eased)
      if (e.cancelable) e.preventDefault() // suppress native overscroll glow
    }

    const onEnd = async () => {
      if (!active.current) return
      active.current = false
      setDragging(false)
      const dist = pullRef.current
      if (dist < THRESHOLD) {
        setPullBoth(0)
        return
      }
      setRefreshing(true)
      refreshingRef.current = true
      setPullBoth(THRESHOLD) // hold at the spinner height
      const started = Date.now()
      try {
        await onRefreshRef.current?.()
      } finally {
        const wait = MIN_SPIN_MS - (Date.now() - started)
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        setRefreshing(false)
        refreshingRef.current = false
        setPullBoth(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef, Boolean(onRefresh)])

  return { pull, refreshing, dragging }
}

export const PULL_THRESHOLD = THRESHOLD
