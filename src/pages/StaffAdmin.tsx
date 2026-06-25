import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, Role } from '../lib/types'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { STAFF_PICS } from '../lib/units'
import { useAutoRefresh } from '../lib/useAutoRefresh'

const ROLE_STYLE: Record<Role, string> = {
  boss: 'bg-amber-100 text-amber-700',
  admin: 'bg-emerald-100 text-emerald-700',
  staff: 'bg-slate-100 text-slate-600',
  guest: 'bg-sky-100 text-sky-700',
}

export default function StaffAdmin() {
  const { isAdmin, isBoss, session } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    setPeople((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Refetch after waking from idle.
  useAutoRefresh(load)

  async function setRole(p: Profile, role: Role) {
    setError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('set_role', { target: p.id, new_role: role })
    if (error) setError(error.message)
    await load()
    setBusyId(null)
  }

  async function setPic(p: Profile, pic: string) {
    setError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('set_staff_pic', { target: p.id, pic })
    if (error) setError(error.message)
    await load()
    setBusyId(null)
  }

  async function rename(p: Profile) {
    const name = window.prompt("Staff member's display name", p.full_name)
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === p.full_name) return
    setError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('set_full_name', { target: p.id, name: trimmed })
    if (error) setError(error.message)
    await load()
    setBusyId(null)
  }

  if (!isAdmin) {
    return (
      <Layout title="Staff" back={<BackLink />}>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Admins only.
        </p>
      </Layout>
    )
  }

  return (
    <Layout title="Staff & roles" back={<BackLink />} onRefresh={load}>
      <p className="mb-3 px-1 text-xs text-slate-500">
        Tap <b>Rename</b> to set a staff member's display name (used everywhere in the app). Admins can
        also delete records, archive units, and edit prices. Add new staff in your Supabase dashboard
        (Authentication → Users); they appear here automatically.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          to="/projects"
          className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Icon name="folder" className="h-4 w-4 text-slate-500" /> Manage projects</span>
          <span className="text-xs font-medium text-slate-400">Add / rename ›</span>
        </Link>
        <Link
          to="/settings"
          className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Icon name="settings" className="h-4 w-4 text-slate-500" /> Payment & announcements</span>
          <span className="text-xs font-medium text-slate-400">Settings ›</span>
        </Link>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => {
            const isMe = p.id === session?.user.id
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {p.full_name} {isMe && <span className="text-xs text-slate-400">(you)</span>}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ' + ROLE_STYLE[p.role]}>
                      {p.role.toUpperCase()}
                    </span>
                    <button
                      onClick={() => rename(p)}
                      disabled={busyId === p.id}
                      className="text-xs font-medium text-slate-500 underline disabled:opacity-50"
                    >
                      Rename
                    </button>
                  </div>
                  <label className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">PIC</span>
                    <select
                      value={p.staff_pic ?? ''}
                      onChange={(e) => setPic(p, e.target.value)}
                      disabled={busyId === p.id}
                      className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 disabled:opacity-50"
                      title="Which units this person sees as 'mine'"
                    >
                      <option value="">— none —</option>
                      {STAFF_PICS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <select
                  value={p.role}
                  onChange={(e) => setRole(p, e.target.value as Role)}
                  disabled={busyId === p.id}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                >
                  <option value="guest">Guest (quote only)</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  {/* Only a boss can assign the boss role (DB-enforced too) */}
                  {(isBoss || p.role === 'boss') && <option value="boss">Boss</option>}
                </select>
              </li>
            )
          })}
        </ul>
      )}
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
