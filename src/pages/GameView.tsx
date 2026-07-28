import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
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
//  GAME MODE — Lucas' personal old-school JRPG skin over the real data.
//  Light-mode only (parchment + wood), pixel font, hand-drawn pixel icons.
//  Read-only: every number comes from the same tables as the normal pages.
// ---------------------------------------------------------------------------

// ---- pixel-art icons: 10×10 grids, '.' = transparent, letters = palette ----
interface Pix {
  pal: Record<string, string>
  rows: string[]
}
const PIXELS: Record<string, Pix> = {
  sword: {
    pal: { s: '#9fb7c9', w: '#e6eef5', g: '#c9920e', h: '#7a4a22' },
    rows: [
      '....ws....',
      '....ws....',
      '....ws....',
      '....ws....',
      '....ws....',
      '..gggggg..',
      '....hh....',
      '....hh....',
      '...hhhh...',
      '..........',
    ],
  },
  shield: {
    pal: { p: '#3f6fb5', w: '#cfe0f5' },
    rows: [
      '.pppppppp.',
      '.pwwwwwwp.',
      '.pwppppwp.',
      '.pwppppwp.',
      '.pwwwwwwp.',
      '..pppppp..',
      '..pppppp..',
      '...pppp...',
      '....pp....',
      '..........',
    ],
  },
  brush: {
    pal: { w: '#b57b3e', m: '#9aa5ad', f: '#b03f9e' },
    rows: [
      '....ww....',
      '....ww....',
      '....ww....',
      '....ww....',
      '...mmmm...',
      '...mmmm...',
      '...ffff...',
      '...ffff...',
      '....ff....',
      '..........',
    ],
  },
  house: {
    pal: { r: '#c0522f', w: '#efe0bd', d: '#6b4a2a' },
    rows: [
      '....rr....',
      '...rrrr...',
      '..rrrrrr..',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      '.wwwwwwww.',
      '.ww.dd.ww.',
      '.ww.dd.ww.',
      '.wwwwwwww.',
      '..........',
    ],
  },
  cabinet: {
    pal: { c: '#6fa3bd', k: '#3b2a18', d: '#4c7a91' },
    rows: [
      '.cccccccc.',
      '.cccccccc.',
      '.cc.kk.cc.',
      '.cccccccc.',
      '.cccccccc.',
      '.cc.kk.cc.',
      '.cccccccc.',
      '.cccccccc.',
      '.dddddddd.',
      '..........',
    ],
  },
  drop: {
    pal: { b: '#3f8fd0', w: '#d5ecff' },
    rows: [
      '....bb....',
      '....bb....',
      '...bbbb...',
      '..bbbbbb..',
      '.bbbbbbbb.',
      '.bwbbbbbb.',
      '.bwbbbbbb.',
      '..bbbbbb..',
      '...bbbb...',
      '..........',
    ],
  },
  antenna: {
    pal: { t: '#2f8f7d' },
    rows: [
      '....tt....',
      '..t.tt.t..',
      '.t..tt..t.',
      '....tt....',
      '....tt....',
      '...tttt...',
      '..tt..tt..',
      '.tt....tt.',
      '..........',
      '..........',
    ],
  },
  lock: {
    pal: { g: '#8b8f98', l: '#c9a24b', k: '#4a3418' },
    rows: [
      '...gggg...',
      '..gg..gg..',
      '..gg..gg..',
      '.llllllll.',
      '.llllllll.',
      '.lllkklll.',
      '.lllkklll.',
      '.llllllll.',
      '.llllllll.',
      '..........',
    ],
  },
  bolt: {
    pal: { y: '#e0a92e' },
    rows: [
      '.....yy...',
      '....yyy...',
      '...yyy....',
      '..yyyyyy..',
      '....yyy...',
      '...yyy....',
      '..yyy.....',
      '..yy......',
      '..........',
      '..........',
    ],
  },
  toolbox: {
    pal: { b: '#b5533c', h: '#6b4a2a', l: '#8a3a28' },
    rows: [
      '..........',
      '...hhhh...',
      '..hh..hh..',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '.llllllll.',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '..........',
      '..........',
    ],
  },
  coin: {
    pal: { c: '#e0a92e', w: '#f5e08c', d: '#b07a14' },
    rows: [
      '...cccc...',
      '..cwwccc..',
      '.cwccccdc.',
      '.cwccccdc.',
      '.ccccccdc.',
      '.ccccccdc.',
      '..ccccdd..',
      '...cccc...',
      '..........',
      '..........',
    ],
  },
  trophy: {
    pal: { t: '#e0b13a', d: '#b07a14' },
    rows: [
      '.tttttttt.',
      '.tttttttt.',
      't.tttttt.t',
      't.tttttt.t',
      '.t.tttt.t.',
      '...tttt...',
      '....tt....',
      '...dddd...',
      '..dddddd..',
      '..........',
    ],
  },
  map: {
    pal: { m: '#8a5a33', w: '#f4ead0', r: '#c0522f' },
    rows: [
      '..........',
      '.mmmmmmmm.',
      '.mwwwwwwm.',
      '.mwrrwwwm.',
      '.mwwwrwwm.',
      '.mwwrwwwm.',
      '.mwrwwwwm.',
      '.mmmmmmmm.',
      '..........',
      '..........',
    ],
  },
  crown: {
    pal: { g: '#e0b13a', r: '#c0522f', b: '#3f6fb5' },
    rows: [
      '..........',
      '.g..gg..g.',
      '.g.gggg.g.',
      '.gggggggg.',
      '.grggbggg.',
      '.gggggggg.',
      '.gggggggg.',
      '..........',
      '..........',
      '..........',
    ],
  },
  chest: {
    pal: { w: '#9a6a3a', g: '#e0b13a', d: '#7a4e26', k: '#e0b13a' },
    rows: [
      '..........',
      '.wwwwwwww.',
      '.wwwwwwww.',
      '.gggggggg.',
      '.dddddddd.',
      '.dddkkddd.',
      '.dddkkddd.',
      '.dddddddd.',
      '..........',
      '..........',
    ],
  },
  cart: {
    pal: { b: '#a5713d', d: '#7a4e26', w: '#3b3b3b' },
    rows: [
      '..........',
      '.bbbbbbbb.',
      '.bddbbddb.',
      '.bbbbbbbb.',
      '.bddbbddb.',
      '.bbbbbbbb.',
      '..w....w..',
      '.www..www.',
      '..w....w..',
      '..........',
    ],
  },
  key: {
    pal: { k: '#c9a24b' },
    rows: [
      '..........',
      '..kkk.....',
      '.kk.kk....',
      '.kk.kk....',
      '..kkk.....',
      '...kk.....',
      '...kkk....',
      '...kk.....',
      '...kkk....',
      '..........',
    ],
  },
  star: {
    pal: { s: '#e0a92e' },
    rows: [
      '..........',
      '....ss....',
      '....ss....',
      '.ssssssss.',
      '..ssssss..',
      '...ssss...',
      '..ss..ss..',
      '..........',
      '..........',
      '..........',
    ],
  },
  fish: {
    pal: { f: '#5f9fd6', e: '#1a1c2c', t: '#3f6fb5' },
    rows: [
      '..........',
      '..ffff....',
      '.ffffff..t',
      'ffeffffftt',
      '.ffffff..t',
      '..ffff....',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  crate: {
    pal: { b: '#a5713d', d: '#7a4e26' },
    rows: [
      '..........',
      '.bbbbbbbb.',
      '.bdbbbbdb.',
      '.bbdbbdbb.',
      '.bbbddbbb.',
      '.bbdbbdbb.',
      '.bdbbbbdb.',
      '.bbbbbbbb.',
      '..........',
      '..........',
    ],
  },
  hourglass: {
    pal: { h: '#7a4e26', s: '#e0c25a' },
    rows: [
      '..........',
      '.hhhhhhhh.',
      '..s....s..',
      '..ssssss..',
      '...ssss...',
      '....ss....',
      '...s..s...',
      '..s.ss.s..',
      '.hhhhhhhh.',
      '..........',
    ],
  },
}

function PixelIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const ico = PIXELS[name] ?? PIXELS.toolbox
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      className={'inline-block shrink-0 align-[-3px] ' + (className ?? '')}
      aria-hidden
    >
      {ico.rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill={ico.pal[ch]} />,
        ),
      )}
    </svg>
  )
}

const TRADE_ICON: Record<string, string> = {
  Mindhome: 'house',
  'Aluminium Cabinet': 'cabinet',
  'Iron Work': 'sword',
  'Aluminium Work': 'shield',
  Painting: 'brush',
  Waterproofing: 'drop',
  'Smart Home': 'antenna',
  'Smart Lock': 'lock',
  EE: 'bolt',
  'Other Services': 'toolbox',
}
const tradeIcon = (cat: string) => TRADE_ICON[cat] ?? 'toolbox'

interface Rarity {
  name: string
  frame: string // card border colour
  text: string // rarity label colour
  bar: string // xp bar fill
  glow: boolean
}
function rarity(p: number): Rarity {
  if (p >= 100)
    return { name: 'LEGENDARY', frame: 'border-[#c9920e]', text: 'text-[#a37207]', bar: 'bg-[#e6b429]', glow: true }
  if (p >= 85) return { name: 'EPIC', frame: 'border-[#9b4fb0]', text: 'text-[#8a3f9e]', bar: 'bg-[#b06cc4]', glow: false }
  if (p >= 60) return { name: 'RARE', frame: 'border-[#3f6fb5]', text: 'text-[#33619f]', bar: 'bg-[#5f8fd0]', glow: false }
  if (p >= 30)
    return { name: 'UNCOMMON', frame: 'border-[#3f9b4f]', text: 'text-[#2f8040]', bar: 'bg-[#5fb56f]', glow: false }
  return { name: 'COMMON', frame: 'border-[#9a9484]', text: 'text-[#7d7767]', bar: 'bg-[#a8a292]', glow: false }
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

const INK = 'text-[#3b2a18]'
const FADED = 'text-[#8a7a5e]'

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

  // The pixel font is decorative — load it lazily, fall back to monospace offline.
  useEffect(() => {
    if (document.getElementById('gv-font')) return
    const l = document.createElement('link')
    l.id = 'gv-font'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
    document.head.appendChild(l)
  }, [])

  async function load(quiet = false) {
    if (!quiet) progressStart()
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
    } catch {
      // offline — keep whatever is on screen; the shelf isn't critical
    } finally {
      setLoading(false)
      if (!quiet) progressDone()
    }
  }

  useEffect(() => {
    load()
    // One quiet refetch per burst of realtime events (no progress-bar sweep).
    const rt = coalesce(() => load(true))
    const channel = realtimeChannel('game-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_suppliers' }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
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

  // A bookcase per project.
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
      <div className={`flex h-[var(--app-h,100dvh)] flex-col items-center justify-center gap-4 bg-[#f2e3c2] p-8 text-center ${INK}`}>
        <PixelIcon name="lock" size={56} />
        <p className="gv-pixel text-xs">GAME MODE IS LOCKED</p>
        <p className={`text-sm ${FADED}`}>This area belongs to the guild master.</p>
        <Link to="/" className="gv-btn gv-pixel mt-2 px-4 py-2 text-[10px]">
          BACK TO BASE
        </Link>
      </div>
    )
  }

  return (
    <div className={`h-[var(--app-h,100dvh)] overflow-y-auto bg-[#f2e3c2] ${INK}`} style={{ colorScheme: 'light' }}>
      {/* HUD */}
      <div className="sticky top-0 z-10 border-b-4 border-[#3b2a18] bg-[#f7ecd4]/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="gv-pixel truncate text-xs text-[#7a4e26] sm:text-sm">TENN QUEST</h1>
            <p className={`mt-1 flex items-center gap-1 truncate text-[11px] ${FADED}`}>
              <PixelIcon name="crown" size={14} /> {displayName || 'Lucas'} · Lv {player.level} · {player.quests}{' '}
              quests
            </p>
          </div>
          <div className="text-right">
            <p className="gv-pixel flex items-center justify-end gap-1 text-[10px] text-[#a37207]">
              <PixelIcon name="coin" size={14} /> {money0(player.gold)}
            </p>
            <p className={`mt-1 text-[11px] ${FADED}`}>loot left {money0(player.loot)}</p>
          </div>
          <button
            onClick={() => navigate('/units')}
            title="Back to the normal app"
            className="gv-btn gv-pixel shrink-0 px-3 py-2 text-[9px]"
          >
            ✕ EXIT
          </button>
        </div>
        {/* guild XP bar */}
        <div className="gv-bar mx-auto mt-2 h-3.5 max-w-5xl">
          <div className="gv-shine h-full bg-[#e6b429]" style={{ width: `${player.xp}%` }} />
        </div>
        <div className="mx-auto mt-2 flex max-w-5xl gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the realm…"
            className={`min-w-0 flex-1 border-[3px] border-[#3b2a18] bg-[#fff8e6] px-3 py-1.5 text-sm ${INK} outline-none placeholder:text-[#b3a17c] focus:bg-white`}
          />
          <button
            onClick={() => setShowVault(!showVault)}
            className={
              'gv-btn shrink-0 px-3 py-1.5 text-[10px] font-bold ' +
              (showVault ? '!bg-[#e6b429]' : '')
            }
          >
            <PixelIcon name="key" size={14} /> VAULT
          </button>
        </div>
      </div>

      {/* Bookcases */}
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-5">
        {loading ? (
          <p className={`gv-pixel py-16 text-center text-[10px] ${FADED}`}>LOADING THE REALM…</p>
        ) : shelves.length === 0 ? (
          <p className={`border-[3px] border-dashed border-[#b3a17c] py-16 text-center text-sm ${FADED}`}>
            No quests found in this realm.
          </p>
        ) : (
          shelves.map((shelf) => (
            <section key={shelf.name} className="mb-10">
              {/* wooden nameplate */}
              <h2 className="gv-plaque gv-pixel mb-0 inline-flex max-w-full items-center gap-2 px-3 py-2 text-[9px] text-[#f7ecd4]">
                <PixelIcon name="map" size={14} />
                <span className="truncate">{shelf.name.toUpperCase()}</span>
                <span className="shrink-0 font-sans text-[10px] font-normal normal-case text-[#e0cfa8]">
                  {shelf.units.length} · {shelf.units.filter((u) => u.percent >= 100).length} done
                </span>
              </h2>
              {/* the bookcase: wooden frame, back panel, one plank under every row */}
              <div className="gv-case">
                <div className="gv-shelfbg grid grid-cols-2 gap-x-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shelf.units.map((u) => {
                    const r = rarity(u.percent)
                    return (
                      <button
                        key={u.job.id}
                        onClick={() => setOpenId(u.job.id)}
                        className={
                          `gv-card relative flex flex-col border-[3px] text-left ${r.frame} ` +
                          `${r.glow ? 'gv-glow' : ''} ${u.job.is_archived ? 'opacity-60 saturate-50' : ''}`
                        }
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className={`gv-pixel text-[7px] ${r.text}`}>{r.name}</span>
                          {u.job.is_archived ? (
                            <span className={`gv-pixel text-[7px] ${FADED}`}>VAULT</span>
                          ) : (
                            u.percent >= 100 && <PixelIcon name="trophy" size={14} />
                          )}
                        </div>
                        <p className="gv-pixel mt-1.5 truncate text-[11px]">{u.job.unit_code || '—'}</p>
                        <p className={`mt-1 truncate text-[10px] ${FADED}`}>{u.job.customer_name}</p>
                        <div className="mt-auto">
                          <div className="gv-bar h-2.5">
                            <div className={`h-full ${r.bar}`} style={{ width: `${u.percent}%` }} />
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span className="flex min-w-0 gap-0.5 overflow-hidden">
                              {u.works.slice(0, 4).map((w) => (
                                <PixelIcon key={w.id} name={tradeIcon(w.category)} size={13} />
                              ))}
                              {u.works.length > 4 && <span className={`text-[9px] ${FADED}`}>+{u.works.length - 4}</span>}
                            </span>
                            <span className="gv-pixel shrink-0 text-[8px] text-[#7a4e26]">{u.percent}%</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          ))
        )}
      </div>

      {/* Expanded card — the unit's "character sheet" */}
      {open && <UnitSheet u={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function SheetHeading({ icon, children }: { icon: string; children: string }) {
  return (
    <p className="gv-pixel mb-1.5 flex items-center gap-1.5 text-[8px] text-[#7a4e26]">
      <PixelIcon name={icon} size={14} /> {children}
    </p>
  )
}

function UnitSheet({ u, onClose }: { u: UnitStats; onClose: () => void }) {
  const r = rarity(u.percent)
  const trades = perTradeRows(u.job, u.claims)
  const pics = u.job.pics?.length ? u.job.pics : u.job.pic ? [u.job.pic] : []
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(u.job.created_at).getTime()) / 86400000))

  const badges: { icon: string; label: string }[] = []
  if (u.works.length > 0 && u.works.every((w) => getStage(w.stage).percent >= 100))
    badges.push({ icon: 'trophy', label: 'All quests complete' })
  if (Number(u.job.order_total || 0) > 0 && u.balance <= 0.005) badges.push({ icon: 'coin', label: 'Fully collected' })
  if (Number(u.job.order_total || 0) >= 20000) badges.push({ icon: 'fish', label: 'Big fish' })
  if (u.works.length >= 3) badges.push({ icon: 'sword', label: `${u.works.length}-trade combo` })
  if (u.suppliers.length > 0 && u.suppliers.every((s) => s.stage === 'installed'))
    badges.push({ icon: 'crate', label: 'Supply line cleared' })
  if (ageDays <= 7) badges.push({ icon: 'star', label: 'Fresh quest' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#3b2a18]/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`gv-pop gv-sheet max-h-[92vh] w-full max-w-lg overflow-y-auto border-[4px] p-4 ${r.frame} ${r.glow ? 'gv-glow' : ''} ${INK}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`gv-pixel text-[8px] ${r.text}`}>{r.name}</span>
            <h3 className="gv-pixel mt-1.5 truncate text-base">{u.job.unit_code || '—'}</h3>
            <p className={`mt-1.5 truncate text-sm ${FADED}`}>{u.job.customer_name}</p>
            <p className={`mt-1 flex items-center gap-1 truncate text-[11px] ${FADED}`}>
              <PixelIcon name="map" size={13} /> {u.job.project || '—'}
              {pics.length > 0 && (
                <>
                  {' '}
                  · <PixelIcon name="shield" size={13} /> {pics.join(', ')}
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="gv-btn shrink-0 px-2.5 py-1 text-sm">
            ✕
          </button>
        </div>

        {/* XP */}
        <div className="mt-4">
          <div className="flex justify-between">
            <span className="gv-pixel text-[8px] text-[#7a4e26]">QUEST PROGRESS</span>
            <span className="gv-pixel text-[8px]">{u.percent}%</span>
          </div>
          <div className="gv-bar mt-1 h-3.5">
            <div className={`gv-shine h-full ${r.bar}`} style={{ width: `${u.percent}%` }} />
          </div>
        </div>

        {/* Quests (work cards) */}
        {u.works.length > 0 && (
          <div className="mt-4">
            <SheetHeading icon="sword">QUESTS</SheetHeading>
            <ul className="space-y-1.5">
              {u.works.map((w) => {
                const st = getStage(w.stage)
                const notch = STAGES.findIndex((s) => s.key === st.key)
                return (
                  <li key={w.id} className="border-2 border-[#d8c194] bg-[#fdf4de] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <PixelIcon name={tradeIcon(w.category)} size={15} /> {w.category}
                        {w.title ? <span className={FADED}> · {w.title}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold">{st.label}</span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {STAGES.map((s, i) => (
                        <div
                          key={s.key}
                          className={`h-2 flex-1 border border-[#3b2a18] ${i <= notch ? st.color : 'bg-[#e8d9b0]'}`}
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
          <SheetHeading icon="chest">TREASURY</SheetHeading>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['Quest reward', money0(Number(u.job.order_total || 0)), ''],
                ['Gold earned', money0(u.collected), 'text-[#a37207]'],
                ['Loot left', money0(Math.max(0, u.balance)), u.balance > 0.005 ? 'text-[#b03a2e]' : 'text-[#2f8040]'],
              ] as const
            ).map(([label, value, cls]) => (
              <div key={label} className="border-2 border-[#d8c194] bg-[#fdf4de] p-2">
                <p className={`text-[10px] ${FADED}`}>{label}</p>
                <p className={`gv-pixel mt-1 text-[9px] ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
          {trades.length > 0 && (
            <ul className="mt-2 space-y-1">
              {trades.map((t) => (
                <li key={t.cat} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <PixelIcon name={tradeIcon(t.cat)} size={13} /> {t.cat}
                  </span>
                  <span className="shrink-0 font-mono">
                    {money0(t.collected)} / {money0(t.order)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Supply line (boss-only table; hidden for units without entries) */}
        {u.suppliers.length > 0 && (
          <div className="mt-4">
            <SheetHeading icon="cart">SUPPLY LINE</SheetHeading>
            <ul className="space-y-1">
              {u.suppliers.map((s) => {
                const st = getSupplierStage(s.stage)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <PixelIcon name="cart" size={13} /> {s.supplier}
                      {s.item ? <span className={FADED}> · {s.item}</span> : null}
                    </span>
                    <span className="shrink-0 border border-[#3b2a18] bg-[#fdf4de] px-1.5 py-0.5 text-[10px] font-bold">
                      {st.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mt-4">
            <SheetHeading icon="trophy">BADGES</SheetHeading>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className="flex items-center gap-1.5 border-2 border-[#d8c194] bg-[#fdf4de] px-2.5 py-1 text-[11px] font-medium"
                >
                  <PixelIcon name={b.icon} size={13} /> {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-[#d8c194] pt-3">
          <p className={`flex items-center gap-1 text-[11px] ${FADED}`}>
            <PixelIcon name="hourglass" size={13} /> {ageDays}d old · updated {relativeTime(u.job.updated_at)}
          </p>
          <Link to={`/job/${u.job.id}`} className="gv-btn gv-pixel shrink-0 !bg-[#e6b429] px-3 py-2 text-[8px]">
            OPEN REAL UNIT ▸
          </Link>
        </div>
      </div>
    </div>
  )
}
