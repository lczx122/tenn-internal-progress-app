import { useEffect, useRef, useState } from 'react'
import { onProgress, progressActive } from '../lib/progress'

// A thin top bar that creeps forward while any data fetch is in flight, then
// completes and fades out. Mounted once (in main.tsx); driven by the progress
// bus. No dependency.
export function TopProgressBar() {
  const [active, setActive] = useState(progressActive())
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const creep = useRef<number | undefined>(undefined)

  useEffect(() => onProgress(setActive), [])

  useEffect(() => {
    if (active) {
      setVisible(true)
      setWidth((w) => (w < 8 ? 8 : w))
      creep.current = window.setInterval(() => {
        setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w))
      }, 200)
      return () => {
        if (creep.current) clearInterval(creep.current)
      }
    }
    // finished: snap to 100%, then hide
    if (visible) {
      setWidth(100)
      const t = window.setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 280)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!visible) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60]"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <div
        className="h-0.5 bg-emerald-400 transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: active ? 1 : 0, boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}
      />
    </div>
  )
}
