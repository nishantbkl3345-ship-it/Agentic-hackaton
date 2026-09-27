// Per-level visual tuning for the mission-discovery platformer.
// Surface count/shape comes from AttackConsole's LEVEL_SURFACES at runtime —
// this table only holds difficulty knobs, so it never needs to change when
// a level's surfaces change and adding a level just adds one entry (or none,
// DEFAULT_VISUALS covers it).
export const DEFAULT_VISUALS = { enemyCount: 2, worldWidthPerCheckpoint: 900 }

export const LEVEL_VISUALS = {
  level1: { enemyCount: 1, worldWidthPerCheckpoint: 850 },
  level2: { enemyCount: 2, worldWidthPerCheckpoint: 950 },
  level3: { enemyCount: 2, worldWidthPerCheckpoint: 1100 },
  boss: { enemyCount: 3, worldWidthPerCheckpoint: 1000 },
}

export function getMissionVisuals(levelId) {
  return LEVEL_VISUALS[levelId] || DEFAULT_VISUALS
}
