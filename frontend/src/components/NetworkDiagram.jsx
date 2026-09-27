import { useEffect, useRef, useState } from 'react'
import { ChatIcon, FileIcon, ToolIcon, BotIcon } from './icons'

const KIND_ICON = { chat: ChatIcon, file: FileIcon, tool: ToolIcon }
const KIND_LABEL = { chat: 'CHAT', file: 'FILES', tool: 'TOOLS' }

const X_BY_COUNT = {
  1: [50],
  2: [28, 72],
  3: [16, 50, 84],
}

/**
 * nodes: [{ id, kind: 'chat'|'file'|'tool', label? }]
 * demo=true runs the looping landing-page animation and ignores onNodeClick.
 */
export default function NetworkDiagram({
  botLabel = 'TARGET',
  nodes,
  weakNodeId = null,
  activeNodeId = null,
  onNodeClick = null,
  demo = false,
}) {
  const [demoPhase, setDemoPhase] = useState('idle')
  const timers = useRef([])

  useEffect(() => {
    if (!demo) return
    const run = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
      setDemoPhase('idle')
      at(500, () => setDemoPhase('active'))
      at(1500, () => setDemoPhase('weak'))
      at(2500, () => setDemoPhase('trace'))
      at(3500, () => setDemoPhase('warning'))
      at(4800, () => setDemoPhase('reset'))
      at(5400, run)
    }
    run()
    return () => timers.current.forEach(clearTimeout)
  }, [demo])

  const xs = X_BY_COUNT[nodes.length] || X_BY_COUNT[3]
  const demoWeakId = nodes.find((n) => n.kind === 'file')?.id ?? nodes[0]?.id
  const effectiveWeak = demo ? demoWeakId : weakNodeId
  const aiLive = demo && demoPhase !== 'idle' && demoPhase !== 'reset'

  return (
    <div className="net-diagram">
      <svg className="net-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.map((n, i) => {
          const isWeak = n.id === effectiveWeak
          const litUp = demo ? isWeak && demoPhase !== 'idle' && demoPhase !== 'reset' : isWeak
          const tracing = demo && isWeak && (demoPhase === 'trace' || demoPhase === 'warning')
          return (
            <line
              key={n.id}
              x1={xs[i]} y1="68" x2="50" y2="26"
              stroke={litUp ? 'var(--breach)' : 'var(--line-bright)'}
              strokeWidth={tracing ? 1.2 : 0.6}
              strokeDasharray={tracing ? '4 2' : undefined}
              className={tracing ? 'net-trace' : ''}
            />
          )
        })}
      </svg>

      <button type="button" className={`net-node net-ai ${aiLive ? 'live' : ''}`} style={{ left: '50%', top: '22%' }} disabled>
        <BotIcon width={22} height={22} />
        <span className="net-node-label">{botLabel}</span>
      </button>

      {nodes.map((n, i) => {
        const Icon = KIND_ICON[n.kind] || BotIcon
        const isWeak = n.id === effectiveWeak
        const weakLit = demo ? isWeak && demoPhase !== 'idle' && demoPhase !== 'reset' : isWeak
        const isActive = n.id === activeNodeId
        return (
          <button
            type="button"
            key={n.id}
            className={`net-node ${weakLit ? 'weak' : ''} ${isActive ? 'selected' : ''}`}
            style={{ left: `${xs[i]}%`, top: '74%' }}
            onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
            disabled={!onNodeClick}
          >
            <Icon width={18} height={18} />
            <span className="net-node-label">{n.label || KIND_LABEL[n.kind]}</span>
          </button>
        )
      })}

      {demo && demoPhase === 'warning' && <div className="net-flash">⚠ WEAK LINK FOUND</div>}
      {!demo && weakNodeId && <div className="net-hint">ATTACK SURFACE DETECTED</div>}
    </div>
  )
}
