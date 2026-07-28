import { useEffect, useState } from 'react'

// Global connectivity strip. The service worker deliberately caches nothing
// (so the app is never stale), which means offline = nothing loads and no
// write can land — say so plainly instead of letting saves fail quietly.
// Mounted once in main.tsx; useAutoRefresh refetches everywhere on 'online'.
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[90] bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-slate-900"
      style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top))' }}
    >
      You're offline — changes can't be saved right now.
    </div>
  )
}
