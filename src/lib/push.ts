import { supabase } from './supabase'

export interface NotifyPrefs {
  enabled: boolean
  lead_minutes: number
}

// Whether this browser/device can do web push at all.
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// iOS only allows web push when the app is installed to the Home Screen.
export function isStandalone(): boolean {
  return (
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

async function getVapidPublicKey(): Promise<string | null> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'vapid_public').maybeSingle()
  const v = (data?.value ?? null) as { key?: string } | string | null
  if (!v) return null
  const key = typeof v === 'string' ? v : v.key ?? null
  return key && key.length > 20 ? key : null
}

async function uid(): Promise<string | undefined> {
  return (await supabase.auth.getUser()).data.user?.id
}

export async function getPrefs(): Promise<NotifyPrefs> {
  const { data } = await supabase.from('notification_prefs').select('enabled, lead_minutes').maybeSingle()
  return { enabled: !!data?.enabled, lead_minutes: data?.lead_minutes ?? 30 }
}

// Turn on reminders: ask permission, subscribe to push, save the subscription
// and the lead time. Throws a friendly error if anything isn't available.
export async function enablePush(leadMinutes: number): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications aren’t supported on this browser.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notification permission was not granted.')
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  const vapid = await getVapidPublicKey()
  if (!vapid) throw new Error('Push isn’t set up yet (the admin needs to add the VAPID key).')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapid) as unknown as BufferSource,
    })
  }
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const me = await uid()
  await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: me, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth },
      { onConflict: 'endpoint' },
    )
  await supabase
    .from('notification_prefs')
    .upsert({ user_id: me, enabled: true, lead_minutes: leadMinutes }, { onConflict: 'user_id' })
}

export async function setLead(leadMinutes: number): Promise<void> {
  const me = await uid()
  await supabase
    .from('notification_prefs')
    .upsert({ user_id: me, lead_minutes: leadMinutes }, { onConflict: 'user_id' })
}

// Ask the server to push a test notification to this user's devices.
export async function sendTest(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; sent?: number; error?: string }) ?? { ok: false, error: 'No response' }
}

// Boss-only: store an announcement (shown in the in-app banner for everyone) and
// push it to all subscribed devices. Returns how many pushes were sent.
export async function postAnnouncement(text: string): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('announce', { body: { text } })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; sent?: number; error?: string }) ?? { ok: false, error: 'No response' }
}

export async function disablePush(): Promise<void> {
  const me = await uid()
  await supabase.from('notification_prefs').upsert({ user_id: me, enabled: false }, { onConflict: 'user_id' })
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    // best-effort
  }
}
