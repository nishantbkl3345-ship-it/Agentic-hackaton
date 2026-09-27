import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NetworkDiagram from './NetworkDiagram'
import { levelFromXp } from './StatusBar'
import heroArena from '../assets/hero-arena.png'

const HERO_NODES = [
  { id: 'chat', kind: 'chat' },
  { id: 'file', kind: 'file' },
  { id: 'tool', kind: 'tool' },
]

export default function Landing({ xp, onEnter }) {
  const sceneRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMove = (e) => {
    const rect = sceneRef.current.getBoundingClientRect()
    setTilt({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    })
  }
  const handleLeave = () => setTilt({ x: 0, y: 0 })

  return (
    <div className="landing">
      <div
        className="landing-scene"
        ref={sceneRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <div
          className="landing-scene-bg"
          style={{
            backgroundImage: `url(${heroArena})`,
            transform: `scale(1.09) translate3d(${tilt.x * -16}px, ${tilt.y * -12}px, 0)`,
          }}
        />
        <div className="landing-scene-overlay" />

        <nav className="landing-nav">
          <div className="landing-logo">
            <span className="landing-logo-mark">◆</span>
            <div>
              <div className="landing-wordmark">SENTINELLLM</div>
              <div className="landing-eyebrow">AI SECURITY ARENA // CLASSIFIED TRAINING SIMULATION</div>
            </div>
          </div>
          <div className="landing-nav-links">
            <button type="button" className="landing-nav-link active" onClick={onEnter}>MISSIONS</button>
            <Link to="/missions" className="landing-nav-link">ARENA</Link>
            <Link to="/missions" className="landing-nav-link">ATTACK LAB</Link>
            <Link to="/leaderboard" className="landing-nav-link">LEADERBOARD</Link>
          </div>
          <div className="landing-nav-xp">
            <div className="status-lvl">LVL {String(levelFromXp(xp)).padStart(2, '0')}</div>
            <div className="status-xp">{xp.toLocaleString()} XP</div>
          </div>
        </nav>

        <div
          className="landing-hero"
          style={{ transform: `translate3d(${tilt.x * 8}px, ${tilt.y * 6}px, 0)` }}
        >
          <div className="landing-hero-copy">
            <h1 className="landing-headline">
              <span className="line">HACK</span>
              <span className="line">THE</span>
              <span className="line accent">AI</span>
            </h1>
            <p className="landing-tagline">Every AI has a weakness.<br />Find it. Exploit it. Fix it.</p>
            <p className="landing-sub">
              SentinelLLM turns AI security testing into an interactive attack-and-defense
              game. Trace vulnerabilities from source code to runtime exploitation, capture
              proof, and patch the system before the next attack.
            </p>
            <div className="landing-cta-row">
              <button type="button" className="btn btn-primary" onClick={onEnter}>ENTER THE ARENA →</button>
              <button type="button" className="btn-ghost landing-watch">▶ WATCH THE BREACH</button>
            </div>
          </div>
          <div className="landing-hero-visual panel">
            <div className="label">TARGET // FOODIEBOT — AI AGENT</div>
            <NetworkDiagram botLabel="FOODIEBOT" nodes={HERO_NODES} demo />
          </div>
        </div>

        <div className="landing-operator-tag">
          <div className="label">OPERATOR</div>
          <div className="label text-accent">// RED TEAM</div>
          <div className="label text-safe">// ONLINE</div>
        </div>
      </div>

      <section className="landing-compare">
        <h2 className="display landing-compare-title">THIS IS NOT A JAILBREAK BUTTON.</h2>
        <p className="text-dim">Randomly trying prompts isn't the game.</p>
        <div className="compare-grid">
          <div className="compare-col dim">
            <div className="label">RANDOM ATTACK</div>
            <div className="compare-step">PROMPT</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step">HOPE</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step">MAYBE BREAK</div>
          </div>
          <div className="compare-col hot">
            <div className="label text-accent">SENTINELLLM</div>
            <div className="compare-step hot">TRACE CODE</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">FIND WEAK LINK</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">CHOOSE ATTACK</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">EXPLOIT</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">PROVE</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">PATCH</div>
            <div className="compare-arrow">↓</div>
            <div className="compare-step hot">REPLAY</div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>SENTINELLLM // AI SECURITY ARENA</span>
        <span>AUTHORIZED TARGETS ONLY</span>
      </footer>
    </div>
  )
}
