/**
 * game/spinny/types.ts
 * All types for the Spinny ring-rotation puzzle game mode.
 */

// ─────────────────────────────────────────────
// Game phase — mirrors the implicit state machine in SPGamePlayViewController
// ─────────────────────────────────────────────

export type GamePhase =
  /** Level loaded, waiting for the entry animation to complete. */
  | 'animating_in'
  /** All rings visible and interactive. */
  | 'playing'
  /** A ring is actively being rotated by the user's finger. */
  | 'rotating'
  /** All rings solved — win screen animating in. */
  | 'completed';

// ─────────────────────────────────────────────
// Ring descriptor — geometry for a single concentric ring
// ─────────────────────────────────────────────

/**
 * Static geometry for one ring. Computed once at level start.
 * Mirrors the per-CircleView frame/radius data in createCircles.
 */
export interface RingDescriptor {
  /** 1-based index matching the original's UIView.tag (1 = innermost). */
  id: number;
  /** Outer radius of this ring in logical pixels. */
  outerRadius: number;
  /** Inner radius = outer radius of the next smaller ring (0 for the innermost). */
  innerRadius: number;
  /** Full diameter — the UIView frame width in the original. */
  size: number;
}

// ─────────────────────────────────────────────
// Runtime ring state
// ─────────────────────────────────────────────

/**
 * Mutable per-ring state tracked during gameplay.
 * In the original this was spread across CircleView instance vars (imageAngle, isEnded).
 * Here it is owned by useSpinnyGame's Reanimated shared values.
 */
export interface RingRuntimeState {
  id: number;
  /** Current rotation angle in degrees.
   *  Original: CircleView.imageAngle — initialized random, updated by gesture. */
  angle: number;
  /** True when the ring has snapped to 0° and is locked.
   *  Original: CircleView.isEnded — set YES in CustomControl.finalAngle: */
  isSolved: boolean;
}

// ─────────────────────────────────────────────
// Hit-test result
// ─────────────────────────────────────────────

export interface HitTestResult {
  /** 0-based index into the rings array. -1 = miss. */
  ringIndex: number;
  /** Distance from touch to board center. */
  distance: number;
}

// ─────────────────────────────────────────────
// Gesture event shapes (passed between worklet and JS thread)
// ─────────────────────────────────────────────

export interface RotationEvent {
  /** Ring index that is being rotated. */
  ringIndex: number;
  /** Cumulative angle delta for this gesture in degrees. */
  angleDelta: number;
}

export interface SnapEvent {
  /** Ring index that snapped into place. */
  ringIndex: number;
}
