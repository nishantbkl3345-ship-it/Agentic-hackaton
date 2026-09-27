import { useMemo, useState } from 'react'
import NetworkDiagram from './NetworkDiagram'
import CodePanel from './CodePanel'
import { ChatIcon, FileIcon, ToolIcon } from './icons'

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

const ENTRY_POINT_META = {
  TALK: { icon: ChatIcon, desc: 'Manipulate the conversation', stars: 1 },
  INFILTRATE: { icon: FileIcon, desc: 'Poison an untrusted document', stars: 2 },
  SABOTAGE: { icon: ToolIcon, desc: 'Manipulate a connected AI tool', stars: 4 },
}

// UI-only grouping of the real attack ids from app/attacks.py into the three
// game-facing entry points. Not stored server-side.
const ATTACK_ENTRY_POINT = {
  'canary-direct': 'TALK',
  'canary-roleplay': 'TALK',
  'system-prompt-leak': 'TALK',
  'discount-abuse': 'SABOTAGE',
  'translation-smuggle': 'TALK',
  'agent-canary-direct': 'TALK',
  'agent-roleplay': 'TALK',
  'refund-overreach': 'SABOTAGE',
  'poisoned-review': 'INFILTRATE',
  'review-translation-smuggle': 'INFILTRATE',
}

function Stars({ count }) {
  return (
    <span className="stars">
      {'★'.repeat(count)}
      <span className="dim">{'★'.repeat(4 - count)}</span>
    </span>
  )
}

export default function AttackSelect({ levelId, levelMeta, attacks, resultsById, patches, findings, running, disabled, onLaunch, onHint }) {
  const kinds = LEVEL_SURFACES[levelId] || ['chat', 'tool']
  const nodes = useMemo(() => kinds.map((k) => ({ id: k, kind: k })), [kinds])
  const [activeNode, setActiveNode] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)
  const [stuckOpen, setStuckOpen] = useState(false)
  const [revealedHints, setRevealedHints] = useState([])
  const [hintBusy, setHintBusy] = useState(false)

  const hintsUsed = levelMeta?.hints_used ?? 0
  const hintsAvailable = levelMeta?.hints_available ?? 0
  const hasAttempted = Object.keys(resultsById || {}).length > 0
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

  const groups = useMemo(() => {
    const byEntry = {}
    for (const a of attacks) {
      const ep = ATTACK_ENTRY_POINT[a.id] || (a.category === 'unsafe_action' ? 'SABOTAGE' : 'TALK')
      byEntry[ep] = byEntry[ep] || []
      byEntry[ep].push(a)
    }
    return byEntry
  }, [attacks])

  const activeFindings = activeNode
    ? (findings || []).filter((f) => NODE_FINDING_TYPES[activeNode]?.includes(f.type))
    : []

  return (
    <div className="attack-select fade-up">
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

      <h3 className="display attack-select-title">CHOOSE YOUR ENTRY POINT</h3>
      <div className="entry-grid">
        {Object.keys(ENTRY_POINT_META)
          .filter((ep) => groups[ep]?.length)
          .map((ep) => {
            const meta = ENTRY_POINT_META[ep]
            const Icon = meta.icon
            const isOpen = openGroup === ep
            return (
              <div
                key={ep}
                className={`panel entry-card ${isOpen ? 'open' : ''}`}
                onClick={() => setOpenGroup(isOpen ? null : ep)}
              >
                <Icon width={26} height={26} />
                <div className="entry-card-label">{ep}</div>
                <div className="entry-card-desc text-dim">{meta.desc}</div>
                <Stars count={meta.stars} />
              </div>
            )
          })}
      </div>

      {openGroup && (
        <div className="attack-grid fade-up">
          {groups[openGroup].map((a) => {
            const result = resultsById[a.id]
            const patched = patches.includes(a.category)
            let badgeClass = 'untested'
            let badgeText = 'UNTESTED'
            if (result) {
              badgeClass = result.result
              badgeText = result.result === 'success' ? 'BREACHED' : 'BLOCKED'
            }
            return (
              <div className="panel attack-card" key={a.id}>
                <div className="attack-card-top">
                  <span className={`badge ${badgeClass}`}>{badgeText}</span>
                  {result?.first_blood && <span className="tag text-accent">FIRST BLOOD</span>}
                  {patched && <span className="tag text-safe">PATCHED</span>}
                </div>
                <div className="attack-card-name">{a.name}</div>
                <button
                  type="button"
                  className="btn btn-primary attack-card-launch"
                  disabled={running || disabled}
                  onClick={() => onLaunch(a)}
                >
                  {result ? 'REPLAY →' : 'LAUNCH ATTACK →'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
