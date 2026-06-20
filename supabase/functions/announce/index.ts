// Tenn — announcement broadcaster (Supabase Edge Function).
// A boss posts an announcement: store it in app_settings (key 'announcement', so
// the in-app banner shows it for everyone in real time) and push a notification
// to every subscribed device. A { clear:true } body empties the announcement.
//
// Deploy:   supabase functions deploy announce
// Secrets:  VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (same as send-reminders).
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@tenn.app',
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_PRIVATE')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonRes = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Boss only.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return jsonRes({ ok: false, error: 'Not signed in.' }, 401)
  const { data: prof } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
  if (prof?.role !== 'boss') return jsonRes({ ok: false, error: 'Only a boss can post announcements.' }, 403)

  let body: { text?: string; clear?: boolean } = {}
  try { body = await req.json() } catch (_e) { /* empty */ }
  const clear = !!body.clear
  const text = String(body.text ?? '').trim()
  if (!clear && !text) return jsonRes({ ok: false, error: 'Announcement text is empty.' }, 400)

  const value = clear
    ? {}
    : { id: String(Date.now()), text, by: prof?.full_name || 'Boss', at: new Date().toISOString() }
  await supabase.from('app_settings').upsert({
    key: 'announcement', value, updated_by: user.id, updated_at: new Date().toISOString(),
  })
  if (clear) return jsonRes({ ok: true, sent: 0, cleared: true })

  // Best-effort push to every subscribed device.
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth')
  const payload = JSON.stringify({ title: '📢 Announcement', body: text, url: '/', tag: 'announcement' })
  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
  return jsonRes({ ok: true, sent })
})
