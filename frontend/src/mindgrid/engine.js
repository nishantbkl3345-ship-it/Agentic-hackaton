// MindGrid puzzle engine — pure logic, no DOM/React.
//
// The board is a real logical grid. Every block has a cell-based shape and a
// (row, col) anchor. Every move is validated against the board edges, the
// cells other blocks occupy, and the exits. The same engine drives human play,
// both AI players in a duel, the solver and the level generator.

export const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }
export const DIR_LIST = ['up', 'down', 'left', 'right']
export const SIDE_TO_DIR = { top: 'up', bottom: 'down', left: 'left', right: 'right' }

export const COLORS = {
  red: { base: '#e8343f', light: '#ff6b73', dark: '#a3161f' },
  blue: { base: '#3d8bff', light: '#78b0ff', dark: '#1f5fc4' },
  green: { base: '#8fdc3c', light: '#b8f272', dark: '#5ba322' },
  yellow: { base: '#ffc93c', light: '#ffe07a', dark: '#d19a12' },
  pink: { base: '#e35be8', light: '#f28ff5', dark: '#a632ab' },
  orange: { base: '#ff8a2e', light: '#ffb06e', dark: '#c95f10' },
  purple: { base: '#8a5cf6', light: '#b393ff', dark: '#5b33c4' },
  cyan: { base: '#2fd4d4', light: '#79ecec', dark: '#159a9a' },
}
export const COLOR_NAMES = Object.keys(COLORS)

// Shapes are row-major 0/1 matrices. All are 4-connected.
export const SHAPES = {
  '1x1': [[1]],
  '1x2': [[1, 1]],
  '2x1': [[1], [1]],
  '1x3': [[1, 1, 1]],
  '3x1': [[1], [1], [1]],
  '2x2': [[1, 1], [1, 1]],
  '2x3': [[1, 1, 1], [1, 1, 1]],
  '3x2': [[1, 1], [1, 1], [1, 1]],
  L: [[1, 1], [1, 0], [1, 0]],
  J: [[1, 1], [0, 1], [0, 1]],
  Lr: [[1, 0], [1, 0], [1, 1]],
  T: [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
  Tsm: [[1, 1, 1], [0, 1, 0]],
  S: [[0, 1, 1], [1, 1, 0]],
  P: [[1, 1], [1, 1], [1, 0]],
}

export function shapeCells(shape) {
  const cells = []
  shape.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([r, c]) }))
  return cells
}

const shapeH = (shape) => shape.length
const shapeW = (shape) => Math.max(...shape.map((r) => r.length))

// ---------------------------------------------------------------------------
// State

/** Normalize a level definition into a mutable-free game state. */
export function createState(level) {
  return {
    width: level.width,
    height: level.height,
    exits: level.exits.map((e) => ({ ...e })),
    blocks: level.blocks.map((b, i) => ({
      ...b,
      label: b.label || labelFor(i),
      cells: shapeCells(b.shape),
    })),
    escaped: [],
    moves: 0,
  }
}

function labelFor(i) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return i < 26 ? A[i] : A[Math.floor(i / 26) - 1] + A[i % 26]
}

export function absCells(block, dRow = 0, dCol = 0) {
  return block.cells.map(([r, c]) => [block.row + r + dRow, block.col + c + dCol])
}

function buildGrid(state, skipId) {
  const g = new Array(state.width * state.height).fill(null)
  for (const b of state.blocks) {
    if (b.id === skipId) continue
    for (const [r, c] of absCells(b)) g[r * state.width + c] = b.id
  }
  return g
}

const inBounds = (s, r, c) => r >= 0 && r < s.height && c >= 0 && c < s.width

/** The exit this block could leave through when sliding in `dir`, if any. */
function matchingExit(state, block, dir) {
  for (const e of state.exits) {
    if (e.color !== block.color || SIDE_TO_DIR[e.side] !== dir) continue
    const cells = absCells(block)
    const lo = e.position
    const hi = e.position + e.size - 1
    const horizontal = e.side === 'left' || e.side === 'right'
    const fits = cells.every(([r, c]) => {
      const v = horizontal ? r : c
      return v >= lo && v <= hi
    })
    if (fits) return e
  }
  return null
}

/**
 * How far `blockId` can slide in `dir` while staying on the board, and whether
 * it can leave through its matching exit (clear path to the edge for every
 * cell, and the whole cross-section inside the opening).
 */
export function slideInfo(state, blockId, dir) {
  const b = state.blocks.find((x) => x.id === blockId)
  if (!b) return { dist: 0, canExit: false, exitId: null, blockedBy: null }
  const [dr, dc] = DIRS[dir]
  const g = buildGrid(state, blockId)

  let k = 0
  let blockedBy = null
  for (;;) {
    const n = k + 1
    let ok = true
    for (const [r, c] of absCells(b, dr * n, dc * n)) {
      if (!inBounds(state, r, c)) { ok = false; break }
      const occ = g[r * state.width + c]
      if (occ) { ok = false; blockedBy = occ; break }
    }
    if (!ok) break
    k = n
  }

  const exit = matchingExit(state, b, dir)
  let canExit = false
  if (exit) {
    canExit = absCells(b).every(([r, c]) => {
      let rr = r + dr
      let cc = c + dc
      while (inBounds(state, rr, cc)) {
        if (g[rr * state.width + cc]) return false
        rr += dr
        cc += dc
      }
      return true
    })
  }
  return { dist: k, canExit, exitId: canExit ? exit.id : null, blockedBy }
}

/** All currently useful moves: one entry per (block, dir) with room to move. */
export function legalMoves(state) {
  const out = []
  for (const b of state.blocks) {
    for (const dir of DIR_LIST) {
      const info = slideInfo(state, b.id, dir)
      if (info.dist > 0 || info.canExit) out.push({ blockId: b.id, label: b.label, dir, ...info })
    }
  }
  return out
}

/**
 * Apply a move. `dist` is a positive integer or 'exit'. Returns
 * { ok, state, exited, error } — never mutates the input state.
 */
export function applyMove(state, blockId, dir, dist) {
  const b = state.blocks.find((x) => x.id === blockId)
  if (!b) return { ok: false, error: `No block ${blockId} on the board` }
  if (!DIRS[dir]) return { ok: false, error: `Unknown direction ${dir}` }
  const info = slideInfo(state, blockId, dir)

  if (dist === 'exit' || (info.canExit && Number(dist) > info.dist)) {
    if (!info.canExit) {
      return { ok: false, error: `${b.label} cannot exit ${dir}: no matching ${b.color} exit in line, or the path is blocked` }
    }
    return {
      ok: true,
      exited: true,
      state: {
        ...state,
        blocks: state.blocks.filter((x) => x.id !== blockId),
        escaped: [...state.escaped, blockId],
        moves: state.moves + 1,
      },
    }
  }

  const n = Number(dist)
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: `Distance must be a positive whole number` }
  if (n > info.dist) return { ok: false, error: `${b.label} can only move ${dir} ${info.dist} cell(s)` }
  const [dr, dc] = DIRS[dir]
  return {
    ok: true,
    exited: false,
    state: {
      ...state,
      blocks: state.blocks.map((x) => (x.id === blockId ? { ...x, row: x.row + dr * n, col: x.col + dc * n } : x)),
      moves: state.moves + 1,
    },
  }
}

export const isSolved = (state) => state.blocks.length === 0

// ---------------------------------------------------------------------------
// Solver — best-first search over slide moves on a compact representation.

export function solve(level, { maxStates = 40000 } = {}) {
  const W = level.width
  const H = level.height
  const blocks = level.blocks.map((b) => ({ ...b, cells: shapeCells(b.shape) }))
  const n = blocks.length

  // Per block per dir: candidate exits (color + side match); fit checked at runtime.
  const exitCands = blocks.map((b) => {
    const m = {}
    for (const dir of DIR_LIST) {
      m[dir] = level.exits.filter((e) => e.color === b.color && SIDE_TO_DIR[e.side] === dir)
    }
    return m
  })

  const start = []
  for (const b of blocks) start.push(b.row, b.col)
  const DEAD = -99
  const keyOf = (pos) => pos.join(',')

  const grid = new Int16Array(W * H)
  const fillGrid = (pos) => {
    grid.fill(-1)
    for (let i = 0; i < n; i++) {
      const r0 = pos[2 * i]
      if (r0 === DEAD) continue
      const c0 = pos[2 * i + 1]
      for (const [r, c] of blocks[i].cells) grid[(r0 + r) * W + c0 + c] = i
    }
  }
  const free = (i, r, c) => {
    if (r < 0 || r >= H || c < 0 || c >= W) return false
    const v = grid[r * W + c]
    return v === -1 || v === i
  }

  const expand = (pos) => {
    fillGrid(pos)
    const moves = []
    for (let i = 0; i < n; i++) {
      const r0 = pos[2 * i]
      if (r0 === DEAD) continue
      const c0 = pos[2 * i + 1]
      const cells = blocks[i].cells
      for (const dir of DIR_LIST) {
        const [dr, dc] = DIRS[dir]
        // exit check
        for (const e of exitCands[i][dir]) {
          const horizontal = e.side === 'left' || e.side === 'right'
          let fits = true
          for (const [r, c] of cells) {
            const v = horizontal ? r0 + r : c0 + c
            if (v < e.position || v > e.position + e.size - 1) { fits = false; break }
          }
          if (!fits) continue
          let clear = true
          for (const [r, c] of cells) {
            let rr = r0 + r + dr
            let cc = c0 + c + dc
            while (rr >= 0 && rr < H && cc >= 0 && cc < W) {
              const v = grid[rr * W + cc]
              if (v !== -1 && v !== i) { clear = false; break }
              rr += dr
              cc += dc
            }
            if (!clear) break
          }
          if (clear) moves.push({ i, dir, dist: 'exit' })
          break
        }
        // in-board slides
        for (let k = 1; ; k++) {
          let ok = true
          for (const [r, c] of cells) {
            if (!free(i, r0 + r + dr * k, c0 + c + dc * k)) { ok = false; break }
          }
          if (!ok) break
          moves.push({ i, dir, dist: k })
        }
      }
    }
    return moves
  }

  const alive = (pos) => {
    let a = 0
    for (let i = 0; i < n; i++) if (pos[2 * i] !== DEAD) a++
    return a
  }

  // binary min-heap keyed by priority
  const heap = []
  const push = (item) => {
    heap.push(item)
    let j = heap.length - 1
    while (j > 0) {
      const p = (j - 1) >> 1
      if (heap[p].pri <= heap[j].pri) break
      ;[heap[p], heap[j]] = [heap[j], heap[p]]
      j = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let j = 0
      for (;;) {
        const l = 2 * j + 1
        const r = l + 1
        let m = j
        if (l < heap.length && heap[l].pri < heap[m].pri) m = l
        if (r < heap.length && heap[r].pri < heap[m].pri) m = r
        if (m === j) break
        ;[heap[m], heap[j]] = [heap[j], heap[m]]
        j = m
      }
    }
    return top
  }

  const parent = new Map()
  const startKey = keyOf(start)
  parent.set(startKey, null)
  push({ pos: start, g: 0, pri: alive(start) * 1000 })
  let explored = 0

  while (heap.length && explored < maxStates) {
    const { pos, g } = pop()
    explored++
    if (alive(pos) === 0) {
      const path = []
      let k = keyOf(pos)
      while (parent.get(k)) {
        const { prev, move } = parent.get(k)
        path.push(move)
        k = prev
      }
      path.reverse()
      return { solved: true, moves: path, explored }
    }
    const curKey = keyOf(pos)
    for (const mv of expand(pos)) {
      const next = pos.slice()
      if (mv.dist === 'exit') {
        next[2 * mv.i] = DEAD
        next[2 * mv.i + 1] = DEAD
      } else {
        const [dr, dc] = DIRS[mv.dir]
        next[2 * mv.i] += dr * mv.dist
        next[2 * mv.i + 1] += dc * mv.dist
      }
      const nk = keyOf(next)
      if (parent.has(nk)) continue
      parent.set(nk, { prev: curKey, move: { blockId: blocks[mv.i].id, label: blocks[mv.i].label, dir: mv.dir, dist: mv.dist } })
      push({ pos: next, g: g + 1, pri: alive(next) * 1000 + g + 1 })
    }
  }
  return { solved: false, moves: null, explored }
}

// ---------------------------------------------------------------------------
// Level generation — random placement, then solver validation.

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)) // inclusive

function shuffle(rng, arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function placeExits(rng, cfg, W, H) {
  const colors = shuffle(rng, COLOR_NAMES).slice(0, cfg.exits)
  const sides = []
  const order = shuffle(rng, ['left', 'right', 'top', 'bottom'])
  for (let i = 0; i < cfg.exits; i++) sides.push(order[i % 4])
  const taken = { left: [], right: [], top: [], bottom: [] }
  const exits = []
  for (let i = 0; i < cfg.exits; i++) {
    const side = sides[i]
    const len = side === 'left' || side === 'right' ? H : W
    const size = pick(rng, cfg.exitSizes)
    let placed = null
    for (let t = 0; t < 40 && !placed; t++) {
      const position = randInt(rng, 1, len - size - 1)
      const clash = taken[side].some(([p, s]) => position <= p + s && p <= position + size)
      if (!clash) placed = position
    }
    if (placed == null) return null
    taken[side].push([placed, size])
    exits.push({ id: `exit-${colors[i]}`, color: colors[i], side, position: placed, size })
  }
  return exits
}

function crossFits(shape, exit) {
  return exit.side === 'left' || exit.side === 'right' ? shapeH(shape) <= exit.size : shapeW(shape) <= exit.size
}

function tryPlace(rng, cfg, W, H, occ, shape, exit) {
  const h = shapeH(shape)
  const w = shapeW(shape)
  const cells = shapeCells(shape)
  for (let t = 0; t < 80; t++) {
    let row = randInt(rng, 0, H - h)
    let col = randInt(rng, 0, W - w)
    if (rng() < cfg.laneProb) {
      if (exit.side === 'left' || exit.side === 'right') row = randInt(rng, exit.position, exit.position + exit.size - h)
      else col = randInt(rng, exit.position, exit.position + exit.size - w)
    }
    if (cells.every(([r, c]) => !occ[(row + r) * W + col + c])) return { row, col }
  }
  return null
}

/**
 * Generate a level for `cfg`, validated solvable. Deterministic per seed so
 * both AI players (and replays) face the identical board.
 */
export function generateLevel(cfg, seed) {
  const rng = mulberry32(seed)
  const W = cfg.size
  const H = cfg.size
  let best = null

  for (let attempt = 0; attempt < cfg.attempts; attempt++) {
    const exits = placeExits(rng, cfg, W, H)
    if (!exits) continue
    const occ = new Array(W * H).fill(false)
    const blocks = []
    let failed = false
    for (let i = 0; i < cfg.blocks; i++) {
      const exit = exits[i % exits.length]
      const shapes = cfg.shapes.map((s) => SHAPES[s]).filter((s) => crossFits(s, exit))
      const shape = pick(rng, shapes)
      const at = tryPlace(rng, cfg, W, H, occ, shape, exit)
      if (!at) { failed = true; break }
      for (const [r, c] of shapeCells(shape)) occ[(at.row + r) * W + at.col + c] = true
      blocks.push({ id: `b${i}`, label: labelFor(i), color: exit.color, shape, row: at.row, col: at.col, targetExit: exit.id })
    }
    if (failed) continue

    const level = { width: W, height: H, exits, blocks }
    const st = createState(level)
    const freeNow = st.blocks.filter((b) => DIR_LIST.some((d) => slideInfo(st, b.id, d).canExit)).length
    if (freeNow < 1 || freeNow > cfg.maxFree) continue

    const sol = solve(level, { maxStates: cfg.maxStates })
    if (!sol.solved) continue
    const candidate = { ...level, par: sol.moves.length, solution: sol.moves }
    if (!best || candidate.par > best.par) best = candidate
    if (sol.moves.length >= cfg.minMoves) return { ...candidate, name: cfg.name, index: cfg.index }
  }
  if (best) return { ...best, name: cfg.name, index: cfg.index }
  throw new Error(`Could not generate a solvable level for ${cfg.name}`)
}

// ---------------------------------------------------------------------------
// Level ladder (data-driven). Board size, block count, exits and shape pool
// all grow with the level.

const BASIC = ['1x2', '2x1', '1x3', '3x1', '2x2']
const MID = [...BASIC, 'L', 'J', 'Lr', '2x3', '3x2']
const ADV = [...MID, 'T', 'Tsm', 'S', 'P', '1x1']

export const LEVELS = [
  { index: 1, name: 'Tutorial', size: 10, blocks: 4, exits: 2, shapes: BASIC, exitSizes: [2, 3], laneProb: 0.7, maxFree: 2, minMoves: 4 },
  { index: 2, name: 'Warm-up', size: 10, blocks: 6, exits: 3, shapes: BASIC, exitSizes: [2, 3], laneProb: 0.55, maxFree: 2, minMoves: 7 },
  { index: 3, name: 'Corridors', size: 10, blocks: 8, exits: 4, shapes: MID, exitSizes: [2, 3], laneProb: 0.5, maxFree: 2, minMoves: 10 },
  { index: 4, name: 'Gridlock', size: 10, blocks: 10, exits: 5, shapes: MID, exitSizes: [2, 3], laneProb: 0.45, maxFree: 2, minMoves: 13 },
  { index: 5, name: 'Big Board', size: 12, blocks: 12, exits: 5, shapes: ADV, exitSizes: [2, 3], laneProb: 0.45, maxFree: 2, minMoves: 16 },
  { index: 6, name: 'Chain Reaction', size: 12, blocks: 14, exits: 6, shapes: ADV, exitSizes: [2, 3], laneProb: 0.4, maxFree: 2, minMoves: 19 },
  { index: 7, name: 'Labyrinth', size: 14, blocks: 16, exits: 7, shapes: ADV, exitSizes: [2, 3], laneProb: 0.4, maxFree: 3, minMoves: 22 },
  { index: 8, name: 'Grandmaster', size: 16, blocks: 18, exits: 8, shapes: ADV, exitSizes: [2, 3], laneProb: 0.4, maxFree: 3, minMoves: 25 },
].map((l) => ({ attempts: 120, maxStates: 30000, ...l }))

const LEVEL_SEED_BASE = 7919
const cache = new Map()

export function getLevel(index, variant = 0) {
  const key = `${index}:${variant}`
  if (!cache.has(key)) {
    const cfg = LEVELS.find((l) => l.index === index)
    cache.set(key, generateLevel(cfg, LEVEL_SEED_BASE * index + variant * 104729))
  }
  return cache.get(key)
}

// ---------------------------------------------------------------------------
// Text rendering for LLM players.

// What a human sees at a glance, spelled out for a text-only player: is the
// block lined up with its exit opening, and which blocks stand in the way.
function exitStatus(state, b, g, labelById) {
  const exit = state.exits.find((e) => e.color === b.color)
  if (!exit) return 'has no exit'
  const cells = absCells(b)
  const horizontal = exit.side === 'left' || exit.side === 'right'
  const vals = cells.map(([r, c]) => (horizontal ? r : c))
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const openLo = exit.position
  const openHi = exit.position + exit.size - 1
  const axis = horizontal ? 'rows' : 'cols'
  const where = `${exit.color.toUpperCase()} exit (${exit.side} edge, ${axis} ${openLo}-${openHi})`
  if (lo < openLo || hi > openHi) {
    const need = lo < openLo ? openLo - lo : openHi - hi
    const dir = horizontal ? (need > 0 ? 'down' : 'up') : (need > 0 ? 'right' : 'left')
    const fits = hi - lo <= openHi - openLo
    return fits
      ? `needs the ${where}; NOT aligned (block ${axis} ${lo}-${hi}) - it must first move ${dir} ${Math.abs(need)}`
      : `needs the ${where}; block is too wide for it`
  }
  const [dr, dc] = DIRS[SIDE_TO_DIR[exit.side]]
  const blockers = new Set()
  for (const [r, c] of cells) {
    let rr = r + dr
    let cc = c + dc
    while (inBounds(state, rr, cc)) {
      const occ = g[rr * state.width + cc]
      if (occ && occ !== b.id) blockers.add(labelById[occ])
      rr += dr
      cc += dc
    }
  }
  return blockers.size
    ? `needs the ${where}; ALIGNED, but the path is blocked by ${[...blockers].join(', ')}`
    : `needs the ${where}; ALIGNED and the path is clear - it can EXIT now`
}

export function describeBlockShape(b) {
  return `${shapeH(b.shape)}x${shapeW(b.shape)}`
}

export function boardToText(state) {
  const W = state.width
  const H = state.height
  const rows = []
  const g = buildGrid(state, null)
  const labelById = Object.fromEntries(state.blocks.map((b) => [b.id, b.label]))
  const header = '     ' + Array.from({ length: W }, (_, c) => String(c % 10)).join(' ')
  rows.push(header)
  for (let r = 0; r < H; r++) {
    const line = Array.from({ length: W }, (_, c) => {
      const id = g[r * W + c]
      return id ? labelById[id].slice(-1) : '.'
    }).join(' ')
    rows.push(`${String(r).padStart(3)}  ${line}`)
  }
  const exits = state.exits.map((e) => {
    const axis = e.side === 'left' || e.side === 'right' ? 'rows' : 'cols'
    return `- ${e.color.toUpperCase()} exit on the ${e.side.toUpperCase()} edge, ${axis} ${e.position}-${e.position + e.size - 1}`
  })
  const blocks = state.blocks.map((b) => {
    const cells = absCells(b)
    const rs = cells.map((c) => c[0])
    const cs = cells.map((c) => c[1])
    const base = `- ${b.label} (${b.color}, ${describeBlockShape(b)}, ${b.cells.length} cells) spans rows ${Math.min(...rs)}-${Math.max(...rs)}, cols ${Math.min(...cs)}-${Math.max(...cs)}`
    return `${base} -> ${exitStatus(state, b, g, labelById)}`
  })
  const moves = []
  for (const b of state.blocks) {
    const parts = []
    for (const dir of DIR_LIST) {
      const i = slideInfo(state, b.id, dir)
      if (i.dist > 0 || i.canExit) parts.push(`${dir} up to ${i.dist}${i.canExit ? ' (or EXIT)' : ''}`)
    }
    moves.push(`- ${b.label}: ${parts.length ? parts.join(', ') : 'stuck'}`)
  }
  return {
    board: rows.join('\n'),
    exits: exits.join('\n'),
    blocks: blocks.join('\n'),
    legal: moves.join('\n'),
  }
}
