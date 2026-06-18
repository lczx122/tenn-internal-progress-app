import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { PercentBar } from '../components/StageBar'
import { getStage, overallPercent, STAGES } from '../lib/stages'
import { getCategory, CATEGORIES } from '../lib/categories'
import { relativeTime } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [works, setWorks] = useState<JobWork[]>([])
  const [loading, setLoading] = useState(true)
  // Filters can be seeded from the URL (e.g. the dashboard links to
  // /units?stage=installing, /units?cat=Aluminium, or /units?q=Ahmad).
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') ?? '')
  const [catFilter, setCatFilter] = useState(searchParams.get('cat') ?? '')
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') ?? '')
  const [showArchived, setShowArchived] = useState(false)
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'progress'>('updated')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadSet('tenn_collapsed_projects'))
  const [pinned, setPinned] = useState<Set<string>>(() => loadSet('tenn_pinned_projects'))
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  function toggleIn(
    key: string,
    setter: Dispatch<SetStateAction<Set<string>>>,
    storageKey: string,
  ) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }
  const toggleCollapse = (p: string) => toggleIn(p, setCollapsed, 'tenn_collapsed_projects')
  const togglePin = (p: string) => toggleIn(p, setPinned, 'tenn_pinned_projects')

  async function load() {
    const [{ data: j }, { data: w }] = await Promise.all([
      supabase.from('jobs').select('*').order('updated_at', { ascending: false }),
      supabase.from('job_works').select('*'),
    ])
    setJobs((j as Job[]) ?? [])
    setWorks((w as JobWork[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Live updates on units and their work categories.
    const channel = supabase
      .channel('jobs-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Refetch after waking from idle (realtime socket may have died).
  useAutoRefresh(load)

  // Group work categories by unit.
  const worksByJob = useMemo(() => {
    const m = new Map<string, JobWork[]>()
    for (const w of works) {
      const arr = m.get(w.job_id) ?? []
      arr.push(w)
      m.set(w.job_id, arr)
    }
    return m
  }, [works])

  // All project names, for the filter dropdown.
  const projects = useMemo(() => {
    const s = new Set<string>()
    for (const j of jobs) if (j.project) s.add(j.project)
    return [...s].sort()
  }, [jobs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => j.is_archived === showArchived)
      .filter((j) => !projectFilter || j.project === projectFilter)
      .filter(
        (j) =>
          !q ||
          j.customer_name.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          (j.unit_code ?? '').toLowerCase().includes(q) ||
          (j.pic ?? '').toLowerCase().includes(q) ||
          j.key_holder.toLowerCase().includes(q) ||
          (worksByJob.get(j.id) ?? []).some((w) =>
            w.category.toLowerCase().includes(q)
          )
      )
      .filter((j) => {
        // Category / stage filters work together:
        //  - category only   → units that have that category
        //  - stage only      → units with ANY category at that stage
        //  - both            → units with that category at that stage
        if (!catFilter && !stageFilter) return true
        const w = worksByJob.get(j.id) ?? []
        return w.some(
          (x) =>
            (!catFilter || x.category === catFilter) &&
            (!stageFilter || x.stage === stageFilter)
        )
      })
  }, [jobs, query, showArchived, projectFilter, worksByJob, catFilter, stageFilter])

  // Group the visible units under their project, sort within each group, then
  // float pinned projects to the top.
  const groups = useMemo(() => {
    const pct = (j: Job) => overallPercent((worksByJob.get(j.id) ?? []).map((x) => x.stage))
    const sortItems = (items: Job[]) => {
      const arr = [...items]
      if (sortBy === 'name') arr.sort((a, b) => a.customer_name.localeCompare(b.customer_name))
      else if (sortBy === 'progress') arr.sort((a, b) => pct(a) - pct(b))
      else arr.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
      return arr
    }
    const m = new Map<string, Job[]>()
    for (const j of visible) {
      const p = j.project || 'Unassigned'
      if (!m.has(p)) m.set(p, [])
      m.get(p)!.push(j)
    }
    const arr = [...m.entries()].map(([project, items]) => ({ project, items: sortItems(items) }))
    // stable sort: pinned projects first, keeping relative order otherwise
    arr.sort((a, b) => (pinned.has(b.project) ? 1 : 0) - (pinned.has(a.project) ? 1 : 0))
    return arr
  }, [visible, sortBy, pinned, worksByJob])

  return (
    <Layout title="Units" bottomNav onRefresh={load}>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unit, address, category, key holder…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          onClick={() => navigate('/new')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      {projects.length > 1 && (
        <div className="mb-3">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={`w-full rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-slate-900 ${projectFilter ? 'border-slate-900 font-medium' : 'border-slate-300 text-slate-700'}`}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className={`flex-1 rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-slate-900 ${catFilter ? 'border-slate-900 font-medium' : 'border-slate-300 text-slate-600'}`}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className={`flex-1 rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-slate-900 ${stageFilter ? 'border-slate-900 font-medium' : 'border-slate-300 text-slate-600'}`}
        >
          <option value="">Any stage</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
        >
          <option value="updated">Sort: Recently updated</option>
          <option value="name">Sort: Unit code (A–Z)</option>
          <option value="progress">Sort: Progress (low → high)</option>
        </select>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-slate-500 underline"
          >
            {showArchived ? '← Back to active units' : 'View archived units'}
          </button>
          {isAdmin && (
            <Link to="/units/bulk" className="text-xs font-medium text-slate-500 underline">
              Bulk edit ▦
            </Link>
          )}
        </div>
        {(catFilter || stageFilter || projectFilter) && (
          <button
            onClick={() => {
              setCatFilter('')
              setStageFilter('')
              setProjectFilter('')
            }}
            className="text-xs font-medium text-slate-500"
          >
            Clear filters ✕
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {showArchived ? 'No archived units.' : 'No units yet. Tap “+ New”.'}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.project)
            return (
            <section key={g.project}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <button
                  onClick={() => toggleCollapse(g.project)}
                  className="flex flex-1 items-center gap-2 active:opacity-70"
                >
                  <span className={`text-xs text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                  <h2 className="text-sm font-semibold text-slate-700">{g.project}</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {g.items.length}
                  </span>
                </button>
                <button
                  onClick={() => togglePin(g.project)}
                  title={pinned.has(g.project) ? 'Unpin project' : 'Pin project to top'}
                  className={`shrink-0 text-sm ${pinned.has(g.project) ? 'text-amber-500' : 'text-slate-300 active:text-slate-500'}`}
                >
                  📌
                </button>
              </div>
              {!isCollapsed && (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {g.items.map((job) => {
                  const w = worksByJob.get(job.id) ?? []
                  const pct = overallPercent(w.map((x) => x.stage))
                  return (
                    <li key={job.id}>
                      <Link
                        to={`/job/${job.id}`}
                        className="block rounded-xl bg-white p-4 shadow-sm active:bg-slate-50"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {job.customer_name}
                            </p>
                            {(job.unit_code || job.address) && (
                              <p className="truncate text-sm text-slate-500">
                                {job.unit_code || job.address}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            🔑 {job.key_holder}
                          </span>
                        </div>

                        {/* Per-category chips, each dot coloured by its own stage. */}
                        {w.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {w.map((x) => (
                              <span
                                key={x.id}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getCategory(x.category).accent}`}
                                title={`${getCategory(x.category).label}: ${getStage(x.stage).label}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${getStage(x.stage).color}`} />
                                {getCategory(x.category).label}
                              </span>
                            ))}
                          </div>
                        )}

                        {w.length > 0 ? (
                          <PercentBar percent={pct} label={`Overall · ${w.length} ${w.length === 1 ? 'category' : 'categories'}`} />
                        ) : (
                          <p className="text-xs text-slate-400">No work categories yet.</p>
                        )}

                        <p className="mt-2 text-xs text-slate-400">
                          Updated {relativeTime(job.updated_at)}
                          {job.updated_by ? ` by ${job.updated_by}` : ''}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              )}
            </section>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
