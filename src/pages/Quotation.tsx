import { useSearchParams } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

// The quotation / sales-order generator is a self-contained static tool
// (catalog, cabinet pricing, print/PDF, localStorage). It lives untouched at
// public/quotation.html and is embedded full-width here, behind the app's auth
// gate. Any URL params (e.g. ?from=<id>&type=SO from "Convert to SO") are
// forwarded to the iframe. Editing prices? Edit public/quotation.html.
export default function Quotation() {
  const [params] = useSearchParams()
  const qs = params.toString()
  const src = '/quotation.html' + (qs ? `?${qs}` : '')
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
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
