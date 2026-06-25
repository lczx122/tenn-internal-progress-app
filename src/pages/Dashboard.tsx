import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Appointment, Claim, Job, JobEvent, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { STAGES, getStage, overallPercent } from '../lib/stages'
import { CATEGORIES } from '../lib/categories'
import { getApptType, startOfDay, addDays, dayLabel, timeLabel } from '../lib/appointments'
import { eventIconName } from '../lib/jobEvents'
import { Icon } from '../components/Icon'
import { relativeTime, formatDateTime } from '../lib/format'
import { collectedTotal, money } from '../lib/claims'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'

type DashCache = {
  jobs: Job[]
  works: JobWork[]
  events: JobEvent[]
  appts: Appointment[]
  claims: Claim[]
}

const STALE_DAYS = 7
const DAY_MS = 86_400_000

// Whole days from today until a date string (null if unset/invalid).
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / DAY_MS)
}

export default function Dashboard() {
  const c0 = cacheGet<DashCache>('dashboard')
  const [jobs, setJobs] = useState<Job[]>(c0?.jobs ?? [])
  const [works, setWorks] = useState<JobWork[]>(c0?.works ?? [])
  const [events, setEvents] = useState<JobEvent[]>(c0?.events ?? [])
  const [appts, setAppts] = useState<Appointment[]>(c0?.appts ?? [])
  const [claims, setClaims] = useState<Claim[]>(c0?.claims ?? [])
  const [loading, setLoading] = useState(!c0)
  const [scope, setScope] = useState<'mine' | 'all' | null>(null)
  const { session, isAdmin, staffPic } = useAuth()
  const myId = session?.user.id
  const effectiveScope: 'mine' | 'all' = scope ?? (!isAdmin && staffPic ? 'mine' : 'all')

  async function load() {
    progressStart()
    try {
      const [{ data: j }, { data: w }, { data: e }, { data: ap }, { data: cl }] = await Promise.all([
        supabase.from('jobs').select('*').order('updated_at', { ascending: false }),
        supabase.from('job_works').select('*'),
        supabase.from('job_events').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('appointments').select('*').eq('status', 'scheduled').order('starts_at'),
        supabase.from('claims').select('*'),
      ])
      const next: DashCache = {
        jobs: (j as Job[]) ?? [],
        works: (w as JobWork[]) ?? [],
        events: (e as JobEvent[]) ?? [],
        appts: (ap as Appointment[]) ?? [],
        claims: (cl as Claim[]) ?? [],
      }
      setJobs(next.jobs)
      setWorks(next.works)
      setEvents(next.events)
      setAppts(next.appts)
      setClaims(next.claims)
      cacheSet('dashboard', next)
      setLoading(false)
    } finally {
      progressDone()
    }
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_events' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Refetch after waking from idle (realtime socket may have died).
  useAutoRefresh(load)

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
      .filter((j) => effectiveScope === 'all' || !staffPic || j.pics?.includes(staffPic) || j.pic === staffPic)
      .map((j) => {
        const w = byJob.get(j.id) ?? []
        return { job: j, works: w, pct: overallPercent(w.map((x) => x.stage)) }
      })
  }, [jobs, works, effectiveScope, staffPic])

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
        const dueIn = daysUntil(u.job.start_date)
        const soon = dueIn != null && dueIn >= 0 && dueIn <= 7 // confirm modifications with client
        if (!overdue && !stale && !soon) return null
        const reasons: string[] = []
        if (overdue) reasons.push('Overdue')
        if (soon) reasons.push(`Starts ${dueIn === 0 ? 'today' : dueIn === 1 ? 'tmrw' : dueIn + 'd'}`)
        if (stale) reasons.push(`No update ${ageDays}d`)
        // Sort key: overdue first, then starting-soon, then by staleness.
        const rank = (overdue ? 2000 : 0) + (soon ? 1000 - (dueIn ?? 0) * 10 : 0) + ageDays
        return { ...u, overdue, stale, soon, reasons, rank }
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

  // ---- My schedule: overdue + the next few of MY upcoming appointments ----
  const schedule = useMemo(() => {
    const now = Date.now()
    const horizon = addDays(startOfDay(new Date()), 8).getTime() // through the next week
    return appts
      .filter((a) => !!myId && (a.assignee_ids ?? []).includes(myId))
      .filter((a) => new Date(a.starts_at).getTime() < horizon)
      .map((a) => ({ ...a, overdue: new Date(a.starts_at).getTime() < now }))
      .slice(0, 6)
  }, [appts, myId])

  // ---- Key-holder summary: who is holding how many active units ----
  const keyHolders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of active) {
      const k = u.job.key_holder || 'Office'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([holder, count]) => ({ holder, count }))
      .sort((a, b) => b.count - a.count)
  }, [active])

  // ---- Claims: collected vs outstanding across active units ----
  const claimsSummary = useMemo(() => {
    const byJob = new Map<string, Claim[]>()
    for (const c of claims) {
      const arr = byJob.get(c.job_id) ?? []
      arr.push(c)
      byJob.set(c.job_id, arr)
    }
    let order = 0
    let collected = 0
    const outstanding: { job: Job; balance: number }[] = []
    for (const u of active) {
      const o = Number(u.job.order_total || 0)
      const got = collectedTotal(byJob.get(u.job.id) ?? [])
      if (o <= 0 && got <= 0) continue
      order += o
      collected += got
      const balance = o - got
      if (balance > 0) outstanding.push({ job: u.job, balance })
    }
    outstanding.sort((a, b) => b.balance - a.balance)
    return { order, collected, balance: order - collected, outstanding }
  }, [claims, active])

  // Look up a unit's name for the global activity feed.
  const jobName = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of jobs) m.set(j.id, j.customer_name)
    return m
  }, [jobs])

  return (
    <Layout title="Dashboard" bottomNav onRefresh={load}>
      <Link
        to="/quote"
        className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-slate-700"
      >
        <Icon name="receipt" className="h-4 w-4" /> New Quotation
      </Link>
      {staffPic && (
        <div className="mb-4 flex gap-2">
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={
                'flex-1 rounded-lg border px-2 py-2 text-sm font-medium ' +
                (effectiveScope === s
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
              }
            >
              {s === 'mine' ? 'My units' : 'All units'}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            <StatTile label="Active units" value={active.length} />
            <StatTile label="Done · ready to archive" value={doneCount} accent="text-emerald-600" />
            <StatTile label="Needs attention" value={attention.length} accent={attention.length ? 'text-rose-600' : 'text-slate-900'} />
            <StatTile label="Open work items" value={openItems} />
          </div>

          {/* Desktop: two columns — primary lists left; summaries + activity right */}
          <div className="space-y-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:space-y-0">
          <div className="space-y-5 lg:col-span-2">
          {/* Schedule: overdue + upcoming */}
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-700">My schedule</h2>
              <Link to="/schedule" className="text-xs font-medium text-slate-500">View all ›</Link>
            </div>
            {schedule.length === 0 ? (
              <Empty>Nothing assigned to you in the next week.</Empty>
            ) : (
              <ul className="space-y-2">
                {schedule.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/appointment/${a.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-slate-800">
                          <Icon name={getApptType(a.type).icon} className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{a.title || a.customer_name || getApptType(a.type).label}</span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {dayLabel(new Date(a.starts_at))} · {timeLabel(a.starts_at)}
                          {a.who ? ` · ${a.who}` : ''}
                        </p>
                      </div>
                      {a.overdue && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          Overdue
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
              <Empty>
                <span className="inline-flex items-center gap-1.5">
                  All good — nothing overdue or stale. <Icon name="sparkles" className="h-4 w-4 text-amber-500" />
                </span>
              </Empty>
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
                          <p className="truncate font-semibold text-slate-900">{u.job.unit_code || u.job.address || u.job.customer_name}</p>
                          {u.job.customer_name && (u.job.unit_code || u.job.address) && (
                            <p className="truncate text-xs text-slate-500">{u.job.customer_name}</p>
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
          </div>

          <div className="space-y-5">
          {/* Claims summary */}
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-700">Collection</h2>
              <Link to="/claims" className="text-xs font-medium text-slate-500">View all ›</Link>
            </div>
            {claimsSummary.order === 0 && claimsSummary.collected === 0 ? (
              <Empty>No order totals set yet. Add one on a unit to track collections.</Empty>
            ) : (
              <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[11px] text-slate-400">Order</div>
                    <div className="text-sm font-semibold text-slate-800">{money(claimsSummary.order)}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <div className="text-[11px] text-emerald-700/70">Collected</div>
                    <div className="text-sm font-semibold text-emerald-700">{money(claimsSummary.collected)}</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <div className="text-[11px] text-amber-700/70">Outstanding</div>
                    <div className="text-sm font-semibold text-amber-700">{money(claimsSummary.balance)}</div>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${claimsSummary.order > 0 ? Math.min(100, Math.round((claimsSummary.collected / claimsSummary.order) * 100)) : 0}%` }}
                  />
                </div>
                {claimsSummary.outstanding.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {claimsSummary.outstanding.slice(0, 5).map(({ job, balance }) => (
                      <li key={job.id}>
                        <Link
                          to={`/job/${job.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 active:bg-slate-50"
                        >
                          <span className="min-w-0 truncate text-sm text-slate-700">
                            {job.customer_name || job.unit_code || '—'}
                          </span>
                          <span className="shrink-0 text-sm font-medium text-amber-700">{money(balance)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

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

          {/* Key holders */}
          <Section title="Who has the keys">
            {keyHolders.length === 0 ? (
              <Empty>No active units.</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keyHolders.map(({ holder, count }) => (
                  <Link
                    key={holder}
                    to={`/units?q=${encodeURIComponent(holder)}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900 active:bg-amber-100"
                  >
                    <Icon name="key" className="h-4 w-4" /> <span className="font-medium">{holder}</span>
                    <span className="rounded-full bg-amber-200/70 px-1.5 text-xs font-semibold">{count}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Recent activity across all units */}
          <Section title="Recent activity">
            {events.length === 0 ? (
              <Empty>No activity yet.</Empty>
            ) : (
              <ul className="max-h-[26rem] space-y-3 overflow-y-auto rounded-xl bg-white p-4 shadow-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="mt-0.5 text-slate-400"><Icon name={eventIconName(ev.type)} className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        {ev.job_id && jobName.has(ev.job_id) && (
                          <Link to={`/job/${ev.job_id}`} className="font-semibold text-slate-900 underline">
                            {jobName.get(ev.job_id)}
                          </Link>
                        )}{' '}
                        <span className="break-words">{ev.body}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {ev.author_name || 'Someone'} · {formatDateTime(ev.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          </div>
          </div>
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
