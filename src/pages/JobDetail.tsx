import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Appointment, Claim, Job, JobEvent, JobWork, UnitSupplier } from '../lib/types'
import { STAGES, getStage } from '../lib/stages'
import { CATEGORIES, getCategory } from '../lib/categories'
import { getApptType } from '../lib/appointments'
import { eventIconName } from '../lib/jobEvents'
import { Icon } from '../components/Icon'
import { Layout } from '../components/Layout'
import { BackLink } from '../components/BackLink'
import { StageBar } from '../components/StageBar'
import { ClaimsSection } from '../components/ClaimsSection'
import { SupplierSection } from '../components/SupplierSection'
import { formatDate, formatDateTime } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { runDb, toastOk } from '../lib/toast'
import { confirmDialog } from '../lib/dialog'
import { ErrorState } from '../components/ErrorState'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { displayName, session, isAdmin, isBoss } = useAuth()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [works, setWorks] = useState<JobWork[]>([])
  const [events, setEvents] = useState<JobEvent[]>([])
  const [appts, setAppts] = useState<Appointment[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [soCount, setSoCount] = useState<number | null>(null)
  const [suppliers, setSuppliers] = useState<UnitSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      const [{ data: j, error: je }, { data: wk }, { data: ev }, { data: ap }, { data: cl }, { count: sc }, { data: sup }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase.from('job_works').select('*').eq('job_id', id).order('created_at'),
      supabase.from('job_events').select('*').eq('job_id', id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('*').eq('job_id', id).order('starts_at'),
      supabase.from('claims').select('*').eq('job_id', id).order('created_at'),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('unit_id', id).eq('doc_type', 'SO'),
      // Boss-only (RLS returns nothing for non-boss).
      supabase.from('unit_suppliers').select('*').eq('job_id', id).order('created_at'),
    ])
      // "No row" (PGRST116) is a real not-found; anything else is a failed load
      // (offline / server) — show retry instead of pretending the unit is gone.
      setLoadFailed(!!je && (je as { code?: string }).code !== 'PGRST116')
      setJob((j as Job) ?? null)
      setWorks((wk as JobWork[]) ?? [])
      setEvents((ev as JobEvent[]) ?? [])
      setAppts((ap as Appointment[]) ?? [])
      setClaims((cl as Claim[]) ?? [])
      setSoCount(sc ?? 0)
      setSuppliers((sup as UnitSupplier[]) ?? [])
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadAll()
    // One quiet refetch per burst of realtime events (no progress-bar sweep).
    const rt = coalesce(() => loadAll())
    const channel = realtimeChannel(`job-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works', filter: `job_id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_events', filter: `job_id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `job_id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims', filter: `job_id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations', filter: `unit_id=eq.${id}` }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_suppliers', filter: `job_id=eq.${id}` }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
      supabase.removeChannel(channel)
    }
  }, [id, loadAll])

  // Refetch after waking from idle (realtime socket may have died).
  useAutoRefresh(loadAll)

  async function logEvent(type: JobEvent['type'], body: string) {
    if (!id) return
    await supabase.from('job_events').insert({
      job_id: id,
      type,
      body,
      author_id: session?.user.id ?? null,
      author_name: displayName,
    })
  }

  // Bumps the unit's updated_by/at so the list reflects the latest activity.
  async function touchJob() {
    if (!id) return
    await supabase.from('jobs').update({ updated_by: displayName }).eq('id', id)
  }

  async function changeWorkStage(work: JobWork, stage: string) {
    if (stage === work.stage) return
    setBusy(true)
    const ok = await runDb(supabase.from('job_works').update({ stage, updated_by: displayName }).eq('id', work.id), {
      fail: 'Stage not saved',
    })
    if (ok) {
      await logEvent('stage', `${getCategory(work.category).label}: ${getStage(work.stage).label} → ${getStage(stage).label}`)
      await touchJob()
    }
    setBusy(false)
  }

  async function saveWorkRemarks(work: JobWork, remarks: string) {
    setBusy(true)
    const ok = await runDb(
      supabase.from('job_works').update({ remarks, updated_by: displayName }).eq('id', work.id),
      { fail: 'Remarks not saved' },
    )
    if (ok) await touchJob()
    setBusy(false)
  }

  async function deleteWork(work: JobWork) {
    const label = getCategory(work.category).label
    if (
      !(await confirmDialog({
        title: 'Remove category',
        message: `Remove the “${label}” category and its progress from this unit?`,
        confirmLabel: 'Remove',
        danger: true,
      }))
    )
      return
    setBusy(true)
    const ok = await runDb(supabase.from('job_works').delete().eq('id', work.id), {
      ok: `${label} removed`,
      fail: 'Could not remove',
    })
    if (ok) {
      await logEvent('note', `Removed ${label} category`)
      await touchJob()
    }
    setBusy(false)
  }

  async function addWork(category: string, title: string, stage: string) {
    if (!id) return
    setBusy(true)
    const ok = await runDb(
      supabase.from('job_works').insert({ job_id: id, category, title, stage, updated_by: displayName }),
      { ok: `${getCategory(category).label} added`, fail: 'Could not add category' },
    )
    if (ok) {
      await logEvent('note', `Added ${getCategory(category).label}${title ? ` — ${title}` : ''}`)
      await touchJob()
      setAdding(false)
    }
    setBusy(false)
  }

  async function addNote() {
    const trimmed = note.trim()
    if (!trimmed) return
    setBusy(true)
    const ok = await runDb(
      supabase.from('job_events').insert({
        job_id: id,
        type: 'note',
        body: trimmed,
        author_id: session?.user.id ?? null,
        author_name: displayName,
      }),
      { ok: 'Note posted', fail: 'Note not posted' },
    )
    if (ok) {
      await touchJob()
      setNote('') // keep the text on failure so nothing typed is lost
    }
    setBusy(false)
  }

  async function toggleArchive() {
    if (!job || busy) return
    setBusy(true)
    const ok = await runDb(
      supabase.from('jobs').update({ is_archived: !job.is_archived, updated_by: displayName }).eq('id', job.id),
      { ok: job.is_archived ? 'Unit restored' : 'Unit archived', fail: 'Could not archive' },
    )
    setBusy(false)
    if (ok) navigate('/units')
  }

  async function deleteJob() {
    if (!job || busy) return
    if (
      !(await confirmDialog({
        title: 'Delete unit',
        message: `Permanently delete “${job.customer_name}” and ALL its categories, collections, history and appointments? This cannot be undone.`,
        confirmLabel: 'Delete forever',
        danger: true,
        requireText: job.unit_code || job.customer_name,
      }))
    )
      return
    setBusy(true)
    const ok = await runDb(supabase.from('jobs').delete().eq('id', job.id), {
      fail: 'Could not delete',
    })
    setBusy(false)
    if (ok) {
      toastOk('Unit deleted')
      navigate('/units')
    }
  }

  if (loading) {
    return (
      <Layout title="Unit">
        <p className="py-10 text-center text-slate-400">Loading…</p>
      </Layout>
    )
  }

  if (!job) {
    return (
      <Layout title="Unit" back={<BackLink fallback="/units" />}>
        {loadFailed ? (
          <ErrorState onRetry={loadAll} />
        ) : (
          <p className="py-10 text-center text-slate-400">Unit not found.</p>
        )}
      </Layout>
    )
  }

  const usedCategories = new Set(works.map((w) => w.category))

  return (
    <Layout title={job.unit_code || job.address || job.customer_name} back={<BackLink fallback="/units" />} onRefresh={loadAll}>
      <div className="xl:columns-2 xl:gap-6 xl:[&>div]:break-inside-avoid xl:[&>section]:mb-4 xl:[&>section]:mt-0 xl:[&>section]:break-inside-avoid">
      {/* Summary card */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-2">
          {job.project ? (
            <Link
              to={`/units?project=${encodeURIComponent(job.project)}`}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 active:bg-slate-200"
            >
              <Icon name="folder" className="h-3.5 w-3.5" /> {job.project}
            </Link>
          ) : (
            <span />
          )}
          <Link
            to={`/job/${job.id}/edit`}
            className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 active:bg-slate-100"
          >
            ✎ Edit details
          </Link>
        </div>

        <p className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
          <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" /> {job.customer_name}
        </p>
        {(job.unit_code || job.address) && (
          <p className="mt-1 flex items-center gap-1.5 text-slate-700">
            <Icon name="home" className="h-4 w-4 shrink-0 text-slate-400" /> {job.unit_code || job.address}
          </p>
        )}
        {job.phone && (
          <p className="mt-1 flex items-center gap-1.5 text-slate-700">
            <Icon name="phone" className="h-4 w-4 shrink-0 text-slate-400" />
            <a href={`tel:${job.phone}`} className="underline">{job.phone}</a>
          </p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <Icon name="user" className="h-3.5 w-3.5 shrink-0" />
          {job.is_owner ? 'Owner' : `Not owner${job.owner_relationship ? ` · ${job.owner_relationship}` : ''}`}
        </p>

        {job.house_types && job.house_types.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.house_types.map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-400">PIC</div>
            <div className="font-medium text-slate-700">
              {job.pics?.length ? job.pics.join(', ') : job.pic || '—'}
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <div className="flex items-center gap-1 text-amber-700/70"><Icon name="key" className="h-3.5 w-3.5" /> Keys</div>
            <div className="font-medium text-amber-800">{job.key_holder || 'Office'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-400">Start</div>
            <div className="font-medium text-slate-700">{formatDate(job.start_date)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-400">Target</div>
            <div className="font-medium text-slate-700">{formatDate(job.target_date)}</div>
          </div>
        </div>

        {soCount != null && !job.is_archived && (soCount === 0 || (soCount >= 2 && isAdmin)) && (
          <Link
            to={`/quote?unit=${job.id}&type=SO`}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-100"
          >
            <Icon name="receipt" className="h-4 w-4" />
            {soCount === 0 ? 'Convert to Sales Order' : `Consolidate ${soCount} Sales Orders into one`}
          </Link>
        )}
      </section>

      {/* Customer claims */}
      <ClaimsSection
        job={job}
        claims={claims}
        works={works}
        displayName={displayName}
        session={session}
        isAdmin={isAdmin}
        onChange={loadAll}
      />

      {/* Appointments */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Appointments</h2>
          <Link
            to={`/schedule/new?job_id=${job.id}`}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700"
          >
            + Schedule
          </Link>
        </div>
        {appts.filter((a) => a.status !== 'cancelled').length === 0 ? (
          <p className="text-sm text-slate-400">No appointments yet.</p>
        ) : (
          <ul className="space-y-2">
            {appts
              .filter((a) => a.status !== 'cancelled')
              .map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/appointment/${a.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 active:bg-slate-100"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <Icon name={getApptType(a.type).icon} className="h-4 w-4 shrink-0 text-slate-400" /> {getApptType(a.type).label}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {new Date(a.starts_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {a.who ? ` · ${a.who}` : ''}
                      </span>
                    </span>
                    {a.status === 'done' && <span className="shrink-0 text-xs font-medium text-emerald-600">Done</span>}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Work categories */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-700">Job categories</h2>
          {!adding && usedCategories.size < CATEGORIES.length && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700"
            >
              + Add category
            </button>
          )}
        </div>

        {adding && (
          <AddWorkForm
            used={usedCategories}
            busy={busy}
            onCancel={() => setAdding(false)}
            onAdd={addWork}
          />
        )}

        {works.length === 0 && !adding ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            No job categories yet. Tap “+ Add category”.
          </div>
        ) : (
          <div className="space-y-3">
            {works.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                busy={busy}
                onChangeStage={(s) => changeWorkStage(w, s)}
                onSaveRemarks={(r) => saveWorkRemarks(w, r)}
                onDelete={() => deleteWork(w)}
                canDelete={isAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {/* Supplier progress — boss only */}
      {isBoss && job && (
        <SupplierSection job={job} suppliers={suppliers} session={session} onChange={loadAll} />
      )}

      {/* Add note */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Add an update / note</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What happened on site today?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
        <button
          onClick={addNote}
          disabled={busy || !note.trim()}
          className="mt-2 w-full rounded-lg bg-slate-900 py-2.5 font-medium text-white active:bg-slate-700 disabled:opacity-50"
        >
          Post update
        </button>
      </section>

      {/* Timeline */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Activity timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div className="mt-0.5 text-slate-400"><Icon name={eventIconName(ev.type)} className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{ev.body}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {ev.author_name || 'Someone'} · {formatDateTime(ev.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <div className="my-6 space-y-2">
          <button
            onClick={toggleArchive}
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-500 active:bg-slate-100 disabled:opacity-50"
          >
            {job.is_archived ? 'Unarchive unit' : 'Archive unit (mark complete)'}
          </button>
          {job.is_archived && (
            <button
              onClick={deleteJob}
              disabled={busy}
              className="w-full rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
            >
              Delete unit permanently
            </button>
          )}
        </div>
      )}
      </div>
    </Layout>
  )
}

// ---- One work category card with its own stage + remarks ----
function WorkCard({
  work,
  busy,
  onChangeStage,
  onSaveRemarks,
  onDelete,
  canDelete,
}: {
  work: JobWork
  busy: boolean
  onChangeStage: (stage: string) => void
  onSaveRemarks: (remarks: string) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const cat = getCategory(work.category)
  const [remarks, setRemarks] = useState(work.remarks)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setRemarks(work.remarks)
  }, [work.remarks])

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cat.accent}`}>
            {cat.label}
          </span>
          {work.title && <p className="mt-1 text-sm text-slate-600">{work.title}</p>}
        </div>
        {canDelete && (
          <button onClick={onDelete} className="shrink-0 text-xs text-slate-300 active:text-red-500">
            Remove
          </button>
        )}
      </div>

      <StageBar stageKey={work.stage} />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STAGES.map((s) => {
          const active = s.key === work.stage
          return (
            <button
              key={s.key}
              disabled={busy}
              onClick={() => onChangeStage(s.key)}
              className={
                'rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ' +
                (active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 active:bg-slate-200')
              }
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Remarks */}
      <div className="mt-3">
        {editing ? (
          <div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Remarks / next action…"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => {
                  onSaveRemarks(remarks)
                  setEditing(false)
                }}
                disabled={busy}
                className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setRemarks(work.remarks)
                  setEditing(false)
                }}
                className="rounded-md px-3 py-1 text-xs font-medium text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex w-full items-start gap-1 text-left text-sm text-slate-500 active:text-slate-700"
          >
            <span className="mt-0.5 text-slate-400"><Icon name="note" className="h-4 w-4" /></span>
            <span className="flex-1">{work.remarks || <span className="italic text-slate-400">Add remarks…</span>}</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Add a new category to the unit ----
function AddWorkForm({
  used,
  busy,
  onCancel,
  onAdd,
}: {
  used: Set<string>
  busy: boolean
  onCancel: () => void
  onAdd: (category: string, title: string, stage: string) => void
}) {
  const available = CATEGORIES.filter((c) => !used.has(c.key))
  const [category, setCategory] = useState(available[0]?.key ?? '')
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState(STAGES[0].key)

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
      >
        {available.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-slate-500">Item / description (optional)</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 2 Room Premium, Premium Smart Lock…"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
      />

      <label className="mb-1 block text-xs font-medium text-slate-500">Starting stage</label>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={() => category && onAdd(category, title.trim(), stage)}
          disabled={busy || !category}
          className="flex-1 rounded-lg bg-slate-900 py-2.5 font-medium text-white active:bg-slate-700 disabled:opacity-50"
        >
          Add
        </button>
        <button onClick={onCancel} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  )
}
