import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Appointment, Job } from '../lib/types'
import { Layout } from '../components/Layout'
import { APPT_TYPES, getApptType, toLocalInput } from '../lib/appointments'

// Default a new appointment to the next whole hour.
function defaultStart(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

export default function AppointmentForm() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const { displayName, session } = useAuth()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Appointment['status']>('scheduled')

  const [form, setForm] = useState({
    type: 'site_visit',
    title: '',
    who: '',
    starts_at: defaultStart(),
    ends_at: '',
    job_id: params.get('job_id') ?? '',
    customer_name: '',
    location: '',
    notes: '',
  })

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Load active units for the link dropdown.
  useEffect(() => {
    supabase
      .from('jobs')
      .select('*')
      .eq('is_archived', false)
      .order('customer_name')
      .then(({ data }) => setJobs((data as Job[]) ?? []))
  }, [])

  // Editing: load the appointment. New + ?job_id: prefill from that unit.
  useEffect(() => {
    if (isEdit) {
      supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          const a = data as Appointment | null
          if (a) {
            setStatus(a.status)
            setForm({
              type: a.type,
              title: a.title,
              who: a.who,
              starts_at: toLocalInput(a.starts_at),
              ends_at: toLocalInput(a.ends_at),
              job_id: a.job_id ?? '',
              customer_name: a.customer_name,
              location: a.location,
              notes: a.notes,
            })
          }
          setLoading(false)
        })
    } else if (form.job_id) {
      supabase
        .from('jobs')
        .select('*')
        .eq('id', form.job_id)
        .single()
        .then(({ data }) => {
          const j = data as Job | null
          if (j) setForm((f) => ({ ...f, customer_name: j.customer_name, location: j.address }))
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const selectedJob = useMemo(() => jobs.find((j) => j.id === form.job_id), [jobs, form.job_id])

  async function logToJob(jobId: string, body: string) {
    await supabase.from('job_events').insert({
      job_id: jobId,
      type: 'note',
      body,
      author_id: session?.user.id ?? null,
      author_name: displayName,
    })
    await supabase.from('jobs').update({ updated_by: displayName }).eq('id', jobId)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.starts_at) {
      setError('Pick a date and time.')
      return
    }
    setBusy(true)
    setError(null)
    const row = {
      type: form.type,
      title: form.title.trim(),
      who: form.who.trim(),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      job_id: form.job_id || null,
      customer_name: form.customer_name.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
    }

    if (isEdit) {
      const { error } = await supabase.from('appointments').update(row).eq('id', id)
      if (error) return fail(error.message)
    } else {
      const { error } = await supabase.from('appointments').insert({
        ...row,
        status: 'scheduled',
        created_by: session?.user.id ?? null,
        created_by_name: displayName,
      })
      if (error) return fail(error.message)
      if (row.job_id) {
        const when = new Date(row.starts_at).toLocaleString(undefined, {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        await logToJob(row.job_id, `📅 ${getApptType(row.type).label} scheduled for ${when}${row.who ? ` (${row.who})` : ''}`)
      }
    }
    navigate('/schedule')
  }

  function fail(msg: string) {
    setError(msg)
    setBusy(false)
  }

  async function changeStatus(next: Appointment['status']) {
    if (!id) return
    setBusy(true)
    await supabase.from('appointments').update({ status: next }).eq('id', id)
    if (next === 'done' && form.job_id) {
      await logToJob(form.job_id, `✅ ${getApptType(form.type).label} completed`)
    }
    setBusy(false)
    navigate('/schedule')
  }

  async function remove() {
    if (!id || !window.confirm('Delete this appointment?')) return
    setBusy(true)
    await supabase.from('appointments').delete().eq('id', id)
    navigate('/schedule')
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900'
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700'

  if (loading) {
    return (
      <Layout title="Appointment" back={<BackLink />}>
        <p className="py-10 text-center text-slate-400">Loading…</p>
      </Layout>
    )
  }

  return (
    <Layout title={isEdit ? 'Edit appointment' : 'New appointment'} back={<BackLink />}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className={labelCls}>Type</label>
            <select className={field} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {APPT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Title</label>
            <input
              className={field}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Measure balcony grill"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Starts</label>
              <input
                type="datetime-local"
                className={field}
                value={form.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Ends (optional)</label>
              <input
                type="datetime-local"
                className={field}
                value={form.ends_at}
                onChange={(e) => set('ends_at', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Who's going</label>
            <input
              className={field}
              value={form.who}
              onChange={(e) => set('who', e.target.value)}
              placeholder="e.g. Ahmad"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className={labelCls}>Linked unit (optional)</label>
            <select
              className={field}
              value={form.job_id}
              onChange={(e) => {
                const j = jobs.find((x) => x.id === e.target.value)
                setForm((f) => ({
                  ...f,
                  job_id: e.target.value,
                  customer_name: j ? j.customer_name : f.customer_name,
                  location: j ? j.address : f.location,
                }))
              }}
            >
              <option value="">— None —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.customer_name}
                </option>
              ))}
            </select>
            {selectedJob && (
              <Link to={`/job/${selectedJob.id}`} className="mt-1 inline-block text-xs text-slate-500 underline">
                Open unit ›
              </Link>
            )}
          </div>
          <div>
            <label className={labelCls}>Customer / name</label>
            <input className={field} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input className={field} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={field}
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white active:bg-slate-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create appointment'}
        </button>
      </form>

      {isEdit && (
        <div className="my-5 space-y-2">
          {status === 'scheduled' ? (
            <div className="flex gap-2">
              <button
                onClick={() => changeStatus('done')}
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-60"
              >
                ✅ Mark done
              </button>
              <button
                onClick={() => changeStatus('cancelled')}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-60"
              >
                Cancel appt
              </button>
            </div>
          ) : (
            <button
              onClick={() => changeStatus('scheduled')}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-100 disabled:opacity-60"
            >
              Reopen (mark scheduled)
            </button>
          )}
          <button
            onClick={remove}
            disabled={busy}
            className="w-full rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-60"
          >
            Delete appointment
          </button>
        </div>
      )}
    </Layout>
  )
}

function BackLink() {
  return (
    <Link to="/schedule" className="text-xl leading-none text-slate-300">
      ←
    </Link>
  )
}
