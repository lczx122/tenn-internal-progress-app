import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Segmented switch between the Collection and Costing pages, which share one
// "Money" slot in the nav. Only the boss has Costing, so others see nothing
// (the Collection page just renders on its own).
export function FinanceToggle({ current }: { current: 'collection' | 'costing' }) {
  const { isBoss } = useAuth()
  const navigate = useNavigate()
  if (!isBoss) return null

  const base = 'flex-1 rounded-lg px-3 py-2 text-sm font-medium '
  const on = 'bg-primary text-white'
  const off = 'border border-line-2 bg-surface text-muted active:bg-press'
  return (
    <div className="mb-3 flex gap-2">
      <button
        type="button"
        onClick={() => current !== 'collection' && navigate('/claims')}
        className={base + (current === 'collection' ? on : off)}
      >
        Collection
      </button>
      <button
        type="button"
        onClick={() => current !== 'costing' && navigate('/costing')}
        className={base + (current === 'costing' ? on : off)}
      >
        Costing
      </button>
    </div>
  )
}
