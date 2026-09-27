export default function Loader({ label = 'LOADING', inline = false }) {
  return (
    <span className={`loader ${inline ? 'loader-inline' : ''}`}>
      <span className="loader-glyph" />
      {label && <span className="loader-label">{label}…</span>}
    </span>
  )
}

export function LoaderBlock({ label = 'LOADING' }) {
  return (
    <div className="loader-block">
      <Loader label={label} />
    </div>
  )
}
