import { getStage } from '../lib/stages'

// A compact progress bar + stage label for a given stage key.
export function StageBar({ stageKey }: { stageKey: string }) {
  const stage = getStage(stageKey)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-slate-700">{stage.label}</span>
        <span className="text-slate-500">{stage.percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
          style={{ width: `${stage.percent}%` }}
        />
      </div>
    </div>
  )
}
