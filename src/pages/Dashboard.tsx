import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { STAGES, getStage, overallPercent } from '../lib/stages'
import { CATEGORIES } from '../lib/categories'
import { relativeTime } from '../lib/format'

const STALE_DAYS = 7
const DAY_MS = 86_400_000

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [works, setWorks] = useState<JobWork[]>([])
  const [loading, setLoading] = useState(true)

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
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Active units only, each annotated with its overall progress.
  const active = useMemo(() => {
    const byJob = new Map<string, JobWork[]>()
    for (const w of works) {
      const arr = byJob.get(w.job_id) ?? []
      arr.push(w)
      byJob.set(w.job_id, arr)
    }
    return jobs
      .filter((j) => !j.is_archived)
      .map((j) => {
        const w = byJob.get(j.id) ?? []
        return { job: j, works: w, pct: overallPercent(w.map((x) => x.stage)) }
      })
  }, [jobs, works])

  const activeWorks = useMemo(
    () => active.flatMap((u) => u.works),
    [active],
  )

  // ---- KPI numbers ----
  const doneCount = active.filter((u) => u.works.length > 0 && u.pct === 100).length
  const openItems = activeWorks.filter((w) => w.stage !== 'completed').length

  // ---- Needs attention: overdue (past target, not done) or stale (no update) ----
  const attention = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    return active
      .filter((u) => u.pct < 100)
      .map((u) => {
        const overdue =
          u.job.target_date && new Date(u.job.target_date) < startOfToday
        const ageDays = Math.floor((now - new Date(u.job.updated_at).getTime()) / DAY_MS)
        const stale = ageDays >= STALE_DAYS
        if (!overdue && !stale) return null
        const reasons: string[] = []
        if (overdue) reasons.push('Overdue')
        if (stale) reasons.push(`No update ${ageDays}d`)
        // Sort key: overdue items first, then by staleness.
        const rank = (overdue ? 1000 : 0) + ageDays
        return { ...u, overdue, stale, reasons, rank }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.rank - a.rank)
  }, [active])

  // ---- Pipeline: how many work items sit at each stage ----
  const pipeline = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of activeWorks) counts.set(w.stage, (counts.get(w.stage) ?? 0) + 1)
    const max = Math.max(1, ...STAGES.map((s) => counts.get(s.key) ?? 0))
    return STAGES.map((s) => ({ stage: s, count: counts.get(s.key) ?? 0, max }))
  }, [activeWorks])

  // ---- Category breakdown: avg progress + item count per category ----
  const categoryStats = useMemo(() => {
    return CATEGORIES.map((c) => {
      const items = activeWorks.filter((w) => w.category === c.key)
      const pct = overallPercent(items.map((w) => w.stage))
      return { cat: c, count: items.length, pct }
    }).filter((x) => x.count > 0)
  }, [activeWorks])

  return (
    <Layout title="Dashboard" bottomNav>
      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Active units" value={active.length} />
            <StatTile label="Done · ready to archive" value={doneCount} accent="text-emerald-600" />
            <StatTile label="Needs attention" value={attention.length} accent={attention.length ? 'text-rose-600' : 'text-slate-900'} />
            <StatTile label="Open work items" value={openItems} />
          </div>

          {/* Pipeline funnel */}
          <Section title="Pipeline">
            {activeWorks.length === 0 ? (
              <Empty>No work items yet.</Empty>
            ) : (
              <div className="space-y-2.5">
                {pipeline.map(({ stage, count, max }) => (
                  <Link
                    key={stage.key}
                    to={`/units?stage=${stage.key}`}
                    className="block active:opacity-70"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{stage.label}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                        style={{ width: `${Math.round((count / max) * 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Needs attention */}
          <Section title="Needs attention">
            {attention.length === 0 ? (
              <Empty>All good — nothing overdue or stale. 🎉</Empty>
            ) : (
              <ul className="space-y-2">
                {attention.map((u) => (
                  <li key={u.job.id}>
                    <Link
                      to={`/job/${u.job.id}`}
                      className="block rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{u.job.customer_name}</p>
                          {u.job.address && (
                            <p className="truncate text-xs text-slate-500">{u.job.address}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {u.reasons.map((r) => (
                            <span
                              key={r}
                              className={
                                'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                                (r === 'Overdue'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800')
                              }
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {u.pct}% · updated {relativeTime(u.job.updated_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Category breakdown */}
          <Section title="By category">
            {categoryStats.length === 0 ? (
              <Empty>No categories on any active unit yet.</Empty>
            ) : (
              <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
                {categoryStats.map(({ cat, count, pct }) => (
                  <Link key={cat.key} to={`/units?cat=${cat.key}`} className="block active:opacity-70">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${cat.accent}`}>
                        {cat.label}
                      </span>
                      <span className="text-slate-500">
                        {pct}% · {count} {count === 1 ? 'unit' : 'units'}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getStage(stageForPercent(pct)).color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </Layout>
  )
}

// Map an average percent back to the nearest stage colour for the bar.
function stageForPercent(pct: number): string {
  let best = STAGES[0]
  for (const s of STAGES) if (pct >= s.percent) best = s
  return best.key
}

function StatTile({ label, value, accent = 'text-slate-900' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className={`text-3xl font-bold leading-none ${accent}`}>{value}</div>
      <div className="mt-1.5 text-xs font-medium text-slate-500">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}
