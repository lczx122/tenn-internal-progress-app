// Tiny global "is something loading" bus for the top progress bar. Pages wrap
// their load() with progressStart()/progressDone(); the bar (mounted once) shows
// while any fetch is in flight. Module-level so it survives page unmounts.
let active = 0
const subs = new Set<(on: boolean) => void>()

function notify() {
  const on = active > 0
  for (const s of subs) s(on)
}

export function progressStart(): void {
  active++
  notify()
}
export function progressDone(): void {
  active = Math.max(0, active - 1)
  notify()
}
export function progressActive(): boolean {
  return active > 0
}
export function onProgress(cb: (on: boolean) => void): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}
