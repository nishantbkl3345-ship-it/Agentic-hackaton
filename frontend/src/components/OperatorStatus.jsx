import { levelFromXp } from './StatusBar'

function Stat({ label, value, accent }) {
  return (
    <div className="op-stat">
      <div className="label">{label}</div>
      <div className={`mono op-stat-num ${accent ? 'text-accent' : ''}`}>{value}</div>
    </div>
  )
}

export default function OperatorStatus({ xp, elo, stats }) {
  const level = levelFromXp(xp)
  const xpIntoLevel = xp % 500
  const remaining = 500 - xpIntoLevel
  const pct = Math.min(100, (xpIntoLevel / 500) * 100)

  return (
    <div className="operator-status fade-up">
      <h3 className="display">OPERATOR STATUS</h3>
      <div className="op-level mono">LEVEL {String(level).padStart(2, '0')}</div>
      <div className="op-xp mono">{xp.toLocaleString()} XP</div>
      <div className="op-progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="label text-dim">NEXT LEVEL — {remaining.toLocaleString()} XP</div>

      <div className="op-stat-row">
        <Stat label="ELO" value={elo} accent />
        <Stat label="EXPLOITS" value={stats?.exploits ?? 0} />
        <Stat label="PATCHES" value={stats?.patches ?? 0} />
        <Stat label="MISSIONS" value={`${stats?.missions_cleared ?? 0} / ${stats?.missions_total ?? 0}`} />
      </div>
    </div>
  )
}
