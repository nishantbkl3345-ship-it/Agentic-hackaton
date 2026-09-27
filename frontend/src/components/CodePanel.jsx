const FLOW_BY_TYPE = {
  PROMPT_INJECTION_CONCAT: ['UNTRUSTED INPUT', 'PROMPT', 'LLM'],
  UNFILTERED_EXTERNAL_INPUT: ['UNTRUSTED INPUT', 'PROMPT', 'LLM'],
  UNSAFE_TOOL_SINK: ['LLM', 'TOOL CALL', 'EXECUTED'],
  NO_OUTPUT_CHECK: ['LLM', 'RAW OUTPUT', 'CUSTOMER'],
}

export default function CodePanel({ findings }) {
  if (!findings || findings.length === 0) return null
  const flow = FLOW_BY_TYPE[findings[0].type] || ['INPUT', 'PROMPT', 'LLM']

  return (
    <div className="panel code-panel fade-up">
      <div className="label text-accent">ATTACK PATH IDENTIFIED</div>
      {findings.map((f, i) => (
        <div className="code-panel-block" key={i}>
          <div className="code-panel-meta">
            <span className="tag">{f.type}</span>
            <span className="mono text-dim">{f.file}:{f.line}</span>
          </div>
          <div className="code-block">
            <div className="code-line hot">
              <span className="ln">{f.line}</span>
              <span>{f.snippet}</span>
            </div>
          </div>
          <div className="code-panel-fix text-dim">FIX: {f.fix}</div>
        </div>
      ))}
      <div className="flow">
        {flow.map((step, i) => (
          <span key={step} style={{ display: 'contents' }}>
            <span className={`step ${i === flow.length - 1 ? 'hot' : ''}`}>{step}</span>
            {i < flow.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
