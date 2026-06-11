import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile } from '../lib/types'
import { Layout } from '../components/Layout'

export default function StaffAdmin() {
  const { isAdmin, session } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
    setPeople((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(p: Profile, role: 'admin' | 'staff') {
    setError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('set_role', { target: p.id, new_role: role })
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
    <Layout title="Staff & roles" back={<BackLink />}>
      <p className="mb-3 px-1 text-xs text-slate-500">
        Tap <b>Rename</b> to set a staff member's display name (used everywhere in the app). Admins can
        also delete records, archive units, and edit prices. Add new staff in your Supabase dashboard
        (Authentication → Users); they appear here automatically.
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => {
            const isMe = p.id === session?.user.id
            const admin = p.role === 'admin'
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {p.full_name} {isMe && <span className="text-xs text-slate-400">(you)</span>}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className={
                        'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ' +
                        (admin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')
                      }
                    >
                      {admin ? 'ADMIN' : 'STAFF'}
                    </span>
                    <button
                      onClick={() => rename(p)}
                      disabled={busyId === p.id}
                      className="text-xs font-medium text-slate-500 underline disabled:opacity-50"
                    >
                      Rename
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setRole(p, admin ? 'staff' : 'admin')}
                  disabled={busyId === p.id}
                  className={
                    'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ' +
                    (admin
                      ? 'border-slate-300 text-slate-600 active:bg-slate-100'
                      : 'border-emerald-600 text-emerald-700 active:bg-emerald-50')
                  }
                >
                  {busyId === p.id ? '…' : admin ? 'Make staff' : 'Make admin'}
                </button>
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
