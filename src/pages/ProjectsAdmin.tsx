import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Project } from '../lib/types'
import { Layout } from '../components/Layout'
import { useAutoRefresh } from '../lib/useAutoRefresh'

export default function ProjectsAdmin() {
  const { isAdmin } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [{ data: p }, { data: j }] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('jobs').select('project'),
    ])
    setProjects((p as Project[]) ?? [])
    const c: Record<string, number> = {}
    for (const row of (j as { project: string }[]) ?? []) {
      if (row.project) c[row.project] = (c[row.project] ?? 0) + 1
    }
    setCounts(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('projects-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useAutoRefresh(load)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('projects').insert({ name: n })
    if (error) setError(error.code === '23505' ? 'That project already exists.' : error.message)
    else setName('')
    await load()
    setBusy(false)
  }

  async function rename(p: Project) {
    const next = window.prompt('Rename project', p.name)
    if (next == null) return
    const n = next.trim()
    if (!n || n === p.name) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('projects').update({ name: n }).eq('id', p.id)
    if (error) {
      setError(error.code === '23505' ? 'A project with that name already exists.' : error.message)
    } else {
      // Keep units pointing at the renamed project.
      await supabase.from('jobs').update({ project: n }).eq('project', p.name)
    }
    await load()
    setBusy(false)
  }

  async function remove(p: Project) {
    const used = counts[p.name] ?? 0
    if (used > 0) {
      setError(`Can't delete “${p.name}” — ${used} unit${used === 1 ? '' : 's'} still use it. Reassign them first.`)
      return
    }
    if (!window.confirm(`Delete project “${p.name}”?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('projects').delete().eq('id', p.id)
    if (error) setError(error.message)
    await load()
    setBusy(false)
  }

  if (!isAdmin) {
    return (
      <Layout title="Projects" back={<BackLink />}>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Admins only.
        </p>
      </Layout>
    )
  }

  return (
    <Layout title="Projects" back={<BackLink />} onRefresh={load}>
      <p className="mb-3 px-1 text-xs text-slate-500">
        Projects group your units. Staff pick from this list when creating a unit — only admins can add,
        rename or remove projects here.
      </p>

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          No projects yet. Add your first one above.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-400">
                  {(counts[p.name] ?? 0)} {(counts[p.name] ?? 0) === 1 ? 'unit' : 'units'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => rename(p)}
                  disabled={busy}
                  className="text-xs font-medium text-slate-500 underline disabled:opacity-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => remove(p)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}

function BackLink() {
  return (
    <Link to="/units" className="text-xl leading-none text-slate-300">
      ←
    </Link>
  )
}
