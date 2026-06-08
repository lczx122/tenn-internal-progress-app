import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Make misconfiguration obvious instead of a blank screen.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase config. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Expose the configured, signed-in client to the embedded quotation tool
// (public/quotation.html runs in a same-origin iframe). It reuses this exact
// client — sharing the auth session — to save quotes and reserve numbers.
if (typeof window !== 'undefined') {
  ;(window as { tennSupabase?: typeof supabase }).tennSupabase = supabase
}

export const isConfigured = Boolean(url && anonKey)
