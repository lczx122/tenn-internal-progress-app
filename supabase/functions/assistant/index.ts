// Tenn — Siri / Shortcuts assistant (Supabase Edge Function).
//
// A tiny voice-facing API over the shared `appointments` table so you can ask
// Siri to (a) set an appointment or (b) read back your upcoming appointments.
// It writes the SAME table the in-app Schedule uses, so everything stays in
// sync in real time.
//
// WHY A SHARED SECRET (not the app login): Apple Shortcuts can't run the app's
// Supabase auth flow, so this function is gated by a single secret token you
// store inside the Shortcut. Keep that token private — anyone holding it can
// call this endpoint. The function uses the service-role key server-side, so it
// bypasses RLS just like the other functions here.
//
// Deploy:   supabase functions deploy assistant
// Secret:   supabase secrets set ASSISTANT_TOKEN="<a long random string>"
//           (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided for you.)
//
// Call it (from a Shortcut's "Get Contents of URL", method POST):
//   URL    : https://<project-ref>.functions.supabase.co/assistant
//   Header : Authorization: Bearer <ASSISTANT_TOKEN>
//   Body   : application/json, one of —
//     { "action":"create", "type":"site_visit", "customer":"Ali",
//       "starts_at":"2026-06-24 15:00", "location":"Shah Alam", "who":"Tenn" }
//     { "action":"list", "when":"today" }     // today | tomorrow | week | all
//
// Every reply includes a `speech` string meant to be spoken back by Siri.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonRes = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Malaysia is UTC+8 (no DST). All spoken dates/times use this wall clock.
const TZ = 'Asia/Kuala_Lumpur'
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

const TYPE_LABEL: Record<string, string> = {
  site_visit: 'site visit',
  measurement: 'measurement',
  installation: 'installation',
  meeting: 'meeting',
  collection: 'collection',
  other: 'appointment',
}
function normType(s: unknown): string {
  const k = String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return k in TYPE_LABEL ? k : 'site_visit'
}

// Accept ISO 8601 or a plain "YYYY-MM-DD HH:mm". Anything without an explicit
// timezone is treated as Malaysia time.
function toIso(s: unknown): string | null {
  let v = String(s ?? '').trim()
  if (!v) return null
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(v)) v = v.replace(' ', 'T') + '+08:00'
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Start of "today" in MYT, expressed as a UTC instant.
function mytStartOfToday(): Date {
  const myt = new Date(Date.now() + MYT_OFFSET_MS)
  const y = myt.getUTCFullYear(), m = myt.getUTCMonth(), d = myt.getUTCDate()
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - MYT_OFFSET_MS)
}
// Listing windows. "today"/"tomorrow" are whole MYT calendar days; "week" and
// "all" run from the start of today forward. Done/cancelled appointments are
// filtered out separately, so overdue-but-pending ones still surface.
function rangeFor(when: string): { start: Date; end: Date; label: string } {
  const day = 24 * 60 * 60 * 1000
  const start0 = mytStartOfToday()
  const endOfToday = new Date(start0.getTime() + day)
  switch ((when || 'today').toLowerCase()) {
    case 'tomorrow':
      return { start: endOfToday, end: new Date(endOfToday.getTime() + day), label: 'tomorrow' }
    case 'week':
      return { start: start0, end: new Date(start0.getTime() + 7 * day), label: 'in the next 7 days' }
    case 'all':
      return { start: start0, end: new Date(start0.getTime() + 365 * day), label: 'coming up' }
    default: // today → the whole of today
      return { start: start0, end: endOfToday, label: 'today' }
  }
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // ── Auth: shared secret ────────────────────────────────────────────────
  const secret = Deno.env.get('ASSISTANT_TOKEN')
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!secret) return jsonRes({ ok: false, speech: 'The assistant is not configured yet.' }, 500)
  if (token !== secret) return jsonRes({ ok: false, speech: 'Sorry, you are not authorized.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch (_e) { /* empty body */ }
  const action = String(body.action ?? '').trim().toLowerCase()

  // ── CREATE ─────────────────────────────────────────────────────────────
  if (action === 'create') {
    const starts_at = toIso(body.starts_at)
    if (!starts_at) return jsonRes({ ok: false, speech: 'I need a date and time for the appointment.' }, 400)

    const type = normType(body.type)
    const customer = String(body.customer ?? body.customer_name ?? '').trim()
    const location = String(body.location ?? '').trim()
    const who = String(body.who ?? '').trim()
    const notes = String(body.notes ?? '').trim()
    const title = String(body.title ?? '').trim() ||
      `${TYPE_LABEL[type]}${customer ? ' — ' + customer : ''}`
    const ends_at = toIso(body.ends_at)

    // Best-effort: link to an existing unit when exactly one job matches.
    let job_id: string | null = null
    let customer_name = customer
    if (customer) {
      const { data: jobs } = await supabase
        .from('jobs').select('id,customer_name').ilike('customer_name', `%${customer}%`).limit(2)
      if (jobs && jobs.length === 1) { job_id = jobs[0].id; customer_name = jobs[0].customer_name }
    }

    const { error } = await supabase.from('appointments').insert({
      title, type, job_id, customer_name, location, who,
      starts_at, ends_at, status: 'scheduled', notes,
      created_by_name: String(body.by ?? 'Siri').trim() || 'Siri',
    })
    if (error) return jsonRes({ ok: false, speech: 'Sorry, I could not save that appointment.' }, 500)

    const speech = `Appointment set: ${TYPE_LABEL[type]}${customer ? ' for ' + customer : ''} ` +
      `on ${fmtDate(starts_at)} at ${fmtTime(starts_at)}${location ? ' in ' + location : ''}.`
    return jsonRes({ ok: true, speech })
  }

  // ── LIST ───────────────────────────────────────────────────────────────
  if (action === 'list') {
    const { start, end, label } = rangeFor(String(body.when ?? 'today'))
    const { data: rows, error } = await supabase
      .from('appointments')
      .select('title,type,customer_name,location,starts_at,status')
      .neq('status', 'cancelled')
      .neq('status', 'done')   // skip completed; overdue-but-pending still show
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .order('starts_at', { ascending: true })
      .limit(12)
    if (error) return jsonRes({ ok: false, speech: 'Sorry, I could not check the schedule.' }, 500)

    const list = rows ?? []
    if (!list.length) return jsonRes({ ok: true, count: 0, speech: `You have no appointments ${label}.` })

    const withDay = label === 'in the next 7 days' || label === 'coming up'
    const items = list.map((r) => {
      const t = TYPE_LABEL[r.type] || 'appointment'
      const desc = String(r.title ?? '').trim() || t        // prefer the title
      const when = withDay ? `${fmtDate(r.starts_at)} at ${fmtTime(r.starts_at)}` : fmtTime(r.starts_at)
      const who = r.customer_name ? ` for ${r.customer_name}` : ''
      const where = r.location ? ` at ${r.location}` : ''
      return `${when}, ${t}${desc && desc !== t ? ` — ${desc}` : ''}${who}${where}`
    })
    const n = list.length
    const speech = `You have ${n} appointment${n === 1 ? '' : 's'} ${label}: ${items.join('; ')}.`
    return jsonRes({ ok: true, count: n, speech, appointments: list })
  }

  return jsonRes({ ok: false, speech: 'I did not understand that request.' }, 400)
})
