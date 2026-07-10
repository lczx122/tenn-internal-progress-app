import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Claim, Job, JobWork, UnitSupplier } from '../lib/types'
import { STAGES, getStage, overallPercent } from '../lib/stages'
import { getSupplierStage } from '../lib/supplierStages'
import { money0, collectedTotal, perTradeRows } from '../lib/claims'
import { relativeTime } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'
import { usePersistedState } from '../lib/usePersistedState'

// ---------------------------------------------------------------------------
//  GAME MODE — Lucas' personal skin over the real data. Read-only: every number
//  comes from the same tables as the normal pages; nothing here writes.
// ---------------------------------------------------------------------------

const TRADE_ICON: Record<string, string> = {
  Mindhome: '🏠',
  'Aluminium Cabinet': '🗄️',
  'Iron Work': '⚔️',
  'Aluminium Work': '🛡️',
  Painting: '🎨',
  Waterproofing: '💧',
  'Smart Home': '📡',
  'Smart Lock': '🔐',
  EE: '⚡',
  'Other Services': '🧰',
}
const tradeIcon = (cat: string) => TRADE_ICON[cat] ?? '🔧'

interface Rarity {
  name: string
  frame: string // card border
  text: string // rarity label colour
  bar: string // xp bar fill
  glow: boolean
}
function rarity(p: number): Rarity {
  if (p >= 100)
    return { name: 'LEGENDARY', frame: 'border-yellow-400/80', text: 'text-yellow-300', bar: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400', glow: true }
  if (p >= 85)
    return { name: 'EPIC', frame: 'border-fuchsia-500/70', text: 'text-fuchsia-300', bar: 'bg-gradient-to-r from-fuchsia-500 to-purple-400', glow: false }
  if (p >= 60)
    return { name: 'RARE', frame: 'border-sky-500/70', text: 'text-sky-300', bar: 'bg-gradient-to-r from-sky-500 to-cyan-400', glow: false }
  if (p >= 30)
    return { name: 'UNCOMMON', frame: 'border-emerald-500/70', text: 'text-emerald-300', bar: 'bg-gradient-to-r from-emerald-500 to-lime-400', glow: false }
  return { name: 'COMMON', frame: 'border-slate-600', text: 'text-slate-400', bar: 'bg-slate-500', glow: false }
}

interface UnitStats {
  job: Job
  works: JobWork[]
  claims: Claim[]
  suppliers: UnitSupplier[]
  percent: number
  collected: number
  balance: number
}

type GameCache = { jobs: Job[]; works: JobWork[]; claims: Claim[]; suppliers: UnitSupplier[] }

export default function GameView() {
  const { isLucas, displayName } = useAuth()
  const navigate = useNavigate()
  const c0 = cacheGet<GameCache>('game')
  const [jobs, setJobs] = useState<Job[]>(c0?.jobs ?? [])
  const [works, setWorks] = useState<JobWork[]>(c0?.works ?? [])
  const [claims, setClaims] = useState<Claim[]>(c0?.claims ?? [])
  const [suppliers, setSuppliers] = useState<UnitSupplier[]>(c0?.suppliers ?? [])
  const [loading, setLoading] = useState(!c0)
  const [query, setQuery] = useState('')
  const [showVault, setShowVault] = usePersistedState('tenn_game_vault', false)
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    progressStart()
    try {
      const [{ data: j }, { data: w }, { data: c }, { data: s }] = await Promise.all([
        supabase.from('jobs').select('*').order('project'),
        supabase.from('job_works').select('*'),
        supabase.from('claims').select('*'),
        supabase.from('unit_suppliers').select('*'),
      ])
      const next: GameCache = {
        jobs: (j as Job[]) ?? [],
        works: (w as JobWork[]) ?? [],
        claims: (c as Claim[]) ?? [],
        suppliers: (s as UnitSupplier[]) ?? [],
      }
      setJobs(next.jobs)
      setWorks(next.works)
      setClaims(next.claims)
      setSuppliers(next.suppliers)
      cacheSet('game', next)
      setLoading(false)
    } finally {
      progressDone()
    }
  }

  useEffect(() => {
    load()
    const channel = realtimeChannel('game-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_suppliers' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  useAutoRefresh(load)

  const stats = useMemo(() => {
    const worksBy = new Map<string, JobWork[]>()
    for (const w of works) {
      const a = worksBy.get(w.job_id) ?? []
      a.push(w)
      worksBy.set(w.job_id, a)
    }
    const claimsBy = new Map<string, Claim[]>()
    for (const c of claims) {
      const a = claimsBy.get(c.job_id) ?? []
      a.push(c)
      claimsBy.set(c.job_id, a)
    }
    const supsBy = new Map<string, UnitSupplier[]>()
    for (const s of suppliers) {
      const a = supsBy.get(s.job_id) ?? []
      a.push(s)
      supsBy.set(s.job_id, a)
    }
    return jobs.map((job): UnitStats => {
      const jw = worksBy.get(job.id) ?? []
      const jc = claimsBy.get(job.id) ?? []
      const collected = collectedTotal(jc)
      return {
        job,
        works: jw,
        claims: jc,
        suppliers: supsBy.get(job.id) ?? [],
        percent: overallPercent(jw.map((w) => w.stage)),
        collected,
        balance: Number(job.order_total || 0) - collected,
      }
    })
  }, [jobs, works, claims, suppliers])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stats
      .filter((s) => showVault || !s.job.is_archived)
      .filter(
        (s) =>
          !q ||
          (s.job.unit_code || '').toLowerCase().includes(q) ||
          s.job.customer_name.toLowerCase().includes(q) ||
          (s.job.project || '').toLowerCase().includes(q),
      )
  }, [stats, query, showVault])

  // A "world" (shelf) per project.
  const shelves = useMemo(() => {
    const by = new Map<string, UnitStats[]>()
    for (const s of visible) {
      const key = s.job.project || 'Side quests'
      const a = by.get(key) ?? []
      a.push(s)
      by.set(key, a)
    }
    return [...by.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, units]) => ({
        name,
        units: units.sort(
          (a, b) => b.percent - a.percent || (a.job.unit_code || '').localeCompare(b.job.unit_code || ''),
        ),
      }))
  }, [visible])

  // Player header numbers (active units only).
  const player = useMemo(() => {
    const active = stats.filter((s) => !s.job.is_archived)
    const done = active.filter((s) => s.percent >= 100).length
    return {
      level: done,
      quests: active.length,
      xp: active.length ? Math.round(active.reduce((t, s) => t + s.percent, 0) / active.length) : 0,
      gold: active.reduce((t, s) => t + s.collected, 0),
      loot: active.reduce((t, s) => t + Math.max(0, s.balance), 0),
    }
  }, [stats])

  const open = openId ? stats.find((s) => s.job.id === openId) : undefined

  if (!isLucas) {
    return (
      <div className="flex h-[var(--app-h,100dvh)] flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center text-slate-300">
        <div className="text-5xl">🔒</div>
        <p className="font-bold">Game mode is locked.</p>
        <p className="text-sm text-slate-500">This area belongs to the guild master.</p>
        <Link to="/" className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-sm">
          Back to base
        </Link>
      </div>
    )
  }

  return (
    <div className="h-[var(--app-h,100dvh)] overflow-y-auto bg-slate-950 text-slate-100">
      {/* HUD */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black tracking-[.12em] text-yellow-300 sm:text-lg sm:tracking-[.2em]">
              TENN QUEST
            </h1>
            <p className="truncate text-[11px] text-slate-400">
              🧙 {displayName || 'Lucas'} · Lv {player.level} · {player.quests} quests
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold text-yellow-300">🪙 {money0(player.gold)}</p>
            <p className="text-[11px] text-slate-400">loot left {money0(player.loot)}</p>
          </div>
          <button
            onClick={() => navigate('/units')}
            title="Back to the normal app"
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 active:bg-slate-800"
          >
            ✕ Exit
          </button>
        </div>
        {/* guild XP bar */}
        <div className="mx-auto mt-2 h-2 max-w-5xl overflow-hidden rounded-full bg-slate-800">
          <div
            className="gv-shine h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400"
            style={{ width: `${player.xp}%` }}
          />
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the realm…"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-yellow-400"
          />
          <button
            onClick={() => setShowVault(!showVault)}
            className={
              'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ' +
              (showVault
                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 active:bg-slate-800')
            }
          >
            🗝️ Vault
          </button>
        </div>
      </div>

      {/* Shelves */}
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-4">
        {loading ? (
          <p className="py-16 text-center text-slate-500">Loading the realm…</p>
        ) : shelves.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-slate-500">
            No quests found in this realm.
          </p>
        ) : (
          shelves.map((shelf) => (
            <section key={shelf.name} className="mb-8">
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-black uppercase tracking-widest text-slate-300">
                🗺️ {shelf.name}
                <span className="text-[11px] font-medium normal-case tracking-normal text-slate-500">
                  {shelf.units.length} unit{shelf.units.length === 1 ? '' : 's'} ·{' '}
                  {shelf.units.filter((u) => u.percent >= 100).length} complete
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {shelf.units.map((u) => {
                  const r = rarity(u.percent)
                  return (
                    <button
                      key={u.job.id}
                      onClick={() => setOpenId(u.job.id)}
                      className={
                        `relative rounded-xl border-2 ${r.frame} bg-slate-900 p-3 text-left active:scale-95 ` +
                        `transition-transform ${r.glow ? 'gv-glow' : ''} ${u.job.is_archived ? 'opacity-50 saturate-50' : ''}`
                      }
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[9px] font-black tracking-widest ${r.text}`}>{r.name}</span>
                        {u.job.is_archived && <span className="text-[9px] font-bold text-slate-500">IN VAULT</span>}
                        {u.percent >= 100 && !u.job.is_archived && <span className="text-sm leading-none">🏆</span>}
                      </div>
                      <p className="mt-1 truncate font-mono text-base font-black">{u.job.unit_code || '—'}</p>
                      <p className="truncate text-[11px] text-slate-400">{u.job.customer_name}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${u.percent}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="truncate text-xs">
                          {u.works.slice(0, 4).map((w) => tradeIcon(w.category)).join(' ')}
                          {u.works.length > 4 ? ' …' : ''}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-yellow-300/90">
                          {u.percent}%
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="gv-shelf mt-3" />
            </section>
          ))
        )}
      </div>

      {/* Expanded card — the unit's "character sheet" */}
      {open && <UnitSheet u={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function UnitSheet({ u, onClose }: { u: UnitStats; onClose: () => void }) {
  const r = rarity(u.percent)
  const trades = perTradeRows(u.job, u.claims)
  const pics = u.job.pics?.length ? u.job.pics : u.job.pic ? [u.job.pic] : []
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(u.job.created_at).getTime()) / 86400000))

  const badges: { icon: string; label: string }[] = []
  if (u.works.length > 0 && u.works.every((w) => getStage(w.stage).percent >= 100))
    badges.push({ icon: '🏆', label: 'All quests complete' })
  if (Number(u.job.order_total || 0) > 0 && u.balance <= 0.005) badges.push({ icon: '💰', label: 'Fully collected' })
  if (Number(u.job.order_total || 0) >= 20000) badges.push({ icon: '🐳', label: 'Big fish' })
  if (u.works.length >= 3) badges.push({ icon: '⚔️', label: `${u.works.length}-trade combo` })
  if (u.suppliers.length > 0 && u.suppliers.every((s) => s.stage === 'installed'))
    badges.push({ icon: '📦', label: 'Supply line cleared' })
  if (ageDays <= 7) badges.push({ icon: '✨', label: 'Fresh quest' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`gv-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-2 ${r.frame} bg-slate-900 p-4 sm:rounded-2xl ${r.glow ? 'gv-glow' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`text-[10px] font-black tracking-widest ${r.text}`}>{r.name}</span>
            <h3 className="truncate font-mono text-2xl font-black">{u.job.unit_code || '—'}</h3>
            <p className="truncate text-sm text-slate-400">{u.job.customer_name}</p>
            <p className="truncate text-[11px] text-slate-500">
              🗺️ {u.job.project || '—'} {pics.length > 0 && <>· 🧝 {pics.join(', ')}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 active:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* XP */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>QUEST PROGRESS</span>
            <span className="font-mono font-bold text-slate-200">{u.percent}%</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div className={`gv-shine h-full rounded-full ${r.bar}`} style={{ width: `${u.percent}%` }} />
          </div>
        </div>

        {/* Quests (work cards) */}
        {u.works.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-black tracking-widest text-slate-400">⚔️ QUESTS</p>
            <ul className="space-y-1.5">
              {u.works.map((w) => {
                const st = getStage(w.stage)
                const notch = STAGES.findIndex((s) => s.key === st.key)
                return (
                  <li key={w.id} className="rounded-lg bg-slate-800/60 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {tradeIcon(w.category)} {w.category}
                        {w.title ? <span className="text-slate-500"> · {w.title}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-300">{st.label}</span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {STAGES.map((s, i) => (
                        <div
                          key={s.key}
                          className={`h-1.5 flex-1 rounded-full ${i <= notch ? st.color : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Treasury */}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-black tracking-widest text-slate-400">🪙 TREASURY</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/60 p-2">
              <p className="text-[10px] text-slate-400">Quest reward</p>
              <p className="font-mono text-sm font-bold">{money0(Number(u.job.order_total || 0))}</p>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2">
              <p className="text-[10px] text-slate-400">Gold earned</p>
              <p className="font-mono text-sm font-bold text-yellow-300">{money0(u.collected)}</p>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2">
              <p className="text-[10px] text-slate-400">Loot left</p>
              <p className={`font-mono text-sm font-bold ${u.balance > 0.005 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {money0(Math.max(0, u.balance))}
              </p>
            </div>
          </div>
          {trades.length > 0 && (
            <ul className="mt-2 space-y-1">
              {trades.map((t) => (
                <li key={t.cat} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span className="min-w-0 truncate">
                    {tradeIcon(t.cat)} {t.cat}
                  </span>
                  <span className="shrink-0 font-mono">
                    {money0(t.collected)} / {money0(t.order)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Supply line (boss-only table; empty for units without entries) */}
        {u.suppliers.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-black tracking-widest text-slate-400">📦 SUPPLY LINE</p>
            <ul className="space-y-1">
              {u.suppliers.map((s) => {
                const st = getSupplierStage(s.stage)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                    <span className="min-w-0 truncate">
                      🚚 {s.supplier}
                      {s.item ? <span className="text-slate-500"> · {s.item}</span> : null}
                    </span>
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold">{st.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-black tracking-widest text-slate-400">🎖️ BADGES</p>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium"
                >
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <p className="text-[11px] text-slate-500">
            ⏳ {ageDays} day{ageDays === 1 ? '' : 's'} old · updated {relativeTime(u.job.updated_at)}
          </p>
          <Link
            to={`/job/${u.job.id}`}
            className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-black text-slate-900 active:bg-yellow-300"
          >
            OPEN REAL UNIT ▸
          </Link>
        </div>
      </div>
    </div>
  )
}
