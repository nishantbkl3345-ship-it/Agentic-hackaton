import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiJson } from '../api'

export default function Leaderboard({ eventId, big }) {
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') === 'elo' ? 'elo' : 'xp'
  const [data, setData] = useState({ rows: [], you: null })

  useEffect(() => {
    let alive = true
    const load = async () => {
      const qs = new URLSearchParams({ sort })
      if (eventId) qs.set('event_id', eventId)
      try {
        const d = await apiJson(`/leaderboard?${qs}`)
        if (alive) setData(d)
      } catch {
        // transient poll failure, keep last-known data
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [sort, eventId])

  const setSort = (next) => setParams((p) => { p.set('sort', next); return p })

  const youOnBoard = data.rows.some((r) => r.id === data.you?.id)

  return (
    <div className={`leaderboard fade-up ${big ? 'big' : ''}`}>
      <h2 className="display mission-select-title">{eventId ? 'EVENT LEADERBOARD' : 'GLOBAL LEADERBOARD'}</h2>
      <div className="leaderboard-sort">
        <button type="button" className={`btn-ghost ${sort === 'xp' ? 'active' : ''}`} onClick={() => setSort('xp')}>SORT BY XP</button>
        <button type="button" className={`btn-ghost ${sort === 'elo' ? 'active' : ''}`} onClick={() => setSort('elo')}>SORT BY ELO</button>
      </div>
      <table className="leaderboard-table mono">
        <thead>
          <tr>
            <th>RANK</th>
            <th>OPERATOR</th>
            <th>XP</th>
            <th>ELO</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id} className={r.id === data.you?.id ? 'you' : ''}>
              <td>#{r.rank}</td>
              <td>{r.display_name}</td>
              <td>{r.xp_total.toLocaleString()}</td>
              <td>{r.elo}</td>
            </tr>
          ))}
          {data.you && !youOnBoard && (
            <tr className="you">
              <td>{data.you.rank ? `#${data.you.rank}` : '—'}</td>
              <td>{data.you.display_name}{data.you.is_guest ? ' (guest)' : ''}</td>
              <td>
                {data.you.xp_total.toLocaleString()}
                {data.you.is_guest && <span className="text-dim"> · not saved</span>}
              </td>
              <td>{data.you.elo}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
