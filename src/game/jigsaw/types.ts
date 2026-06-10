/**
 * game/jigsaw/types.ts
 * Types for the Jigsaw drag-and-drop puzzle game mode.
 */
import type { PieceSides } from './jigsawShapes';

export interface Frame {
  x: number; y: number; width: number; height: number;
}

export interface JigsawPiece {
  id:         number;
  row:        number;
  col:        number;
  /** Tab shape for each of the four sides (1=out, -1=in, 0=flat). */
  sides:      PieceSides;
  /** Correct canvas top-left position on screen (includes tabW/tabH offsets). */
  targetX:    number;
  targetY:    number;
  /** Initial canvas top-left position in the side panel. */
  panelX:     number;
  panelY:     number;
  panelSide:  'left' | 'right';
  /** Scale when resting in the panel (< 1.0). */
  panelScale: number;
}

export interface JigsawGridConfig {
  cols:          number;
  rows:          number;
  snapTolerance: number;
}

export type JigsawGamePhase = 'idle' | 'playing' | 'completed';