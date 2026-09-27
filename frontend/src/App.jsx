import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import './theme.css'
import { apiJson, apiPostJson } from './api'
import heroArena from './assets/hero-arena.png'
import Landing from './components/Landing'
import MissionMap from './components/MissionMap'
import MissionPreview from './components/MissionPreview'
import OperatorStatus from './components/OperatorStatus'
import LiveOpsFeed from './components/LiveOpsFeed'
import Achievements from './components/Achievements'
import AttackConsole from './components/AttackConsole'
import BreachSequence from './components/BreachSequence'
import DefenderMode from './components/DefenderMode'
import StatusBar, { scoreColor } from './components/StatusBar'
import Login from './components/Login'
import Signup from './components/Signup'
import Leaderboard from './components/Leaderboard'
import ActivityTicker from './components/ActivityTicker'
import Onboarding from './components/Onboarding'
import EventJoin from './components/EventJoin'
import SaveYourRun from './components/SaveYourRun'
import { JailbreakSelect, JailbreakArena } from './components/JailbreakGame'
import AuditLab from './components/AuditLab'
import Crucible from './components/Crucible'
import { LoaderBlock } from './components/Loader'

const EMPTY_REPORT = { score: 100, weak_spots_found: 0, confirmed_live: 0, map: [], findings: [], attacks: [] }

function StatRow({ report, attemptsRemaining, attemptLimit }) {
  return (
    <div className="stat-row">
      <div className="stat">
        <div className="label">SECURITY SCORE</div>
        <div className="mono stat-num" style={{ color: scoreColor(report.score) }}>{report.score}</div>
      </div>
      <div className="stat">
        <div className="label">WEAK SPOTS</div>
        <div className="mono stat-num">{report.weak_spots_found}</div>
      </div>
      <div className="stat">
        <div className="label">CONFIRMED LIVE</div>
        <div className="mono stat-num text-breach">{report.confirmed_live}</div>
      </div>
      {attemptLimit != null && (
        <div className="stat">
          <div className="label">ATTEMPTS LEFT</div>
          <div className="mono stat-num text-breach">{attemptsRemaining}/{attemptLimit}</div>
        </div>
      )}
    </div>
  )
}

function MissionsPage({ operator }) {
  const navigate = useNavigate()
  const [levels, setLevels] = useState([])
  const [nextPatches, setNextPatches] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = async () => {
    try {
      const ls = await apiJson('/levels')
      setLevels(ls)
      setError(null)
      const next = ls.find((l) => l.unlocked && !l.cleared)
      if (next) setNextPatches(await apiJson(`/levels/${next.id}/patches`))
    } catch (e) { setError(e.message) } finally { setLoaded(true) }
  }

  useEffect(() => {
    refresh()
    apiJson('/operator/stats').then(setStats).catch(() => {})
  }, [])

  const resetProgress = async () => {
    await apiPostJson('/reset-progress', {})
    await refresh()
    apiJson('/operator/stats').then(setStats).catch(() => {})
  }

  const nextLevel = levels.find((l) => l.unlocked && !l.cleared) || null
  const enter = (id) => navigate(`/mission/${id}`)

  return (
    <div className="arena-dashboard">
      <div
        className="arena-bg"
        style={{ backgroundImage: `url(${heroArena})` }}
      />
      <div className="container">
        <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/')} backLabel="HOME" error={error} />

        <div className="label text-accent">OPERATOR // RED TEAM</div>
        <h1 className="display arena-welcome">WELCOME BACK, OPERATOR.</h1>
        <p className="text-dim">Three AI systems are waiting. One is already vulnerable.</p>

        <button
          type="button"
          onClick={() => navigate('/crucible')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', margin: '18px 0',
            padding: '18px 22px', border: '1px solid var(--accent)', background: 'linear-gradient(90deg, rgba(255,106,31,0.14), transparent)',
            color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="mono text-accent" style={{ fontSize: 12, letterSpacing: 1 }}>⚡ CRUCIBLE · AI TESTING ENGINE</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>PUT YOUR AI UNDER PRESSURE</div>
            <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>Security, Truth, Tools, Reliability — real tests, real evidence, one score.</div>
          </div>
          <span className="btn btn-primary">ENTER CRUCIBLE →</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/jailbreak')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', margin: '18px 0',
            padding: '18px 22px', border: '1px solid var(--accent)', background: 'linear-gradient(90deg, rgba(255,106,31,0.14), transparent)',
            color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="mono text-accent" style={{ fontSize: 12, letterSpacing: 1 }}>🔴 LIVE MODE · REAL AI</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>JAILBREAK CHAT — steal a secret from a live AI</div>
            <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>You type. It talks back. Break its rules with your own words.</div>
          </div>
          <span className="btn btn-primary">PLAY LIVE →</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/audit')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', margin: '0 0 18px',
            padding: '18px 22px', border: '1px solid var(--line-bright)', background: 'var(--panel)',
            color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="mono text-accent" style={{ fontSize: 12, letterSpacing: 1 }}>📋 MODEL AUDIT · REPORT CARD</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>BRING YOUR MODEL — grade it vs GPT-4o mini & Gemini</div>
            <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>Capability + security, one combined report.</div>
          </div>
          <span className="btn">AUDIT →</span>
        </button>

        {loaded ? (
          <MissionPreview level={nextLevel} patches={nextPatches} onEnter={enter} />
        ) : (
          <div className="panel raised" style={{ margin: '30px 0' }}><LoaderBlock label="SCANNING MISSIONS" /></div>
        )}

        <ActivityTicker />

        {loaded ? <MissionMap levels={levels} onSelect={enter} /> : <LoaderBlock label="MAPPING TARGETS" />}

        <div className="arena-columns">
          <OperatorStatus xp={operator?.xp_total || 0} elo={operator?.elo || 1200} stats={stats} />
          <LiveOpsFeed />
        </div>

        <Achievements items={stats?.achievements} />

        <div style={{ marginTop: 40 }}>
          <Leaderboard />
        </div>

        <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={resetProgress}>
          ↺ RESET ALL PROGRESS
        </button>
      </div>
    </div>
  )
}

function MissionArena({ operator, onGuestMilestone }) {
  const { levelId } = useParams()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('event_id')
  const navigate = useNavigate()

  const [levels, setLevels] = useState([])
  const [report, setReport] = useState(EMPTY_REPORT)
  const [attackMeta, setAttackMeta] = useState({ categories: [], input_label: '', input_placeholder: '' })
  const [patches, setPatches] = useState([])
  const [running, setRunning] = useState(false)
  const [patching, setPatching] = useState(false)
  const [currentMessage, setCurrentMessage] = useState('')
  const [priorRun, setPriorRun] = useState(null)
  const [lastRun, setLastRun] = useState(null)
  const [showSequence, setShowSequence] = useState(false)
  const [clearedBanner, setClearedBanner] = useState(null)
  const [defeated, setDefeated] = useState(false)
  const [error, setError] = useState(null)
  const [arenaLoaded, setArenaLoaded] = useState(false)

  const activeLevel = useMemo(() => levels.find((l) => l.id === levelId) || null, [levels, levelId])

  const refreshLevels = async () => {
    try { setLevels(await apiJson('/levels')); setError(null) } catch (e) { setError(e.message) }
  }

  const refreshArena = async () => {
    try {
      const [r, a, p] = await Promise.all([
        apiJson(`/levels/${levelId}/report`),
        apiJson(`/levels/${levelId}/attacks`),
        apiJson(`/levels/${levelId}/patches`),
      ])
      setReport(r); setAttackMeta(a); setPatches(p); setError(null)
    } catch (e) { setError(e.message) } finally { setArenaLoaded(true) }
  }

  useEffect(() => {
    setLastRun(null); setPriorRun(null); setClearedBanner(null); setDefeated(false); setShowSequence(false)
    setArenaLoaded(false)
    refreshLevels()
    refreshArena()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId])

  const resultsByCategory = useMemo(() => {
    const map = {}
    for (const a of report.attacks || []) map[a.category] = a
    return map
  }, [report.attacks])

  const attackQs = eventId ? `?event_id=${eventId}` : ''

  const runAttack = async (message) => {
    setRunning(true)
    setCurrentMessage(message)
    setLastRun(null)
    setClearedBanner(null)
    setShowSequence(true)

    let res
    try {
      res = await apiJson(`/levels/${levelId}/attack${attackQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
    } catch (e) {
      if (e.status === 409) {
        setRunning(false); setShowSequence(false); setDefeated(true)
        await refreshLevels()
        return
      }
      setError(e.message)
      setRunning(false); setShowSequence(false)
      return
    }

    setPriorRun(res.attack.category ? resultsByCategory[res.attack.category] || null : null)
    setLastRun(res)
    setRunning(false)
    await refreshArena()
    await refreshLevels()

    if (res.boss_lost) setDefeated(true)
    if (res.level_cleared) setClearedBanner({ xpGained: res.xp_gained, nextLevelId: res.next_level_id })
    if (res.attack.result === 'success' && operator?.is_guest) onGuestMilestone()
  }

  const applyPatch = async (category) => {
    setPatching(true)
    const res = await apiPostJson(`/levels/${levelId}/patch${attackQs}`, { category })
    setPatching(false)
    await refreshArena()
    await refreshLevels()
    if (res.level_cleared) setClearedBanner({ xpGained: res.xp_gained, nextLevelId: res.next_level_id })
  }

  const resetLevel = async () => {
    await apiJson(`/levels/${levelId}/reset`, { method: 'POST' })
    setLastRun(null); setPriorRun(null); setClearedBanner(null); setDefeated(false); setShowSequence(false)
    await refreshArena()
    await refreshLevels()
  }

  const takeHint = async () => {
    try {
      const data = await apiJson(`/levels/${levelId}/hint`, { method: 'POST' })
      await refreshLevels()
      return data.hint
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  if (!activeLevel) {
    return (
      <div className="container">
        <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} />
        <LoaderBlock label="LOADING MISSION" />
      </div>
    )
  }

  const attemptLimit = activeLevel?.attempt_limit ?? null
  const attemptsRemaining = attemptLimit != null ? Math.max(0, attemptLimit - (activeLevel?.attempts_used ?? 0)) : null
  const showDefender = !showSequence && lastRun && lastRun.attack.result === 'success'
  const defenderPatched = lastRun ? patches.includes(lastRun.attack.category) : false

  return (
    <div className="container">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} />
      {eventId && <ActivityTicker eventId={eventId} />}

      {defeated && (
        <div className="banner defeated">{activeLevel.name.toUpperCase()} WINS — OUT OF ATTEMPTS</div>
      )}
      {clearedBanner && (
        <div className="banner cleared">
          MISSION CLEARED +{clearedBanner.xpGained} XP
          {clearedBanner.nextLevelId && (
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/mission/${clearedBanner.nextLevelId}${eventId ? `?event_id=${eventId}` : ''}`)}>
                NEXT MISSION →
              </button>
            </div>
          )}
        </div>
      )}

      {!arenaLoaded ? (
        <LoaderBlock label="LOADING TARGET STATE" />
      ) : (
        <>
          <StatRow report={report} attemptsRemaining={attemptsRemaining} attemptLimit={attemptLimit} />

          <AttackConsole
            levelId={levelId}
            levelMeta={activeLevel}
            categories={attackMeta.categories}
            inputLabel={attackMeta.input_label}
            inputPlaceholder={attackMeta.input_placeholder}
            resultsByCategory={resultsByCategory}
            patches={patches}
            findings={report.findings}
            running={running}
            disabled={defeated}
            onLaunch={runAttack}
            onHint={takeHint}
          />
        </>
      )}

      {showDefender && (
        <DefenderMode
          attack={lastRun.attack}
          findings={lastRun.findings_hit}
          patched={defenderPatched}
          patching={patching}
          onPatch={applyPatch}
          onReplay={() => runAttack(currentMessage)}
        />
      )}

      <button type="button" className="btn-ghost" style={{ marginTop: 24 }} onClick={resetLevel}>
        ↺ RESET MISSION
      </button>

      <BreachSequence
        active={showSequence}
        attack={currentMessage ? { id: currentMessage, name: currentMessage } : null}
        result={lastRun}
        prior={priorRun}
        onClose={() => setShowSequence(false)}
        onRetry={() => { setShowSequence(false); runAttack(currentMessage) }}
      />
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const [operator, setOperator] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSaveRun, setShowSaveRun] = useState(false)
  const [saveRunSeen, setSaveRunSeen] = useState(false)

  const refreshMe = async () => {
    const op = await apiJson('/me')
    setOperator(op)
    return op
  }

  useEffect(() => { refreshMe() }, [])

  const enterMissions = async () => {
    const op = operator || (await refreshMe())
    if (op && !op.onboarded) setShowOnboarding(true)
    navigate('/missions')
  }

  const onGuestMilestone = () => {
    if (!saveRunSeen) setShowSaveRun(true)
  }

  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<Landing xp={operator?.xp_total || 0} onEnter={enterMissions} />} />
        <Route path="/login" element={<Login onAuthed={setOperator} />} />
        <Route path="/signup" element={<Signup onAuthed={setOperator} xpToSave={operator?.xp_total || 0} />} />
        <Route path="/missions" element={<MissionsPage operator={operator} />} />
        <Route path="/jailbreak" element={<JailbreakSelect operator={operator} />} />
        <Route path="/jailbreak/:tierId" element={<JailbreakArena operator={operator} />} />
        <Route path="/audit" element={<AuditLab operator={operator} />} />
        <Route path="/crucible" element={<Crucible operator={operator} />} />
        <Route path="/mission/:levelId" element={<MissionArena operator={operator} onGuestMilestone={onGuestMilestone} />} />
        <Route
          path="/leaderboard"
          element={(
            <div className="container">
              <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" />
              <Leaderboard />
            </div>
          )}
        />
        <Route path="/j/:code" element={<EventJoin operator={operator} />} />
        <Route
          path="/event/:eventId/board"
          element={<EventBoardPage />}
        />
      </Routes>

      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      {showSaveRun && (
        <SaveYourRun
          xp={operator?.xp_total || 0}
          onDismiss={() => { setShowSaveRun(false); setSaveRunSeen(true) }}
        />
      )}
    </div>
  )
}

function EventBoardPage() {
  const { eventId } = useParams()
  return (
    <div className="container">
      <Leaderboard eventId={eventId} big />
    </div>
  )
}
