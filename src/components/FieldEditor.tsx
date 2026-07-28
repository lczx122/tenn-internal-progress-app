import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// App-wide mobile field editor: on touch devices, focusing any text/number
// field opens a focused editing card floating above the keyboard, and mirrors
// what you type back into the real field. React-app twin of the editor in
// public/quotation.html.
//
// Opt a field out with `data-fed-skip`; override its title with
// `data-fed-label="…"`.

const TEXT_TYPES = new Set(['text', 'number', 'tel', 'email', 'url', 'search'])

function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return (
    (navigator.maxTouchPoints || 0) > 0 ||
    (!!window.matchMedia && window.matchMedia('(pointer:coarse)').matches)
  )
}

function isEditable(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLElement)) return false
  if (el.dataset.fedSkip !== undefined) return false
  const f = el as HTMLInputElement
  if (f.readOnly || f.disabled) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  const t = (f.type || 'text').toLowerCase()
  if (t === 'password') return false // leave password managers / autofill alone
  return TEXT_TYPES.has(t)
}

// Update a (possibly React-controlled) field so React's onChange fires.
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function deriveLabel(el: HTMLElement): string {
  const dl = el.getAttribute('data-fed-label')
  if (dl) return dl
  if (el.id) {
    try {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      const t = lab?.textContent?.replace(/\s+/g, ' ').trim()
      if (t) return t
    } catch {
      /* ignore bad selectors */
    }
  }
  const wrap = el.closest('label')
  if (wrap) {
    const c = wrap.cloneNode(true) as HTMLElement
    c.querySelectorAll('input,textarea,select,button').forEach((n) => n.remove())
    const t = c.textContent?.replace(/\s+/g, ' ').trim()
    if (t) return t
  }
  return el.getAttribute('aria-label') || (el as HTMLInputElement).placeholder || 'Edit'
}

export default function FieldEditor() {
  const [touch] = useState(isTouchDevice)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const location = useLocation()

  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const originalRef = useRef('')

  // Place the card vertically centred in the area above the keyboard.
  function reposition() {
    const card = cardRef.current
    if (!card) return
    const vv = window.visualViewport
    const vh = vv ? vv.height : window.innerHeight
    const off = vv ? vv.offsetTop : 0
    card.style.top = `${off + vh * 0.42}px`
  }

  function dismiss() {
    setOpen(false)
    inputRef.current?.blur()
    areaRef.current?.blur()
    targetRef.current = null
  }

  useEffect(() => {
    if (!touch) return
    // Which control shows is driven imperatively (not via React) so it's correct
    // at the synchronous focus() call.
    if (areaRef.current) areaRef.current.style.display = 'none'

    function openFor(target: HTMLInputElement | HTMLTextAreaElement) {
      const input = inputRef.current
      const area = areaRef.current
      if (!input || !area) return
      targetRef.current = target
      originalRef.current = target.value
      const ml = target.tagName === 'TEXTAREA'
      const el: HTMLInputElement | HTMLTextAreaElement = ml ? area : input
      if (ml) {
        area.style.display = ''
        input.style.display = 'none'
      } else {
        input.style.display = ''
        area.style.display = 'none'
        const ti = target as HTMLInputElement
        input.type = ti.type === 'search' ? 'text' : ti.type || 'text'
        ;['inputmode', 'step', 'min', 'max', 'maxlength', 'list', 'pattern'].forEach((a) => {
          const v = target.getAttribute(a)
          if (v !== null) input.setAttribute(a, v)
          else input.removeAttribute(a)
        })
      }
      el.value = target.value
      setLabel(deriveLabel(target))
      setOpen(true)
      reposition()
      el.focus() // synchronous, inside the tap, so iOS keeps the keyboard up
      try {
        if (!(el === input && input.type === 'number')) {
          const end = el.value.length
          ;(el as HTMLInputElement).setSelectionRange(end, end)
        }
      } catch {
        /* number/email inputs reject setSelectionRange */
      }
    }

    function onFocusIn(e: FocusEvent) {
      const t = e.target
      if (rootRef.current && t instanceof Node && rootRef.current.contains(t)) return
      if (!isEditable(t)) return
      openFor(t)
    }

    document.addEventListener('focusin', onFocusIn)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
    }
  }, [touch])

  // Close if the user navigates away while the editor is open.
  useEffect(() => {
    dismiss()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  if (!touch) return null

  function onBoxInput(e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = targetRef.current
    if (target) setNativeValue(target, (e.target as HTMLInputElement).value)
  }
  function cancel() {
    const t = targetRef.current
    if (t) setNativeValue(t, originalRef.current)
    dismiss()
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' && areaRef.current?.style.display === 'none') || e.key === 'Escape') {
      e.preventDefault()
      if (e.key === 'Escape') cancel()
      else dismiss()
    }
  }

  const inputClass =
    'w-full rounded-[10px] border-[1.5px] border-primary px-3 py-3 text-[17px] outline-none'

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-[200] ${open ? '' : 'pointer-events-none opacity-0'}`}
    >
      <div className="absolute inset-0 bg-primary/45" onClick={dismiss} />
      <div
        ref={cardRef}
        className="absolute left-1/2 w-[min(360px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-4 shadow-2xl"
      >
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-2">
          {label || 'Edit'}
        </div>
        <input ref={inputRef} tabIndex={-1} onInput={onBoxInput} onKeyDown={onKeyDown} className={inputClass} />
        <textarea ref={areaRef} tabIndex={-1} rows={4} onInput={onBoxInput} className={`${inputClass} resize-y`} />
        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={cancel}
            className="rounded-[10px] border border-line-2 px-4 py-2.5 text-sm font-semibold text-muted active:bg-press"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white active:bg-primary-press"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
