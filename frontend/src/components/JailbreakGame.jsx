import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiJson, apiPostJson } from '../api'
import StatusBar from './StatusBar'
import Loader, { LoaderBlock } from './Loader'

const DIFF_COLOR = { Easy: 'var(--safe)', Medium: 'var(--amber)', Hard: 'var(--breach)' }

export function JailbreakSelect({ operator }) {
  const navigate = useNavigate()
  const [tiers, setTiers] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    apiJson('/jb/tiers').then(setTiers).catch((e) => setError(e.message))
  }, [])

  return (
    <div className="container">
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/missions')} backLabel="MISSIONS" error={error} />
      <div className="label text-accent">LIVE MODE // WORD HEIST</div>
      <h1 className="display" style={{ margin: '6px 0 4px' }}>MAKE THE AI SAY IT</h1>
      <p className="text-dim" style={{ maxWidth: 660 }}>
        You pick a secret word. The AI is told your word and ordered never to say it.
        Your job: trick it into saying the word anyway — before the timer runs out.
        Pick your opponent. Stronger models are harder to trick.
      </p>

      {tiers.length === 0 && !error && <LoaderBlock label="LOADING OPPONENTS" />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 28 }}>
        {tiers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/jailbreak/${t.id}`)}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: 20, border: '1px solid var(--line)',
              background: 'var(--panel)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 12, letterSpacing: 1, color: DIFF_COLOR[t.difficulty] }}>
                {t.difficulty.toUpperCase()}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t.model_label}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{t.name}</div>
            <div className="text-dim" style={{ fontSize: 13 }}>{t.blurb}</div>
            <div className="btn btn-primary" style={{ marginTop: 6, alignSelf: 'flex-start' }}>CHOOSE →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const DURATIONS = [
  { label: '2 MIN', seconds: 120 },
  { label: '3 MIN', seconds: 180 },
]

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Split a reply so the winning target word can be highlighted.
function Highlighted({ text, word }) {
  if (!word) return text
  try {
    const re = new RegExp(`(${word.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')})`, 'ig')
    const parts = text.split(re)
    return parts.map((p, i) =>
      re.test(p)
        ? <mark key={i} style={{ background: 'var(--safe)', color: '#0b0806', padding: '0 3px', borderRadius: 3 }}>{p}</mark>
        : <span key={i}>{p}</span>
    )
  } catch {
    return text
  }
}

export function JailbreakArena({ operator }) {
  const { tierId } = useParams()
  const navigate = useNavigate()
  const [tier, setTier] = useState(null)
  const [error, setError] = useState(null)

  const [phase, setPhase] = useState('setup') // setup | playing | won | lost
  const [wordDraft, setWordDraft] = useState('')
  const [duration, setDuration] = useState(180)
  const [targetWord, setTargetWord] = useState('')

  const [messages, setMessages] = useState([]) // {role, content, win}
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    apiJson('/jb/tiers')
      .then((ts) => setTier(ts.find((t) => t.id === tierId) || null))
      .catch((e) => setError(e.message))
  }, [tierId])

  // Countdown
  useEffect(() => {
    if (phase !== 'playing') return
    if (secondsLeft <= 0) { setPhase('lost'); return }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, secondsLeft])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const start = () => {
    const w = wordDraft.trim()
    if (!w) return
    setTargetWord(w)
    setMessages([])
    setSecondsLeft(duration)
    setPhase('playing')
  }

  const playAgain = () => {
    setPhase('setup'); setMessages([]); setInput(''); setWordDraft(targetWord)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending || phase !== 'playing') return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    try {
      const res = await apiPostJson('/jb/chat', { tier: tierId, target_word: targetWord, message: text, history })
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, win: res.won }])
      if (res.won) setPhase('won')
      setError(null)
    } catch (e) {
      setError(e.message)
      const content = e.status && e.status < 500 ? e.message : '[connection error — is the backend running?]'
      setMessages((m) => [...m, { role: 'assistant', content, errored: true }])
    } finally {
      setSending(false)
    }
  }

  const timerColor = useMemo(() => {
    if (secondsLeft <= 15) return 'var(--breach)'
    if (secondsLeft <= 45) return 'var(--amber)'
    return 'var(--safe)'
  }, [secondsLeft])

  if (!tier) {
    return (
      <div className="container">
        <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/jailbreak')} backLabel="LEVELS" error={error} />
        <LoaderBlock label="LOADING OPPONENT" />
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <StatusBar xp={operator?.xp_total || 0} onBack={() => navigate('/jailbreak')} backLabel="LEVELS" error={error} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 12, letterSpacing: 1, color: DIFF_COLOR[tier.difficulty] }}>
            {tier.difficulty.toUpperCase()} · {tier.model_label}
          </div>
          <h1 className="display" style={{ margin: '2px 0' }}>{tier.name}</h1>
        </div>
        {phase === 'playing' && (
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: timerColor }}>{fmt(secondsLeft)}</div>
        )}
      </div>

      {/* SETUP PHASE */}
      {phase === 'setup' && (
        <div style={{ marginTop: 22, padding: 22, background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="label text-accent">STEP 1 — CHOOSE THE HIDDEN WORD</div>
          <p className="text-dim" style={{ fontSize: 13, margin: '8px 0 16px' }}>
            Pick a word or short phrase. The AI will know it and has been ordered never
            to say it. You win the instant it slips — spelled out or in another form counts too.
          </p>
          <input
            value={wordDraft}
            onChange={(e) => setWordDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            placeholder="e.g. banana, checkmate, pineapple…"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', fontSize: 18, fontWeight: 600, background: 'var(--void-deep)',
              border: '1px solid var(--line-bright)', borderRadius: 6, color: 'var(--ink)', fontFamily: 'inherit',
            }}
          />

          <div className="label text-accent" style={{ marginTop: 22 }}>STEP 2 — SET THE CLOCK</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {DURATIONS.map((d) => (
              <button
                key={d.seconds}
                type="button"
                className={duration === d.seconds ? 'btn btn-primary' : 'btn'}
                onClick={() => setDuration(d.seconds)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={start}
            disabled={!wordDraft.trim()}
            style={{ marginTop: 24, fontSize: 16, padding: '14px 28px' }}
          >
            START ROUND →
          </button>
        </div>
      )}

      {/* PLAYING / RESULT PHASES */}
      {phase !== 'setup' && (
        <>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="mono text-dim" style={{ fontSize: 13 }}>YOUR HIDDEN WORD:</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>
              {targetWord.toUpperCase()}
            </span>
            <span className="text-dim" style={{ fontSize: 12 }}>— get {tier.name} to say it</span>
          </div>

          {phase === 'won' && (
            <div className="banner cleared" style={{ marginTop: 16 }}>
              🏆 YOU WIN — {tier.name} said “{targetWord}”
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={playAgain}>NEW WORD</button>
                <button type="button" className="btn btn-primary" onClick={() => navigate('/jailbreak')}>CHANGE OPPONENT →</button>
              </div>
            </div>
          )}
          {phase === 'lost' && (
            <div className="banner defeated" style={{ marginTop: 16 }}>
              ⏱ TIME'S UP — {tier.name} never said “{targetWord}”. The AI wins this round.
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={playAgain}>TRY AGAIN</button>
                <button type="button" className="btn" onClick={() => navigate('/jailbreak')}>CHANGE OPPONENT →</button>
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            style={{
              marginTop: 16, height: 400, overflowY: 'auto', padding: 16,
              background: 'var(--void-deep)', border: '1px solid var(--line)', borderRadius: 6,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div className="text-dim" style={{ margin: 'auto', textAlign: 'center', fontSize: 13, maxWidth: 380 }}>
                Start talking. {tier.name} knows “{targetWord}” and will try to avoid it —
                set a trap: a riddle, a game, a story, a translation.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.role === 'user' ? 'var(--accent)' : (m.win ? 'rgba(143,217,74,0.12)' : 'var(--panel-raised)'),
                    color: m.role === 'user' ? '#1a1109' : (m.errored ? 'var(--breach)' : 'var(--ink)'),
                    border: m.role === 'user' ? 'none' : `1px solid ${m.win ? 'var(--safe)' : 'var(--line)'}`,
                  }}
                >
                  {m.role === 'assistant' ? <Highlighted text={m.content} word={m.win ? targetWord : ''} /> : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--ink-dim)', fontSize: 14 }}>
                  <Loader label={`${tier.name} is typing`} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={phase !== 'playing'}
              placeholder={phase === 'playing' ? 'Say something…' : 'Round over.'}
              style={{
                flex: 1, padding: '12px 14px', fontSize: 14, background: 'var(--panel)',
                border: '1px solid var(--line-bright)', borderRadius: 6, color: 'var(--ink)', fontFamily: 'inherit',
                opacity: phase === 'playing' ? 1 : 0.5,
              }}
            />
            <button type="button" className="btn btn-primary" onClick={send} disabled={sending || phase !== 'playing' || !input.trim()}>
              SEND
            </button>
          </div>
        </>
      )}
    </div>
  )
}
