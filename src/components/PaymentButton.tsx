import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Mobile-only floating button → a sheet with the payment QR (static
// /payment-qr.png) and the bank account details (admin-editable, stored in
// app_settings key 'payment_details'). Handy for staff collecting on site.
type Pay = { bank_name?: string; account_name?: string; account_number?: string; note?: string }

export function PaymentButton() {
  const [open, setOpen] = useState(false)
  const [pay, setPay] = useState<Pay>({})
  const [copied, setCopied] = useState(false)
  const [qrOk, setQrOk] = useState(true)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'payment_details')
      .maybeSingle()
      .then(({ data }) => setPay((data?.value as Pay) ?? {}))
  }, [])

  async function copyAcct() {
    if (!pay.account_number) return
    try {
      await navigator.clipboard.writeText(pay.account_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        className="fixed right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg active:bg-emerald-700 lg:hidden"
        aria-label="Payment QR & bank details"
        title="Payment QR & bank details"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3M20 14v.01M14 20v.01M20 20v.01M17 17v3" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-primary/50 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-2">Collect payment</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="min-h-[40px] min-w-[40px] rounded-lg text-faint active:text-muted"
              >
                ✕
              </button>
            </div>
            {qrOk && (
              <img
                src="/payment-qr.png"
                alt="Payment QR"
                className="mx-auto mb-4 w-56 max-w-full rounded-lg border border-line"
                onError={() => setQrOk(false)}
              />
            )}
            <div className="space-y-1.5 text-sm">
              {pay.bank_name && (
                <div>
                  <span className="text-faint">Bank </span>
                  <span className="font-medium text-ink-2">{pay.bank_name}</span>
                </div>
              )}
              {pay.account_name && (
                <div>
                  <span className="text-faint">Name </span>
                  <span className="font-medium text-ink-2">{pay.account_name}</span>
                </div>
              )}
              {pay.account_number && (
                <button
                  onClick={copyAcct}
                  className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 active:bg-press"
                >
                  <span className="font-mono text-base font-semibold text-ink">{pay.account_number}</span>
                  <span className="text-xs font-medium text-emerald-600">{copied ? 'Copied ✓' : 'Tap to copy'}</span>
                </button>
              )}
              {pay.note && <p className="pt-1 text-xs text-muted-2">{pay.note}</p>}
              {!pay.bank_name && !pay.account_number && (
                <p className="text-xs text-faint">Bank details not set yet — an admin can add them in Settings.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
