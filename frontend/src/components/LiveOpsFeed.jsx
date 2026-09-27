import { useEffect, useState } from 'react'
import { apiJson } from '../api'

const KIND_LABEL = {
  breach: 'BREACHED',
  first_blood: 'FIRST BLOOD',
  patch: 'PATCHED',
  level_clear: 'CLEARED MISSION',
  join: 'JOINED THE OPS ROOM',
}
const KIND_CLASS = {
  breach: 'text-breach',
  first_blood: 'text-accent',
  patch: 'text-safe',
  level_clear: 'text-accent',
  join: 'text-dim',
}

function timeOf(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour12: false })
}

export default function LiveOpsFeed({ eventId, limit = 8 }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const qs = eventId ? `?event_id=${eventId}` : ''
      try {
        const d = await apiJson(`/activity/recent${qs}`)
        if (alive) setItems(d.items.slice(0, limit))
      } catch {
        // transient poll failure, keep last-known feed
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [eventId, limit])

  return (
    <div className="live-ops fade-up">
      <h3 className="display" style={{ fontSize: 20 }}>LIVE OPERATIONS</h3>
      {!items.length && <p className="text-dim mono" style={{ fontSize: 12 }}>No activity yet. Be the first.</p>}
      <div className="live-ops-list">
        {items.map((it, i) => (
          <div key={i} className="live-ops-row mono">
            <span className="text-dim">{timeOf(it.ts)}</span>
            <span className="text-accent">{it.display_name}</span>
            <span className={KIND_CLASS[it.kind] || ''}>
              {KIND_LABEL[it.kind] || it.kind.toUpperCase()}{it.level_id ? ` ${it.level_id.toUpperCase()}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
