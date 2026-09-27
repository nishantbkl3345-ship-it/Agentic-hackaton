import { useMemo, useState } from 'react'
import NetworkDiagram from './NetworkDiagram'
import CodePanel from './CodePanel'

export const LEVEL_SURFACES = {
  level1: ['chat', 'tool'],
  level2: ['chat', 'tool'],
  level3: ['file'],
  boss: ['chat', 'tool'],
}

export const CATEGORY_BY_KIND = { chat: 'prompt_injection', file: 'prompt_injection', tool: 'unsafe_action' }
const NODE_FINDING_TYPES = {
  chat: ['PROMPT_INJECTION_CONCAT', 'UNFILTERED_EXTERNAL_INPUT', 'NO_OUTPUT_CHECK'],
  file: ['PROMPT_INJECTION_CONCAT', 'UNFILTERED_EXTERNAL_INPUT', 'NO_OUTPUT_CHECK'],
  tool: ['UNSAFE_TOOL_SINK'],
}

export default function AttackConsole({
  levelId,
  levelMeta,
  categories,
  inputLabel,
  inputPlaceholder,
  resultsByCategory,
  patches,
  findings,
  running,
  disabled,
  onLaunch,
  onHint,
}) {
  const kinds = LEVEL_SURFACES[levelId] || ['chat', 'tool']
  const nodes = useMemo(() => kinds.map((k) => ({ id: k, kind: k })), [kinds])
  const [activeNode, setActiveNode] = useState(null)
  const [stuckOpen, setStuckOpen] = useState(false)
  const [revealedHints, setRevealedHints] = useState([])
  const [hintBusy, setHintBusy] = useState(false)
  const [message, setMessage] = useState('')

  const hintsUsed = levelMeta?.hints_used ?? 0
  const hintsAvailable = levelMeta?.hints_available ?? 0
  const hasAttempted = (levelMeta?.attempts_used ?? 0) > 0
  const canTakeHint = hintsUsed < hintsAvailable && (hintsUsed === 0 || hasAttempted)

  const takeHint = async () => {
    setHintBusy(true)
    try {
      const text = await onHint()
      if (text) setRevealedHints((prev) => [...prev, text])
    } finally {
      setHintBusy(false)
    }
  }

  const weakNodeId = useMemo(
    () => kinds.find((k) => !patches.includes(CATEGORY_BY_KIND[k])) || null,
    [kinds, patches]
  )

  const activeFindings = activeNode
    ? (findings || []).filter((f) => NODE_FINDING_TYPES[activeNode]?.includes(f.type))
    : []

  const send = () => {
    const text = message.trim()
    if (!text || running || disabled) return
    onLaunch(text)
  }

  return (
    <div className="attack-console fade-up">
      <div className="panel attack-map-panel">
        <div className="label">TARGET // {(levelMeta?.name || '').toUpperCase()}</div>
        <NetworkDiagram
          botLabel={levelMeta?.name || 'TARGET'}
          nodes={nodes}
          weakNodeId={weakNodeId}
          activeNodeId={activeNode}
          onNodeClick={(id) => setActiveNode(id === activeNode ? null : id)}
        />
      </div>

      {activeNode && <CodePanel findings={activeFindings} />}

      {hintsAvailable > 0 && (
        <div className="hint-affordance">
          <div className="hint-toggle mono" onClick={() => setStuckOpen((v) => !v)}>
            {stuckOpen ? '▾' : '▸'} STUCK?
          </div>
          {stuckOpen && (
            <div className="hint-box fade-up">
              {revealedHints.map((text, i) => (
                <p key={i} className="text-dim" style={{ margin: i === 0 ? 0 : '10px 0 0' }}>
                  HINT {i + 1}: {text}
                </p>
              ))}
              {hintsUsed < hintsAvailable && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: revealedHints.length ? 10 : 0 }}
                  disabled={!canTakeHint || hintBusy}
                  onClick={takeHint}
                >
                  {hintBusy ? 'LOADING…' : `REVEAL HINT ${hintsUsed + 1} →`}
                </button>
              )}
              {!canTakeHint && hintsUsed < hintsAvailable && (
                <p className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
                  Try an attack first — this hint unlocks after a real attempt.
                </p>
              )}
              {hintsUsed >= hintsAvailable && (
                <p className="text-dim" style={{ fontSize: 11 }}>No more hints for this mission.</p>
              )}
            </div>
          )}
        </div>
      )}

      <h3 className="display attack-select-title">{inputLabel || 'SEND YOUR ATTACK'}</h3>

      {categories?.length > 0 && (
        <div className="console-status-row">
          {categories.map((c) => {
            const result = resultsByCategory[c.category]
            const patched = patches.includes(c.category)
            let badgeClass = 'untested'
            let badgeText = 'UNTESTED'
            if (result) {
              badgeClass = result.result
              badgeText = result.result === 'success' ? 'BREACHED' : 'BLOCKED'
            }
            return (
              <div className="panel console-status-chip" key={c.category}>
                <div className="label">{c.label}</div>
                <div className="console-status-tags">
                  <span className={`badge ${badgeClass}`}>{badgeText}</span>
                  {result?.first_blood && <span className="tag text-accent">FIRST BLOOD</span>}
                  {patched && <span className="tag text-safe">PATCHED</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="console-input">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={inputPlaceholder || 'Type your message...'}
          rows={4}
          disabled={running || disabled}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || disabled || !message.trim()}
          onClick={send}
        >
          {running ? 'SENDING…' : 'LAUNCH ATTACK →'}
        </button>
      </div>
    </div>
  )
}
