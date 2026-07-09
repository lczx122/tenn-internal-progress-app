import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

// Type-guard builder for string-union state: validate: oneOf('mine', 'all').
export function oneOf<T extends string>(...vals: readonly T[]) {
  return (v: unknown): v is T => vals.includes(v as T)
}

// useState that survives reloads via localStorage. Used for filter/toggle/sort
// preferences so a page refresh (or iOS discarding the PWA) doesn't reset them.
//
//  - `validate` accepts only expected values from storage (stale/garbage → default).
//  - `override` (e.g. a URL param) wins over the stored value for this mount but
//    is not written back, so deep-links stay transient.
//  - The first render never writes: untouched defaults are never persisted, and
//    a tri-state default of null means "no explicit choice" (null is stored as
//    a key removal, so the default logic applies again next time).
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: {
    validate?: (v: unknown) => v is T
    override?: T | null
  },
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (options?.override != null) return options.override
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        if (options?.validate ? options.validate(parsed) : parsed != null && typeof parsed === typeof defaultValue) {
          return parsed as T
        }
      }
    } catch {
      // ignore storage/parse failures — fall through to the default
    }
    return defaultValue
  })

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore storage failures
    }
  }, [key, value])

  return [value, setValue]
}
