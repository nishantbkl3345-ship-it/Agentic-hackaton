import { useEffect, useState } from 'react'
import { apiJson } from '../api'
import Loader, { LoaderBlock } from './Loader'

const CATEGORY_LABELS = { security: 'SECURITY', truth: 'TRUTH', tools: 'TOOLS', reliability: 'RELIABILITY', overall: 'OVERALL' }

function runLabel(r) {
  const when = r.started_at ? new Date(r.started_at).toLocaleString() : ''
  const overall = r.scores?.overall
  return `${when} — ${overall == null ? 'n/a' : overall + '/100'}`
}

export default function CrucibleCompare({ targetKey, currentRunId, targetLabel }) {
  const [runs, setRuns] = useState([])
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState(currentRunId)
  const [compare, setCompare] = useState(null)
  const [error, setError] = useState(null)
  const [runsLoaded, setRunsLoaded] = useState(false)

  useEffect(() => {
    if (!targetKey) return
    apiJson(`/crucible/runs?target_key=${encodeURIComponent(targetKey)}`).then((list) => {
      setRuns(list)
      setRunsLoaded(true)
      const idx = list.findIndex((r) => r.id === currentRunId)
      const prior = idx >= 0 ? list[idx + 1] : list[1]
      if (prior) setBeforeId(prior.id)
    }).catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  useEffect(() => {
    if (!beforeId || !afterId) { setCompare(null); return }
    setCompare(null)
    apiJson(`/crucible/runs/compare?before=${beforeId}&after=${afterId}`).then(setCompare).catch((e) => setError(e.message))
  }, [beforeId, afterId])

  if (error) return <p className="form-error">{error}</p>
  if (!runsLoaded) return <LoaderBlock label="LOADING PAST RUNS" />
  if (runs.length < 2) {
    return (
      <p className="text-dim" style={{ marginTop: 14 }}>
        This is the only completed run against <b>{targetLabel || 'this target'}</b> so far — comparison only
        works between two runs on the <i>same</i> target (a run against a different bot or endpoint won't show up
        here). Fix something and run CRUCIBLE again against {targetLabel || 'this target'} to compare.
      </p>
    )
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="label">BEFORE</span>
          <select value={beforeId} onChange={(e) => setBeforeId(e.target.value)}>
            <option value="">—</option>
            {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="label">AFTER</span>
          <select value={afterId} onChange={(e) => setAfterId(e.target.value)}>
            <option value="">—</option>
            {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
          </select>
        </label>
      </div>

      {!compare && beforeId && afterId && <Loader label="COMPUTING DIFF" />}

      {compare && (
        <>
          <table className="crucible-compare-table">
            <thead><tr><th>METRIC</th><th>BEFORE</th><th>AFTER</th><th>Δ</th></tr></thead>
            <tbody>
              {Object.keys(CATEGORY_LABELS).filter((k) => compare.deltas[k]).map((k) => {
                const d = compare.deltas[k]
                const dir = d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : ''
                return (
                  <tr key={k}>
                    <td>{CATEGORY_LABELS[k]}</td>
                    <td className="mono">{d.before}</td>
                    <td className="mono">{d.after}</td>
                    <td className={`mono crucible-delta ${dir}`}>{d.delta > 0 ? '↑' : d.delta < 0 ? '↓' : '—'} {d.delta > 0 ? '+' : ''}{d.delta}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
            <div>
              <div className="label text-safe">RESOLVED ({compare.findings.resolved.length})</div>
              {compare.findings.resolved.map((f) => <div key={f.id} className="text-dim" style={{ fontSize: 12 }}>✓ {f.title}</div>)}
            </div>
            <div>
              <div className="label text-breach">NEW ({compare.findings.new.length})</div>
              {compare.findings.new.map((f) => <div key={f.id} className="text-breach" style={{ fontSize: 12 }}>● {f.title}</div>)}
            </div>
            <div>
              <div className="label">STILL PRESENT ({compare.findings.persisting.length})</div>
              {compare.findings.persisting.map((f) => <div key={f.id} className="text-dim" style={{ fontSize: 12 }}>· {f.title}</div>)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
