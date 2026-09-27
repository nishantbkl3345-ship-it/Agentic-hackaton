import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPostJson } from '../api'
import Loader from './Loader'

export default function Signup({ onAuthed, xpToSave = 0 }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const operator = await apiPostJson('/auth/signup', { username, password })
      onAuthed(operator)
      navigate('/missions')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container auth-shell">
      <div className="panel accent">
        <div className="label text-accent">CREATE OPERATOR ID</div>
        <h2 className="display">SAVE YOUR RUN</h2>
        {xpToSave > 0 && (
          <p className="text-dim mono">You've earned {xpToSave.toLocaleString()} XP as a guest. Sign up to keep it.</p>
        )}
        <form onSubmit={submit}>
          <label className="field">
            <span className="label">OPERATOR ID</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="3+ characters" />
          </label>
          <label className="field">
            <span className="label">PASSWORD</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6+ characters" />
          </label>
          {error && <div className="form-error mono">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <>CREATING <Loader label="" inline /></> : 'CREATE FREE OPERATOR ID →'}
          </button>
        </form>
        <div className="auth-switch text-dim mono">
          Already have an ID? <Link to="/login" className="text-accent">SIGN IN →</Link>
        </div>
      </div>
    </div>
  )
}
