// Tenn — "throw in text, get a schedule" parser (Supabase Edge Function).
//
// The app posts a blob of free text (a WhatsApp message, site notes, a voice
// transcript — English/Malay mix) plus today's date and the live unit list.
// Claude extracts the schedulable tasks and returns them as structured rows;
// the APP shows a preview and only inserts what the user confirms — this
// function never writes to the database.
//
// Deploy:   supabase functions deploy parse-tasks
//           (do NOT pass --no-verify-jwt — only signed-in staff may call it)
// Secrets:  supabase secrets set ANTHROPIC_API_KEY="sk-ant-…"
//           optional: PARSE_MODEL (defaults to claude-sonnet-5)
//
// Request : { text: string, now: string(ISO), units: [{code, customer}], staff: string[] }
// Response: { tasks: [{ title, type, unit_code, customer, who, location,
//                       starts_at(ISO UTC), ends_at(ISO UTC)|null, notes }] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonRes = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const APPT_TYPES = ['site_visit', 'measurement', 'installation', 'meeting', 'collection', 'other']

// The model answers in Malaysia wall-clock time; we store UTC.
const MYT = '+08:00'
function mytToIso(s: string | null | undefined): string | null {
  if (!s) return null
  const d = new Date(`${s.replace(' ', 'T')}:00${MYT}`.replace(/:00:00\+/, ':00+'))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

interface RawTask {
  title?: string
  type?: string
  unit_code?: string | null
  customer?: string | null
  who?: string | null
  location?: string | null
  starts_at?: string | null
  ends_at?: string | null
  notes?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return jsonRes({ error: 'POST only' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonRes({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

  let body: { text?: string; now?: string; units?: { code: string; customer: string }[]; staff?: string[] }
  try {
    body = await req.json()
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400)
  }

  const text = (body.text ?? '').trim().slice(0, 4000)
  if (!text) return jsonRes({ error: 'No text' }, 400)
  const nowIso = body.now && !isNaN(new Date(body.now).getTime()) ? body.now : new Date().toISOString()
  const units = (body.units ?? []).slice(0, 400)
  const staff = (body.staff ?? []).slice(0, 50)

  // Today's date in Malaysia wall clock, for resolving "esok" / "Wednesday".
  const nowMyt = new Date(new Date(nowIso).getTime() + 8 * 3600e3)
  const today = nowMyt.toISOString().slice(0, 10)
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nowMyt.getUTCDay()]
  const timeNow = nowMyt.toISOString().slice(11, 16)

  const system = [
    'You extract renovation-job appointments from informal notes for a Malaysian renovation company.',
    'The text may mix English and Bahasa Malaysia (esok=tomorrow, lusa=day after tomorrow, pagi=morning, petang=afternoon/evening, malam=night, Isnin..Ahad=Mon..Sun).',
    `Right now in Malaysia it is ${dayName} ${today} ${timeNow} (UTC+8). Resolve every relative date/time against this.`,
    'Rules:',
    `- type must be one of: ${APPT_TYPES.join(', ')}. Measuring=measurement, installing/mounting=installation, collecting money/balance/deposit=collection, viewing/inspection/progress check=site_visit, discussion=meeting, else other.`,
    '- starts_at / ends_at are Malaysia wall-clock "YYYY-MM-DD HH:mm". If only a day is given, use 10:00. If a stated day name already passed this week, use next week. Omit ends_at unless stated.',
    '- unit_code: copy the unit exactly as written when it looks like a unit/lot code (e.g. C-08-10, D-07-03, PG-02-11), else null.',
    units.length
      ? `- Known units (code · customer): ${units.map((u) => `${u.code} · ${u.customer}`).join('; ')}. If the text names a customer from this list without a code, set unit_code to that unit's code.`
      : '',
    staff.length ? `- Staff who can be assigned (use for "who" when named): ${staff.join(', ')}.` : '',
    '- title: short and useful, e.g. "Measure kitchen cabinet". Do not repeat the unit code in the title.',
    '- One task per distinct action. Ignore chit-chat. If the text contains no schedulable task, return an empty list.',
  ]
    .filter(Boolean)
    .join('\n')

  const tool = {
    name: 'schedule_tasks',
    description: 'Report every schedulable task found in the text.',
    input_schema: {
      type: 'object',
      required: ['tasks'],
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title', 'type', 'starts_at'],
            properties: {
              title: { type: 'string' },
              type: { type: 'string', enum: APPT_TYPES },
              unit_code: { type: ['string', 'null'] },
              customer: { type: ['string', 'null'] },
              who: { type: ['string', 'null'], description: 'staff name(s) responsible, comma-separated' },
              location: { type: ['string', 'null'] },
              starts_at: { type: 'string', description: 'YYYY-MM-DD HH:mm Malaysia time' },
              ends_at: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('PARSE_MODEL') || 'claude-sonnet-5',
      max_tokens: 2000,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'schedule_tasks' },
      messages: [{ role: 'user', content: text }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('anthropic error', res.status, detail.slice(0, 300))
    return jsonRes({ error: `AI request failed (${res.status})` }, 502)
  }
  const data = await res.json()
  const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
  const raw: RawTask[] = toolUse?.input?.tasks ?? []

  const tasks = raw
    .filter((t) => t && t.title && t.starts_at)
    .slice(0, 20)
    .map((t) => ({
      title: String(t.title).slice(0, 200),
      type: APPT_TYPES.includes(t.type ?? '') ? t.type : 'other',
      unit_code: t.unit_code ? String(t.unit_code).slice(0, 40) : null,
      customer: t.customer ? String(t.customer).slice(0, 120) : null,
      who: t.who ? String(t.who).slice(0, 120) : null,
      location: t.location ? String(t.location).slice(0, 200) : null,
      starts_at: mytToIso(t.starts_at),
      ends_at: mytToIso(t.ends_at),
      notes: t.notes ? String(t.notes).slice(0, 500) : null,
    }))
    .filter((t) => t.starts_at)

  return jsonRes({ tasks })
})
