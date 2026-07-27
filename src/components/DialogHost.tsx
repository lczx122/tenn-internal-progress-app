import { useEffect, useRef, useState } from 'react'
import { bindDialogHost, type DialogState } from '../lib/dialog'

// Renders confirmDialog / promptDialog requests (see src/lib/dialog.ts).
// Mounted once in main.tsx. Backdrop tap and Esc cancel; Enter confirms.
export function DialogHost() {
  const [d, setD] = useState<DialogState | null>(null)
  const [text, setText] = useState('')
  const [guard, setGuard] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bindDialogHost((next) => {
      setD(next)
      setText(next?.input?.initial ?? '')
      setGuard('')
    })
    return () => bindDialogHost(null)
  }, [])

  useEffect(() => {
    if (d?.input || d?.requireText) inputRef.current?.focus()
  }, [d])

  if (!d) return null

  const guardOk = !d.requireText || guard.trim().toLowerCase() === d.requireText.trim().toLowerCase()

  const close = (v: boolean | string | null) => {
    d.resolve(v)
    setD(null)
  }
  const confirm = () => {
    if (!guardOk) return
    close(d.input ? text.trim() : true)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6"
      onClick={() => close(d.input ? null : false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close(d.input ? null : false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
      >
        {d.title && <h2 className="mb-1 text-base font-semibold text-slate-900">{d.title}</h2>}
        <p className="text-sm text-slate-700">{d.message}</p>

        {d.input && (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
            placeholder={d.input.placeholder}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-slate-900"
          />
        )}

        {d.requireText && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-500">
              Type <span className="font-mono font-bold text-slate-700">{d.requireText}</span> to confirm:
            </p>
            <input
              ref={inputRef}
              value={guard}
              onChange={(e) => setGuard(e.target.value)}
              placeholder={d.requireText}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-red-500"
            />
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => close(d.input ? null : false)}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 active:bg-slate-50"
          >
            {d.cancelLabel}
          </button>
          <button
            onClick={confirm}
            disabled={!guardOk}
            autoFocus={!d.input && !d.requireText}
            className={
              'min-h-[44px] rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ' +
              (d.danger ? 'bg-red-600 active:bg-red-700' : 'bg-slate-900 active:bg-slate-700')
            }
          >
            {d.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
