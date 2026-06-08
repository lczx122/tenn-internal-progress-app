import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job } from '../lib/types'
import { Layout } from '../components/Layout'
import { StageBar } from '../components/StageBar'
import { relativeTime } from '../lib/format'

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const navigate = useNavigate()

  async function load() {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('updated_at', { ascending: false })
    setJobs((data as Job[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Live updates: any insert/update/delete to jobs refreshes the list so
    // every phone stays in sync without a manual refresh.
    const channel = supabase
      .channel('jobs-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => j.is_archived === showArchived)
      .filter(
        (j) =>
          !q ||
          j.customer_name.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          j.key_holder.toLowerCase().includes(q)
      )
  }, [jobs, query, showArchived])

  return (
    <Layout title="Renovation Jobs">
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, address, key holder…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          onClick={() => navigate('/new')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      <button
        onClick={() => setShowArchived((v) => !v)}
        className="mb-3 text-xs font-medium text-slate-500 underline"
      >
        {showArchived ? '← Back to active jobs' : 'View archived jobs'}
      </button>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {showArchived ? 'No archived jobs.' : 'No jobs yet. Tap “+ New”.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((job) => (
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
                <StageBar stageKey={job.stage} />
                <p className="mt-2 text-xs text-slate-400">
                  Updated {relativeTime(job.updated_at)}
                  {job.updated_by ? ` by ${job.updated_by}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}
