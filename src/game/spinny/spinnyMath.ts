/**
 * spinnyMath.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure math functions for the Spinny ring-rotation puzzle.
 *
 * Every function marked 'worklet' runs on the Reanimated UI thread —
 * zero bridge crossings during active gesture handling.
 *
 * Every function is 100% pure: no imports, no side effects, no React.
 * This file is fully unit-testable with plain Jest.
 *
 * Original Objective-C source files:
 *   - OneFingerRotationGestureRecognizer.m  (angle math, hit zone)
 *   - CustomControl.m                        (snap logic, win check)
 *   - SPGamePlayViewController.m             (ring geometry, level state)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RingDescriptor, HitTestResult } from './types';
import {
  SNAP_TOLERANCE_DEG,
  RANDOM_ANGLE_MIN,
  RANDOM_ANGLE_MAX,
  RING_COUNT,
  RING_WIDTH_DIVISOR_PHONE,
  RING_WIDTH_DIVISOR_TABLET,
} from '../../constants/gameConstants';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ANGLE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize any angle to [0, 360).
 * Handles negative values and values beyond ±360.
 *
 * Example: -5 → 355,  370 → 10,  0 → 0
 */
export function normalizeAngle(angle: number): number {
  'worklet';
  return ((angle % 360) + 360) % 360;
}

/**
 * Generate a random start angle for a ring in [RANDOM_ANGLE_MIN, RANDOM_ANGLE_MAX].
 * The bounds ensure no ring begins already solved (would be within ±SNAP_TOLERANCE of 0°).
 *
 * Original: float randomNum = [self randomNumberBetween:30.0f maxNumber:330.0f]
 *   in CircleView.initWithFrame: (arc4random_uniform)
 *
 * Not a worklet — only called during level setup on the JS thread.
 */
export function randomStartAngle(): number {
  return RANDOM_ANGLE_MIN + Math.random() * (RANDOM_ANGLE_MAX - RANDOM_ANGLE_MIN);
}

/**
 * Compute the signed angle delta (degrees) as a finger moves from (prevX, prevY)
 * to (currX, currY), both relative to the board center (centerX, centerY).
 *
 * Uses atan2 — same algorithm as the original Objective-C:
 *   CGFloat atanA = atan2(a, b);   // previous vector from center
 *   CGFloat atanB = atan2(c, d);   // current vector from center
 *   return (atanA - atanB) * 180 / M_PI;
 *
 * The result is clamped to [-180, 180] to fix the 12-o'clock wraparound.
 * Original: if (angle > 180) angle -= 360; else if (angle < -180) angle += 360;
 *
 * @param prevX  - previous touch x in board-local coords
 * @param prevY  - previous touch y in board-local coords
 * @param currX  - current touch x in board-local coords
 * @param currY  - current touch y in board-local coords
 * @param cx     - board center x
 * @param cy     - board center y
 * @returns angle delta in degrees, in range [-180, 180]
 */
export function angleDeltaDegrees(
  prevX: number, prevY: number,
  currX: number, currY: number,
  cx: number,    cy: number,
): number {
  'worklet';
  // Vectors from center to previous and current touch positions
  const atanA = Math.atan2(prevX - cx, prevY - cy);
  const atanB = Math.atan2(currX - cx, currY - cy);
  let delta = (atanA - atanB) * (180 / Math.PI);

  // Fix wraparound at the 12-o'clock position
  if (delta > 180)       delta -= 360;
  else if (delta < -180) delta += 360;

  return delta;
}

/**
 * Accumulate a ring's angle with the given delta, keeping the result in (-360, 360].
 *
 * Original ObjC used a single ±360 adjustment which silently broke on fast swipes
 * (delta > 360 in one frame). The modulo fix handles arbitrarily large deltas.
 *
 * Why (-360, 360] and not [0, 360)?
 * We preserve the sign so that isRingSnapped can distinguish "just over 0° clockwise"
 * (positive small value) from "just under 0° counterclockwise" (negative small value),
 * and the 350°-branch of the snap check still works after normalisation.
 *
 * Original: self.circle.imageAngle += angle;
 *   if (self.circle.imageAngle > 360)  self.circle.imageAngle -= 360;
 *   else if (self.circle.imageAngle < -360) self.circle.imageAngle += 360;
 */
export function accumulateAngle(currentAngle: number, delta: number): number {
  'worklet';
  // JS `%` preserves sign, so -400 % 360 = -40 and 400 % 360 = 40. ✓
  return (currentAngle + delta) % 360;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DISTANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Euclidean distance between two 2D points.
 *
 * Original C function in OneFingerRotationGestureRecognizer.m:
 *   CGFloat dx = point1.x - point2.x;
 *   CGFloat dy = point1.y - point2.y;
 *   return sqrt(dx*dx + dy*dy);
 */
export function distanceBetweenPoints(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  'worklet';
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. HIT TESTING — annular ring selection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine which ring (if any) a touch point lands on.
 *
 * Rings are tested outermost-first (largest outerRadius first), matching the
 * original's tag-sorted subview iteration in CustomControl.pointInside:withEvent:
 * combined with CGPathContainsPoint on each ring's circular UIBezierPath.
 *
 * The annular zone check: innerRadius ≤ dist ≤ outerRadius
 * replaces: CGPathContainsPoint(view.bezierPath.CGPath, NULL, pointInB, NO)
 *
 * Solved rings are skipped (replaces the isEnded guard):
 *   if ([(CircleView*)view isEnded]) { return NO; }
 *
 * @param touchX    touch x in RingBoard local coordinates
 * @param touchY    touch y in RingBoard local coordinates
 * @param centerX   center of the ring board
 * @param centerY   center of the ring board
 * @param rings     ring descriptors sorted outermost-first
 * @param solved    per-ring solved flags (same order as rings)
 * @returns HitTestResult — ringIndex = -1 if no ring was hit
 */
export function hitTestRings(
  touchX:  number,
  touchY:  number,
  centerX: number,
  centerY: number,
  rings:   ReadonlyArray<Pick<RingDescriptor, 'outerRadius' | 'innerRadius'>>,
  solved:  ReadonlyArray<boolean>,
): HitTestResult {
  'worklet';
  const dist = distanceBetweenPoints(touchX, touchY, centerX, centerY);

  for (let i = 0; i < rings.length; i++) {
    if (solved[i]) continue;  // skip solved rings — isEnded guard

    const ring = rings[i]!;
    if (dist >= ring.innerRadius && dist <= ring.outerRadius) {
      return { ringIndex: i, distance: dist };
    }
  }

  return { ringIndex: -1, distance: dist };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. WIN CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a single ring has been rotated to its target (0°) within tolerance.
 *
 * Exact port of the snap check in CustomControl.finalAngle: (CustomControl.m):
 *   if ((self.circle.imageAngle >= -10.0f && self.circle.imageAngle <= 10.0f)
 *       || self.circle.imageAngle >= 350.0f)
 *
 * The >= 350 branch handles the case where the ring overshot 360 and wrapped
 * around to a positive value near 360 — equivalent to being within 10° of 0.
 *
 * Works on the raw un-normalized angle (handles e.g. -5° directly),
 * then also checks the normalized value to catch 355° → solved.
 */
export function isRingSnapped(angle: number): boolean {
  'worklet';
  // Direct range (handles -10° to +10°, i.e. negative angles near 0)
  if (angle >= -SNAP_TOLERANCE_DEG && angle <= SNAP_TOLERANCE_DEG) return true;
  // Normalized check (handles 350°–360° range after positive accumulation)
  const normalized = normalizeAngle(angle);
  return normalized >= (360 - SNAP_TOLERANCE_DEG) || normalized <= SNAP_TOLERANCE_DEG;
}

/**
 * Check if all rings have been solved.
 * Called in circlePlacedToCorrectPosition: after each individual snap.
 *
 * Original: iterate arrCircles, check !circle.isEnded on each.
 *   BOOL isLevelCompleted = YES;
 *   for (CircleView *circle in arrCircles) {
 *     if (!circle.isEnded) { isLevelCompleted = NO; break; }
 *   }
 */
export function isLevelComplete(solvedFlags: ReadonlyArray<boolean>): boolean {
  'worklet';
  for (let i = 0; i < solvedFlags.length; i++) {
    if (!solvedFlags[i]) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RING GEOMETRY — compute layout for all rings
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the full descriptor set for all rings given a board size.
 *
 * Original geometry calculation (SPGamePlayViewController.createPuzzleCircles /
 * createCircles, iPhone branch):
 *   circleWidth = screenHeight / circleCounts / 1.25
 *   for i from circleCounts down to 1:
 *     frame = CGRectMake(
 *       (control.width - circleWidth * i) / 2,
 *       (control.height - circleWidth * i) / 2,
 *       circleWidth * i,
 *       circleWidth * i
 *     )
 *
 * Returns rings sorted outermost-first (index 0 = largest), matching the
 * hit-test order expected by hitTestRings.
 *
 * @param boardSize  full diameter of the ring board in logical pixels
 * @param ringCount  number of rings (default: RING_COUNT = 4)
 * @param isTablet   uses divisor 1.55 instead of 1.25 for iPads
 */
export function computeRingDescriptors(
  boardSize: number,
  ringCount: number = RING_COUNT,
  isTablet  = false,
): RingDescriptor[] {
  const divisor   = isTablet ? RING_WIDTH_DIVISOR_TABLET : RING_WIDTH_DIVISOR_PHONE;
  const ringWidth = boardSize / ringCount / divisor;

  // Build innermost-first (id 1 … ringCount), then reverse for outermost-first array
  const rings: RingDescriptor[] = [];
  for (let id = 1; id <= ringCount; id++) {
    const outerRadius = (ringWidth * id) / 2;
    const innerRadius = (ringWidth * (id - 1)) / 2;
    rings.push({ id, outerRadius, innerRadius, size: ringWidth * id });
  }

  // Reverse so index 0 is outermost — hit-test checks outermost first
  return rings.reverse();
}

/**
 * Compute the image offset needed to center the full puzzle image inside
 * a ring of the given size, creating the circular "window" illusion.
 *
 * Original: updateImageSize: in SPGamePlayViewController.m
 *   CGRectMake(
 *     imageView.frame.size.width/2 - imgMain.frame.size.width/2,
 *     imageView.frame.size.height/2 - imgMain.frame.size.height/2,
 *     imgMain.frame.size.width,
 *     imgMain.frame.size.height
 *   )
 *
 * @param ringSize       the ring's view size (= diameter)
 * @param fullImageSize  the reference puzzle image's size (square)
 * @returns {x, y} margin offsets to apply inside the ring view
 */
export function computeImageOffset(
  ringSize:      number,
  fullImageSize: number,
): { x: number; y: number } {
  'worklet';
  const offset = (ringSize - fullImageSize) / 2;
  return { x: offset, y: offset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. INITIAL STATE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate initial angles for all rings (one random angle per ring).
 * Called once when a level loads — not a worklet (only runs on JS thread at setup).
 *
 * Original: CircleView.initWithFrame: calls randomNumberBetween:30:330 for each ring.
 */
export function generateInitialAngles(ringCount: number = RING_COUNT): number[] {
  return Array.from({ length: ringCount }, () => randomStartAngle());
}
