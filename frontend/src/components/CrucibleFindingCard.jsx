import { useState } from 'react'
import { apiPostJson } from '../api'

const SEVERITY_COLOR = { CRITICAL: 'var(--breach)', HIGH: 'var(--breach)', MEDIUM: 'var(--amber)', LOW: 'var(--ink-dim)' }
const STATUS_LABEL = {
  open: 'OPEN', retested_pass: 'RETEST: FIXED', retested_fail: 'RETEST: STILL FAILS',
  retest_error: 'RETEST FAILED', timeout: 'RETEST STILL RUNNING',
}

export default function CrucibleFindingCard({ finding, needsApiKey }) {
  const [expanded, setExpanded] = useState(false)
  const [retesting, setRetesting] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [status, setStatus] = useState(finding.status)
  const [note, setNote] = useState(null)

  const retest = async (e) => {
    e.stopPropagation()
    setRetesting(true)
    setNote(null)
    try {
      const res = await apiPostJson(`/crucible/findings/${finding.id}/retest`, needsApiKey ? { api_key: apiKeyInput } : {})
      setStatus(res.status)
      if (res.message) setNote(res.message)
    } catch (err) {
      setStatus('retest_error')
      setNote(err.message)
    } finally {
      setRetesting(false)
    }
  }

  const canRetryRetest = status !== 'retested_pass'

  return (
    <div className={`panel crucible-finding ${finding.severity}`}>
      <div className="crucible-finding-head" onClick={() => setExpanded((v) => !v)}>
        <div>
          <span className="tag" style={{ color: SEVERITY_COLOR[finding.severity], borderColor: SEVERITY_COLOR[finding.severity], marginRight: 10 }}>
            {finding.severity}
          </span>
          <b>{finding.title}</b>
        </div>
        <span className="label">{STATUS_LABEL[status] || status}</span>
      </div>

      {expanded && (
        <div className="crucible-finding-body">
          <div className="row"><span className="k label">DESCRIPTION</span><div className="crucible-finding-value">{finding.description}</div></div>
          {finding.evidence && (
            <div className="row"><span className="k label">EVIDENCE</span><div className="crucible-finding-value mono text-breach">{finding.evidence}</div></div>
          )}
          {finding.remediation && (
            <div className="row"><span className="k label">FIX</span><div>{finding.remediation}</div></div>
          )}
          {needsApiKey && canRetryRetest && (
            <div className="row field" style={{ margin: 0 }}>
              <input
                type="password" placeholder="api key (needed to retest a bring-your-own target)"
                value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          )}
          {canRetryRetest && (
            <button type="button" className="btn-ghost" style={{ marginTop: 10 }} disabled={retesting} onClick={retest}>
              {retesting ? 'RETESTING…' : status === 'timeout' ? 'CHECK AGAIN →' : 'RETEST →'}
            </button>
          )}
          {note && <p className="text-dim" style={{ fontSize: 12, marginTop: 8 }}>{note}</p>}
        </div>
      )}
    </div>
  )
}
