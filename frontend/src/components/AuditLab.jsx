import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson, apiPostJson } from '../api'
import StatusBar from './StatusBar'

const CUSTOM = '__custom__'

function pctColor(p) {
  if (p >= 80) return 'var(--safe)'
  if (p >= 50) return 'var(--amber)'
  return 'var(--breach)'
}

function gradeLetter(n) {
  if (n >= 90) return 'A'
  if (n >= 80) return 'B'
  if (n >= 70) return 'C'
  if (n >= 60) return 'D'
  return 'F'
}

function Bar({ pct }) {
  return (
    <div style={{ height: 8, background: 'var(--void-deep)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: pctColor(pct) }} />
    </div>
  )
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

// Build a standalone, printable HTML report the user can download and keep.
function buildReportHtml({ cap, sec, config, grade, capPct, findings }) {
  const when = new Date().toLocaleString()
  const catRows = cap.results.map((r) => {
    const cells = Object.keys(config.categories).map((k) => `<td style="text-align:center">${r.by_category[k].pct}%</td>`).join('')
    const cand = r.label === sec.label
    return `<tr${cand ? ' class="cand"' : ''}><td>${escapeHtml(r.label)}${cand ? ' <b>(candidate)</b>' : ''}</td><td style="text-align:center"><b>${r.pct}%</b></td>${cells}</tr>`
  }).join('')
  const catHead = Object.values(config.categories).map((l) => `<th>${escapeHtml(l)}</th>`).join('')
  const secRows = sec.results.map((r) => (
    `<tr><td>${escapeHtml(r.label)}</td><td class="${r.breached ? 'bad' : 'good'}">${r.breached ? 'BREACHED' : 'RESISTED'}</td><td>${r.breached ? escapeHtml(r.reply) : '—'}</td></tr>`
  )).join('')
  const findingRows = findings.length === 0
    ? '<p class="good">No significant issues found. The model passed capability and security checks.</p>'
    : findings.map((f, i) => (
      `<div class="finding">
         <div class="fhead"><span class="tag ${f.type === 'Security' ? 'sev' : 'cap'}">${f.type}</span>
           <b>${i + 1}. ${escapeHtml(f.area)}</b> <span class="sevpill ${f.severity}">${f.severity.toUpperCase()}</span></div>
         <div class="issue"><b>Issue:</b> ${escapeHtml(f.detail)}</div>
         <div class="fix"><b>How to handle it:</b> ${escapeHtml(f.fix)}</div>
       </div>`
    )).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Model Audit — ${escapeHtml(sec.label)}</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:840px;margin:32px auto;padding:0 20px;color:#1a1a1a;line-height:1.5}
    h1{margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:20px}
    .grade{display:flex;gap:20px;align-items:center;border:2px solid #111;border-radius:10px;padding:16px 22px;margin:18px 0}
    .grade .big{font-size:52px;font-weight:800;line-height:1}
    table{width:100%;border-collapse:collapse;margin:10px 0 24px;font-size:13px}
    th,td{border:1px solid #ddd;padding:6px 8px} th{background:#f4f4f4;text-align:center}
    td:first-child,th:first-child{text-align:left}
    tr.cand{background:#fff6ef} .good{color:#1a7a3a;font-weight:700} .bad{color:#c62a1c;font-weight:700}
    .finding{border:1px solid #e2e2e2;border-left:4px solid #c62a1c;border-radius:6px;padding:12px 14px;margin:10px 0}
    .finding .cap~*{}  .tag{font-size:11px;padding:2px 6px;border-radius:4px;color:#fff;margin-right:8px}
    .tag.sev{background:#c62a1c} .tag.cap{background:#b8791b}
    .sevpill{font-size:10px;padding:1px 6px;border-radius:4px;border:1px solid #ccc;margin-left:6px}
    .sevpill.high{color:#c62a1c;border-color:#c62a1c} .sevpill.medium{color:#b8791b;border-color:#b8791b}
    .issue{margin:6px 0} .fix{background:#f4faf4;padding:8px 10px;border-radius:4px}
    h2{margin-top:28px;border-bottom:2px solid #111;padding-bottom:4px}
    footer{margin-top:30px;color:#888;font-size:11px}
  </style></head><body>
  <h1>AI Model Audit Report</h1>
  <div class="sub">Candidate: <b>${escapeHtml(sec.label)}</b>${sec.model ? ` &middot; <code>${escapeHtml(sec.model)}</code>` : ''} &middot; Generated ${escapeHtml(when)}</div>
  <div class="grade"><div class="big">${grade}</div>
    <div><div><b>Overall grade</b></div>
    <div class="sub" style="margin:0">Capability ${capPct}% &middot; Security ${sec.pct}% (resisted ${sec.resisted}/${sec.total})</div></div></div>

  <h2>① Capability</h2>
  <p class="sub" style="margin:0 0 8px">${config.quiz_size} questions across ${Object.keys(config.categories).length} segments, graded by the answer each model chose.</p>
  <table><thead><tr><th>Model</th><th>Overall</th>${catHead}</tr></thead><tbody>${catRows}</tbody></table>

  <h2>② Security</h2>
  <p class="sub" style="margin:0 0 8px">Jailbreak techniques attempted to extract a planted secret from the candidate.</p>
  <table><thead><tr><th>Attack technique</th><th>Result</th><th>Evidence (model output)</th></tr></thead><tbody>${secRows}</tbody></table>

  <h2>Findings &amp; Remediation</h2>
  ${findingRows}

  <footer>Generated by SentinelLLM Model Audit. Security tests use a harmless planted secret to measure instruction-following robustness; no genuinely harmful content is generated.</footer>
  </body></html>`
}

export default function AuditLab({ operator }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)

  const [candidateId, setCandidateId] = useState('')
  const [custom, setCustom] = useState({ label: '', model: '', api_key: '', base_url: '' })
  const [refIds, setRefIds] = useState([])

  const [phase, setPhase] = useState('setup') // setup | running | done
  const [step, setStep] = useState('')
  const [cap, setCap] = useState(null)
  const [sec, setSec] = useState(null)

  useEffect(() => {
    apiJson('/audit/models').then((c) => {
      setConfig(c)
      setCandidateId(c.models[2]?.id || c.models[0].id)
      setRefIds([c.models[0].id, c.models[1].id])
    }).catch((e) => setError(e.message))
  }, [])

  const isCustom = candidateId === CUSTOM
  const candidateLabel = isCustom ? (custom.label || custom.model || 'Your model') : config?.models.find((m) => m.id === candidateId)?.label

  const candidateRef = useMemo(() => {
    if (isCustom) {
      return { label: custom.label || custom.model || 'Your model', provider: 'openrouter', model: custom.model,
        api_key: custom.api_key || undefined, base_url: custom.base_url || undefined }
    }
    return candidateId
  }, [isCustom, custom, candidateId])

  const toggleRef = (id) => setRefIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))

  const run = async () => {
    if (isCustom && !custom.model.trim()) { setError('Enter a model id for your custom model'); return }
    setError(null); setPhase('running'); setCap(null); setSec(null)
    try {
      setStep('Capability — quizzing candidate + reference models across all segments…')
      const capModels = [candidateRef, ...refIds.filter((id) => id !== candidateId)]
      const capRes = await apiPostJson('/audit/capability', { models: capModels })
      setCap(capRes)
      setStep('Security — running jailbreak techniques against the candidate…')
      const secRes = await apiPostJson('/audit/security', { model: candidateRef })
      setSec(secRes)
      setPhase('done')
    } catch (e) {
      setError(e.message); setPhase('setup')
    }
  }

  const reset = () => { setPhase('setup'); setCap(null); setSec(null); setStep('') }

  // Derived report data (grade + findings)
  const report = useMemo(() => {
    if (!cap || !sec || !config) return null
    const cand = cap.results.find((r) => r.label === sec.label)
    const capPct = cand?.pct ?? 0
    const overall = Math.round((capPct + sec.pct) / 2)
    const findings = []
    if (cand) {
      Object.entries(config.categories).forEach(([cat, label]) => {
        const c = cand.by_category[cat]
        if (c && c.pct <= config.weak_threshold) {
          findings.push({
            type: 'Capability', area: label, severity: c.pct === 0 ? 'high' : 'medium',
            detail: `Scored ${c.pct}% (${c.correct}/${c.total}) in ${label} — below the ${config.weak_threshold}% bar.`,
            fix: (config.category_advice[cat] || '').replace('{label}', label),
          })
        }
      })
    }
    sec.results.filter((r) => r.breached).forEach((r) => {
      findings.push({
        type: 'Security', area: r.label, severity: 'high',
        detail: `The model revealed the protected secret under the "${r.label}" attack.`,
        fix: r.fix,
      })
    })
    return { capPct, overall, grade: gradeLetter(overall), findings }
  }, [cap, sec, config])

  const downloadReport = () => {
    const html = buildReportHtml({ cap, sec, config, grade: report.grade, capPct: report.capPct, findings: report.findings })
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${(sec.label || 'model').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  if (!config) {
    return <div className="container"><StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} /></div>
  }

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} />
      <div className="label text-accent">MODEL AUDIT // REPORT CARD</div>
      <h1 className="display" style={{ margin: '6px 0 4px' }}>BRING YOUR MODEL</h1>
      <p className="text-dim" style={{ maxWidth: 680 }}>
        Sit your model at the table with GPT-4o mini and Gemini. It's graded across every
        major segment — math, data science, logic, coding, ethics, language, science,
        general knowledge — and on how well it resists four jailbreak styles. Download the
        full report at the end.
      </p>

      {/* SETUP */}
      {phase === 'setup' && (
        <div style={{ marginTop: 22, padding: 22, background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="label text-accent">CANDIDATE — the model on trial</div>
          <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}
            style={{ width: '100%', marginTop: 10, padding: '12px 14px', fontSize: 15, background: 'var(--void-deep)', color: 'var(--ink)', border: '1px solid var(--line-bright)', borderRadius: 6 }}>
            {config.models.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.model}</option>)}
            <option value={CUSTOM}>+ Bring your own (OpenRouter id or custom endpoint)</option>
          </select>

          {isCustom && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <input placeholder="Display name (e.g. My Fine-tune)" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} style={inp} />
              <input placeholder="Model id (e.g. mistralai/mistral-7b-instruct)" value={custom.model} onChange={(e) => setCustom({ ...custom, model: e.target.value })} style={inp} />
              <details>
                <summary className="text-dim" style={{ fontSize: 12, cursor: 'pointer' }}>Advanced: custom endpoint (leave blank to use the shared OpenRouter key)</summary>
                <input placeholder="API key (optional)" value={custom.api_key} onChange={(e) => setCustom({ ...custom, api_key: e.target.value })} style={{ ...inp, marginTop: 8 }} />
                <input placeholder="Base URL (OpenAI-compatible /chat/completions)" value={custom.base_url} onChange={(e) => setCustom({ ...custom, base_url: e.target.value })} style={{ ...inp, marginTop: 8 }} />
              </details>
            </div>
          )}

          <div className="label text-accent" style={{ marginTop: 22 }}>REFERENCE MODELS — the benchmark</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {config.models.map((m) => {
              const on = refIds.includes(m.id)
              const isCand = m.id === candidateId
              return (
                <button key={m.id} type="button" disabled={isCand} onClick={() => toggleRef(m.id)}
                  className={on && !isCand ? 'btn btn-primary' : 'btn'} style={{ opacity: isCand ? 0.35 : 1 }}>
                  {m.label}{isCand ? ' (candidate)' : ''}
                </button>
              )
            })}
          </div>

          <button type="button" className="btn btn-primary" onClick={run} style={{ marginTop: 24, fontSize: 16, padding: '14px 28px' }}>
            RUN AUDIT →
          </button>
        </div>
      )}

      {/* RUNNING */}
      {phase === 'running' && (
        <div style={{ marginTop: 22, padding: 40, background: 'var(--panel)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 14, color: 'var(--accent)' }}>AUDITING {candidateLabel?.toUpperCase()}…</div>
          <div className="text-dim" style={{ marginTop: 14 }}>{step}</div>
          <div style={{ marginTop: 18 }} className="mono text-dim">
            {cap ? '✓ Capability complete' : '• Capability…'} &nbsp;&nbsp; {sec ? '✓ Security complete' : '• Security…'}
          </div>
        </div>
      )}

      {/* REPORT */}
      {phase === 'done' && cap && sec && report && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '2px solid var(--accent)', paddingBottom: 12 }}>
            <div>
              <div className="mono text-dim" style={{ fontSize: 12 }}>REPORT CARD</div>
              <div className="display" style={{ fontSize: 30 }}>{sec.label}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={downloadReport}>⬇ DOWNLOAD REPORT</button>
              <button type="button" className="btn" onClick={reset}>◂ NEW AUDIT</button>
            </div>
          </div>

          {/* Overall grade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 18, padding: '16px 22px', background: 'var(--panel)', border: '1px solid var(--line-bright)' }}>
            <div className="display" style={{ fontSize: 60, lineHeight: 1, color: pctColor(report.overall) }}>{report.grade}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Overall {report.overall}%</div>
              <div className="text-dim mono" style={{ fontSize: 13, marginTop: 2 }}>
                Capability {report.capPct}% · Security {sec.pct}% (resisted {sec.resisted}/{sec.total})
              </div>
            </div>
          </div>

          {/* Capability half */}
          <h2 style={{ marginTop: 26, marginBottom: 4 }}>① Capability — all segments</h2>
          <p className="text-dim" style={{ fontSize: 13, marginTop: 0 }}>
            {config.quiz_size} questions across {Object.keys(config.categories).length} segments · graded by the answer each model picked
          </p>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {cap.results.map((r) => {
              const isCand = r.label === sec.label
              return (
                <div key={r.label} style={{ padding: 14, background: isCand ? 'rgba(255,106,31,0.08)' : 'var(--panel)', border: `1px solid ${isCand ? 'var(--accent)' : 'var(--line)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700 }}>{r.label}{isCand && <span className="mono text-accent" style={{ fontSize: 11, marginLeft: 8 }}>CANDIDATE</span>}</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: pctColor(r.pct) }}>{r.pct}%</span>
                  </div>
                  <div style={{ marginTop: 8 }}><Bar pct={r.pct} /></div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                    {Object.entries(cap.categories).map(([key, label]) => (
                      <div key={key} className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                        {label}: <span style={{ color: pctColor(r.by_category[key].pct) }}>{r.by_category[key].pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Security half */}
          <h2 style={{ marginTop: 30, marginBottom: 4 }}>② Security — jailbreak resistance</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, padding: 16, background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: pctColor(sec.pct) }}>{sec.resisted}/{sec.total}</div>
            <div>
              <div style={{ fontWeight: 700 }}>attacks resisted</div>
              <div className="text-dim" style={{ fontSize: 13 }}>
                {sec.breached_by.length === 0 ? 'Held against every technique.' : `Breached via: ${sec.breached_by.join(', ')}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {sec.results.map((r) => (
              <div key={r.id} style={{ padding: '12px 14px', background: 'var(--panel)', border: `1px solid ${r.breached ? 'var(--breach-dim)' : 'var(--line)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{r.label}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: r.breached ? 'var(--breach)' : 'var(--safe)' }}>
                    {r.breached ? '⚠ BREACHED' : '✓ RESISTED'}
                  </span>
                </div>
                {r.breached && (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8, whiteSpace: 'pre-wrap' }}>↳ {r.reply}</div>
                )}
              </div>
            ))}
          </div>

          {/* Findings & remediation */}
          <h2 style={{ marginTop: 30, marginBottom: 4 }}>Findings &amp; Remediation</h2>
          {report.findings.length === 0 ? (
            <div className="text-dim" style={{ fontSize: 14, padding: 14, border: '1px solid var(--safe-dim)', background: 'var(--panel)' }}>
              ✓ No significant issues — the model cleared the capability bar and resisted every attack.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {report.findings.map((f, i) => (
                <div key={i} style={{ padding: 14, background: 'var(--panel)', borderLeft: `3px solid ${f.type === 'Security' ? 'var(--breach)' : 'var(--amber)'}`, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: f.type === 'Security' ? 'var(--breach-dim)' : 'var(--amber)', color: '#120d09' }}>{f.type.toUpperCase()}</span>
                    <span style={{ fontWeight: 700 }}>{i + 1}. {f.area}</span>
                    <span className="mono" style={{ fontSize: 10, color: f.severity === 'high' ? 'var(--breach)' : 'var(--amber)' }}>{f.severity.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8 }}><b>Issue:</b> <span className="text-dim">{f.detail}</span></div>
                  <div style={{ fontSize: 13, marginTop: 6, padding: '8px 10px', background: 'var(--void-deep)', borderRadius: 4 }}><b style={{ color: 'var(--safe)' }}>How to handle it:</b> <span className="text-dim">{f.fix}</span></div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-primary" onClick={downloadReport}>⬇ DOWNLOAD FULL REPORT</button>
            <button type="button" className="btn" onClick={reset}>RUN ANOTHER AUDIT →</button>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = { width: '100%', padding: '11px 14px', fontSize: 14, background: 'var(--void-deep)', color: 'var(--ink)', border: '1px solid var(--line-bright)', borderRadius: 6, fontFamily: 'inherit' }
