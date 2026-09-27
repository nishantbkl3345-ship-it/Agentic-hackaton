import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPostJson } from '../api'

export default function Login({ onAuthed }) {
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
      const operator = await apiPostJson('/auth/login', { username, password })
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
      <div className="panel">
        <div className="label text-accent">OPERATOR LOGIN</div>
        <h2 className="display">SIGN IN</h2>
        <form onSubmit={submit}>
          <label className="field">
            <span className="label">OPERATOR ID</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="label">PASSWORD</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="form-error mono">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'SIGNING IN…' : 'SIGN IN →'}
          </button>
        </form>
        <div className="auth-switch text-dim mono">
          No operator ID? <Link to="/signup" className="text-accent">CREATE ONE →</Link>
        </div>
      </div>
    </div>
  )
}
