import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { realtimeChannel } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { Icon } from './Icon'

// Current boss announcement, stored in app_settings key 'announcement'.
// Shape: { id, text, by, at }. A new post gets a new id; dismissing remembers
// the id so it stays gone until the next (new-id) announcement.
type Announcement = { id?: string; text?: string; by?: string }
const DISMISS_KEY = 'tenn_dismissed_announcement'

export function AnnouncementBanner() {
  const { isBoss } = useAuth()
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [dismissedId, setDismissedId] = useState<string>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) ?? ''
    } catch {
      return ''
    }
  })

  async function load() {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'announcement')
      .maybeSingle()
    setAnn((data?.value as Announcement) ?? null)
  }

  useEffect(() => {
    load()
    const ch = realtimeChannel('announcement-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.announcement' },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])
  useAutoRefresh(load)

  const text = (ann?.text ?? '').trim()
  const id = ann?.id ?? ''
  if (!text || id === dismissedId) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, id)
    } catch {
      /* ignore */
    }
    setDismissedId(id)
  }
  async function clearForEveryone() {
    await supabase
      .from('app_settings')
      .upsert({ key: 'announcement', value: {}, updated_at: new Date().toISOString() })
    setAnn(null)
  }

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-4 py-2.5 lg:px-8">
        <span className="mt-0.5 text-amber-700"><Icon name="megaphone" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm font-medium text-amber-900">{text}</p>
          {ann?.by && <p className="mt-0.5 text-[11px] text-amber-700/80">— {ann.by}</p>}
        </div>
        {isBoss && (
          <button onClick={clearForEveryone} className="shrink-0 text-[11px] font-medium text-amber-700 underline">
            Clear
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded px-1 text-amber-700 active:bg-amber-100"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
