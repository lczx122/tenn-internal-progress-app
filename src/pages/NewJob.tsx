import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { LoadingState } from '../components/ui'
import { BackLink } from '../components/BackLink'
import type { Job, Project } from '../lib/types'
import {
  HOUSE_TYPES,
  STAFF_PICS,
  RELATIONSHIPS,
  KEY_HOLDER_TYPES,
  type KeyHolderType,
  defaultPic,
  keyHolderLabel,
} from '../lib/units'

const DEFAULT_PROJECT = 'Ambience Pulau Gadong'

const emptyForm = {
  customer_name: '',
  phone: '',
  is_owner: true,
  owner_relationship: '',
  unit_code: '',
  project: '',
  house_types: [] as string[],
  pics: [] as string[],
  key_holder_type: 'Office' as KeyHolderType,
  key_holder_detail: '',
  start_date: '',
  target_date: '',
}
type FormState = typeof emptyForm

export default function NewJob() {
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)
  const { displayName, session, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [projects, setProjects] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState<string | null>(null)

  // Load the admin-managed project list.
  useEffect(() => {
    supabase
      .from('projects')
      .select('name')
      .order('name')
      .then(({ data }) => {
        const list = (data as Pick<Project, 'name'>[] | null)?.map((p) => p.name) ?? []
        setProjects(list)
        // Default a brand-new unit's project + PIC once the lists are known.
        if (!editing) {
          setForm((f) => ({
            ...f,
            project: f.project || list[0] || DEFAULT_PROJECT,
            pics: f.pics.length ? f.pics : defaultPic(displayName) ? [defaultPic(displayName)] : [],
          }))
        }
      })
  }, [editing, displayName])

  // In edit mode, load the existing unit and pre-fill the form.
  useEffect(() => {
    if (!id) return
    supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const j = data as Job | null
        if (!j) {
          setError('Unit not found.')
          setLoading(false)
          return
        }
        const type = (KEY_HOLDER_TYPES as readonly string[]).includes(j.key_holder_type)
          ? (j.key_holder_type as KeyHolderType)
          : 'Office'
        // Other Staff / Others store the raw detail in key_holder.
        const detail = type === 'Other Staff' || type === 'Others' ? j.key_holder : ''
        setForm({
          customer_name: j.customer_name ?? '',
          phone: j.phone ?? '',
          is_owner: j.is_owner ?? true,
          owner_relationship: j.owner_relationship ?? '',
          unit_code: j.unit_code || j.address || '',
          project: j.project ?? '',
          house_types: j.house_types ?? [],
          pics: j.pics?.length ? j.pics : j.pic ? [j.pic] : [],
          key_holder_type: type,
          key_holder_detail: detail,
          start_date: j.start_date ?? '',
          target_date: j.target_date ?? '',
        })
        setLoading(false)
      })
  }, [id])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function toggleHouseType(t: string) {
    setForm((f) => ({
      ...f,
      house_types: f.house_types.includes(t)
        ? f.house_types.filter((x) => x !== t)
        : [...f.house_types, t],
    }))
  }

  function togglePic(p: string) {
    setForm((f) => ({
      ...f,
      pics: f.pics.includes(p) ? f.pics.filter((x) => x !== p) : [...f.pics, p],
    }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) {
      setError('Customer name is required.')
      return
    }
    setBusy(true)
    setError(null)

    const key_holder = keyHolderLabel(form.key_holder_type, form.key_holder_detail, form.pics[0] ?? '')
    const record = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      is_owner: form.is_owner,
      owner_relationship: form.is_owner ? '' : form.owner_relationship.trim(),
      unit_code: form.unit_code.trim(),
      project: form.project.trim() || projects[0] || DEFAULT_PROJECT,
      house_types: form.house_types,
      pics: form.pics,
      pic: form.pics[0] ?? '',
      key_holder_type: form.key_holder_type,
      key_holder,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      updated_by: displayName,
    }

    if (editing && id) {
      const { error } = await supabase.from('jobs').update(record).eq('id', id)
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
      navigate(`/job/${id}`, { replace: true })
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert(record)
      .select()
      .single()

    if (error || !data) {
      setError(error?.message ?? 'Could not create unit.')
      setBusy(false)
      return
    }

    // Seed the timeline with a "created" event.
    await supabase.from('job_events').insert({
      job_id: data.id,
      type: 'created',
      body: `Unit created`,
      author_id: session?.user.id ?? null,
      author_name: displayName,
    })

    navigate(`/job/${data.id}`, { replace: true })
  }

  const field =
    'w-full rounded-lg border border-line-2 px-3 py-2.5 text-base outline-none focus:border-strong'
  const labelCls = 'mb-1 block text-sm font-medium text-body'
  const cardCls = 'rounded-xl bg-surface p-4 shadow-sm space-y-4'
  const sectionTitle = 'text-sm font-semibold text-ink-2'

  if (loading) {
    return (
      <Layout title={editing ? 'Edit unit' : 'New unit'} back={<BackLink fallback={id ? `/job/${id}` : '/units'} />}>
        <LoadingState skeleton />
      </Layout>
    )
  }

  return (
    <Layout title={editing ? 'Edit unit' : 'New Unit'} back={<BackLink fallback={id ? `/job/${id}` : '/units'} />}>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
        {/* Customer details */}
        <div className={cardCls}>
          <h2 className={sectionTitle}>Customer details</h2>
          <div>
            <label className={labelCls}>Customer name *</label>
            <input
              className={field}
              value={form.customer_name}
              onChange={(e) => set('customer_name', e.target.value)}
              placeholder="e.g. Mr Tan Ah Kow"
            />
          </div>
          <div>
            <label className={labelCls}>Contact number</label>
            <input
              type="tel"
              className={field}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="e.g. 012-345 6789"
            />
          </div>
          <div>
            <label className={labelCls}>Is this person the owner?</label>
            <div className="flex gap-2">
              {[
                { v: true, label: 'Owner' },
                { v: false, label: 'Not the owner' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => set('is_owner', o.v)}
                  className={
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium ' +
                    (form.is_owner === o.v
                      ? 'border-primary bg-primary text-white'
                      : 'border-line-2 bg-surface text-muted active:bg-press')
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {!form.is_owner && (
            <div>
              <label className={labelCls}>Relationship to owner</label>
              <select
                className={field}
                value={form.owner_relationship}
                onChange={(e) => set('owner_relationship', e.target.value)}
              >
                <option value="">Select…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Address / unit code</label>
            <textarea
              className={field}
              rows={2}
              value={form.unit_code}
              onChange={(e) => set('unit_code', e.target.value)}
              placeholder="e.g. A-10-06, Ambience Pulau Gadong, 75250 Melaka"
            />
          </div>
        </div>

        {/* Property */}
        <div className={cardCls}>
          <h2 className={sectionTitle}>Property</h2>
          <div>
            <label className={labelCls}>Project</label>
            {projects.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-2 px-3 py-2.5 text-sm text-faint">
                No projects yet.{' '}
                {isAdmin ? (
                  <Link to="/projects" className="font-medium text-muted underline">
                    Add one
                  </Link>
                ) : (
                  'Ask an admin to add one.'
                )}
              </p>
            ) : (
              <select
                className={field}
                value={form.project}
                onChange={(e) => set('project', e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
            {isAdmin && projects.length > 0 && (
              <Link to="/projects" className="mt-1 inline-block text-xs font-medium text-faint underline">
                Manage projects
              </Link>
            )}
          </div>
          <div>
            <label className={labelCls}>House type</label>
            <div className="flex flex-wrap gap-2">
              {HOUSE_TYPES.map((t) => {
                const on = form.house_types.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleHouseType(t)}
                    className={
                      'rounded-full border px-3 py-1.5 text-sm font-medium ' +
                      (on
                        ? 'border-primary bg-primary text-white'
                        : 'border-line-2 bg-surface text-muted active:bg-press')
                    }
                  >
                    {on ? '✓ ' : ''}
                    {t}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-faint">Tick all that apply.</p>
          </div>
        </div>

        {/* Assignment */}
        <div className={cardCls}>
          <h2 className={sectionTitle}>Assignment</h2>
          <div>
            <label className={labelCls}>Person(s) in charge (PIC)</label>
            <div className="flex flex-wrap gap-2">
              {STAFF_PICS.map((p) => {
                const on = form.pics.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePic(p)}
                    className={
                      'rounded-full border px-3 py-1.5 text-sm font-medium ' +
                      (on
                        ? 'border-primary bg-primary text-white'
                        : 'border-line-2 bg-surface text-muted active:bg-press')
                    }
                  >
                    {on ? '✓ ' : ''}
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Who has the keys?</label>
            <select
              className={field}
              value={form.key_holder_type}
              onChange={(e) => {
                set('key_holder_type', e.target.value as KeyHolderType)
                set('key_holder_detail', '')
              }}
            >
              {KEY_HOLDER_TYPES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {form.key_holder_type === 'Other Staff' && (
              <select
                className={`${field} mt-2`}
                value={form.key_holder_detail}
                onChange={(e) => set('key_holder_detail', e.target.value)}
              >
                <option value="">Select staff…</option>
                {STAFF_PICS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
            {form.key_holder_type === 'Others' && (
              <input
                className={`${field} mt-2`}
                value={form.key_holder_detail}
                onChange={(e) => set('key_holder_detail', e.target.value)}
                placeholder="e.g. Neighbour, contractor…"
              />
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Start date</label>
              <input
                type="date"
                className={field}
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Target completion</label>
              <input
                type="date"
                className={field}
                value={form.target_date}
                onChange={(e) => set('target_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary py-3 font-medium text-white active:bg-primary-press disabled:opacity-60"
        >
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create unit'}
        </button>
      </form>
    </Layout>
  )
}
