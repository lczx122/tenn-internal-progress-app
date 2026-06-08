import type { ReactNode } from 'react'
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
  const { displayName, signOut } = useAuth()
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {back}
          <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
          <div className="text-right">
            <div className="text-xs leading-tight text-slate-300">Signed in</div>
            <div className="text-sm font-medium leading-tight">{displayName}</div>
          </div>
          <button
            onClick={signOut}
            className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium active:bg-slate-600"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className={`mx-auto max-w-lg px-4 py-4 ${bottomNav ? 'pb-24' : ''}`}>
        {children}
      </main>
      {bottomNav && <BottomNav />}
    </div>
  )
}
