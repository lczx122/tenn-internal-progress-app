import { useEffect, useState } from 'react'
import { bindToaster, type ToastItem } from '../lib/toast'

// Single toast host, mounted once in main.tsx. Success toasts auto-dismiss in
// 2.5s, errors stay 5s; tap any toast to dismiss it early. Sits above the
// bottom nav so it never covers the primary action.
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    bindToaster((t) => {
      setItems((prev) => [...prev.slice(-2), t]) // max 3 on screen
      // Errors and undo-able toasts stay longer — 2.5s is too short to react.
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id))
      }, t.kind === 'err' ? 5000 : t.undo ? 6000 : 2500)
    })
    return () => bindToaster(null)
  }, [])

  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          className={
            'toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm text-white shadow-lg ' +
            (t.kind === 'err' ? 'bg-red-600' : 'bg-primary dark:bg-slate-700')
          }
        >
          <span className="min-w-0">{t.text}</span>
          {t.undo && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                t.undo?.()
                setItems((prev) => prev.filter((x) => x.id !== t.id))
              }}
              className="shrink-0 rounded-md border border-white/40 px-2 py-0.5 text-xs font-semibold"
            >
              Undo
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
