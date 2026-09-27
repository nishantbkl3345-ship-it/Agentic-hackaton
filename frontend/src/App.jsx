import { useEffect, useState } from 'react'

const API = 'http://localhost:8000/report'
const POLL_MS = 3000

const EMPTY = { score: 100, weak_spots_found: 0, confirmed_live: 0, map: [], findings: [], attacks: [] }

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d1117; color: #e6edf3;
         font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  header { display: flex; justify-content: space-between; align-items: baseline;
           flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: .5px; }
  h1 span { color: #8b949e; font-weight: 400; }
  .status { color: #8b949e; font-size: 12px; }
  .status.err { color: #f85149; }
  .grid { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
  @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 16px; min-width: 0; }
  .card h2 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; }
  .full { grid-column: 1 / -1; }
  .gauge { text-align: center; }
  .gauge .num { font-size: 72px; font-weight: 700; line-height: 1; }
  .gauge .sub { color: #8b949e; margin-top: 12px; }
  .summary { margin-top: 12px; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #21262d; vertical-align: top; }
  th { color: #8b949e; font-weight: 500; font-size: 12px; }
  .scroll { overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .sev { padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .sev.high { background: #f8514926; color: #ff7b72; }
  .sev.medium { background: #d2992226; color: #e3b341; }
  .sev.low { background: #388bfd26; color: #79c0ff; }
  .empty { color: #6e7681; font-style: italic; padding: 8px 0; }
  .feed { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; }
  .feed li { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #21262d; }
  .verdict { font-weight: 700; font-size: 12px; min-width: 64px; }
  .verdict.success { color: #ff7b72; }
  .verdict.safe { color: #3fb950; }
  .muted { color: #8b949e; }
  .pair { display: grid; grid-template-columns: 1fr 80px 1fr; align-items: center; margin-bottom: 10px; }
  .node { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 10px; min-width: 0; overflow-wrap: anywhere; }
  .node.hole { border-left: 3px solid #ff7b72; }
  .node.proof { border-left: 3px solid #e3b341; }
  .link { position: relative; height: 2px; background: #e3b341; margin: 0 6px; }
  .link::after { content: ""; position: absolute; right: -2px; top: -4px;
                 border-left: 8px solid #e3b341; border-top: 5px solid transparent; border-bottom: 5px solid transparent; }
  .cols { display: grid; grid-template-columns: 1fr 80px 1fr; color: #8b949e; font-size: 12px; margin-bottom: 8px; }
  @media (max-width: 600px) {
    .pair, .cols { grid-template-columns: 1fr; }
    .link { width: 2px; height: 20px; margin: 4px auto; }
    .link::after { right: -4px; top: auto; bottom: -2px; border-left: 5px solid transparent;
                   border-right: 5px solid transparent; border-top: 8px solid #e3b341; }
    .cols span:nth-child(2) { display: none; }
  }
`

function scoreColor(score) {
  if (score < 50) return '#f85149'
  if (score < 80) return '#e3b341'
  return '#3fb950'
}

function Severity({ level }) {
  return <span className={`sev ${level}`}>{level}</span>
}

function ScoreGauge({ report }) {
  const { score, weak_spots_found, confirmed_live } = report
  const color = scoreColor(score)
  const r = 70
  const circ = 2 * Math.PI * r
  return (
    <div className="card gauge">
      <h2>Security score</h2>
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`Score ${score} of 100`}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="#21262d" strokeWidth="12" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
                transform="rotate(-90 90 90)" style={{ transition: 'stroke-dashoffset .6s' }} />
        <text x="90" y="104" textAnchor="middle" fill={color} fontSize="48" fontWeight="700">{score}</text>
      </svg>
      <div className="summary">
        Found <b>{weak_spots_found}</b> weak spots in the code,<br />confirmed <b>{confirmed_live}</b> live
      </div>
      <div className="sub">0–100 · red &lt;50 · yellow &lt;80 · green ≥80</div>
    </div>
  )
}

function FindingsList({ findings }) {
  return (
    <div className="card">
      <h2>Findings ({findings.length})</h2>
      {findings.length === 0 ? <div className="empty">No code findings yet.</div> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Type</th><th>Location</th><th>Severity</th><th>Fix</th></tr></thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i}>
                  <td><code>{f.type}</code></td>
                  <td><code>{f.file}:{f.line}</code></td>
                  <td><Severity level={f.severity} /></td>
                  <td>{f.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AttackFeed({ attacks }) {
  return (
    <div className="card full">
      <h2>Live attack feed ({attacks.length})</h2>
      {attacks.length === 0 ? <div className="empty">No attacks run yet.</div> : (
        <ul className="feed">
          {[...attacks].reverse().map((a, i) => (
            <li key={i}>
              <span className={`verdict ${a.result}`}>{a.result === 'success' ? 'BREACH' : 'BLOCKED'}</span>
              <div>
                <b>{a.name || a.id || 'attack'}</b>
                {a.category && <span className="muted"> · {a.category}</span>}
                <div className="muted">{a.reason}{a.evidence ? <> — <code>{a.evidence}</code></> : null}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProofMap({ map }) {
  return (
    <div className="card full">
      <h2>Code hole → Live proof</h2>
      {map.length === 0 ? <div className="empty">No confirmed holes yet.</div> : (
        <>
          <div className="cols"><span>Code hole</span><span /><span>Live proof</span></div>
          {map.map(({ finding, attack }, i) => (
            <div className="pair" key={i}>
              <div className="node hole">
                <code>{finding.type}</code> <Severity level={finding.severity} />
                <div className="muted"><code>{finding.file}:{finding.line}</code></div>
              </div>
              <div className="link" />
              <div className="node proof">
                <b>{attack.name || attack.id || 'attack'}</b>
                <div className="muted">{attack.reason}{attack.evidence ? <> — <code>{attack.evidence}</code></> : null}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function App() {
  const [report, setReport] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [updated, setUpdated] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(API)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(data => { if (alive) { setReport(data); setError(null); setUpdated(new Date()) } })
        .catch(e => { if (alive) setError(e.message) })
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <header>
          <h1>SentinelLLM <span>/ chatbot security scan</span></h1>
          <div className={`status ${error ? 'err' : ''}`}>
            {error ? `Backend unreachable (${error}) — is uvicorn running on :8000?`
                   : updated ? `Updated ${updated.toLocaleTimeString()}` : 'Loading…'}
          </div>
        </header>
        <div className="grid">
          <ScoreGauge report={report} />
          <FindingsList findings={report.findings} />
          <AttackFeed attacks={report.attacks} />
          <ProofMap map={report.map} />
        </div>
      </div>
    </>
  )
}
