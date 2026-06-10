/**
 * patchworkMath.ts
 * Pure math for the Patchwork tile-placement puzzle mode.
 * Replaces: PatchworkGameController + TileManager coordinate logic.
 *
 * Zero React dependencies — fully unit testable.
 *
 * ─── Worklet annotations ──────────────────────────────────────────────────────
 *   Functions that are called from Reanimated gesture worklets carry the
 *   'worklet' directive so the Reanimated Babel plugin compiles them into the
 *   UI-thread JS runtime. Functions that only run on the JS thread (tile
 *   generation, win checks over JS arrays) do NOT carry the directive.
 *
 * ─── Coordinate space ─────────────────────────────────────────────────────────
 *   All pixel coordinates are board-local (board top-left = 0,0). The board is
 *   square (boardSize × boardSize). Cell pixel frames are derived from the board
 *   size and the grid config — no screen-level offsets needed here.
 *
 * ─── Key difference from Jigsaw ───────────────────────────────────────────────
 *   Jigsaw uses pixel-proximity snap (isPieceNearTarget — continuous tolerance).
 *   Patchwork uses cell-based snap (pixelToGridCell — discrete, no tolerance).
 *   A tile snaps if and only if the finger lifts inside the correct grid cell.
 */

import type { GameMode } from '../../types/models';
import type { PatchworkTile, TilePosition, PatchworkGridConfig, Frame } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GRID CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map a GameMode to grid dimensions.
 * Original: GameMode enum (Easy=2×2, Medium=3×3, Hard=4×4 in GameManager.h).
 */
export function patchworkGridConfigForMode(mode: GameMode): PatchworkGridConfig {
  const configs: Record<GameMode, PatchworkGridConfig> = {
    easy:   { cols: 2, rows: 2 },
    medium: { cols: 3, rows: 3 },
    hard:   { cols: 4, rows: 4 },
  };
  return configs[mode];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COORDINATE CONVERSIONS  (both called from worklets → 'worklet' directive)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a pixel position to a grid cell, clamped to grid bounds.
 * Used in onUpdate (isNearTarget) and onEnd (snap decision).
 *
 * @param posX        position x in board-local coordinates
 * @param posY        position y in board-local coordinates
 * @param boardWidth  total board width in pixels
 * @param boardHeight total board height in pixels
 * @param config      grid dimensions
 */
export function pixelToGridCell(
  posX:        number,
  posY:        number,
  boardWidth:  number,
  boardHeight: number,
  config:      PatchworkGridConfig,
): TilePosition {
  'worklet';
  const col = Math.floor((posX / boardWidth)  * config.cols);
  const row = Math.floor((posY / boardHeight) * config.rows);
  return {
    col: Math.min(Math.max(col, 0), config.cols - 1),
    row: Math.min(Math.max(row, 0), config.rows - 1),
  };
}

/**
 * Convert a grid cell (row, col) to its pixel frame on the board.
 * The inverse of pixelToGridCell — used in onEnd to compute the snap
 * animation destination.
 *
 * @param row         grid row (0 = top)
 * @param col         grid column (0 = left)
 * @param boardWidth  total board width in pixels
 * @param boardHeight total board height in pixels
 * @param config      grid dimensions
 */
export function cellToPixelFrame(
  row:         number,
  col:         number,
  boardWidth:  number,
  boardHeight: number,
  config:      PatchworkGridConfig,
): Frame {
  'worklet';
  const cellW = boardWidth  / config.cols;
  const cellH = boardHeight / config.rows;
  return { x: col * cellW, y: row * cellH, width: cellW, height: cellH };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PROXIMITY CHECK  (called from worklet → 'worklet' directive)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns true if the drag position (posX, posY) is currently over the tile's
 * correct target cell. Used to drive the isNearTarget SharedValue in onUpdate,
 * which in turn triggers the slot-highlight visual.
 *
 * Cell membership is exact (pixelToGridCell discretises with floor), so there
 * is no tolerance parameter — you're either in the cell or you're not.
 */
export function isTileOverTarget(
  posX:        number,
  posY:        number,
  target:      TilePosition,
  boardWidth:  number,
  boardHeight: number,
  config:      PatchworkGridConfig,
): boolean {
  'worklet';
  const cell = pixelToGridCell(posX, posY, boardWidth, boardHeight, config);
  return cell.row === target.row && cell.col === target.col;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PLACEMENT CHECKS  (JS-thread only — operate on tile descriptor arrays)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns true if a tile's current cell matches its target cell.
 * Called on the JS thread (e.g. for rendering, not in gesture worklets).
 * Replaces the position-comparison logic in PatchworkGameController.
 */
export function isTileCorrectlyPlaced(tile: PatchworkTile): boolean {
  if (!tile.current) return false;
  return tile.current.row === tile.target.row &&
         tile.current.col  === tile.target.col;
}

/**
 * Returns true if every tile is in its correct position.
 * Replaces the isLevelCompleted loop in PatchworkGameController.
 * Not a worklet — uses Array.every which is JS-only.
 */
export function isPatchworkComplete(tiles: ReadonlyArray<PatchworkTile>): boolean {
  return tiles.every(isTileCorrectlyPlaced);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. TILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate the full set of PatchworkTile descriptors for a level.
 *
 * Each tile gets:
 *   target      / targetFrame  — computed from its row-major ID and the grid.
 *   initialFrame               — shuffled starting pixel position (Fisher-Yates
 *                                over the set of target frames, same as Jigsaw).
 *   current = null             — all tiles start unplaced (in tray).
 *   isPlaced = false
 *
 * @param imageKeys  asset key per tile (length must equal config.cols * config.rows)
 * @param boardFrame the board's pixel frame (x,y = 0,0 in board-local space)
 * @param config     grid dimensions
 *
 * Replaces: tile-setup and shuffle logic in PatchworkGameController.
 */
export function generateTiles(
  imageKeys:  string[],
  boardFrame: Frame,
  config:     PatchworkGridConfig,
): PatchworkTile[] {
  const { cols } = config;
  const cellW = boardFrame.width  / config.cols;
  const cellH = boardFrame.height / config.rows;

  const tiles: PatchworkTile[] = imageKeys.map((key, id) => {
    const row = Math.floor(id / cols);
    const col = id % cols;
    const targetFrame: Frame = {
      x:      boardFrame.x + col * cellW,
      y:      boardFrame.y + row * cellH,
      width:  cellW,
      height: cellH,
    };
    return {
      id,
      imageKey:     key,
      target:       { row, col },
      targetFrame,
      initialFrame: targetFrame,    // will be overwritten by shuffle below
      current:      null,
      isPlaced:     false,
    };
  });

  // Shuffle initial positions (Fisher-Yates over target frames).
  // The target frames themselves stay fixed; only the starting positions shuffle.
  const frames = tiles.map((t) => ({ ...t.targetFrame }));
  for (let i = frames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frames[i], frames[j]] = [frames[j]!, frames[i]!];
  }

  return tiles.map((t, i) => ({ ...t, initialFrame: frames[i]! }));
}
