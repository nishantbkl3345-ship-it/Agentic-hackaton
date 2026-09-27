import { useNavigate } from 'react-router-dom'

export default function SaveYourRun({ xp, onDismiss }) {
  const navigate = useNavigate()

  const goSignup = () => {
    onDismiss()
    navigate('/signup')
  }

  return (
    <div className="save-run-overlay fade-up">
      <div className="panel accent save-run-panel">
        <div className="label text-accent">RUN IN PROGRESS</div>
        <h2 className="display">NICE BREACH.</h2>
        <p className="text-dim">
          You've earned {xp.toLocaleString()} XP as a guest. It only sticks around on this
          browser — save it to a free operator ID so it's yours for good.
        </p>
        <button type="button" className="btn btn-primary" onClick={goSignup}>
          SAVE YOUR RUN — CREATE FREE OPERATOR ID →
        </button>
        <span className="save-run-skip text-dim mono" onClick={onDismiss}>
          Continue without saving
        </span>
      </div>
    </div>
  )
}
