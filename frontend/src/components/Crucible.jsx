import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson, apiPostJson } from '../api'
import StatusBar from './StatusBar'
import CrucibleConsole from './CrucibleConsole'
import CrucibleResults from './CrucibleResults'
import Loader, { LoaderBlock } from './Loader'

const CUSTOM_KIND = 'custom'
const CATEGORY_DEFS = [
  { key: 'security', label: 'SECURITY', blurb: 'Prompt injection, jailbreaks, canary/secret leaks, adversarial input.' },
  { key: 'truth', label: 'TRUTH', blurb: 'Factual accuracy, hallucination, contradiction, groundedness.' },
  { key: 'tools', label: 'TOOLS', blurb: 'Unauthorized/out-of-policy tool calls, sandboxed — nothing real executes.' },
  { key: 'reliability', label: 'RELIABILITY', blurb: 'Repeatability, phrasing variation, edge cases, stability.' },
]
const DEPTHS = ['quick', 'standard', 'deep']

export default function Crucible({ operator }) {
  const navigate = useNavigate()
  const [bots, setBots] = useState([])
  const [target, setTarget] = useState({ kind: 'bot', level_id: null })
  const [custom, setCustom] = useState({ label: '', model: '', api_key: '', base_url: '' })
  const [configuration, setConfiguration] = useState({ security: true, truth: true, tools: true, reliability: true, depth: 'standard' })
  const [phase, setPhase] = useState('setup') // setup | running | results
  const [runId, setRunId] = useState(null)
  const [error, setError] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [targetsLoaded, setTargetsLoaded] = useState(false)

  useEffect(() => {
    apiJson('/crucible/targets').then((d) => {
      setBots(d.bots)
      if (d.bots[0]) setTarget({ kind: 'bot', level_id: d.bots[0].id })
      setTargetsLoaded(true)
    }).catch((e) => setError(e.message))
  }, [])

  const isCustom = target.kind === CUSTOM_KIND

  const enabledCount = useMemo(
    () => CATEGORY_DEFS.filter((c) => configuration[c.key]).length,
    [configuration]
  )

  const toggleCategory = (key) => setConfiguration((c) => ({ ...c, [key]: !c[key] }))

  const launch = async () => {
    setError(null)
    if (enabledCount === 0) { setError('select at least one test category'); return }
    let payloadTarget = target
    if (isCustom) {
      if (!custom.model.trim() || !custom.api_key.trim() || !custom.base_url.trim()) {
        setError('bring-your-own targets need a model id, api key and base url')
        return
      }
      payloadTarget = { kind: 'custom', label: custom.label || custom.model, model: custom.model, api_key: custom.api_key, base_url: custom.base_url }
    }
    setLaunching(true)
    try {
      const res = await apiPostJson('/crucible/runs', { target: payloadTarget, configuration })
      setRunId(res.run_id)
      setPhase('running')
    } catch (e) {
      setError(e.message)
    } finally {
      setLaunching(false)
    }
  }

  const runAgain = () => { setPhase('setup'); setRunId(null) }

  return (
    <div className="container">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} />

      <div className="crucible-hero">
        <div className="label text-accent crucible-tagline">CRUCIBLE</div>
        <h1 className="display crucible-title">PUT YOUR AI UNDER PRESSURE.</h1>
        <p className="text-dim">Real adversarial tests, real evidence, a real answer: can you trust this AI?</p>
      </div>

      {phase === 'setup' && !targetsLoaded && <LoaderBlock label="CONNECTING TO TEST TARGETS" />}

      {phase === 'setup' && targetsLoaded && (
        <>
          <div className="crucible-section">
            <div className="label crucible-section-title">CONNECT AI</div>
            <div className="crucible-target-list">
              {bots.map((b) => (
                <div
                  key={b.id}
                  className={`panel crucible-target-option ${!isCustom && target.level_id === b.id ? 'selected' : ''}`}
                  onClick={() => setTarget({ kind: 'bot', level_id: b.id })}
                >
                  <div className="label">
                    {b.provider?.toUpperCase() || 'MOCK'}
                    {!b.live && <span className="text-breach"> · MOCK (no API key)</span>}
                  </div>
                  <div className="name">{b.name}</div>
                </div>
              ))}
              <div
                className={`panel crucible-target-option ${isCustom ? 'selected' : ''}`}
                onClick={() => setTarget({ kind: CUSTOM_KIND })}
              >
                <div className="label">BRING YOUR OWN</div>
                <div className="name">Custom endpoint</div>
              </div>
            </div>

            {!isCustom && bots.find((b) => b.id === target.level_id)?.live === false && (
              <p className="crucible-not-testable text-breach">
                No {bots.find((b) => b.id === target.level_id)?.provider?.toUpperCase()} API key is configured on
                this server — this target's replies will come from the deterministic offline mock, not a real
                model. Results are still real test executions, but they reflect the mock's behavior, not{' '}
                {bots.find((b) => b.id === target.level_id)?.provider}&apos;s.
              </p>
            )}

            {isCustom && (
              <div className="crucible-custom-form">
                <div className="field">
                  <span className="label">LABEL (OPTIONAL)</span>
                  <input value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="My AI app" />
                </div>
                <div className="field">
                  <span className="label">MODEL ID</span>
                  <input value={custom.model} onChange={(e) => setCustom({ ...custom, model: e.target.value })} placeholder="gpt-4o-mini" />
                </div>
                <div className="field">
                  <span className="label">API KEY</span>
                  <input type="password" value={custom.api_key} onChange={(e) => setCustom({ ...custom, api_key: e.target.value })} placeholder="sk-..." />
                </div>
                <div className="field">
                  <span className="label">BASE URL</span>
                  <input value={custom.base_url} onChange={(e) => setCustom({ ...custom, base_url: e.target.value })} placeholder="https://api.example.com/v1/chat/completions" />
                </div>
                <p className="crucible-not-testable" style={{ gridColumn: '1 / -1' }}>
                  Never stored — used only for this run. Bring-your-own targets currently support Security/Truth/
                  Reliability; Tools tests need a known tool schema and will show NOT TESTABLE.
                </p>
              </div>
            )}
          </div>

          <div className="crucible-section">
            <div className="label crucible-section-title">SELECT TESTS</div>
            <div className="crucible-config-row">
              {CATEGORY_DEFS.map((c) => (
                <div
                  key={c.key}
                  className={`panel crucible-toggle ${configuration[c.key] ? '' : 'off'}`}
                  onClick={() => toggleCategory(c.key)}
                  title={c.blurb}
                >
                  <span className="name">{c.label}</span>
                  <span className="check mono">{configuration[c.key] ? '[✓]' : '[ ]'}</span>
                </div>
              ))}
            </div>

            <div className="label" style={{ marginTop: 20 }}>TEST DEPTH</div>
            <div className="crucible-depth-row">
              {DEPTHS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`crucible-depth-btn ${configuration.depth === d ? 'active' : ''}`}
                  onClick={() => setConfiguration((c) => ({ ...c, depth: d }))}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn-primary crucible-run-btn" disabled={launching} onClick={launch}>
            {launching ? (<>STARTING <Loader label="" inline /></>) : 'RUN CRUCIBLE →'}
          </button>
        </>
      )}

      {phase === 'running' && runId && (
        <CrucibleConsole runId={runId} configuration={configuration} onComplete={() => setPhase('results')} />
      )}

      {phase === 'results' && runId && (
        <CrucibleResults runId={runId} onRunAgain={runAgain} />
      )}
    </div>
  )
}
