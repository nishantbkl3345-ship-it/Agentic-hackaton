import { useState } from 'react'

const DEFENSE_FLOW = ['UNTRUSTED DATA', 'ISOLATION', 'LLM', 'AUTHORIZED TOOL']

export default function DefenderMode({ attack, findings, patched, patching, onPatch, onReplay }) {
  const [confirmedLine, setConfirmedLine] = useState(null)

  if (!attack) return null

  return (
    <div className="panel defender-panel breach fade-up">
      <h3 className="display">{patched ? 'ROUND TWO' : 'YOU BROKE IT.'}</h3>
      <p className="text-dim">
        {patched ? 'Same attack. Same target. New defenses.' : 'Now prove you can fix it.'}
      </p>

      {!patched && (
        <>
          <div className="label text-accent" style={{ marginTop: 16 }}>IDENTIFY THE WEAK LINK</div>
          <div className="code-block">
            {(findings || []).map((f, i) => (
              <div
                key={i}
                className={`code-line clickable ${confirmedLine === i ? 'confirmed' : ''}`}
                onClick={() => setConfirmedLine(i)}
              >
                <span className="ln">{f.line}</span>
                <span>{f.snippet}</span>
              </div>
            ))}
          </div>

          {confirmedLine !== null && (
            <div className="fade-up">
              <div className="label text-safe" style={{ marginTop: 14 }}>✓ ROOT CAUSE IDENTIFIED</div>
              <div className="flow">
                {DEFENSE_FLOW.map((step, i) => (
                  <span key={step} style={{ display: 'contents' }}>
                    <span className="step hot">{step}</span>
                    {i < DEFENSE_FLOW.length - 1 && <span className="arrow">→</span>}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-safe"
                disabled={patching}
                onClick={() => onPatch(attack.category)}
              >
                {patching ? 'PATCHING…' : 'PATCH THE AI →'}
              </button>
            </div>
          )}
        </>
      )}

      {patched && (
        <button type="button" className="btn btn-primary" onClick={onReplay} style={{ marginTop: 16 }}>
          REPLAY ATTACK →
        </button>
      )}
    </div>
  )
}
