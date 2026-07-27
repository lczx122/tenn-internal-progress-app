// Promise-based in-app confirm / prompt — replaces window.confirm/prompt,
// which render as unstyled native dialogs (and are unreliable inside the
// PWA/webviews). The single <DialogHost /> in main.tsx renders the card.
//
//   if (!(await confirmDialog({ message: 'Delete this?', confirmLabel: 'Delete', danger: true }))) return
//   const name = await promptDialog({ message: 'Rename project', initial: p.name })

export interface DialogState {
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  // Prompt mode: show a text input, resolve with its value (null on cancel).
  input?: { initial?: string; placeholder?: string }
  // Extra guard for the scariest actions: user must type this exact text
  // (case-insensitive) before the confirm button enables.
  requireText?: string
  resolve: (v: boolean | string | null) => void
}

let host: ((d: DialogState | null) => void) | null = null

export function bindDialogHost(fn: ((d: DialogState | null) => void) | null): void {
  host = fn
}

export function confirmDialog(opts: {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  requireText?: string
}): Promise<boolean> {
  if (!host) return Promise.resolve(window.confirm(opts.message)) // fallback, never expected
  return new Promise((resolve) => {
    host!({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'OK',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      danger: opts.danger ?? false,
      requireText: opts.requireText,
      resolve: (v) => resolve(v === true),
    })
  })
}

export function promptDialog(opts: {
  title?: string
  message: string
  initial?: string
  placeholder?: string
  confirmLabel?: string
}): Promise<string | null> {
  if (!host) return Promise.resolve(window.prompt(opts.message, opts.initial ?? ''))
  return new Promise((resolve) => {
    host!({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Save',
      cancelLabel: 'Cancel',
      danger: false,
      input: { initial: opts.initial, placeholder: opts.placeholder },
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    })
  })
}
