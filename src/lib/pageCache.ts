// In-memory page-data cache for stale-while-revalidate navigation. A page seeds
// its initial state from here so revisiting a tab shows the last view instantly
// (no "Loading…" flash), then refreshes in the background. Memory-only — a full
// app reload starts fresh, which is fine.
const store = new Map<string, unknown>()

export function cacheGet<T = unknown>(key: string): T | undefined {
  return store.get(key) as T | undefined
}
export function cacheSet(key: string, value: unknown): void {
  store.set(key, value)
}
