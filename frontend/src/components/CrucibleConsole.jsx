import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api'
import Loader from './Loader'

const CATEGORY_LABELS = { security: 'SECURITY', truth: 'TRUTH', tools: 'TOOLS', reliability: 'RELIABILITY' }
const DEPTH_REPS = { quick: 10, standard: 30, deep: 100 }
const PASS = new Set(['SAFE', 'BLOCKED', 'CORRECT', 'PASS'])

function iconFor(status) {
  if (status === 'NOT_TESTABLE') return { cls: 'notest', glyph: '—' }
  if (PASS.has(status)) return { cls: 'pass', glyph: '✓' }
  return { cls: 'confirmed', glyph: '🔴' }
}

export default function CrucibleConsole({ runId, configuration, onComplete }) {
  const [run, setRun] = useState(null)
  const [tests, setTests] = useState([])
  const lastIdRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    let alive = true
    let intervalId = null
    const poll = async () => {
      try {
        const r = await apiJson(`/crucible/runs/${runId}`)
        if (!alive) return
        setRun(r)
        const q = lastIdRef.current ? `?since_id=${lastIdRef.current}` : ''
        const newTests = await apiJson(`/crucible/runs/${runId}/tests${q}`)
        if (!alive) return
        if (newTests.length) {
          setTests((prev) => [...prev, ...newTests])
          lastIdRef.current = newTests[newTests.length - 1].id
        }
        if (r.status !== 'running' && !doneRef.current) {
          doneRef.current = true
          if (intervalId) clearInterval(intervalId)
          onComplete()
        }
      } catch {
        // transient — keep last known state, try again next tick
      }
    }
    poll()
    intervalId = setInterval(poll, 1200)
    return () => { alive = false; if (intervalId) clearInterval(intervalId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const categories = Object.keys(CATEGORY_LABELS).filter((c) => configuration[c])
  const expectedReps = DEPTH_REPS[configuration.depth] || 30

  return (
    <div className="crucible-section fade-up">
      <div className="label crucible-section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>CRUCIBLE // RUN {runId.slice(0, 8).toUpperCase()}</span>
        {run?.status === 'running' && <Loader label="RUNNING" />}
      </div>

      <div className="panel">
        {categories.map((cat) => {
          const catTests = tests.filter((t) => t.category === cat)
          const repeatability = catTests.filter((t) => t.test_type === 'repeatability')
          const others = catTests.filter((t) => t.test_type !== 'repeatability')
          const repConsistent = repeatability.filter((t) => t.status === 'PASS').length

          return (
            <div key={cat} className="crucible-console-cat">
              <div className="crucible-console-cat-title">
                <h3 style={{ fontSize: 16 }}>{CATEGORY_LABELS[cat]}</h3>
                <span className="label">{catTests.length} LOGGED</span>
              </div>

              {others.map((t) => {
                const icon = iconFor(t.status)
                return (
                  <div key={t.id} className="crucible-test-row">
                    <span className={`crucible-test-icon ${icon.cls}`}>{icon.glyph}</span>
                    <span style={{ flex: 1 }}>{t.name}</span>
                    <span className="text-dim">{t.status}</span>
                  </div>
                )
              })}

              {repeatability.length > 0 && (
                <div className="crucible-test-row">
                  <span className={`crucible-test-icon ${repConsistent === repeatability.length ? 'pass' : 'confirmed'}`}>
                    {repeatability.length >= expectedReps ? '✓' : '●'}
                  </span>
                  <span style={{ flex: 1 }}>Repeatability</span>
                  <span className="text-dim">
                    {repeatability.length >= expectedReps
                      ? `${repConsistent}/${repeatability.length} consistent`
                      : `running ${repeatability.length}/${expectedReps}`}
                  </span>
                </div>
              )}

              {catTests.length === 0 && (!run || run.status === 'running') && (
                <div className="crucible-test-row"><span className="crucible-test-icon">●</span><span className="text-dim">waiting…</span></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
