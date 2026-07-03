// Share an on-screen element as a PDF via the Web Share API (mobile), mirroring
// the quotation tool's approach: lazily load html2canvas + jsPDF from CDN, snap
// the element to an image, and hand it to the native share sheet (falling back
// to a download). The element is cloned with a `.pdf-light` class so the export
// is always light-themed, even when the app is in dark mode.

declare global {
  interface Window {
    html2canvas?: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jspdf?: { jsPDF: any }
  }
}

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => res()
    s.onerror = () => rej(new Error('Failed to load ' + src))
    document.head.appendChild(s)
  })
}

let libs: Promise<void> | null = null
function ensurePdfLibs() {
  if (!libs)
    libs = (async () => {
      if (!window.html2canvas)
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
      if (!(window.jspdf && window.jspdf.jsPDF))
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      if (!window.html2canvas || !(window.jspdf && window.jspdf.jsPDF)) throw new Error('PDF tools unavailable')
    })()
  return libs
}

export function canShareFiles(): boolean {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }))
  } catch {
    return false
  }
}

// Render `el` to an A4 PDF (image-based, multi-page) and offer it via the share
// sheet; falls back to a file download. Returns false if PDF tools failed.
export async function shareElementAsPdf(
  el: HTMLElement,
  filename: string,
  orientation: 'p' | 'l' = 'l',
  meta?: { title?: string; text?: string },
): Promise<boolean> {
  await ensurePdfLibs()
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff'
  const clone = el.cloneNode(true) as HTMLElement
  clone.classList.add('pdf-light')
  clone.style.width = '1100px'
  clone.style.background = '#fff'
  clone.style.padding = '12px'
  holder.appendChild(clone)
  document.body.appendChild(holder)
  try {
    const canvas = await window.html2canvas!(holder, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1124 })
    const img = canvas.toDataURL('image/jpeg', 0.92)
    const { jsPDF } = window.jspdf!
    const pdf = new jsPDF(orientation, 'mm', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const m = 8
    const availW = pageW - m * 2
    const imgH = (canvas.height * availW) / canvas.width
    if (imgH <= pageH - m * 2) {
      pdf.addImage(img, 'JPEG', m, m, availW, imgH, undefined, 'FAST')
    } else {
      const iw = pageW
      const ih = (canvas.height * iw) / canvas.width
      let left = ih
      let pos = 0
      pdf.addImage(img, 'JPEG', 0, pos, iw, ih, undefined, 'FAST')
      left -= pageH
      while (left > 0) {
        pos -= pageH
        pdf.addPage()
        pdf.addImage(img, 'JPEG', 0, pos, iw, ih, undefined, 'FAST')
        left -= pageH
      }
    }
    const blob: Blob = pdf.output('blob')
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: meta?.title, text: meta?.text })
        return true
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return true // user cancelled
      }
    }
    // Share unavailable / failed → download the file.
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      a.remove()
    }, 1500)
    return true
  } finally {
    document.body.removeChild(holder)
  }
}
