import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BottomNav } from './BottomNav'
import { usePullToRefresh, PULL_THRESHOLD } from '../lib/usePullToRefresh'

// The standard top bar: title, signed-in user (admins link to Staff & roles),
// and sign out. Shared so every screen — including the embedded Quote tool —
// has the same header.
export function AppHeader({ title, back, wide }: { title: string; back?: ReactNode; wide?: boolean }) {
  const { displayName, isAdmin, signOut } = useAuth()
  const w = wide ? 'max-w-lg lg:max-w-screen-2xl' : 'max-w-lg'
  return (
    <header className="shrink-0 bg-slate-900 text-white shadow pt-[env(safe-area-inset-top)]">
      <div className={`mx-auto flex ${w} items-center gap-3 px-4 py-3`}>
        {back}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        {isAdmin ? (
          <Link to="/staff" className="text-right active:opacity-70" title="Staff & roles">
            <div className="text-xs leading-tight text-amber-300">Admin ⚙︎</div>
            <div className="text-sm font-medium leading-tight">{displayName}</div>
          </Link>
        ) : (
          <div className="text-right">
            <div className="text-xs leading-tight text-slate-300">Signed in</div>
            <div className="text-sm font-medium leading-tight">{displayName}</div>
          </div>
        )}
        <button
          onClick={signOut}
          className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium active:bg-slate-600"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

// App shell: the header above, a centered scrolling content column, and (for
// top-level screens) the bottom tab bar. `wide` lets a page use the full width
// on desktop (e.g. the costing spreadsheet); detail/form screens pass `back`.
// Pass `onRefresh` to enable swipe-down-to-refresh on touch devices.
export function Layout({
  children,
  title,
  back,
  bottomNav,
  wide,
  onRefresh,
}: {
  children: ReactNode
  title: string
  back?: ReactNode
  bottomNav?: boolean
  wide?: boolean
  onRefresh?: () => void | Promise<void>
}) {
  const mainRef = useRef<HTMLElement>(null)
  const { pull, refreshing, dragging } = usePullToRefresh(mainRef, onRefresh)
  const progress = Math.min(1, pull / PULL_THRESHOLD)

  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col">
      <AppHeader title={title} back={back} wide={wide} />
      <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-y-contain">
        {onRefresh && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-end justify-center overflow-hidden"
            style={{ height: pull }}
          >
            <RefreshSpinner spinning={refreshing} progress={progress} />
          </div>
        )}
        <div
          style={{
            transform: pull ? `translateY(${pull}px)` : undefined,
            transition: dragging ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div className={`mx-auto px-4 py-4 ${wide ? 'max-w-lg lg:max-w-screen-2xl' : 'max-w-lg'}`}>{children}</div>
        </div>
      </main>
      {bottomNav && <BottomNav />}
    </div>
  )
}

// The pull-to-refresh spinner: a ring that fills as you pull, then spins.
function RefreshSpinner({ spinning, progress }: { spinning: boolean; progress: number }) {
  return (
    <div className="mb-2 rounded-full bg-white p-1.5 shadow-md ring-1 ring-slate-200">
      <svg
        viewBox="0 0 24 24"
        className={'h-5 w-5 text-slate-700 ' + (spinning ? 'animate-spin' : '')}
        style={spinning ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        {(spinning || progress > 0.05) && <path d="M21 4v5h-5" />}
      </svg>
    </div>
  )
}
