import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job } from '../lib/types'
import { APPT_TYPES, getApptType, toLocalInput } from '../lib/appointments'
import { runDb, toastErr } from '../lib/toast'

// "Throw in some text, get a schedule": paste a WhatsApp message / site notes,
// the parse-tasks edge function (Claude) extracts appointments, the user
// reviews and edits the proposals here, and only confirmed rows are inserted
// into the shared appointments table.

interface Proposal {
  include: boolean
  title: string
  type: string
  unit_code: string | null
  customer: string | null
  who: string | null
  location: string | null
  starts_at: string // datetime-local value
  ends_at: string | null
  notes: string | null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function MagicScheduleSheet({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void | Promise<void> }) {
  const { displayName, session } = useAuth()
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    supabase
      .from('jobs')
      .select('id, unit_code, customer_name, address')
      .eq('is_archived', false)
      .then(({ data }) => setJobs((data as Job[]) ?? []))
  }, [])

  // Match a proposal's unit code to a real unit — same exact-match rule as the
  // SO linker (separators ignored, letters kept).
  const jobByCode = useMemo(() => {
    const m = new Map<string, Job>()
    for (const j of jobs) if (j.unit_code) m.set(norm(j.unit_code), j)
    return m
  }, [jobs])
  const matchJob = (p: Proposal): Job | undefined =>
    (p.unit_code && jobByCode.get(norm(p.unit_code))) ||
    (p.customer ? jobs.find((j) => j.customer_name.toLowerCase() === p.customer!.toLowerCase()) : undefined)

  async function parse() {
    if (!text.trim()) return
    setParsing(true)
    try {
      const { data, error } = await supabase.functions.invoke('parse-tasks', {
        body: {
          text,
          now: new Date().toISOString(),
          units: jobs.filter((j) => j.unit_code).map((j) => ({ code: j.unit_code, customer: j.customer_name })),
          staff: [], // model still picks names out of the text itself
        },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      const tasks = (data?.tasks ?? []) as (Omit<Proposal, 'include' | 'starts_at'> & { starts_at: string })[]
      if (tasks.length === 0) {
        toastErr('No schedulable tasks found in that text.')
        return
      }
      setProposals(
        tasks.map((t) => ({
          ...t,
          include: true,
          starts_at: toLocalInput(t.starts_at),
          ends_at: t.ends_at ? toLocalInput(t.ends_at) : null,
        })),
      )
    } catch (e) {
      toastErr(`Could not parse — ${e instanceof Error ? e.message : 'try again'}`)
    } finally {
      setParsing(false)
    }
  }

  function patch(i: number, fields: Partial<Proposal>) {
    setProposals((prev) => prev!.map((p, idx) => (idx === i ? { ...p, ...fields } : p)))
  }

  const chosen = (proposals ?? []).filter((p) => p.include && p.title.trim() && p.starts_at)

  async function saveAll() {
    if (chosen.length === 0) return
    setSaving(true)
    const rows = chosen.map((p) => {
      const job = matchJob(p)
      return {
        type: p.type,
        title: p.title.trim(),
        assignee_ids: [] as string[],
        assigned_to: null as string | null,
        who: p.who ?? '',
        starts_at: new Date(p.starts_at).toISOString(),
        ends_at: p.ends_at ? new Date(p.ends_at).toISOString() : null,
        job_id: job?.id ?? null,
        customer_name: job?.customer_name ?? p.customer ?? '',
        location: p.location ?? job?.address ?? '',
        notes: p.notes ?? '',
        is_private: false,
        status: 'scheduled',
        created_by: session?.user.id ?? null,
        created_by_name: displayName,
      }
    })
    const ok = await runDb(supabase.from('appointments').insert(rows), {
      ok: `${rows.length} appointment${rows.length === 1 ? '' : 's'} added to the schedule`,
      fail: 'Nothing was added',
    })
    setSaving(false)
    if (ok) {
      await onSaved?.()
      onClose()
    }
  }

  const inp = 'w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-base outline-none focus:border-strong'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">✨ Schedule from text</h2>
          <button onClick={onClose} aria-label="Close" className="min-h-[40px] min-w-[40px] rounded-lg text-faint active:bg-press">
            ✕
          </button>
        </div>

        {!proposals ? (
          <>
            <p className="mb-2 text-xs text-muted-2">
              Paste anything — a WhatsApp message, site notes, English or Malay. The assistant turns it into
              appointments for you to review before anything is saved.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={'e.g.\nAli pergi ukur kabinet C-08-10 esok 3pm.\nPainting starts at D-07-03 on Wednesday.\nCollect balance from Raju on Friday morning.'}
              className={inp}
            />
            <button
              onClick={parse}
              disabled={parsing || !text.trim()}
              className="mt-3 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white active:bg-primary-press disabled:opacity-50"
            >
              {parsing ? 'Reading your text…' : 'Find tasks'}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-2">
              Found {proposals.length} task{proposals.length === 1 ? '' : 's'} — untick anything wrong, adjust, then add.
            </p>
            <ul className="space-y-3">
              {proposals.map((p, i) => {
                const job = matchJob(p)
                const t = getApptType(p.type)
                return (
                  <li key={i} className={'rounded-xl border p-3 ' + (p.include ? 'border-line' : 'border-line-faint opacity-50')}>
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.include}
                        onChange={(e) => patch(i, { include: e.target.checked })}
                        aria-label="Include this task"
                        className="h-5 w-5"
                      />
                      <input value={p.title} onChange={(e) => patch(i, { title: e.target.value })} className={inp} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={p.type} onChange={(e) => patch(i, { type: e.target.value })} className={inp}>
                        {APPT_TYPES.map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={p.starts_at}
                        onChange={(e) => patch(i, { starts_at: e.target.value })}
                        className={inp + ' appearance-none'}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${t.accent}`}>{t.label}</span>
                      {job ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          ⌂ {job.unit_code} · {job.customer_name}
                        </span>
                      ) : p.unit_code ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                          {p.unit_code} — no matching unit, saved without link
                        </span>
                      ) : null}
                      {p.who && <span className="text-muted-2">👤 {p.who}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setProposals(null)}
                className="min-h-[44px] rounded-lg border border-line-2 bg-surface px-4 text-sm font-medium text-body active:bg-press"
              >
                ← Edit text
              </button>
              <button
                onClick={saveAll}
                disabled={saving || chosen.length === 0}
                className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Adding…' : `Add ${chosen.length} to schedule`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
