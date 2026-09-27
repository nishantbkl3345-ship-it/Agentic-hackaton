import { useEffect, useState } from 'react'
import { apiJson } from '../api'

const KIND_LABEL = {
  breach: 'BREACHED',
  first_blood: 'FIRST BLOOD ON',
  patch: 'PATCHED',
  level_clear: 'CLEARED',
  join: 'JOINED THE OPS ROOM ON',
}

export default function ActivityTicker({ eventId }) {
  const [items, setItems] = useState([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const qs = eventId ? `?event_id=${eventId}` : ''
      try {
        const d = await apiJson(`/activity/recent${qs}`)
        if (alive) { setItems(d.items); setActive(d.active_operators) }
      } catch {
        // transient poll failure, keep last-known feed
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [eventId])

  if (!items.length) return null

  const line = items.map((it, i) => (
    <span key={i}>
      <span className={it.kind === 'first_blood' ? 'fb' : ''}>
        OPERATOR {it.display_name} {KIND_LABEL[it.kind] || it.kind.toUpperCase()}
        {it.level_id ? ` ${it.level_id.toUpperCase()}` : ''}
      </span>
      <span className="sep">◆</span>
    </span>
  ))

  return (
    <div className="ticker">
      <div className="ticker-track mono">
        {line}
        <span className="text-accent">{active} OPERATOR{active === 1 ? '' : 'S'} ACTIVE</span>
        <span className="sep">◆</span>
        {line}
        <span className="text-accent">{active} OPERATOR{active === 1 ? '' : 'S'} ACTIVE</span>
      </div>
    </div>
  )
}
