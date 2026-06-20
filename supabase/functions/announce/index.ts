// Tenn — announcement push broadcaster (Supabase Edge Function, OPTIONAL).
// The boss client stores the announcement in app_settings itself (that's what
// drives the in-app banner for everyone, in real time). This function is only
// the best-effort PUSH half: a boss broadcasts the text to every subscribed
// device. Safe to leave undeployed — the banner works without it.
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
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (prof?.role !== 'boss') return jsonRes({ ok: false, error: 'Only a boss can post announcements.' }, 403)

  let body: { text?: string } = {}
  try { body = await req.json() } catch (_e) { /* empty */ }
  const text = String(body.text ?? '').trim()
  if (!text) return jsonRes({ ok: false, error: 'Announcement text is empty.' }, 400)

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
