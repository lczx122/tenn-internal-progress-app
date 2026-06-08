import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, JobEvent, JobPhoto } from '../lib/types'
import { STAGES, getStage } from '../lib/stages'
import { Layout } from '../components/Layout'
import { StageBar } from '../components/StageBar'
import { formatDate, formatDateTime } from '../lib/format'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { displayName, session } = useAuth()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    const [{ data: j }, { data: ev }, { data: ph }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase
        .from('job_events')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: false }),
    ])
    setJob((j as Job) ?? null)
    setEvents((ev as JobEvent[]) ?? [])
    setPhotos((ph as JobPhoto[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadAll()
    const channel = supabase
      .channel(`job-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${id}` },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_events', filter: `job_id=eq.${id}` },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_photos', filter: `job_id=eq.${id}` },
        () => loadAll()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, loadAll])

  // Resolve signed URLs for private photos.
  useEffect(() => {
    if (photos.length === 0) return
    let active = true
    Promise.all(
      photos.map(async (p) => {
        const { data } = await supabase.storage
          .from('job-photos')
          .createSignedUrl(p.storage_path, 3600)
        return [p.id, data?.signedUrl ?? ''] as const
      })
    ).then((pairs) => {
      if (active) setPhotoUrls(Object.fromEntries(pairs))
    })
    return () => {
      active = false
    }
  }, [photos])

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

  async function changeStage(stageKey: string) {
    if (!job || stageKey === job.stage) return
    setBusy(true)
    await supabase
      .from('jobs')
      .update({ stage: stageKey, updated_by: displayName })
      .eq('id', job.id)
    await logEvent(
      'stage',
      `Stage changed to “${getStage(stageKey).label}”`
    )
    setBusy(false)
  }

  async function changeKeyHolder() {
    if (!job) return
    const next = window.prompt('Who has the keys now?', job.key_holder)
    if (next === null) return
    const trimmed = next.trim() || 'Office'
    if (trimmed === job.key_holder) return
    setBusy(true)
    await supabase
      .from('jobs')
      .update({ key_holder: trimmed, updated_by: displayName })
      .eq('id', job.id)
    await logEvent('key', `🔑 Keys handed to ${trimmed}`)
    setBusy(false)
  }

  async function addNote() {
    const trimmed = note.trim()
    if (!trimmed || !job) return
    setBusy(true)
    await logEvent('note', trimmed)
    await supabase
      .from('jobs')
      .update({ updated_by: displayName })
      .eq('id', job.id)
    setNote('')
    setBusy(false)
  }

  async function uploadPhoto(file: File) {
    if (!id) return
    setBusy(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { upsert: false })
    if (!error) {
      await supabase.from('job_photos').insert({
        job_id: id,
        storage_path: path,
        author_name: displayName,
      })
      await logEvent('note', '📷 Added a photo')
      await supabase.from('jobs').update({ updated_by: displayName }).eq('id', id)
    } else {
      window.alert(`Upload failed: ${error.message}`)
    }
    setBusy(false)
  }

  async function toggleArchive() {
    if (!job) return
    await supabase
      .from('jobs')
      .update({ is_archived: !job.is_archived, updated_by: displayName })
      .eq('id', job.id)
    navigate('/')
  }

  if (loading) {
    return (
      <Layout title="Job">
        <p className="py-10 text-center text-slate-400">Loading…</p>
      </Layout>
    )
  }

  if (!job) {
    return (
      <Layout
        title="Job"
        back={<BackLink />}
      >
        <p className="py-10 text-center text-slate-400">Job not found.</p>
      </Layout>
    )
  }

  return (
    <Layout title={job.customer_name} back={<BackLink />}>
      {/* Summary card */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        {job.address && <p className="text-slate-700">📍 {job.address}</p>}
        {job.phone && (
          <p className="mt-1 text-slate-700">
            📞 <a href={`tel:${job.phone}`} className="underline">{job.phone}</a>
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-400">Start</div>
            <div className="font-medium text-slate-700">
              {formatDate(job.start_date)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-400">Target</div>
            <div className="font-medium text-slate-700">
              {formatDate(job.target_date)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <StageBar stageKey={job.stage} />
        </div>

        <button
          onClick={changeKeyHolder}
          className="mt-4 flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-left active:bg-amber-100"
        >
          <span className="text-sm text-amber-900">
            🔑 Keys with <strong>{job.key_holder}</strong>
          </span>
          <span className="text-xs font-medium text-amber-700">Change ›</span>
        </button>
      </section>

      {/* Update stage */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Update progress stage
        </h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => {
            const active = s.key === job.stage
            return (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => changeStage(s.key)}
                className={
                  'rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ' +
                  (active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 active:bg-slate-200')
                }
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Photos */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Photos</h2>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700 disabled:opacity-60"
          >
            + Add photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPhoto(f)
              e.target.value = ''
            }}
          />
        </div>
        {photos.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            No photos yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <a
                key={p.id}
                href={photoUrls[p.id]}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg bg-slate-100"
              >
                {photoUrls[p.id] && (
                  <img
                    src={photoUrls[p.id]}
                    alt={p.caption || 'progress photo'}
                    className="h-full w-full object-cover"
                  />
                )}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Add note */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Add an update / note
        </h2>
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
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Activity timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div className="mt-1 text-base leading-none">
                  {iconFor(ev.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {ev.body}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {ev.author_name || 'Someone'} ·{' '}
                    {formatDateTime(ev.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={toggleArchive}
        className="my-6 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-500 active:bg-slate-100"
      >
        {job.is_archived ? 'Unarchive job' : 'Archive job (mark complete)'}
      </button>
    </Layout>
  )
}

function BackLink() {
  return (
    <Link to="/" className="text-xl leading-none text-slate-300">
      ←
    </Link>
  )
}

function iconFor(type: JobEvent['type']): string {
  switch (type) {
    case 'stage':
      return '📈'
    case 'key':
      return '🔑'
    case 'created':
      return '🏁'
    default:
      return '📝'
  }
}
