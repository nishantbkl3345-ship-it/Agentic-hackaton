const GLYPH = {
  first_blood: '◆',
  canary_hunter: '⬡',
  tool_breaker: '⚙',
  patch_master: '✚',
  fortress_breaker: '▲',
}

export default function Achievements({ items }) {
  if (!items?.length) return null
  return (
    <div className="achievements fade-up">
      <div className="label text-dim">RECENT ACHIEVEMENTS</div>
      <div className="achievement-strip">
        {items.map((a) => (
          <div key={a.id} className={`achievement-badge mono ${a.unlocked ? 'unlocked' : ''}`} title={a.label}>
            <span className="achievement-glyph">{GLYPH[a.id] || '★'}</span>
            <span>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
