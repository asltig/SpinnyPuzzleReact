/**
 * gameConstants.ts
 * Numeric and flag constants extracted from the original Objective-C source.
 * Every constant references its origin for traceability.
 */

// ─────────────────────────────────────────────
// Spinny ring configuration
// ─────────────────────────────────────────────

/** Number of concentric rings per Spinny level.
 *  Original: #define circleCounts 4  (hardcoded in SPGamePlayViewController.m) */
export const RING_COUNT = 4;

/** Ring count for the very first Spinny level — fewer rings makes the
 *  drag-to-rotate tutorial (RingRotationTutorial) easier to follow. */
export const TUTORIAL_RING_COUNT = 3;

/** Win snap tolerance in degrees.
 *  Original: (imageAngle >= -10.0f && imageAngle <= 10.0f) || imageAngle >= 350.0f */
export const SNAP_TOLERANCE_DEG = 10;

/** Min random start angle for a ring (ensures it can't start already solved).
 *  Original: [self randomNumberBetween:30.0f maxNumber:330.0f] */
export const RANDOM_ANGLE_MIN = 30;
export const RANDOM_ANGLE_MAX = 330;

/** Ring width divisor for phones vs tablets.
 *  Original: circleWidth = screenHeight/circleCounts/1.25  (iPhone)
 *           circleWidth = screenHeight/circleCounts/1.55  (iPad) */
export const RING_WIDTH_DIVISOR_PHONE  = 1.25;
export const RING_WIDTH_DIVISOR_TABLET = 1.55;

/** Snap animation duration in ms.
 *  Original: [UIView animateWithDuration:0.3f ...] in CustomControl.finalAngle: */
export const SNAP_ANIMATION_MS = 280;

/** Scale-pulse duration when a ring snaps (grow → return). */
export const SNAP_PULSE_MS = 350;

/** Scale factor at the peak of the snap pulse. */
export const SNAP_PULSE_SCALE = 1.09;

/** Set to true to show angle labels and hit-zone circles in gameplay. */
export const DEBUG_SPINNY = false;

/**
 * Set to true to enable Jigsaw gesture lifecycle assertions and trace logs.
 * Each onFinalize fires assertPieceClean() which verifies that isActive,
 * isNearTarget, and scale are in their correct post-gesture states.
 * Always false in production (wrapped in __DEV__ at call sites).
 */
export const DEBUG_JIGSAW = false;

/**
 * Set to true to enable Patchwork gesture lifecycle assertions and trace logs.
 * Each onFinalize fires assertTileClean() which verifies that isActive,
 * isNearTarget, hasTargetPosition, and scale are in correct post-gesture states.
 * Always false in production (wrapped in __DEV__ at call sites).
 */
export const DEBUG_PATCHWORK = false;

/** Delay (ms) between win detection and navigating to LevelCompleteScreen.
 *  Lets the board's win-state visual register before the screen changes. */
export const LEVEL_COMPLETE_NAVIGATE_DELAY_MS = 200;

/** Auto-advance delay (ms) on LevelCompleteScreen before loading next level.
 *  Shown as a draining progress bar; cancelled on any button press. */
export const AUTO_ADVANCE_DELAY_MS = 2500;

/** Level entry animation duration in ms.
 *  Original: [UIView animateWithDuration:0.5f ...] in levelStartAnimation */
export const LEVEL_ENTER_ANIMATION_MS = 500;

/** Win screen fade-in duration in ms.
 *  Original: [UIView animateWithDuration:0.9f ...] in completeLevel */
export const WIN_FADE_ANIMATION_MS = 900;

/** Minimum rotation delta (degrees) before haptic/sound fires.
 *  Original: if (fabs(self.circle.imageAngle - imageAngle) > 3) */
export const HAPTIC_THRESHOLD_DEG = 3;

// ─────────────────────────────────────────────
// Hints system
// ─────────────────────────────────────────────

/** Starting hint count for new users.
 *  Original: #define HINTS_DEFAULT_COUNT 5 */
export const HINTS_DEFAULT_COUNT = 5;

/** Hints granted after watching a rewarded ad.
 *  Original: #define HINTS_ADDED_COUNT 5 */
export const HINTS_ADDED_COUNT = 5;

/** Hints granted after submitting feedback.
 *  Original: #define HINTS_FEEDBACK_ADDED_COUNT 10 */
export const HINTS_FEEDBACK_ADDED_COUNT = 10;

// ─────────────────────────────────────────────
// Free content limits
// ─────────────────────────────────────────────

/** Free Jigsaw levels (j1–j7 are bundled; rest require purchase or download).
 *  Original: #define FREE_JIGSAW_COUNT 7 */
export const FREE_JIGSAW_COUNT = 7;

// ─────────────────────────────────────────────
// Server sync
// ─────────────────────────────────────────────

/** Days between full server re-syncs.
 *  Original: #define SERVER_SYNC_DAYS 5 */
export const SERVER_SYNC_DAYS = 5;

// ─────────────────────────────────────────────
// Rating prompt
// ─────────────────────────────────────────────

/** Number of levels completed before the rate-us prompt appears.
 *  Original: #define RATE_COUNTER 5 */
export const RATE_COUNTER = 5;

// ─────────────────────────────────────────────
// Jigsaw snap tolerances per difficulty
// ─────────────────────────────────────────────

export const JIGSAW_SNAP_TOLERANCE: Record<'easy' | 'medium' | 'hard', number> = {
  easy:   40,
  medium: 25,
  hard:   12,
};

// ─────────────────────────────────────────────
// Shared drag + snap UX constants
// Used by Jigsaw and Patchwork (not Spinny, which has no lift-and-drop tiles).
// ─────────────────────────────────────────────

/** Scale factor applied to a tile/piece while it is being held.
 *  1.06 gives a subtle "lift off the table" effect without obscuring neighbors. */
export const DRAG_LIFT_SCALE = 1.06;

/** iOS shadow opacity while a tile/piece is being dragged. */
export const DRAG_SHADOW_OPACITY = 0.52;

/** iOS shadow blur radius while dragging. */
export const DRAG_SHADOW_RADIUS = 18;

/** iOS shadow vertical offset while dragging (px). */
export const DRAG_SHADOW_HEIGHT = 10;

/** Android elevation (dp) while dragging — controls shadow depth + z-order. */
export const DRAG_ELEVATION = 12;

/** Duration (ms) for the near-target slot-highlight fade in/out. */
export const SLOT_HIGHLIGHT_MS = 100;

/** Duration (ms) for the win overlay fade-in after a puzzle is solved.
 *  Applies to both the Jigsaw and Patchwork inline win overlays. */
export const WIN_OVERLAY_MS = 300;
