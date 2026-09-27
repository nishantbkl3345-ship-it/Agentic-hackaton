import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PhaserCanvas from './PhaserCanvas'
import StatusBar from './StatusBar'
import { LEVEL_SURFACES, CATEGORY_BY_KIND } from './AttackConsole'
import { apiJson } from '../api'

const SURFACE_LABEL = { chat: 'CHAT CHANNEL', tool: 'CONNECTED TOOL', file: 'DOCUMENT INTAKE' }

export default function MissionPlatformer({ operator }) {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const gameRef = useRef(null)

  const [level, setLevel] = useState(null)
  const [patches, setPatches] = useState([])
  const [hud, setHud] = useState({ data: 0, canary: 0, lives: 3 })
  const [discoveredSurface, setDiscoveredSurface] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([apiJson('/levels'), apiJson(`/levels/${levelId}/patches`)]).then(([levels, p]) => {
      if (cancelled) return
      setLevel(levels.find((l) => l.id === levelId) || null)
      setPatches(p)
    })
    return () => { cancelled = true }
  }, [levelId])

  const surfaceKinds = LEVEL_SURFACES[levelId] || ['chat', 'tool']
  const weakSurface = useMemo(
    () => surfaceKinds.find((k) => !patches.includes(CATEGORY_BY_KIND[k])) || surfaceKinds[0],
    [surfaceKinds, patches]
  )

  const onHudUpdate = (next) => setHud(next)
  const onWeakLinkFound = (surfaceId) => setDiscoveredSurface(surfaceId)

  const enterAttackLab = () => navigate(`/mission/${levelId}`)
  const skip = () => navigate(`/mission/${levelId}`)

  if (!level) return null

  return (
    <div className="container">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" />

      <div className="platformer-shell fade-up">
        <div className="platformer-hud">
          <div className="label text-accent">MISSION {level.id.toUpperCase()} // {level.name.toUpperCase()}</div>
          <div className="platformer-hud-row">
            <span className="mono">DATA +{hud.data}</span>
            <span className="mono text-amber">CANARY ×{hud.canary}</span>
            <span className="mono text-breach">{'♥'.repeat(hud.lives)}{'♡'.repeat(3 - hud.lives)}</span>
          </div>
        </div>

        <PhaserCanvas
          ref={gameRef}
          surfaceKinds={surfaceKinds}
          weakSurface={weakSurface}
          onWeakLinkFound={onWeakLinkFound}
          onHudUpdate={onHudUpdate}
        />

        <div className="platformer-controls label text-dim">
          ← → MOVE &nbsp;·&nbsp; SPACE / ↑ JUMP &nbsp;·&nbsp; E INVESTIGATE
        </div>

        <button type="button" className="btn-ghost" onClick={skip}>SKIP TO ATTACK LAB →</button>
      </div>

      {discoveredSurface && (
        <div className="onboarding-overlay">
          <div className="panel accent onboarding-panel fade-up">
            <div className="label text-accent">MISSION {level.id.toUpperCase()} // {level.name.toUpperCase()}</div>
            <h2 className="display">ATTACK SURFACE DISCOVERED</h2>
            <p className="text-dim">{SURFACE_LABEL[discoveredSurface] || discoveredSurface.toUpperCase()}</p>
            <div className="flow">
              <span className="step hot">UNTRUSTED INPUT</span>
              <span className="arrow">→</span>
              <span className="step hot">{(SURFACE_LABEL[discoveredSurface] || discoveredSurface).toUpperCase()}</span>
              <span className="arrow">→</span>
              <span className="step hot">LLM</span>
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} onClick={enterAttackLab}>
              ENTER ATTACK LAB →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
