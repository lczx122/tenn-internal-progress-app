import { getStage } from '../lib/stages'

// A compact progress bar + stage label for a given stage key.
export function StageBar({ stageKey }: { stageKey: string }) {
  const stage = getStage(stageKey)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-body">{stage.label}</span>
        <span className="text-muted-2">{stage.percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-fill dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
          style={{ width: `${stage.percent}%` }}
        />
      </div>
    </div>
  )
}

// A plain percentage bar with a custom label (used for a unit's overall
// progress, averaged across its categories).
export function PercentBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-body">{label}</span>
        <span className="text-muted-2">{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-fill dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-slate-800 dark:bg-page transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
