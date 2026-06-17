// Tenn Renovation — reminder sender (Supabase Edge Function).
// Runs on a schedule (pg_cron, every minute). For each upcoming appointment, if
// an assignee has reminders enabled and we're inside their lead window, send a
// web-push notification to their devices (deduped via sent_reminders).
//
// Deploy:   supabase functions deploy send-reminders --no-verify-jwt
// Secrets:  VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:you@x.com),
//           CRON_SECRET  (any random string; the cron call must send it)
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

function humanize(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`
  if (min < 1440) { const h = Math.round(min / 60); return `${h} hour${h === 1 ? '' : 's'}` }
  const d = Math.round(min / 1440); return `${d} day${d === 1 ? '' : 's'}`
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonRes = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let body: { test?: boolean } = {}
  try { body = await req.json() } catch (_e) { /* empty body = cron run */ }

  // Authenticated "send me a test notification" path (called from the app).
  if (body?.test) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return jsonRes({ ok: false, error: 'Not signed in.' }, 401)
    const { data: subs } = await supabase
      .from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', user.id)
    if (!subs?.length) return jsonRes({ ok: false, error: 'No device subscribed yet — turn reminders on first.' })
    const payload = JSON.stringify({
      title: 'Test reminder 🔔',
      body: 'Your reminder notifications are working.',
      url: '/schedule', tag: 'test',
    })
    let testSent = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        testSent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
    return jsonRes({ ok: true, sent: testSent })
  }

  // Scheduled (cron) path — guarded by the shared secret.
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const horizonIso = new Date(now + 36 * 3600 * 1000).toISOString() // look 36h ahead

  const { data: appts } = await supabase
    .from('appointments')
    .select('id,title,customer_name,type,starts_at,assignee_ids,status')
    .eq('status', 'scheduled')
    .gte('starts_at', nowIso)
    .lte('starts_at', horizonIso)

  if (!appts?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }))

  const { data: prefs } = await supabase
    .from('notification_prefs')
    .select('user_id,enabled,lead_minutes')
    .eq('enabled', true)
  const prefByUser = new Map((prefs ?? []).map((p) => [p.user_id, p]))

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint,user_id,p256dh,auth')
  const subsByUser = new Map<string, typeof subs>()
  for (const s of subs ?? []) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s)
    subsByUser.set(s.user_id, arr)
  }

  let sent = 0
  for (const a of appts) {
    const start = new Date(a.starts_at).getTime()
    for (const userId of (a.assignee_ids ?? [])) {
      const pref = prefByUser.get(userId)
      if (!pref) continue
      const fireAt = start - pref.lead_minutes * 60000
      if (now < fireAt || now > start) continue // not inside the lead window
      const userSubs = subsByUser.get(userId)
      if (!userSubs?.length) continue

      // Dedupe: insert wins exactly once per (appointment, user).
      const { error: dupe } = await supabase
        .from('sent_reminders')
        .insert({ appointment_id: a.id, user_id: userId })
      if (dupe) continue // already sent

      const payload = JSON.stringify({
        title: a.title || a.customer_name || 'Upcoming appointment',
        body: `Starts in ${humanize(start - now)} · ${new Date(a.starts_at).toLocaleString()}`,
        url: '/schedule',
        tag: 'appt-' + a.id,
      })
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
        } catch (e) {
          // 404/410 = subscription gone; clean it up.
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
