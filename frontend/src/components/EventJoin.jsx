import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { API, apiJson, apiPostJson } from '../api'

export default function EventJoin({ operator }) {
  const { code } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [error, setError] = useState(null)
  const [displayName, setDisplayName] = useState(operator?.display_name || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiJson(`/events/${code}`).then(setEvent).catch((e) => setError(e.message))
  }, [code])

  const join = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiPostJson(`/events/${code}/join`, { display_name: displayName })
      navigate(`/mission/level1?event_id=${event.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !event) {
    return (
      <div className="container event-panel">
        <div className="panel breach">
          <h2 className="display">MISSION NOT FOUND</h2>
          <p className="text-dim mono">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container event-panel">
      <div className="panel accent">
        <div className="label text-accent">MISSION BRIEFING</div>
        <h2 className="display">{event?.name || 'LOADING…'}</h2>
        <div className="event-code mono">{code.toUpperCase()}</div>
        <p className="text-dim mono">{event?.participant_count ?? 0} operators already in the room</p>
        <form onSubmit={join}>
          <label className="field">
            <span className="label">CALLSIGN</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
          </label>
          {error && <div className="form-error mono">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy || !event}>
            {busy ? 'JOINING…' : 'JOIN THE OPS ROOM →'}
          </button>
        </form>
      </div>
      <img
        className="event-qr"
        style={{ display: 'block' }}
        src={`${API}/events/${code}/qr.png`}
        alt="Event join QR code"
        width={180}
        height={180}
      />
    </div>
  )
}
