import { supabase } from './supabase'

// Realtime channels must have UNIQUE topic names. Pages subscribe in a useEffect
// and remove the channel on unmount, but removeChannel is async — so when a page
// remounts quickly (tab away + back), a new channel created with the SAME constant
// name collides with the previous one before it's fully gone. That wedges the
// realtime client, and the next change event (e.g. deleting a row) can spin it
// into a loop that freezes the page. Appending a per-call unique suffix gives
// every mount its own topic, so there's never a collision.
let seq = 0

export function realtimeChannel(name: string) {
  return supabase.channel(`${name}-${Date.now().toString(36)}-${seq++}`)
}

// Coalesce a burst of realtime events into ONE refetch. A single user action
// often touches several tables (a stage change also writes job_events and bumps
// jobs), and each event used to fire its own full reload + progress-bar sweep —
// on every open device. Use `run` as the postgres_changes callback and call
// `cancel` in the effect cleanup so a trailing timer can't refetch after unmount.
export function coalesce(fn: () => void, ms = 350): { run: () => void; cancel: () => void } {
  let t: number | null = null
  return {
    run() {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        t = null
        fn()
      }, ms)
    },
    cancel() {
      if (t) window.clearTimeout(t)
      t = null
    },
  }
}
