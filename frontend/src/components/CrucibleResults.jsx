import { useEffect, useState } from 'react'
import { apiJson } from '../api'
import { scoreColor } from './StatusBar'
import { LoaderBlock } from './Loader'
import CrucibleFindingCard from './CrucibleFindingCard'
import CrucibleCompare from './CrucibleCompare'
import CrucibleTestLog from './CrucibleTestLog'
import { CATEGORY_LABELS, dedupedRecommendations, deriveVerdict, summarize } from './crucibleCriteria'

function CategoryCell({ catKey, entry }) {
  if (!entry) return null
  return (
    <div className="crucible-score-cell">
      <div className="label">{CATEGORY_LABELS[catKey]}</div>
      <div className="num" style={{ color: entry.score == null ? 'var(--ink-faint)' : scoreColor(entry.score) }}>
        {entry.score == null ? '—' : entry.score}
      </div>
      <div className="text-dim" style={{ fontSize: 11 }}>
        {entry.passed}/{entry.total} passed{entry.not_testable ? `, ${entry.not_testable} n/a` : ''}
      </div>
    </div>
  )
}

export default function CrucibleResults({ runId, onRunAgain }) {
  const [run, setRun] = useState(null)
  const [findings, setFindings] = useState([])
  const [tests, setTests] = useState([])
  const [error, setError] = useState(null)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    setRun(null); setFindings([]); setTests([]); setError(null)
    Promise.all([
      apiJson(`/crucible/runs/${runId}`),
      apiJson(`/crucible/runs/${runId}/findings`),
      apiJson(`/crucible/runs/${runId}/tests`),
    ])
      .then(([r, f, t]) => { setRun(r); setFindings(f); setTests(t) })
      .catch((e) => setError(e.message))
  }, [runId])

  if (error) return <p className="form-error">{error}</p>
  if (!run) return <LoaderBlock label="COMPILING REPORT" />

  const scores = run.scores || {}
  const needsApiKey = run.target?.kind === 'custom'
  const findingsByCategory = {}
  for (const f of findings) (findingsByCategory[f.category] ||= []).push(f)
  const verdict = deriveVerdict(scores, findings)
  const summary = summarize(run, tests, findings)
  const recommendations = dedupedRecommendations(findings)

  return (
    <div className="crucible-section fade-up">
      {run.status === 'failed' && (
        <div className="panel breach" style={{ marginBottom: 16 }}>
          <div className="label text-breach">RUN FAILED</div>
          <p style={{ margin: '6px 0 0' }}>
            CRUCIBLE couldn't finish this run{scores.error ? `: ${scores.error}` : '.'} Any tests and findings
            below are whatever completed before the failure — not the full picture. Try running it again.
          </p>
        </div>
      )}

      {run.target?.kind === 'bot' && run.target?.live === false && (
        <p className="crucible-not-testable text-breach" style={{ marginBottom: 16 }}>
          No {run.target.provider?.toUpperCase()} API key is configured on this server — every reply in this run
          came from the deterministic offline mock, not a real {run.target.provider} model. The tests and evidence
          below are real executions against that mock, not against {run.target.provider}.
        </p>
      )}

      <div className="panel accent crucible-verdict">
        <div className="label text-accent">CAN YOU TRUST {(run.target?.label || 'THIS AI').toUpperCase()}?</div>
        <div className={`crucible-verdict-answer ${verdict.tone}`}>{verdict.headline}</div>
        <p className="text-dim">{verdict.detail}</p>
        <div className="crucible-summary-stats mono">
          <div className="crucible-summary-stat"><div className="n">{summary.totalTests}</div><div className="label">TESTS RUN</div></div>
          <div className="crucible-summary-stat"><div className="n">{summary.categoryCount}</div><div className="label">CATEGORIES</div></div>
          <div className="crucible-summary-stat"><div className="n text-breach">{findings.length}</div><div className="label">FINDINGS</div></div>
          {summary.bySeverity.CRITICAL > 0 && (
            <div className="crucible-summary-stat"><div className="n text-breach">{summary.bySeverity.CRITICAL}</div><div className="label">CRITICAL</div></div>
          )}
        </div>
      </div>

      <div className="crucible-score-hero panel">
        <div>
          <div className="label">CRUCIBLE SCORE</div>
          <div className="crucible-score-big" style={{ color: scores.overall == null ? 'var(--ink-faint)' : scoreColor(scores.overall) }}>
            {scores.overall == null ? '—' : scores.overall}<span style={{ fontSize: 28, color: 'var(--ink-dim)' }}>/100</span>
          </div>
        </div>
        <div className="crucible-score-grid">
          {Object.keys(CATEGORY_LABELS).filter((k) => scores[k]).map((k) => (
            <CategoryCell key={k} catKey={k} entry={scores[k]} />
          ))}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="crucible-section">
          <div className="label crucible-section-title">RECOMMENDATIONS</div>
          <div className="panel">
            <div className="crucible-recommend-list">
              {recommendations.map((r, i) => (
                <div key={i} className="crucible-recommend-item">
                  <span className="num mono">{String(i + 1).padStart(2, '0')}</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="crucible-section">
        <div className="crucible-finding-list-title label">
          FINDINGS {findings.length > 0 ? `(${findings.length})` : ''}
        </div>
        {findings.length === 0 && <p className="text-safe">No confirmed issues this run.</p>}
        {findings.length > 0 && (
          <div>
            {Object.keys(CATEGORY_LABELS).filter((k) => findingsByCategory[k]).map((k) => (
              <div key={k} style={{ marginBottom: 18 }}>
                <div className="label" style={{ marginBottom: 8 }}>{CATEGORY_LABELS[k]}</div>
                {findingsByCategory[k].map((f) => (
                  <CrucibleFindingCard key={f.id} finding={f} needsApiKey={needsApiKey} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <CrucibleTestLog tests={tests} configuration={run.configuration} />

      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={onRunAgain}>RUN CRUCIBLE AGAIN →</button>
        <button type="button" className="btn" onClick={() => setComparing((v) => !v)}>
          {comparing ? 'HIDE COMPARISON' : 'COMPARE TO A PREVIOUS RUN'}
        </button>
      </div>

      {comparing && <CrucibleCompare targetKey={run.target_key} currentRunId={runId} targetLabel={run.target?.label} />}
    </div>
  )
}
