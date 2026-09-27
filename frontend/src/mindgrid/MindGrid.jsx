import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiJson, apiPostJson } from '../api'
import StatusBar from '../components/StatusBar'
import Board from './Board'
import { LEVELS, applyMove, boardToText, createState, getLevel, isSolved, solve } from './engine'
import './mindgrid.css'

const CUSTOM = '__custom__'
const MAX_TURNS = 80
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Generate off the current tick so the "Generating…" state paints first.
function useLevel(index, variant = 0) {
  const [level, setLevel] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    setLevel(null)
    const t = setTimeout(() => {
      try { setLevel(getLevel(index, variant)) } catch (e) { setError(e.message) }
    }, 30)
    return () => clearTimeout(t)
  }, [index, variant])
  return [level, error]
}

// ---------------------------------------------------------------------------
// Hub

export function MindGridHub({ operator }) {
  const navigate = useNavigate()
  return (
    <div className="container mg-page">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/')} backLabel="HOME" />
      <div className="label text-accent">MINDGRID // BLOCK ESCAPE</div>
      <h1 className="display" style={{ margin: '6px 0 4px' }}>MINDGRID</h1>
      <p className="text-dim" style={{ maxWidth: 700 }}>
        Slide every block out through the exit of its own color. Blocks move in straight
        lines, never overlap, never rotate. Solve it yourself, or put two AI models on the
        same board and watch which one thinks its way out first.
      </p>

      <button
        type="button"
        onClick={() => navigate('/mindgrid/duel')}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', margin: '20px 0',
          padding: '20px 24px', border: '1px solid var(--accent)',
          background: 'linear-gradient(90deg, rgba(255,106,31,0.16), transparent)', color: 'var(--ink)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="mono text-accent" style={{ fontSize: 12, letterSpacing: 1 }}>⚔ AI DUEL · LIVE MODELS</div>
          <div style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>Your model vs ours — first to clear the board wins</div>
          <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>Same puzzle, same clock. Afterwards both explain how they reasoned.</div>
        </div>
        <span className="btn btn-primary">START A DUEL →</span>
      </button>

      <div className="label text-accent" style={{ marginTop: 10 }}>PLAY IT YOURSELF</div>
      <div className="mg-level-grid" style={{ marginTop: 10 }}>
        {LEVELS.map((l) => (
          <button key={l.index} type="button" className="mg-level" onClick={() => navigate(`/mindgrid/play/${l.index}`)}>
            <span className="mono text-accent" style={{ fontSize: 12 }}>LEVEL {String(l.index).padStart(2, '0')}</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{l.name}</span>
            <span className="text-dim mono" style={{ fontSize: 12 }}>{l.size}×{l.size} · {l.blocks} blocks · {l.exits} exits</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Human play

export function MindGridPlay({ operator }) {
  const { level: levelParam } = useParams()
  const idx = Number(levelParam) || 1
  const navigate = useNavigate()
  const [level, genError] = useLevel(idx)
  const [state, setState] = useState(null)
  const [startAt, setStartAt] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [won, setWon] = useState(null)
  const [hint, setHint] = useState(null)
  const [msg, setMsg] = useState('')

  const reset = () => {
    if (!level) return
    setState(createState(level)); setStartAt(null); setWon(null); setHint(null); setMsg('')
  }
  useEffect(reset, [level]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!startAt || won) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [startAt, won])

  const onMove = (blockId, dir, dist) => {
    const r = applyMove(state, blockId, dir, dist)
    if (!r.ok) { setMsg(r.error); return }
    const started = startAt || Date.now()
    if (!startAt) setStartAt(started)
    setState(r.state); setHint(null); setMsg('')
    if (isSolved(r.state)) setWon({ ms: Date.now() - started, moves: r.state.moves })
  }

  const showHint = () => {
    const sol = solve({
      width: state.width, height: state.height, exits: state.exits,
      blocks: state.blocks.map((b) => ({ id: b.id, label: b.label, color: b.color, shape: b.shape, row: b.row, col: b.col })),
    }, { maxStates: 20000 })
    if (!sol.solved) { setMsg('No solution from this position — try Restart.'); return }
    setHint(sol.moves[0])
  }

  const hasNext = LEVELS.some((l) => l.index === idx + 1)

  return (
    <div className="container mg-page">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/mindgrid')} backLabel="MINDGRID" error={genError} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mono text-accent" style={{ fontSize: 12 }}>LEVEL {String(idx).padStart(2, '0')}</div>
          <h1 className="display" style={{ margin: '2px 0' }}>{LEVELS.find((l) => l.index === idx)?.name || 'MindGrid'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={showHint} disabled={!state || !!won}>💡 HINT</button>
          <button type="button" className="btn" onClick={reset} disabled={!state}>↻ RESTART</button>
        </div>
      </div>

      {state && (
        <div className="mg-hud">
          <div><span className="label">MOVES </span><span className="mono">{state.moves}</span></div>
          <div><span className="label">TIME </span><span className="mono">{fmt(startAt ? (won ? won.ms : now - startAt) : 0)}</span></div>
          <div><span className="label">LEFT </span><span className="mono">{state.blocks.length}</span></div>
          <div><span className="label">PAR </span><span className="mono">{level.solution.length}</span></div>
        </div>
      )}
      <div className="text-dim" style={{ textAlign: 'center', minHeight: 20, fontSize: 13 }}>
        {hint ? <>Hint: slide <b style={{ color: 'var(--ink)' }}>{hint.label}</b> {hint.dir} {hint.dist === 'exit' ? 'out through its exit' : `${hint.dist} cell${hint.dist > 1 ? 's' : ''}`}</> : msg || 'Drag a block. It stops at walls and other blocks, and leaves only through its own color.'}
      </div>

      <div style={{ marginTop: 10 }}>
        {state ? (
          <Board state={state} interactive={!won} onMove={onMove} hintId={hint?.blockId} />
        ) : (
          <div className="text-dim mono" style={{ textAlign: 'center', padding: 80 }}>GENERATING A SOLVABLE LEVEL…</div>
        )}
      </div>

      {won && (
        <div className="mg-overlay">
          <div className="mg-win">
            <div style={{ fontSize: 40 }}>🎉</div>
            <div className="display" style={{ fontSize: 30, margin: '6px 0 14px' }}>PUZZLE SOLVED</div>
            <div className="mono" style={{ fontSize: 15, lineHeight: 1.9 }}>
              Time: {fmt(won.ms)}<br />
              Moves: {won.moves} <span className="text-dim">(par {level.solution.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              {hasNext && <button type="button" className="btn btn-primary" onClick={() => navigate(`/mindgrid/play/${idx + 1}`)}>NEXT LEVEL →</button>}
              <button type="button" className="btn" onClick={reset}>↻ REPLAY</button>
              <button type="button" className="btn-ghost" onClick={() => navigate('/mindgrid')}>ALL LEVELS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Duel

const emptyPlayer = (label, level) => ({
  label, state: createState(level), log: [], whyLog: [], invalid: 0, reversals: 0,
  thinkMs: 0, turns: 0, lastWhy: '', status: 'waiting', solvedMs: null,
})

function decideWinner(players, total) {
  const [a, b] = players
  const solvedA = a.status === 'solved'
  const solvedB = b.status === 'solved'
  if (solvedA !== solvedB) return solvedA ? 0 : 1
  if (solvedA && solvedB) return a.solvedMs <= b.solvedMs ? 0 : 1
  const escA = total - a.state.blocks.length
  const escB = total - b.state.blocks.length
  if (escA !== escB) return escA > escB ? 0 : 1
  if (a.invalid !== b.invalid) return a.invalid < b.invalid ? 0 : 1
  if (a.state.moves !== b.state.moves) return a.state.moves < b.state.moves ? 0 : 1
  return -1
}

function statsFor(p, total, par) {
  const escaped = total - p.state.blocks.length
  const moves = p.state.moves
  return {
    escaped,
    moves,
    invalid: p.invalid,
    reversals: p.reversals,
    efficiency: p.status === 'solved' && moves ? Math.round((100 * par) / moves) : null,
    avgThink: p.turns ? Math.round(p.thinkMs / p.turns) : 0,
    time: p.solvedMs,
  }
}

function verdictLines(winner, loser, ws, ls, total, par) {
  const lines = []
  if (winner.status === 'solved') lines.push(`${winner.label} cleared all ${total} blocks${ls.escaped < total ? ` while ${loser.label} escaped ${ls.escaped}/${total}` : ''}.`)
  else lines.push(`Neither model cleared the board; ${winner.label} escaped more blocks (${ws.escaped} vs ${ls.escaped}).`)
  if (ws.efficiency != null) lines.push(`${winner.label} used ${ws.moves} moves against a solver par of ${par} (${ws.efficiency}% efficient).`)
  if (ws.invalid < ls.invalid) lines.push(`It made fewer illegal moves (${ws.invalid} vs ${ls.invalid}) — it read the board and the legal-move list more accurately.`)
  if (ws.reversals < ls.reversals) lines.push(`It wasted less time undoing itself: ${ws.reversals} back-and-forth moves vs ${ls.reversals} for ${loser.label}, which suggests better planning ahead.`)
  if (ws.avgThink && ls.avgThink && ws.avgThink < ls.avgThink) lines.push(`It also decided faster (${(ws.avgThink / 1000).toFixed(1)}s per move vs ${(ls.avgThink / 1000).toFixed(1)}s).`)
  // Be honest about where the loser was actually better.
  const tradeoffs = []
  if (ls.invalid < ws.invalid) tradeoffs.push(`fewer illegal moves (${ls.invalid} vs ${ws.invalid})`)
  if (ls.reversals < ws.reversals) tradeoffs.push(`less back-and-forth (${ls.reversals} vs ${ws.reversals})`)
  if (ls.avgThink && ws.avgThink && ls.avgThink < ws.avgThink) tradeoffs.push(`faster decisions (${(ls.avgThink / 1000).toFixed(1)}s vs ${(ws.avgThink / 1000).toFixed(1)}s per move)`)
  if (tradeoffs.length) {
    lines.push(`Trade-off: ${loser.label} was more careful on some measures — ${tradeoffs.join(', ')} — but it didn't turn that into escaped blocks, which is what wins the race.`)
  }
  return lines
}

export function MindGridDuel({ operator }) {
  const navigate = useNavigate()
  const [models, setModels] = useState([])
  const [aId, setAId] = useState('gemini-2.5-flash')
  const [bId, setBId] = useState('gpt-4o-mini')
  const [custom, setCustom] = useState({ label: '', model: '', api_key: '', base_url: '' })
  const [levelIdx, setLevelIdx] = useState(2)
  const [limit, setLimit] = useState(180)
  const [error, setError] = useState(null)

  const [phase, setPhase] = useState('setup') // setup | generating | racing | done
  const [level, setLevel] = useState(null)
  const [players, setPlayers] = useState([null, null])
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState(null)
  const [reflections, setReflections] = useState([null, null])
  const raceRef = useRef(null)
  const refsRef = useRef([null, null])

  useEffect(() => {
    apiJson('/mindgrid/models').then((r) => setModels(r.models)).catch((e) => setError(e.message))
    return () => { if (raceRef.current) raceRef.current.stop() }
  }, [])

  useEffect(() => {
    if (phase !== 'racing') return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [phase])

  const labelOf = (id) => models.find((m) => m.id === id)?.label || id
  const refA = aId === CUSTOM
    ? { label: custom.label || custom.model || 'Your model', provider: 'openrouter', model: custom.model, api_key: custom.api_key || undefined, base_url: custom.base_url || undefined }
    : aId
  const labelA = aId === CUSTOM ? (custom.label || custom.model || 'Your model') : labelOf(aId)
  const labelB = labelOf(bId)

  const patch = (i, p) => setPlayers((ps) => {
    const c = [...ps]
    c[i] = { ...c[i], ...p }
    return c
  })

  const runPlayer = async (i, ref, lvl, race) => {
    let st = createState(lvl)
    const history = []
    const log = []
    const whyLog = []
    let invalid = 0
    let reversals = 0
    let thinkMs = 0
    let turn = 0
    let last = null

    while (!race.over && Date.now() < race.deadline && !isSolved(st) && turn < MAX_TURNS) {
      turn++
      patch(i, { status: 'thinking' })
      const text = boardToText(st)
      const request = apiPostJson('/mindgrid/move', {
        model: ref, ...text, history, turn,
        seconds_left: Math.max(0, Math.round((race.deadline - Date.now()) / 1000)),
      }).catch((e) => ({ move: null, error: e.message, raw: '', ms: 0 }))
      const res = await Promise.race([request, race.ended, sleep(Math.max(0, race.deadline - Date.now())).then(() => null)])
      if (!res || race.over || Date.now() >= race.deadline) break

      thinkMs += res.ms || 0
      const m = res.move
      const b = m && st.blocks.find((x) => x.label === m.block)
      const r = b
        ? applyMove(st, b.id, m.dir, m.dist)
        : { ok: false, error: res.error ? `API error: ${res.error}` : m ? `No block "${m.block}" on the board` : `Unreadable reply: "${(res.raw || '').slice(0, 70)}"` }

      if (r.ok) {
        if (last && last.id === b.id && OPPOSITE[last.dir] === m.dir) reversals++
        last = { id: b.id, dir: m.dir }
        st = r.state
        history.push(`Turn ${turn}: ${m.block} ${m.dir} ${m.dist} -> ok${r.exited ? ' (block escaped)' : ''}`)
        log.push({ turn, text: `${m.block} ${m.dir} ${r.exited ? '→ EXIT' : m.dist}`, kind: r.exited ? 'exit' : 'ok' })
      } else {
        invalid++
        history.push(`Turn ${turn}: ${m ? `${m.block} ${m.dir} ${m.dist}` : 'no move'} -> INVALID (${r.error})`)
        log.push({ turn, text: `${m ? `${m.block} ${m.dir} ${m.dist}` : '—'} ✗ ${r.error}`, kind: 'bad' })
      }
      whyLog.push(`Turn ${turn}: ${m ? `${m.block} ${m.dir} ${m.dist}` : 'no move'} (${r.ok ? 'ok' : 'invalid'}) — reason given: ${res.why || '(none)'}`)
      patch(i, { state: st, log: [...log], invalid, reversals, thinkMs, turns: turn, lastWhy: res.why || (r.ok ? '' : r.error), whyLog: [...whyLog] })

      if (isSolved(st)) {
        const ms = Date.now() - race.start
        patch(i, { status: 'solved', solvedMs: ms })
        race.stop()
        return
      }
      await sleep(320)
    }
    patch(i, { status: isSolved(st) ? 'solved' : Date.now() >= race.deadline ? 'timeout' : 'stopped' })
  }

  const start = () => {
    if (aId === CUSTOM && !custom.model.trim()) { setError('Enter a model id for your model'); return }
    setError(null)
    setPhase('generating')
    setResult(null)
    setReflections([null, null])
    setTimeout(async () => {
      let lvl
      try { lvl = getLevel(levelIdx) } catch (e) { setError(e.message); setPhase('setup'); return }
      setLevel(lvl)
      setPlayers([emptyPlayer(labelA, lvl), emptyPlayer(labelB, lvl)])
      refsRef.current = [refA, bId]

      let stopFn
      const race = {
        over: false,
        start: Date.now(),
        deadline: Date.now() + limit * 1000,
        ended: new Promise((r) => { stopFn = r }),
      }
      race.stop = () => { race.over = true; stopFn(null) }
      raceRef.current = race
      setDeadline(race.deadline)
      setNow(Date.now())
      setPhase('racing')

      await Promise.all([runPlayer(0, refA, lvl, race), runPlayer(1, bId, lvl, race)])
      race.over = true
      setPhase('done')
    }, 30)
  }

  // When the race ends: decide, then ask both models to explain themselves.
  useEffect(() => {
    if (phase !== 'done' || !level || !players[0] || !players[1] || result) return
    const total = level.blocks.length
    const par = level.solution.length
    const w = decideWinner(players, total)
    const stats = players.map((p) => statsFor(p, total, par))
    setResult({ winner: w, stats, total, par })

    players.forEach((p, i) => {
      const outcome = w === -1 ? 'It was a draw.' : w === i ? 'You WON the race.' : 'You LOST the race.'
      const s = stats[i]
      const statLine = `${s.escaped}/${total} blocks escaped, ${s.moves} moves, ${s.invalid} invalid moves, ${s.reversals} back-and-forth moves, solver par ${par}.`
      apiPostJson('/mindgrid/reflect', {
        model: refsRef.current[i], level_name: `Level ${level.index} — ${level.name}`,
        outcome, stats: statLine, move_log: p.whyLog,
      })
        .then((r) => setReflections((rs) => { const c = [...rs]; c[i] = r.reasoning; return c }))
        .catch((e) => setReflections((rs) => { const c = [...rs]; c[i] = `(could not load reasoning: ${e.message})`; return c }))
    })
  }, [phase, level, players, result])

  const verdict = useMemo(() => {
    if (!result || result.winner === -1) return []
    const wi = result.winner
    return verdictLines(players[wi], players[1 - wi], result.stats[wi], result.stats[1 - wi], result.total, result.par)
  }, [result, players])

  const reset = () => { setPhase('setup'); setPlayers([null, null]); setResult(null); setReflections([null, null]); setLevel(null) }

  const cfg = LEVELS.find((l) => l.index === levelIdx)

  return (
    <div className="container mg-page">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => { raceRef.current?.stop(); navigate('/mindgrid') }} backLabel="MINDGRID" error={error} />
      <div className="label text-accent">MINDGRID // AI DUEL</div>
      <h1 className="display" style={{ margin: '6px 0 4px' }}>AI VS AI</h1>

      {(phase === 'setup' || phase === 'generating') && (
        <div className="mg-card" style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <div>
              <div className="label text-accent">PLAYER 1 — YOUR MODEL</div>
              <select value={aId} onChange={(e) => setAId(e.target.value)} style={sel}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                <option value={CUSTOM}>+ Bring your own model</option>
              </select>
              {aId === CUSTOM && (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <input style={inp} placeholder="Display name" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} />
                  <input style={inp} placeholder="OpenRouter model id, e.g. qwen/qwen-2.5-7b-instruct" value={custom.model} onChange={(e) => setCustom({ ...custom, model: e.target.value })} />
                  <details>
                    <summary className="text-dim" style={{ fontSize: 12, cursor: 'pointer' }}>Advanced: your own endpoint + key</summary>
                    <input style={{ ...inp, marginTop: 8 }} placeholder="API key" value={custom.api_key} onChange={(e) => setCustom({ ...custom, api_key: e.target.value })} />
                    <input style={{ ...inp, marginTop: 8 }} placeholder="Base URL (OpenAI-compatible /chat/completions)" value={custom.base_url} onChange={(e) => setCustom({ ...custom, base_url: e.target.value })} />
                  </details>
                </div>
              )}
            </div>
            <div>
              <div className="label text-accent">PLAYER 2 — OUR MODEL</div>
              <select value={bId} onChange={(e) => setBId(e.target.value)} style={sel}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="label text-accent" style={{ marginTop: 20 }}>PUZZLE</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {LEVELS.map((l) => (
              <button key={l.index} type="button" className={levelIdx === l.index ? 'btn btn-primary' : 'btn'} onClick={() => setLevelIdx(l.index)}>
                L{l.index} · {l.size}×{l.size}
              </button>
            ))}
          </div>
          <div className="text-dim mono" style={{ fontSize: 12, marginTop: 6 }}>{cfg.name}: {cfg.blocks} blocks, {cfg.exits} exits</div>

          <div className="label text-accent" style={{ marginTop: 20 }}>TIME LIMIT</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[120, 180, 300].map((s) => (
              <button key={s} type="button" className={limit === s ? 'btn btn-primary' : 'btn'} onClick={() => setLimit(s)}>{s / 60} MIN</button>
            ))}
          </div>

          <button type="button" className="btn btn-primary" onClick={start} disabled={phase === 'generating' || !models.length} style={{ marginTop: 24, fontSize: 16, padding: '14px 28px' }}>
            {phase === 'generating' ? 'GENERATING PUZZLE…' : 'START DUEL →'}
          </button>
        </div>
      )}

      {(phase === 'racing' || phase === 'done') && level && players[0] && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '12px 0 14px' }}>
            <div className="mono text-dim" style={{ fontSize: 13 }}>
              LEVEL {level.index} · {level.name} · {level.width}×{level.height} · {level.blocks.length} blocks · solver par {level.solution.length}
            </div>
            {phase === 'racing' ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 26, fontWeight: 700, color: deadline - now < 20000 ? 'var(--breach)' : 'var(--ink)' }}>{fmt(deadline - now)}</span>
                <button type="button" className="btn" onClick={() => raceRef.current?.stop()}>STOP</button>
              </div>
            ) : (
              <button type="button" className="btn" onClick={reset}>◂ NEW DUEL</button>
            )}
          </div>

          {result && (
            <div className={`banner ${result.winner === -1 ? '' : 'cleared'}`} style={{ marginBottom: 16 }}>
              {result.winner === -1 ? '🤝 DRAW — neither model pulled ahead' : `🏆 ${players[result.winner].label.toUpperCase()} WINS`}
            </div>
          )}

          <div className="mg-duel">
            {players.map((p, i) => (
              <div key={i} className={`mg-player ${result?.winner === i ? 'winner' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{p.label}</div>
                  <div className="mono" style={{ fontSize: 12, color: statusColor(p.status) }}>{statusText(p)}</div>
                </div>
                <div className="mono text-dim" style={{ fontSize: 12, margin: '4px 0 10px' }}>
                  moves {p.state.moves} · left {p.state.blocks.length}/{level.blocks.length} · invalid {p.invalid}
                </div>
                <Board state={p.state} maxCell={40} />
                <div className="mg-think">{p.status === 'thinking' ? <span className="mono">thinking…</span> : p.lastWhy ? <>💭 {p.lastWhy}</> : null}</div>
                <div className="mg-log mono">
                  {[...p.log].reverse().map((l) => (
                    <div key={l.turn} className={l.kind === 'bad' ? 'bad' : l.kind === 'exit' ? 'exit' : ''}>
                      T{l.turn}: {l.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {result && (
            <div style={{ marginTop: 26 }}>
              <h2 style={{ marginBottom: 8 }}>Head to head</h2>
              <div className="mg-card" style={{ overflowX: 'auto' }}>
                <table className="mg-table">
                  <thead><tr><th /><th>{players[0].label}</th><th>{players[1].label}</th></tr></thead>
                  <tbody>
                    {compareRows(result, players).map((row) => (
                      <tr key={row.name}>
                        <td className="text-dim">{row.name}</td>
                        {row.values.map((v, i) => <td key={i} className={row.best === i ? 'win' : ''}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {verdict.length > 0 && (
                <>
                  <h2 style={{ margin: '24px 0 8px' }}>Why {players[result.winner].label} won</h2>
                  <div className="mg-card">
                    {verdict.map((v) => <div key={v} style={{ fontSize: 14, marginBottom: 6 }}>• {v}</div>)}
                  </div>
                </>
              )}

              <h2 style={{ margin: '24px 0 8px' }}>In their own words</h2>
              <p className="text-dim" style={{ fontSize: 13, marginTop: 0 }}>Each model was shown its own move log and asked to explain its approach.</p>
              <div className="mg-duel">
                {players.map((p, i) => (
                  <div key={i} className={`mg-player ${result.winner === i ? 'winner' : ''}`}>
                    <div style={{ fontWeight: 800 }}>{p.label} {result.winner === i && <span className="mono" style={{ fontSize: 11, color: 'var(--safe)' }}>· WINNER</span>}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10, whiteSpace: 'pre-wrap' }} className={reflections[i] ? '' : 'text-dim mono'}>
                      {reflections[i] || 'asking for its reasoning…'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button type="button" className="btn btn-primary" onClick={() => { reset(); setTimeout(start, 0) }}>REMATCH</button>
                <button type="button" className="btn" onClick={reset}>CHANGE SETUP</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function statusText(p) {
  if (p.status === 'solved') return `✓ SOLVED ${fmt(p.solvedMs)}`
  if (p.status === 'timeout') return '⏱ OUT OF TIME'
  if (p.status === 'stopped') return 'STOPPED'
  if (p.status === 'thinking') return 'THINKING…'
  return 'READY'
}
function statusColor(s) {
  if (s === 'solved') return 'var(--safe)'
  if (s === 'timeout' || s === 'stopped') return 'var(--breach)'
  return 'var(--amber)'
}

function compareRows(result, players) {
  const [a, b] = result.stats
  const better = (x, y, lowerIsBetter) => {
    if (x == null || y == null || x === y) return -1
    return (lowerIsBetter ? x < y : x > y) ? 0 : 1
  }
  return [
    { name: 'Result', values: players.map((p) => (p.status === 'solved' ? `Solved in ${fmt(p.solvedMs)}` : p.status === 'timeout' ? 'Ran out of time' : 'Stopped')), best: result.winner },
    { name: 'Blocks escaped', values: [`${a.escaped}/${result.total}`, `${b.escaped}/${result.total}`], best: better(a.escaped, b.escaped, false) },
    { name: 'Moves', values: [a.moves, b.moves], best: better(a.moves, b.moves, true) },
    { name: 'Efficiency vs solver', values: [a.efficiency != null ? `${a.efficiency}%` : '—', b.efficiency != null ? `${b.efficiency}%` : '—'], best: better(a.efficiency, b.efficiency, false) },
    { name: 'Invalid moves', values: [a.invalid, b.invalid], best: better(a.invalid, b.invalid, true) },
    { name: 'Back-and-forth moves', values: [a.reversals, b.reversals], best: better(a.reversals, b.reversals, true) },
    { name: 'Avg think time', values: [`${(a.avgThink / 1000).toFixed(1)}s`, `${(b.avgThink / 1000).toFixed(1)}s`], best: better(a.avgThink, b.avgThink, true) },
  ]
}

const sel = { width: '100%', marginTop: 8, padding: '12px 14px', fontSize: 15, background: 'var(--void-deep)', color: 'var(--ink)', border: '1px solid var(--line-bright)', borderRadius: 6 }
const inp = { width: '100%', padding: '11px 14px', fontSize: 14, background: 'var(--void-deep)', color: 'var(--ink)', border: '1px solid var(--line-bright)', borderRadius: 6, fontFamily: 'inherit' }
