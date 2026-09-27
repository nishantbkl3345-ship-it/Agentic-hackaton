import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiJson } from '../api'
import { LEVEL_SURFACES, CATEGORY_BY_KIND } from './AttackConsole'
import { getMissionVisuals } from '../game/missions'
import PhaserCanvas from './PhaserCanvas'

const MISSION_NO = { level1: '01', level2: '02', level3: '03', boss: 'X' }

export default function MissionPlatformer() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const controlsRef = useRef(null)

  const [level, setLevel] = useState(null)
  const [labels, setLabels] = useState({})
  const [patches, setPatches] = useState([])
  const [hud, setHud] = useState({ data: 0, canary: 0, hearts: 3 })
  const [foundSurface, setFoundSurface] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setFoundSurface(null)
    setHud({ data: 0, canary: 0, hearts: 3 })
    setError(null)

    Promise.all([
      apiJson('/levels'),
      apiJson(`/levels/${levelId}/attacks`),
      apiJson(`/levels/${levelId}/patches`),
    ])
      .then(([levels, attacks, appliedPatches]) => {
        setLevel(levels.find((l) => l.id === levelId) || null)
        const byCategory = {}
        for (const c of attacks.categories || []) byCategory[c.category] = c.label
        const kinds = LEVEL_SURFACES[levelId] || ['chat', 'tool']
        const nextLabels = {}
        kinds.forEach((k) => { nextLabels[k] = byCategory[CATEGORY_BY_KIND[k]] || k.toUpperCase() })
        setLabels(nextLabels)
        setPatches(appliedPatches)
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId])

  const kinds = LEVEL_SURFACES[levelId] || ['chat', 'tool']
  const weakKind = useMemo(
    () => kinds.find((k) => !patches.includes(CATEGORY_BY_KIND[k])) || null,
    [kinds, patches]
  )

  const missionConfig = useMemo(() => ({
    levelId,
    kinds,
    weakKind,
    labels,
    visuals: getMissionVisuals(levelId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [levelId, weakKind, labels])

  if (error) {
    return (
      <div className="container">
        <div className="status-error">{error}</div>
        <button type="button" className="btn-ghost" onClick={() => navigate('/missions')}>← MISSIONS</button>
      </div>
    )
  }

  return (
    <div className="mission-platformer">
      <div className="mission-hud mission-hud-top">
        <div className="label text-accent">MISSION {MISSION_NO[levelId] || ''} / {(level?.name || '').toUpperCase()}</div>
        <button type="button" className="btn-ghost" onClick={() => navigate(`/mission/${levelId}`)}>
          SKIP TO ATTACK LAB →
        </button>
      </div>

      <div className="mission-hud mission-hud-counters mono">
        <span className="text-accent">DATA +{hud.data}</span>
        <span>{'♥ '.repeat(hud.hearts)}<span className="text-dim">{'♥ '.repeat(Math.max(0, 3 - hud.hearts))}</span></span>
        <span className="text-safe">CANARY ×{hud.canary}</span>
      </div>

      {level && (
        <PhaserCanvas
          key={levelId}
          missionConfig={missionConfig}
          onWeakLinkFound={setFoundSurface}
          onHudUpdate={setHud}
          controlsRef={controlsRef}
        />
      )}

      <div className="mission-hud mission-hud-controls label text-dim">
        ← → MOVE · ↑ JUMP · E INTERACT
      </div>

      {foundSurface && (
        <div className="mission-discover-overlay">
          <div className="panel accent mission-discover-panel fade-up">
            <div className="label text-accent">MISSION {MISSION_NO[levelId] || ''} // {(level?.name || '').toUpperCase()}</div>
            <h2 className="display">ATTACK SURFACE DISCOVERED</h2>
            <div className="mono text-breach" style={{ fontSize: 18, marginTop: 6 }}>{foundSurface.label}</div>
            <div className="flow" style={{ marginTop: 16 }}>
              <span className="step hot">OPERATOR</span>
              <span className="arrow">→</span>
              <span className="step hot">{foundSurface.label.toUpperCase()}</span>
              <span className="arrow">→</span>
              <span className="step hot">ATTACK LAB</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => navigate(`/mission/${levelId}`)}
            >
              ENTER ATTACK LAB →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
