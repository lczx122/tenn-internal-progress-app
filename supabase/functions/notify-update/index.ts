// Tenn — unit-update push broadcaster (Supabase Edge Function).
// Fired by the app right after a staff member posts an update on a unit's
// timeline: pushes "🏠 D-07-03 · Winnie Chai — Tiles delivered" to every OTHER
// subscribed user who hasn't switched unit updates off. Best-effort — the
// update itself is already saved before this is called, and a failed push
// never blocks anything.
//
// Deploy:   supabase functions deploy notify-update
//           (keep JWT verification ON — only signed-in staff may trigger it)
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
  if (req.method !== 'POST') return jsonRes({ ok: false, error: 'POST only' }, 405)

  // Any signed-in staff member may notify; the author is excluded below.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return jsonRes({ ok: false, error: 'Not signed in.' }, 401)

  let body: { job_id?: string; text?: string } = {}
  try { body = await req.json() } catch (_e) { /* empty */ }
  const jobId = String(body.job_id ?? '')
  const text = String(body.text ?? '').trim().slice(0, 300)
  if (!jobId || !text) return jsonRes({ ok: false, error: 'job_id and text are required.' }, 400)

  // Resolve the unit label + the author's display name for the push title.
  const [{ data: job }, { data: author }] = await Promise.all([
    supabase.from('jobs').select('unit_code, customer_name').eq('id', jobId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  if (!job) return jsonRes({ ok: false, error: 'Unit not found.' }, 404)
  const unitLabel = job.unit_code || job.customer_name || 'a unit'
  const authorName = author?.full_name || 'Someone'

  // Everyone with a push subscription, minus the author, minus anyone who
  // switched unit updates off in their notification prefs.
  const [{ data: subs }, { data: prefs }] = await Promise.all([
    supabase.from('push_subscriptions').select('endpoint,p256dh,auth,user_id').neq('user_id', user.id),
    supabase.from('notification_prefs').select('user_id, unit_updates'),
  ])
  const optedOut = new Set((prefs ?? []).filter((p) => p.unit_updates === false).map((p) => p.user_id))
  const targets = (subs ?? []).filter((s) => !optedOut.has(s.user_id))

  const payload = JSON.stringify({
    title: `🏠 ${unitLabel} · ${authorName}`,
    body: text,
    url: `/job/${jobId}`,
    // one visible notification per unit — a burst of updates collapses
    tag: `unit-update-${jobId}`,
  })

  let sent = 0
  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      // Expired/unsubscribed browser endpoints get cleaned up.
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
  return jsonRes({ ok: true, sent })
})
