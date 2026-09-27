import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COLORS, absCells, slideInfo } from './engine'

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width))
    ro.observe(ref.current)
    setW(ref.current.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [ref])
  return w
}

const bbox = (cells) => ({
  h: Math.max(...cells.map((c) => c[0])) + 1,
  w: Math.max(...cells.map((c) => c[1])) + 1,
})

function BlockTiles({ block, cell }) {
  const pal = COLORS[block.color]
  const has = new Set(block.cells.map(([r, c]) => `${r},${c}`))
  const n = (r, c) => has.has(`${r},${c}`)
  const rad = Math.round(cell * 0.24)
  const bev = Math.max(2, Math.round(cell * 0.09))
  const stud = Math.round(cell * 0.52)
  return block.cells.map(([r, c]) => {
    const top = !n(r - 1, c)
    const bottom = !n(r + 1, c)
    const left = !n(r, c - 1)
    const right = !n(r, c + 1)
    const shadows = []
    if (top) shadows.push(`inset 0 ${bev}px 0 ${pal.light}`)
    if (bottom) shadows.push(`inset 0 -${bev}px 0 ${pal.dark}`)
    if (left) shadows.push(`inset ${bev}px 0 0 ${pal.light}`)
    if (right) shadows.push(`inset -${bev}px 0 0 ${pal.dark}`)
    return (
      <div
        key={`${r},${c}`}
        className="mg-tile"
        style={{
          left: c * cell,
          top: r * cell,
          width: cell,
          height: cell,
          background: pal.base,
          boxShadow: shadows.join(', ') || 'none',
          borderTopLeftRadius: top && left ? rad : 0,
          borderTopRightRadius: top && right ? rad : 0,
          borderBottomLeftRadius: bottom && left ? rad : 0,
          borderBottomRightRadius: bottom && right ? rad : 0,
        }}
      >
        <div
          className="mg-stud"
          style={{
            width: stud,
            height: stud,
            left: (cell - stud) / 2,
            top: (cell - stud) / 2 - 1,
            background: `radial-gradient(circle at 35% 30%, ${pal.light}, ${pal.base} 62%)`,
            boxShadow: `0 ${Math.max(1, Math.round(cell * 0.05))}px 0 ${pal.dark}, inset 0 -1px 1px rgba(0,0,0,0.15)`,
          }}
        />
      </div>
    )
  })
}

function exitSideFor(state, block) {
  const cells = absCells(block)
  for (const e of state.exits) {
    if (e.color !== block.color) continue
    const horizontal = e.side === 'left' || e.side === 'right'
    const fits = cells.every(([r, c]) => {
      const v = horizontal ? r : c
      return v >= e.position && v < e.position + e.size
    })
    if (fits) return e.side
  }
  return 'right'
}

/**
 * Renders a MindGrid state. With `interactive`, blocks can be dragged along
 * one axis; every pixel of travel is clamped to what the engine says is legal.
 */
export default function Board({ state, interactive = false, onMove, maxCell = 54, hintId = null }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const W = state.width
  const H = state.height
  const cell = Math.max(12, Math.min(maxCell, Math.floor((width || 600) / (W + 1.2))))
  const frame = Math.max(10, Math.round(cell * 0.6))

  // ---- drag state ----
  const [drag, setDrag] = useState(null) // { id, axis, offset, min, max, info }
  const dragRef = useRef(null)
  const [shake, setShake] = useState(null) // { id, axis }
  const exitOffset = useRef({})

  // ---- exit ghosts: animate blocks that disappeared from state ----
  const prevBlocks = useRef(state.blocks)
  const [ghosts, setGhosts] = useState([])
  useLayoutEffect(() => {
    const now = new Set(state.blocks.map((b) => b.id))
    const gone = prevBlocks.current.filter((b) => !now.has(b.id))
    if (gone.length) {
      const prevState = { ...state, blocks: prevBlocks.current }
      const add = gone.map((b) => ({ block: b, side: exitSideFor(prevState, b), from: exitOffset.current[b.id] || { x: 0, y: 0 }, key: `${b.id}-${Date.now()}` }))
      gone.forEach((b) => delete exitOffset.current[b.id])
      setGhosts((g) => [...g, ...add])
      const keys = add.map((a) => a.key)
      setTimeout(() => setGhosts((g) => g.filter((x) => !keys.includes(x.key))), 600)
    }
    prevBlocks.current = state.blocks
  }, [state])

  useEffect(() => {
    if (!shake) return undefined
    const t = setTimeout(() => setShake(null), 340)
    return () => clearTimeout(t)
  }, [shake])

  const axisLimits = (id, axis) => {
    const neg = slideInfo(state, id, axis === 'x' ? 'left' : 'up')
    const pos = slideInfo(state, id, axis === 'x' ? 'right' : 'down')
    const b = state.blocks.find((x) => x.id === id)
    const { h, w } = bbox(b.cells)
    const len = axis === 'x' ? w : h
    // If an exit is open in a direction, let the block be dragged out past the edge.
    const min = -(neg.canExit ? neg.dist + len + 1 : neg.dist) * cell
    const max = (pos.canExit ? pos.dist + len + 1 : pos.dist) * cell
    return { min, max, neg, pos }
  }

  const onPointerDown = (e, id) => {
    if (!interactive) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, axis: null, offset: 0, raw: 0 }
    setDrag({ id, axis: null, offset: 0 })
  }

  const finishExit = (d, dir) => {
    exitOffset.current[d.id] = d.axis === 'x' ? { x: d.offset, y: 0 } : { x: 0, y: d.offset }
    dragRef.current = null
    setDrag(null)
    onMove?.(d.id, dir, 'exit')
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      Object.assign(d, axisLimits(d.id, d.axis))
    }
    d.raw = d.axis === 'x' ? dx : dy
    d.offset = Math.max(d.min, Math.min(d.max, d.raw))
    // Reaching the exit while dragging releases the block through it.
    if (d.offset > 0 && d.pos.canExit && d.offset >= (d.pos.dist + 0.6) * cell) return finishExit(d, d.axis === 'x' ? 'right' : 'down')
    if (d.offset < 0 && d.neg.canExit && -d.offset >= (d.neg.dist + 0.6) * cell) return finishExit(d, d.axis === 'x' ? 'left' : 'up')
    setDrag({ id: d.id, axis: d.axis, offset: d.offset })
  }

  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d || !d.axis) return
    const cells = Math.round(d.offset / cell)
    const overshoot = Math.abs(d.raw) - Math.abs(d.offset)
    if (cells !== 0) {
      const dir = d.axis === 'x' ? (cells > 0 ? 'right' : 'left') : (cells > 0 ? 'down' : 'up')
      onMove?.(d.id, dir, Math.abs(cells))
    } else if (overshoot > cell * 0.3 || Math.abs(d.raw) > cell * 0.3) {
      setShake({ id: d.id, axis: d.axis })
    }
  }

  const exitStyle = (e) => {
    const pal = COLORS[e.color]
    const along = e.size * cell - 6
    const common = { background: `linear-gradient(180deg, ${pal.light}, ${pal.base})`, boxShadow: `0 0 14px ${pal.base}, inset 0 -3px 0 ${pal.dark}` }
    const tri = Math.round(frame * 0.42)
    let pos
    let arrow
    if (e.side === 'left' || e.side === 'right') {
      pos = { top: frame + e.position * cell + 3, height: along, width: frame - 2, [e.side]: 1 }
      arrow = e.side === 'left'
        ? { borderTop: `${tri}px solid transparent`, borderBottom: `${tri}px solid transparent`, borderRight: `${tri}px solid #fff` }
        : { borderTop: `${tri}px solid transparent`, borderBottom: `${tri}px solid transparent`, borderLeft: `${tri}px solid #fff` }
    } else {
      pos = { left: frame + e.position * cell + 3, width: along, height: frame - 2, [e.side]: 1 }
      arrow = e.side === 'top'
        ? { borderLeft: `${tri}px solid transparent`, borderRight: `${tri}px solid transparent`, borderBottom: `${tri}px solid #fff` }
        : { borderLeft: `${tri}px solid transparent`, borderRight: `${tri}px solid transparent`, borderTop: `${tri}px solid #fff` }
    }
    return { box: { ...pos, ...common }, arrow }
  }

  const ghostTravel = (b, side) => {
    const { h, w } = bbox(b.cells)
    if (side === 'left') return { x: -((b.col + w) * cell + frame * 1.5), y: 0 }
    if (side === 'right') return { x: (W - b.col) * cell + frame * 1.5, y: 0 }
    if (side === 'top') return { x: 0, y: -((b.row + h) * cell + frame * 1.5) }
    return { x: 0, y: (H - b.row) * cell + frame * 1.5 }
  }

  const totalW = W * cell + frame * 2
  const totalH = H * cell + frame * 2

  return (
    <div className="mg-wrap" ref={wrapRef}>
      <div className="mg-frame" style={{ width: totalW, height: totalH, '--mg-cell': `${cell}px` }}>
        {state.exits.map((e) => {
          const s = exitStyle(e)
          return (
            <div key={e.id} className="mg-exit" style={s.box} title={`${e.color} exit`}>
              <div className="mg-exit-arrow" style={s.arrow} />
            </div>
          )
        })}
        <div className="mg-board" style={{ left: frame, top: frame, width: W * cell, height: H * cell }}>
          <div className="mg-gridline" />
          {state.blocks.map((b) => {
            const { h, w } = bbox(b.cells)
            const isDrag = drag?.id === b.id
            const off = isDrag && drag.axis ? drag.offset : 0
            const tx = isDrag && drag.axis === 'x' ? off : 0
            const ty = isDrag && drag.axis === 'y' ? off : 0
            const cls = ['mg-block']
            if (interactive) cls.push('interactive')
            if (isDrag) cls.push('dragging')
            if (hintId === b.id) cls.push('hint')
            return (
              <div
                key={b.id}
                className={cls.join(' ')}
                style={{
                  left: b.col * cell,
                  top: b.row * cell,
                  width: w * cell,
                  height: h * cell,
                  transform: `translate(${tx}px, ${ty}px) scale(${isDrag ? 1.04 : 1})`,
                }}
                onPointerDown={(e) => onPointerDown(e, b.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div className={shake?.id === b.id ? (shake.axis === 'x' ? 'mg-shake-x' : 'mg-shake-y') : ''} style={{ position: 'absolute', inset: 0 }}>
                  <BlockTiles block={b} cell={cell} />
                </div>
              </div>
            )
          })}
          {ghosts.map(({ block: b, side, from, key }) => {
            const { h, w } = bbox(b.cells)
            const t = ghostTravel(b, side)
            return (
              <div
                key={key}
                className="mg-ghost"
                style={{
                  left: b.col * cell,
                  top: b.row * cell,
                  width: w * cell,
                  height: h * cell,
                  '--sx': `${from.x}px`,
                  '--sy': `${from.y}px`,
                  '--dx': `${t.x}px`,
                  '--dy': `${t.y}px`,
                }}
              >
                <BlockTiles block={b} cell={cell} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

