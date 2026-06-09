import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { BottomNav } from './BottomNav'

// App shell: sticky top bar with the signed-in user + sign out, and a
// centered, phone-width content column. Top-level screens pass `bottomNav`
// to show the tab bar; detail/form screens pass `back` instead.
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
  const { displayName, isAdmin, signOut } = useAuth()
  return (
    <div className="flex h-[100dvh] flex-col">
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
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-4">{children}</div>
      </main>
      {bottomNav && <BottomNav />}
    </div>
  )
}
