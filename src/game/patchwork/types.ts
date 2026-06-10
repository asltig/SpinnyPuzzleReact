/**
 * game/patchwork/types.ts
 * Types for the Patchwork tile-placement puzzle game mode.
 * Replaces: PatchworkGameController + PatchworkTileView data types.
 */

// ─────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────

/** Axis-aligned rectangle in logical pixels. */
export interface Frame {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

// ─────────────────────────────────────────────
// Grid model
// ─────────────────────────────────────────────

/** A discrete position in the puzzle grid (row-major, 0-indexed). */
export interface TilePosition {
  row: number;
  col: number;
}

/**
 * Full descriptor for one Patchwork tile.
 *
 *   target       — correct grid cell the tile must reach.
 *   targetFrame  — pixel frame of that cell on the board. Used for snap
 *                  animation destination and debug-overlay rendering.
 *   initialFrame — scrambled starting pixel position (set at level generation;
 *                  not updated during play — SharedValues track live position).
 *   current      — grid cell the tile currently occupies; null while the tile
 *                  has not yet been successfully dropped onto any cell.
 *   isPlaced     — true once the tile snaps into its correct cell. Set
 *                  alongside hasTargetPosition on the UI thread in onEnd so
 *                  assertTileClean can verify their logical consistency.
 *
 * Replaces: PatchworkTileView + level-data metadata.
 */
export interface PatchworkTile {
  /** Unique tile ID (0-based, row-major order). */
  id:           number;
  /** Asset key for rendering the tile face (image crop identifier). */
  imageKey:     string;
  /** Correct position on the grid (goal). */
  target:       TilePosition;
  /** Pixel frame of the target cell on the board. */
  targetFrame:  Frame;
  /** Scrambled starting pixel position (randomised at level start). */
  initialFrame: Frame;
  /** Current grid cell (null = not yet placed on board). */
  current:      TilePosition | null;
  /** True once the tile has been snapped into its correct cell. */
  isPlaced:     boolean;
}

/**
 * Grid configuration derived from difficulty.
 * Original: GameMode enum (Easy=2×2, Medium=3×3, Hard=4×4 in GameManager.h).
 */
export interface PatchworkGridConfig {
  cols: number;
  rows: number;
}

export type PatchworkGamePhase = 'idle' | 'playing' | 'completed';
