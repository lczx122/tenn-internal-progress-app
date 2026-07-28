import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Job, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { LoadingState, EmptyState , SearchInput , Segmented } from '../components/ui'
import { Icon } from '../components/Icon'
import { PercentBar } from '../components/StageBar'
import { getStage, overallPercent, STAGES } from '../lib/stages'
import { getCategory, CATEGORIES } from '../lib/categories'
import { relativeTime } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'
import { usePersistedState, oneOf } from '../lib/usePersistedState'
import { ErrorState } from '../components/ErrorState'

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

// Whole days from today until a unit's work start_date (null if unset/invalid).
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const start = new Date(dateStr + 'T00:00:00')
  if (isNaN(start.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((start.getTime() - today.getTime()) / 86400000)
}

export default function JobsList() {
  const c0 = cacheGet<{ jobs: Job[]; works: JobWork[] }>('units')
  const [jobs, setJobs] = useState<Job[]>(c0?.jobs ?? [])
  const [works, setWorks] = useState<JobWork[]>(c0?.works ?? [])
  const [loading, setLoading] = useState(!c0)
  const [loadFailed, setLoadFailed] = useState(false)
  // Filters can be seeded from the URL (e.g. the dashboard links to
  // /units?stage=installing, /units?cat=Painting, or /units?q=Ahmad).
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  // Dropdown filters persist across reloads; a URL param (dashboard deep-link)
  // overrides just that filter for the visit without overwriting the saved one.
  const [projectFilter, setProjectFilter] = usePersistedState('tenn_units_project', '', {
    override: searchParams.get('project'),
  })
  const [catFilter, setCatFilter] = usePersistedState('tenn_units_cat', '', {
    override: searchParams.get('cat'),
  })
  const [stageFilter, setStageFilter] = usePersistedState('tenn_units_stage', '', {
    override: searchParams.get('stage'),
  })
  const [showArchived, setShowArchived] = usePersistedState('tenn_units_archived', false)
  const [sortBy, setSortBy] = usePersistedState<'updated' | 'name' | 'progress'>(
    'tenn_units_sort',
    'updated',
    { validate: oneOf('updated', 'name', 'progress') },
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadSet('tenn_collapsed_projects'))
  const [pinned, setPinned] = useState<Set<string>>(() => loadSet('tenn_pinned_projects'))
  // null = use the role default (staff with a PIC start on "mine"; admins on "all").
  const [scope, setScope] = usePersistedState<'mine' | 'all' | null>('tenn_units_scope', null, {
    validate: oneOf('mine', 'all'),
  })
  const { isAdmin, staffPic, isLucas } = useAuth()
  const effectiveScope: 'mine' | 'all' = scope ?? (!isAdmin && staffPic ? 'mine' : 'all')

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

  async function load(quiet = false) {
    if (!quiet) progressStart()
    try {
      const [{ data: j, error: ej }, { data: w }] = await Promise.all([
        supabase.from('jobs').select('*').order('updated_at', { ascending: false }),
        supabase.from('job_works').select('*'),
      ])
      setLoadFailed(!!ej)
      if (!ej) {
        const nj = (j as Job[]) ?? []
        const nw = (w as JobWork[]) ?? []
        setJobs(nj)
        setWorks(nw)
        cacheSet('units', { jobs: nj, works: nw })
      }
    } catch {
      // fetch itself threw (offline) — same treatment as a server error
      setLoadFailed(true)
    } finally {
      setLoading(false)
      if (!quiet) progressDone()
    }
  }

  useEffect(() => {
    load()
    // Live updates on units and their work categories.
    // One quiet refetch per burst of realtime events (no progress-bar sweep).
    const rt = coalesce(() => load(true))
    const channel = realtimeChannel('jobs-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
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
      .filter((j) => effectiveScope === 'all' || !staffPic || j.pics?.includes(staffPic) || j.pic === staffPic)
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
  }, [jobs, query, showArchived, projectFilter, worksByJob, catFilter, stageFilter, effectiveScope, staffPic])

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
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unit, address, category, key holder…"
        />
        {isLucas && (
          <Link
            to="/game"
            title="Game mode"
            className="flex shrink-0 items-center rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm active:bg-press"
          >
            🎮
          </Link>
        )}
        <Link
          to="/quote"
          title="New quotation"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white active:bg-primary-press"
        >
          <Icon name="receipt" className="h-4 w-4" /> Quote
        </Link>
      </div>

      {staffPic && (
        <Segmented
          className="mb-3"
          options={[
            { key: 'mine', label: 'My units' },
            { key: 'all', label: 'All units' },
          ]}
          value={effectiveScope}
          onChange={setScope}
        />
      )}
      {!isAdmin && !staffPic && (
        <p className="mb-3 rounded-lg bg-page px-3 py-2 text-xs text-muted-2">
          Showing all units. Ask an admin to set your PIC name so you can see just yours.
        </p>
      )}

      {projects.length > 1 && (
        <div className="mb-3">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={`w-full rounded-lg border bg-surface px-2 py-2 text-sm outline-none focus:border-strong ${projectFilter ? 'border-primary font-medium' : 'border-line-2 text-body'}`}
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
          className={`flex-1 rounded-lg border bg-surface px-2 py-2 text-sm outline-none focus:border-strong ${catFilter ? 'border-primary font-medium' : 'border-line-2 text-muted'}`}
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
          className={`flex-1 rounded-lg border bg-surface px-2 py-2 text-sm outline-none focus:border-strong ${stageFilter ? 'border-primary font-medium' : 'border-line-2 text-muted'}`}
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
          className="w-full rounded-lg border border-line-2 bg-surface px-2 py-2 text-sm text-body outline-none focus:border-strong"
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
            className="text-xs font-medium text-muted-2 underline"
          >
            {showArchived ? '← Back to active units' : 'View archived units'}
          </button>
          {isAdmin && (
            <Link to="/units/bulk" className="text-xs font-medium text-muted-2 underline">
              Bulk edit ▦
            </Link>
          )}
          {/* Units normally come from saving a Sales Order; this covers the
              odd job that never had one. */}
          <Link to="/units/new" className="text-xs font-medium text-muted-2 underline">
            + New unit
          </Link>
        </div>
        {(catFilter || stageFilter || projectFilter) && (
          <button
            onClick={() => {
              setCatFilter('')
              setStageFilter('')
              setProjectFilter('')
            }}
            className="text-xs font-medium text-muted-2"
          >
            Clear filters ✕
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : loadFailed && jobs.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState>
          {showArchived ? 'No archived units.' : 'No units yet — save a Sales Order in the Quote tab to open one.'}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.project)
            return (
            <section key={g.project}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <button
                  onClick={() => toggleCollapse(g.project)}
                  aria-expanded={!isCollapsed}
                  className="flex min-h-[40px] flex-1 items-center gap-2 active:opacity-70"
                >
                  <span className={`text-xs text-faint transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                  <h2 className="text-sm font-semibold text-body">{g.project}</h2>
                  <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {g.items.length}
                  </span>
                </button>
                <button
                  onClick={() => togglePin(g.project)}
                  title={pinned.has(g.project) ? 'Unpin project' : 'Pin project to top'}
                  aria-label={pinned.has(g.project) ? `Unpin ${g.project}` : `Pin ${g.project} to top`}
                  aria-pressed={pinned.has(g.project)}
                  className={`shrink-0 p-2.5 ${pinned.has(g.project) ? 'text-amber-500' : 'text-faint active:text-muted'}`}
                >
                  <Icon name="pin" className="h-[18px] w-[18px]" />
                </button>
              </div>
              {!isCollapsed && (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {g.items.map((job) => {
                  const w = worksByJob.get(job.id) ?? []
                  const pct = overallPercent(w.map((x) => x.stage))
                  const dueIn = daysUntil(job.start_date)
                  const showNudge = dueIn != null && dueIn >= 0 && dueIn <= 7 && pct < 100
                  return (
                    <li key={job.id}>
                      <Link
                        to={`/job/${job.id}`}
                        className="block rounded-xl bg-surface p-4 shadow-sm active:bg-press"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">
                              {job.unit_code || job.address || job.customer_name}
                            </p>
                            {job.customer_name && (job.unit_code || job.address) && (
                              <p className="truncate text-sm text-muted-2">
                                {job.customer_name}
                              </p>
                            )}
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            <Icon name="key" className="h-3.5 w-3.5" /> {job.key_holder}
                          </span>
                        </div>

                        {showNudge && (
                          <div className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                            <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
                            <span>Work starts {dueIn === 0 ? 'today' : dueIn === 1 ? 'tomorrow' : `in ${dueIn} days`} — confirm any modifications with the client</span>
                          </div>
                        )}

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
                          <p className="text-xs text-faint">No work categories yet.</p>
                        )}

                        <p className="mt-2 text-xs text-faint">
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
