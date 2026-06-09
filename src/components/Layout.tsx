import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BottomNav } from './BottomNav'

// The standard top bar: title, signed-in user (admins link to Staff & roles),
// and sign out. Shared so every screen — including the embedded Quote tool —
// has the same header.
export function AppHeader({ title, back }: { title: string; back?: ReactNode }) {
  const { displayName, isAdmin, signOut } = useAuth()
  return (
    <header className="shrink-0 bg-slate-900 text-white shadow pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
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

// App shell: the header above, a centered phone-width scrolling content column,
// and (for top-level screens) the bottom tab bar. Detail/form screens pass
// `back` instead of `bottomNav`.
export function Layout({
  children,
  title,
  back,
  bottomNav,
}: {
  children: ReactNode
  title: string
  back?: ReactNode
  bottomNav?: boolean
}) {
  return (
    <div className="flex h-[100dvh] flex-col">
      <AppHeader title={title} back={back} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-4">{children}</div>
      </main>
      {bottomNav && <BottomNav />}
    </div>
  )
}
