import NetworkDiagram from './NetworkDiagram'
import { LEVEL_SURFACES, CATEGORY_BY_KIND } from './AttackConsole'

const DIFFICULTY_STARS = { Easy: 1, Medium: 2, Hard: 3, Boss: 4 }
const MISSION_NO = { level1: '01', level2: '02', level3: '03', boss: 'X' }

function Stars({ count, max = 4 }) {
  return (
    <span className="stars">
      {'★'.repeat(count)}
      <span className="dim">{'★'.repeat(max - count)}</span>
    </span>
  )
}

export default function MissionPreview({ level, patches, onEnter }) {
  if (!level) {
    return (
      <div className="panel accent mission-preview fade-up">
        <div className="label text-accent">ALL MISSIONS CLEARED</div>
        <h2 className="display">EVERY SYSTEM IS SECURE.</h2>
        <p className="text-dim">Replay a mission or check where you rank.</p>
      </div>
    )
  }

  const kinds = LEVEL_SURFACES[level.id] || ['chat', 'tool']
  const nodes = kinds.map((k) => ({ id: k, kind: k }))
  const weakNodeId = kinds.find((k) => !(patches || []).includes(CATEGORY_BY_KIND[k])) || null

  return (
    <div className="mission-preview fade-up">
      <div className="panel accent mission-preview-copy">
        <div className="label text-accent">NEXT TARGET // MISSION {MISSION_NO[level.id] || ''}</div>
        <h2 className="display">{level.name.toUpperCase()}</h2>
        <div className="mono text-dim" style={{ marginTop: 4 }}>TARGET // {level.name.toUpperCase()}</div>
        <Stars count={DIFFICULTY_STARS[level.difficulty] || 1} />
        <p className="text-dim" style={{ marginTop: 14 }}>{level.blurb}</p>
        <div className="mono text-accent" style={{ fontSize: 20, marginTop: 10 }}>+{level.reward_xp} XP</div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => onEnter(level.id)}>
          ENTER MISSION →
        </button>
      </div>
      <div className="panel raised mission-preview-visual">
        <div className="label">TARGET // {level.name.toUpperCase()} — AI AGENT</div>
        <NetworkDiagram botLabel={level.name.toUpperCase()} nodes={nodes} weakNodeId={weakNodeId} />
      </div>
    </div>
  )
}
