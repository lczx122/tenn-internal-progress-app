// Shown when an initial load fails and there is no cached data to fall back on —
// so users can tell "couldn't reach the server" apart from a real empty list.
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 py-10 text-center">
      <p className="text-sm font-medium text-red-700">Couldn't load — check your connection.</p>
      <button
        onClick={onRetry}
        className="mt-3 min-h-[44px] rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 active:bg-red-50"
      >
        Retry
      </button>
    </div>
  )
}
