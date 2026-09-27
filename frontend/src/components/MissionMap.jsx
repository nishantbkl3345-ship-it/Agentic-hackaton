import { useState } from 'react'
import { LockIcon, CheckIcon } from './icons'

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

function nodeState(lvl) {
  if (lvl.boss) return lvl.cleared ? 'cleared' : lvl.unlocked ? 'boss-ready' : 'locked'
  if (lvl.cleared) return 'cleared'
  if (lvl.unlocked) return 'current'
  return 'locked'
}

export default function MissionMap({ levels, onSelect }) {
  const [hoverId, setHoverId] = useState(null)
  const hovered = levels.find((l) => l.id === hoverId) || null

  return (
    <div className="mission-map fade-up">
      <h2 className="display mission-map-title">AI BREACH MAP</h2>
      <p className="label text-dim">TRACE. EXPLOIT. SURVIVE.</p>

      <div className="map-row">
        {levels.map((lvl, i) => {
          const state = nodeState(lvl)
          return (
            <span key={lvl.id} className="map-row-item">
              <button
                type="button"
                className={`map-node ${state} ${lvl.boss ? 'boss' : ''}`}
                disabled={!lvl.unlocked}
                onClick={() => lvl.unlocked && onSelect(lvl.id)}
                onMouseEnter={() => setHoverId(lvl.id)}
                onMouseLeave={() => setHoverId((h) => (h === lvl.id ? null : h))}
                onFocus={() => setHoverId(lvl.id)}
              >
                <span className="map-node-no mono">{MISSION_NO[lvl.id]}</span>
                <span className="map-node-glyph">
                  {state === 'cleared' ? <CheckIcon width={18} height={18} /> : state === 'locked' ? <LockIcon width={16} height={16} /> : '●'}
                </span>
                <span className="map-node-label">{lvl.name.toUpperCase()}</span>
              </button>
              {i < levels.length - 1 && (
                <span className={`map-line ${levels[i + 1].unlocked || lvl.cleared ? 'lit' : ''}`} />
              )}
            </span>
          )
        })}
      </div>

      <div className="map-info panel raised fade-up" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
        {hovered && (
          <>
            <div className="label text-accent">MISSION {MISSION_NO[hovered.id]}</div>
            <h3 className="display" style={{ fontSize: 22 }}>{hovered.name.toUpperCase()}</h3>
            <div className="map-info-grid mono">
              <div><span className="label">DIFFICULTY</span><Stars count={DIFFICULTY_STARS[hovered.difficulty] || 1} /></div>
              <div><span className="label">ATTACK SURFACES</span>{hovered.attack_count}</div>
              <div><span className="label">REWARD</span><span className="text-accent">+{hovered.reward_xp} XP</span></div>
              <div>
                <span className="label">STATUS</span>
                {hovered.cleared ? <span className="text-safe">CLEARED</span> : hovered.unlocked ? <span className="text-accent">READY</span> : <span className="text-dim">LOCKED</span>}
              </div>
            </div>
            {hovered.unlocked && (
              <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => onSelect(hovered.id)}>
                ENTER →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
