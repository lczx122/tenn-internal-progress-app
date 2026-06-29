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
