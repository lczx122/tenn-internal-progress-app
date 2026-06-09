import { useSearchParams } from 'react-router-dom'
import { AppHeader } from '../components/Layout'
import { BottomNav } from '../components/BottomNav'

// The quotation / sales-order generator is a self-contained static tool at
// public/quotation.html. It's embedded full-width here under the app's standard
// header (the tool hides its own header via ?embed=1). Any URL params (e.g.
// ?from=<id>&type=SO from "Convert to SO") are forwarded to the iframe.
export default function Quotation() {
  const [params] = useSearchParams()
  const usp = new URLSearchParams(params)
  usp.set('embed', '1')
  const qs = usp.toString()
  const src = `/quotation.html?${qs}`
  return (
    <div className="flex h-[100dvh] flex-col">
      <AppHeader title="Quote" />
      <div className="min-h-0 flex-1">
        <iframe
          key={qs}
          src={src}
          title="Tenn Fasteners — Quotation Generator"
          className="h-full w-full border-0"
        />
      </div>
      <BottomNav />
    </div>
  )
}
