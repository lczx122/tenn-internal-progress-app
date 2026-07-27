// App-wide toast bus. Pages call toastOk / toastErr; the single <Toaster />
// mounted in main.tsx renders the stack. Module-level pub/sub (same pattern as
// progress.ts) so any code — components, helpers, event handlers — can toast.

export interface ToastItem {
  id: number
  kind: 'ok' | 'err'
  text: string
  // Optional undo action — shown as an "Undo" button on the toast.
  undo?: () => void
}

let nextId = 1
let notify: ((t: ToastItem) => void) | null = null

export function bindToaster(fn: ((t: ToastItem) => void) | null): void {
  notify = fn
}

export function toastOk(text: string, undo?: () => void): void {
  notify?.({ id: nextId++, kind: 'ok', text, undo })
}

export function toastErr(text: string): void {
  notify?.({ id: nextId++, kind: 'err', text })
}

// Await a Supabase mutation, toast on failure, optionally toast on success.
// Returns true when the write landed — callers gate navigation/cleanup on it.
export async function runDb(
  q: PromiseLike<{ error: { message: string } | null }>,
  opts?: { ok?: string; fail?: string },
): Promise<boolean> {
  try {
    const { error } = await q
    if (error) {
      toastErr(`${opts?.fail ?? 'Could not save'} — ${error.message}`)
      return false
    }
    if (opts?.ok) toastOk(opts.ok)
    return true
  } catch {
    toastErr(`${opts?.fail ?? 'Could not save'} — check your connection.`)
    return false
  }
}
