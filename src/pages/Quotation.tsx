import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppHeader } from '../components/Layout'
import { BottomNav } from '../components/BottomNav'
import { Sidebar } from '../components/Sidebar'
import { resolvedTheme } from '../lib/theme'

// The quotation / sales-order generator is a self-contained static tool at
// public/quotation.html. It's embedded full-width here under the app's standard
// header (the tool hides its own header via ?embed=1). Any URL params (e.g.
// ?from=<id>&type=SO from "Convert to SO") are forwarded to the iframe.
export default function Quotation() {
  const [params] = useSearchParams()
  // Cache-bust with a value that's unique per visit (build id + a fresh nonce
  // each time this page mounts). A per-build id alone only refreshes once the
  // device loads a new app shell; a per-visit nonce guarantees the iframe never
  // serves a stale quotation.html, so /quote always matches /quotation.html.
  // Stable across re-renders (useMemo) so the iframe doesn't reload mid-session.
  const cacheBust = useMemo(
    () => `${__BUILD_ID__}.${Date.now().toString(36)}`,
    [],
  )
  const usp = new URLSearchParams(params)
  usp.set('embed', '1')
  usp.set('v', cacheBust)
  usp.set('theme', resolvedTheme())
  const qs = usp.toString()
  const src = `/quotation.html?${qs}`
  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col overflow-hidden lg:flex-row">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader title="Quote" />
        <div className="min-h-0 flex-1">
          <iframe
            key={qs}
            src={src}
            title="Tenn Fasteners — Quotation Generator"
            className="h-full w-full border-0"
            allow="web-share; clipboard-write"
          />
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
