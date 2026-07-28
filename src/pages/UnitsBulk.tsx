import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Project } from '../lib/types'
import { Layout } from '../components/Layout'
import { LoadingState, EmptyState } from '../components/ui'
import { BackLink } from '../components/BackLink'
import { STAFF_PICS } from '../lib/units'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { usePersistedState } from '../lib/usePersistedState'

// The columns the bulk grid can edit. Richer fields (house types, owner,
// key-holder structure) stay on the per-unit form; the grid covers the
// high-volume text/number fields that benefit from editing many at once.
type EditField = 'customer_name' | 'unit_code' | 'phone' | 'project' | 'pic' | 'order_total' | 'target_date'

// A draft holds only the cells the user has touched, as raw strings.
type Draft = Partial<Record<EditField, string>>

export default function UnitsBulk() {
  const { isAdmin, displayName } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [showArchived, setShowArchived] = usePersistedState('tenn_unitsbulk_archived', false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const [{ data: j }, { data: p }] = await Promise.all([
      supabase.from('jobs').select('*').order('project').order('customer_name'),
      supabase.from('projects').select('name').order('name'),
    ])
    setJobs((j as Job[]) ?? [])
    setProjects((p as Pick<Project, 'name'>[] | null)?.map((x) => x.name) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useAutoRefresh(load)

  // Original (string) value of a cell, for comparison + display fallback.
  function original(job: Job, f: EditField): string {
    if (f === 'order_total') return job.order_total ? String(job.order_total) : ''
    if (f === 'target_date') return job.target_date ?? ''
    return (job[f] as string) ?? ''
  }

  function cellValue(job: Job, f: EditField): string {
    const d = drafts[job.id]
    return d && f in d ? (d[f] as string) : original(job, f)
  }

  function setCell(job: Job, f: EditField, v: string) {
    setMsg(null)
    setDrafts((prev) => {
      const next = { ...prev }
      const row: Draft = { ...next[job.id] }
      if (v === original(job, f)) delete row[f]
      else row[f] = v
      if (Object.keys(row).length === 0) delete next[job.id]
      else next[job.id] = row
      return next
    })
  }

  const visible = useMemo(
    () => jobs.filter((j) => j.is_archived === showArchived),
    [jobs, showArchived],
  )

  const dirtyIds = Object.keys(drafts)

  async function saveAll() {
    if (dirtyIds.length === 0) return
    setSaving(true)
    setMsg(null)
    let ok = 0
    let failed = 0
    for (const id of dirtyIds) {
      const d = drafts[id]
      const patch: Record<string, string | number | null> = { updated_by: displayName }
      for (const [f, raw] of Object.entries(d) as [EditField, string][]) {
        if (f === 'order_total') patch[f] = Number(raw) || 0
        else if (f === 'target_date') patch[f] = raw || null
        else patch[f] = raw.trim()
      }
      const { error } = await supabase.from('jobs').update(patch).eq('id', id)
      if (error) failed++
      else ok++
    }
    await load()
    setDrafts({})
    setSaving(false)
    setMsg(failed ? `Saved ${ok}, ${failed} failed.` : `Saved ${ok} unit${ok === 1 ? '' : 's'}.`)
  }

  if (!isAdmin) {
    return (
      <Layout title="Bulk edit" back={<BackLink fallback="/units" />}>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Admins only.
        </p>
      </Layout>
    )
  }

  const cell = 'w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none hover:border-slate-200 focus:border-slate-900 focus:bg-white'
  const th = 'px-2 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap'

  return (
    <Layout title="Bulk edit units" back={<BackLink fallback="/units" />} wide onRefresh={load}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs font-medium text-slate-500 underline"
        >
          {showArchived ? '← Active units' : 'View archived'}
        </button>
        <div className="flex items-center gap-2">
          {dirtyIds.length > 0 && (
            <button
              onClick={() => { setDrafts({}); setMsg(null) }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 active:bg-slate-100"
            >
              Discard
            </button>
          )}
          <button
            onClick={saveAll}
            disabled={saving || dirtyIds.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : dirtyIds.length ? `Save ${dirtyIds.length} change${dirtyIds.length === 1 ? '' : 's'}` : 'Save'}
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      <p className="mb-3 px-1 text-xs text-slate-400">
        Tip: edit any cell, then Save. Leave the richer fields (house type, owner, keys) to each unit's full form.
      </p>

      {loading ? (
        <LoadingState skeleton />
      ) : visible.length === 0 ? (
        <EmptyState>
          No {showArchived ? 'archived' : 'active'} units.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={th}>Customer</th>
                <th className={th}>Address / unit code</th>
                <th className={th}>Phone</th>
                <th className={th}>Project</th>
                <th className={th}>PIC</th>
                <th className={th + ' text-right'}>Order total (RM)</th>
                <th className={th}>Target</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => {
                const dirty = job.id in drafts
                return (
                  <tr key={job.id} className={'border-b border-slate-100 last:border-0 ' + (dirty ? 'bg-amber-50/60' : '')}>
                    <td className="min-w-[10rem] px-1">
                      <input className={cell} value={cellValue(job, 'customer_name')} onChange={(e) => setCell(job, 'customer_name', e.target.value)} />
                    </td>
                    <td className="min-w-[12rem] px-1">
                      <input className={cell} value={cellValue(job, 'unit_code')} onChange={(e) => setCell(job, 'unit_code', e.target.value)} />
                    </td>
                    <td className="min-w-[8rem] px-1">
                      <input type="tel" className={cell} value={cellValue(job, 'phone')} onChange={(e) => setCell(job, 'phone', e.target.value)} />
                    </td>
                    <td className="min-w-[10rem] px-1">
                      <select className={cell} value={cellValue(job, 'project')} onChange={(e) => setCell(job, 'project', e.target.value)}>
                        {!projects.includes(cellValue(job, 'project')) && (
                          <option value={cellValue(job, 'project')}>{cellValue(job, 'project') || '—'}</option>
                        )}
                        {projects.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-[7rem] px-1">
                      <select className={cell} value={cellValue(job, 'pic')} onChange={(e) => setCell(job, 'pic', e.target.value)}>
                        <option value="">—</option>
                        {!((STAFF_PICS as readonly string[]).includes(cellValue(job, 'pic'))) && cellValue(job, 'pic') && (
                          <option value={cellValue(job, 'pic')}>{cellValue(job, 'pic')}</option>
                        )}
                        {STAFF_PICS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-[8rem] px-1">
                      <input type="number" inputMode="decimal" min="0" step="0.01" className={cell + ' text-right tabular-nums'} value={cellValue(job, 'order_total')} onChange={(e) => setCell(job, 'order_total', e.target.value)} placeholder="0" />
                    </td>
                    <td className="min-w-[8rem] px-1">
                      <input type="date" className={cell} value={cellValue(job, 'target_date')} onChange={(e) => setCell(job, 'target_date', e.target.value)} />
                    </td>
                    <td className="px-2 whitespace-nowrap">
                      <Link to={`/job/${job.id}`} className="text-xs font-medium text-slate-400 underline">Open</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
