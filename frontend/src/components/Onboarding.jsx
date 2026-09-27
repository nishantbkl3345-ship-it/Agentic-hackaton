import { apiPostJson } from '../api'

const STEPS = ['FIND THE WEAK LINK', 'EXPLOIT & PROVE IT', 'PATCH & SURVIVE']

export default function Onboarding({ onDone }) {
  const dismiss = async () => {
    onDone()
    try { await apiPostJson('/onboarding/seen', {}) } catch { /* best-effort */ }
  }

  return (
    <div className="onboarding-overlay fade-up">
      <div className="panel accent onboarding-panel">
        <div className="label text-accent">FIRST DEPLOYMENT</div>
        <h2 className="display">HOW THIS WORKS</h2>
        <div className="compare-col hot" style={{ margin: '24px auto', maxWidth: 360 }}>
          {STEPS.map((step, i) => (
            <span key={step} style={{ display: 'contents' }}>
              <div className="compare-step hot">{step}</div>
              {i < STEPS.length - 1 && <div className="compare-arrow">↓</div>}
            </span>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={dismiss}>SKIP →</button>
      </div>
    </div>
  )
}
