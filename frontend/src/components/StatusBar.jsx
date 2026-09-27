import { ArrowIcon } from './icons'

export function levelFromXp(xp) {
  return Math.floor((xp || 0) / 500) + 1
}

export function scoreColor(score) {
  if (score < 50) return 'var(--breach)'
  if (score < 80) return 'var(--amber)'
  return 'var(--safe)'
}

export default function StatusBar({ xp = 0, onBack, backLabel = 'MISSIONS', error }) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {onBack && (
          <button type="button" className="btn-ghost status-back" onClick={onBack}>
            <ArrowIcon width={14} height={14} style={{ transform: 'rotate(180deg)' }} /> {backLabel}
          </button>
        )}
      </div>
      <div className="status-bar-right">
        {error && <span className="status-error">SIGNAL LOST — {error}</span>}
        <span className="status-lvl">LVL {String(levelFromXp(xp)).padStart(2, '0')}</span>
        <span className="status-xp">{xp.toLocaleString()} XP</span>
      </div>
    </div>
  )
}
