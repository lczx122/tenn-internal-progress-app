import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { PercentBar } from '../components/StageBar'
import { getStage, overallPercent, STAGES } from '../lib/stages'
import { getCategory, CATEGORIES } from '../lib/categories'
import { relativeTime } from '../lib/format'

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [works, setWorks] = useState<JobWork[]>([])
  const [loading, setLoading] = useState(true)
  // Filters can be seeded from the URL (e.g. the dashboard links to
  // /units?stage=installing, /units?cat=Aluminium, or /units?q=Ahmad).
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [catFilter, setCatFilter] = useState(searchParams.get('cat') ?? '')
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') ?? '')
  const [showArchived, setShowArchived] = useState(false)
  const navigate = useNavigate()

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => j.is_archived === showArchived)
      .filter(
        (j) =>
          !q ||
          j.customer_name.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
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
  }, [jobs, query, showArchived, worksByJob, catFilter, stageFilter])

  return (
    <Layout title="Units" bottomNav>
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

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs font-medium text-slate-500 underline"
        >
          {showArchived ? '← Back to active units' : 'View archived units'}
        </button>
        {(catFilter || stageFilter) && (
          <button
            onClick={() => {
              setCatFilter('')
              setStageFilter('')
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
        <ul className="space-y-3">
          {visible.map((job) => {
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
                      {job.address && (
                        <p className="truncate text-sm text-slate-500">
                          {job.address}
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
    </Layout>
  )
}
