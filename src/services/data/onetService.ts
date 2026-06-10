/**
 * onetService.ts — Level config matching the original iOS GamePlayDrawer exactly.
 *
 * Grid dimensions come from numberOfCellsForLevel() (total including border) minus 2
 * to get the playable area. Empty cells come from emptySetForLevel(), converted from
 * 1-indexed total-grid coords to 0-indexed playable coords:
 *   playable_r = total_r - 1,  playable_c = total_c - 1
 *
 * emptyCells are stored as "r,c" strings so callers can build a Set<string> cheaply.
 */

export interface OnetLevelConfig {
  level:        number;
  rows:         number;
  cols:         number;
  timerSeconds: number;
  emptyCells:   readonly string[];   // "r,c" in 0-indexed playable grid
}

// Converts original total-grid 1-indexed coords → 0-indexed playable strings
function e(...pairs: [number, number][]): readonly string[] {
  return pairs.map(([r, c]) => `${r - 1},${c - 1}`);
}

const CONFIGS: readonly OnetLevelConfig[] = [
  // Level 0 — 5×5 total → 3×3 playable
  { level: 0,  rows: 3,  cols: 3,  timerSeconds:  45, emptyCells: e([2,2]) },

  // Level 1 — 5×7 total → 3×5 playable
  { level: 1,  rows: 3,  cols: 5,  timerSeconds:  50,
    emptyCells: e([1,1],[3,1],[1,5],[3,5],[2,3]) },

  // Level 2 — 5×7 total → 3×5 playable
  { level: 2,  rows: 3,  cols: 5,  timerSeconds:  55, emptyCells: e([2,3]) },

  // Level 3 — 7×7 total → 5×5 playable
  { level: 3,  rows: 5,  cols: 5,  timerSeconds:  60,
    emptyCells: e([1,1],[1,3],[1,5],[3,3],[5,1],[5,3],[5,5]) },

  // Level 4 — 7×9 total → 5×7 playable
  { level: 4,  rows: 5,  cols: 7,  timerSeconds:  65,
    emptyCells: e([1,2],[1,4],[1,6],[3,4],[5,2],[5,4],[5,6],[1,1],[2,1],[4,1],[5,1],[1,7],[2,7],[4,7],[5,7]) },

  // Level 5 — 7×9 total → 5×7 playable
  { level: 5,  rows: 5,  cols: 7,  timerSeconds:  70,
    emptyCells: e([1,2],[1,6],[3,4],[5,2],[5,6],[1,1],[2,1],[4,1],[5,1],[1,7],[2,7],[4,7],[5,7]) },

  // Level 6 — 7×9 total → 5×7 playable
  { level: 6,  rows: 5,  cols: 7,  timerSeconds:  75,
    emptyCells: e([1,2],[1,6],[3,4],[5,2],[5,6],[1,1],[5,1],[1,7],[5,7]) },

  // Level 7 — 7×9 total → 5×7 playable
  { level: 7,  rows: 5,  cols: 7,  timerSeconds:  80,
    emptyCells: e([1,2],[1,6],[3,4],[5,2],[5,6]) },

  // Level 8 — 7×9 total → 5×7 playable
  { level: 8,  rows: 5,  cols: 7,  timerSeconds:  85, emptyCells: e([3,4]) },

  // Level 9 — 7×10 total → 5×8 playable
  { level: 9,  rows: 5,  cols: 8,  timerSeconds:  90,
    emptyCells: e([3,3],[3,4],[3,5],[3,6]) },

  // Level 10 — 7×10 total → 5×8 playable
  { level: 10, rows: 5,  cols: 8,  timerSeconds:  95, emptyCells: e([3,4],[3,5]) },

  // Level 11 — 7×10 total → 5×8 playable
  { level: 11, rows: 5,  cols: 8,  timerSeconds: 100, emptyCells: [] },

  // Level 12 — 8×10 total → 6×8 playable
  { level: 12, rows: 6,  cols: 8,  timerSeconds: 105,
    emptyCells: e([3,2],[4,3],[3,4],[4,5],[3,6],[4,7]) },

  // Level 13 — 8×10 total → 6×8 playable
  { level: 13, rows: 6,  cols: 8,  timerSeconds: 110,
    emptyCells: e([1,1],[6,1],[1,8],[6,8]) },

  // Level 14 — 8×10 total → 6×8 playable
  { level: 14, rows: 6,  cols: 8,  timerSeconds: 115, emptyCells: [] },

  // Level 15 — 8×12 total → 6×10 playable
  { level: 15, rows: 6,  cols: 10, timerSeconds: 120,
    emptyCells: e([3,5],[3,6],[4,5],[4,6],[1,1],[1,10],[6,1],[6,10]) },

  // Level 16 — 8×12 total → 6×10 playable
  { level: 16, rows: 6,  cols: 10, timerSeconds: 125,
    emptyCells: e([3,5],[3,6],[4,5],[4,6],[2,4],[2,7],[5,4],[5,7]) },

  // Level 17 — 8×12 total → 6×10 playable
  { level: 17, rows: 6,  cols: 10, timerSeconds: 130,
    emptyCells: e([2,4],[2,7],[5,4],[5,7]) },

  // Level 18 — 8×12 total → 6×10 playable
  { level: 18, rows: 6,  cols: 10, timerSeconds: 135,
    emptyCells: e([3,5],[3,6],[4,5],[4,6]) },

  // Level 19 — 8×13 total → 6×11 playable
  { level: 19, rows: 6,  cols: 11, timerSeconds: 140, emptyCells: [] },

  // Level 20 — 8×13 total → 6×11 playable
  { level: 20, rows: 6,  cols: 11, timerSeconds: 145,
    emptyCells: e([1,1],[1,11],[6,1],[6,11],[3,6],[4,6]) },

  // Level 21 — 8×13 total → 6×11 playable
  { level: 21, rows: 6,  cols: 11, timerSeconds: 150,
    emptyCells: e([2,3],[2,9],[3,6],[5,8],[5,4],[5,5],[5,6],[5,7]) },

  // Level 22 — 8×13 total → 6×11 playable
  { level: 22, rows: 6,  cols: 11, timerSeconds: 155,
    emptyCells: e([1,1],[1,11],[6,1],[6,11]) },

  // Level 23 — 8×13 total → 6×11 playable
  { level: 23, rows: 6,  cols: 11, timerSeconds: 160, emptyCells: e([3,6],[4,6]) },

  // Level 24 — 8×13 total → 6×11 playable
  { level: 24, rows: 6,  cols: 11, timerSeconds: 165, emptyCells: [] },

  // Level 25 — 8×14 total → 6×12 playable
  { level: 25, rows: 6,  cols: 12, timerSeconds: 170,
    emptyCells: e([1,1],[1,12],[6,1],[6,12],[3,6],[4,6],[3,7],[4,7]) },

  // Level 26 — 8×14 total → 6×12 playable
  { level: 26, rows: 6,  cols: 12, timerSeconds: 175,
    emptyCells: e([2,5],[5,5],[2,8],[5,8],[3,6],[4,6],[3,7],[4,7]) },

  // Level 27 — 8×14 total → 6×12 playable
  { level: 27, rows: 6,  cols: 12, timerSeconds: 180,
    emptyCells: e([3,2],[4,2],[3,11],[4,11],[2,6],[2,7]) },

  // Level 28 — 8×14 total → 6×12 playable
  { level: 28, rows: 6,  cols: 12, timerSeconds: 185,
    emptyCells: e([3,2],[4,2],[3,11],[4,11]) },

  // Level 29 — 8×14 total → 6×12 playable
  { level: 29, rows: 6,  cols: 12, timerSeconds: 190,
    emptyCells: e([2,5],[5,5],[2,8],[5,8]) },
];

export const ONET_TOTAL_LEVELS = CONFIGS.length;

export function getOnetLevelConfig(level: number): OnetLevelConfig {
  return CONFIGS[level] ?? CONFIGS[CONFIGS.length - 1]!;
}