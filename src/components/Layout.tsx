import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BottomNav } from './BottomNav'

// The standard top bar: title, signed-in user (admins link to Staff & roles),
// and sign out. Shared so every screen — including the embedded Quote tool —
// has the same header.
export function AppHeader({ title, back, wide }: { title: string; back?: ReactNode; wide?: boolean }) {
  const { displayName, isAdmin, signOut } = useAuth()
  const w = wide ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg'
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
export function Layout({
  children,
  title,
  back,
  bottomNav,
  wide,
}: {
  children: ReactNode
  title: string
  back?: ReactNode
  bottomNav?: boolean
  wide?: boolean
}) {
  return (
    <div className="flex h-[100dvh] flex-col">
      <AppHeader title={title} back={back} wide={wide} />
      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto px-4 py-4 ${wide ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg'}`}>{children}</div>
      </main>
      {bottomNav && <BottomNav />}
    </div>
  )
}
