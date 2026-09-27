import { useEffect, useRef, useState } from 'react'

const PRE_LINES = [
  'TARGET ACQUIRED',
  'MAPPING ATTACK PATH...',
  'PAYLOAD DEPLOYED',
  'WAITING...',
  'RESPONSE RECEIVED',
  'VERIFYING...',
]

function ProofPanel({ result, prior, onClose, onRetry }) {
  const { attack, findings_hit, xp_gained } = result
  const success = attack.result === 'success'
  const wasDefense = !success && prior?.result === 'success'

  return (
    <div className="proof-panel fade-up">
      <h2 className="display">{success ? 'EXPLOIT CONFIRMED' : 'DEFENSE CONFIRMED'}</h2>

      <div className="proof-rows mono">
        <div><span className="label">YOUR MESSAGE</span> {attack.prompt}</div>
        {findings_hit?.[0] && (
          <>
            <div><span className="label">SOURCE</span> {findings_hit[0].file}:{findings_hit[0].line}</div>
            <div><span className="label">ATTACK</span> {attack.category}</div>
          </>
        )}
        {attack.evidence && <div><span className="label">EVIDENCE</span> {attack.evidence}</div>}
      </div>

      <div className="proof-verdict mono">
        <div><span className="text-dim">EXPECTED</span> Canary / policy stays protected</div>
        <div><span className="text-dim">OBSERVED</span> {success ? 'Leak or unsafe action executed' : 'No leak, no unsafe action'}</div>
        <div className={success ? 'text-breach' : 'text-safe'}>
          RESULT: {success ? '✓ CONFIRMED' : '✓ BLOCKED'}
        </div>
      </div>

      {wasDefense && (
        <div className="proof-compare mono">
          <div className="text-breach">BEFORE PATCH — BREACHED</div>
          <div className="text-safe">AFTER PATCH — BLOCKED</div>
        </div>
      )}

      {xp_gained > 0 && (
        <div className="xp-moment">
          {result.first_blood && <span className="badge first-blood">FIRST BLOOD</span>}
          <div className="xp-moment-num">+{xp_gained} XP</div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 20 }}
        onClick={success ? onClose : onRetry}
      >
        {success ? 'TRY ANOTHER ENTRY POINT →' : 'RETRY →'}
      </button>
    </div>
  )
}

/**
 * Full-screen cinematic overlay for a single attack run. `result` is null
 * until the real API response arrives; the pre-verification lines play on a
 * fixed timer regardless, then the sequence waits for `result` before
 * revealing the outcome.
 */
export default function BreachSequence({ active, attack, result, prior, onClose, onRetry }) {
  const [stage, setStage] = useState('log')
  const [lineIdx, setLineIdx] = useState(0)
  const [evidenceText, setEvidenceText] = useState('')
  const timers = useRef([])

  useEffect(() => {
    if (!active) return
    setStage('log')
    setLineIdx(0)
    setEvidenceText('')
    timers.current.forEach(clearTimeout)
    timers.current = []
    PRE_LINES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setLineIdx(i + 1), 340 * (i + 1)))
    })
    return () => timers.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attack?.id])

  useEffect(() => {
    if (!active || stage !== 'log') return
    if (lineIdx < PRE_LINES.length || !result) return

    const success = result.attack.result === 'success'
    if (success && result.attack.evidence) {
      setStage('evidence')
      const text = result.attack.evidence
      let i = 0
      const tick = () => {
        i += 1
        setEvidenceText(text.slice(0, i))
        if (i < text.length) timers.current.push(setTimeout(tick, 45))
        else timers.current.push(setTimeout(() => setStage('result'), 550))
      }
      tick()
    } else {
      timers.current.push(setTimeout(() => setStage('result'), 350))
    }
  }, [active, stage, lineIdx, result])

  if (!active) return null

  const success = result?.attack?.result === 'success'

  return (
    <div className="breach-overlay">
      <div className="breach-inner">
        {stage === 'log' && (
          <div className="breach-log">
            {attack && (
              <div className="label text-accent">
                INFILTRATING // {attack.name.slice(0, 50).toUpperCase()}{attack.name.length > 50 ? '…' : ''}
              </div>
            )}
            {PRE_LINES.slice(0, lineIdx).map((l, i) => (
              <div key={i} className="mono breach-log-line">{l}</div>
            ))}
            <div className="mono breach-log-line breach-cursor" />
          </div>
        )}

        {stage === 'evidence' && (
          <div className="breach-evidence-reveal">
            <div className="label text-breach">CANARY DETECTED</div>
            <div className="mono breach-evidence-text">{evidenceText}</div>
          </div>
        )}

        {stage === 'result' && result && (
          <div className={`breach-result ${success ? 'breach' : 'safe'}`}>
            <h2 className="display">{success ? 'BREACHED' : 'ATTACK BLOCKED'}</h2>
            <button type="button" className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => setStage('proof')}>
              CONTINUE →
            </button>
          </div>
        )}

        {stage === 'proof' && result && <ProofPanel result={result} prior={prior} onClose={onClose} onRetry={onRetry} />}
      </div>
    </div>
  )
}
