// Shown when the Supabase environment variables are missing, so the app
// gives clear instructions instead of a blank white screen.
import { Icon } from '../components/Icon'

export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-ink">Almost there <Icon name="wrench" className="h-5 w-5 text-muted-2" /></h1>
      <p className="mt-2 text-muted">
        The app isn’t connected to its database yet. Add your Supabase keys:
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-body">
        <li>
          Copy <code className="rounded bg-fill px-1">.env.example</code> to{' '}
          <code className="rounded bg-fill px-1">.env</code>
        </li>
        <li>
          Fill in <code className="rounded bg-fill px-1">VITE_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="rounded bg-fill px-1">VITE_SUPABASE_ANON_KEY</code>{' '}
          from your Supabase project (Settings → API)
        </li>
        <li>Restart the app</li>
      </ol>
      <p className="mt-4 text-sm text-muted-2">
        Full instructions are in <strong>README.md</strong>.
      </p>
    </div>
  )
}
