import { useState } from 'react'
import { CATEGORY_BLURBS, CATEGORY_LABELS, TEST_CRITERIA, statusTone } from './crucibleCriteria'

const ICON = { pass: '✓', confirmed: '🔴', notest: '—' }

function groupByTestType(tests) {
  const out = {}
  for (const t of tests) (out[t.test_type] ||= []).push(t)
  return out
}

function TestTypeGroup({ testType, rows }) {
  const meta = TEST_CRITERIA[testType] || { label: testType, criteria: 'No description available.' }
  // High-repetition test types (repeatability) collapse into one aggregate
  // row instead of listing every run — same idea as the live console.
  const isRepetitive = testType === 'repeatability' && rows.length > 5

  return (
    <div className="crucible-method-criterion">
      <div>
        <b>{meta.label}</b> <span className="text-dim">({rows.length} test{rows.length === 1 ? '' : 's'})</span>
      </div>
      <div className="desc">{meta.criteria}</div>

      {isRepetitive ? (
        (() => {
          const passCount = rows.filter((r) => r.status === 'PASS').length
          return (
            <div className="crucible-method-test-row">
              <span className={`crucible-test-icon ${passCount === rows.length ? 'pass' : 'confirmed'}`}>
                {ICON[passCount === rows.length ? 'pass' : 'confirmed']}
              </span>
              <span>{passCount}/{rows.length} runs consistent with the majority verdict</span>
            </div>
          )
        })()
      ) : (
        rows.map((t) => (
          <div key={t.id} className="crucible-method-test-row">
            <span className={`crucible-test-icon ${statusTone(t.status)}`}>{ICON[statusTone(t.status)]}</span>
            <span style={{ flex: 1 }}>{t.name}</span>
            <span className="text-dim">{t.status}{t.reason && t.status === 'NOT_TESTABLE' ? ` — ${t.reason}` : ''}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function CrucibleTestLog({ tests, configuration }) {
  const [openCats, setOpenCats] = useState({})
  const categories = Object.keys(CATEGORY_LABELS).filter((c) => configuration[c])

  const toggle = (c) => setOpenCats((s) => ({ ...s, [c]: !s[c] }))

  return (
    <div className="crucible-section">
      <div className="label crucible-section-title">METHODOLOGY &amp; FULL TEST LOG</div>
      <p className="text-dim" style={{ marginBottom: 14, fontSize: 13 }}>
        Every category below lists exactly what was sent, how a pass/fail was decided, and what — if
        anything — couldn't be tested against this target and why. Nothing here is summarized away.
      </p>

      <div className="panel">
        {categories.map((cat) => {
          const catTests = tests.filter((t) => t.category === cat)
          const grouped = groupByTestType(catTests)
          const open = openCats[cat] ?? false
          const notTestable = catTests.filter((t) => t.status === 'NOT_TESTABLE').length

          return (
            <div key={cat} className="crucible-method-cat">
              <div className="crucible-collapsible-head" onClick={() => toggle(cat)}>
                <div>
                  <b>{open ? '▾' : '▸'} {CATEGORY_LABELS[cat]}</b>
                  <span className="text-dim" style={{ marginLeft: 10, fontSize: 12 }}>{CATEGORY_BLURBS[cat]}</span>
                </div>
                <span className="label">
                  {catTests.length} RAN{notTestable ? `, ${notTestable} N/A` : ''}
                </span>
              </div>
              {open && (
                <div style={{ marginTop: 8 }}>
                  {Object.keys(grouped).map((tt) => <TestTypeGroup key={tt} testType={tt} rows={grouped[tt]} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
