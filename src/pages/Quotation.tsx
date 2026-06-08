import { BottomNav } from '../components/BottomNav'

// The quotation generator is a self-contained static tool (catalog, cabinet
// pricing, print/PDF, register-line copy, localStorage). It lives untouched at
// public/quotation.html and is embedded full-width here, behind the app's auth
// gate. Editing prices? Edit public/quotation.html — not this wrapper.
export default function Quotation() {
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      <div className="min-h-0 flex-1 pb-14">
        <iframe
          src="/quotation.html"
          title="Tenn Fasteners — Quotation Generator"
          className="h-full w-full border-0"
        />
      </div>
      <BottomNav />
    </div>
  )
}
