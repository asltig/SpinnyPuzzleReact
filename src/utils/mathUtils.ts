/**
 * mathUtils.ts
 * General-purpose math helpers used by both the game logic and UI layers.
 * All functions are pure — no side effects, no imports.
 */

/**
 * Clamp a value between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between a and b by t ∈ [0, 1].
 */
export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/**
 * Convert degrees to radians.
 * Original: #define DEGREES_TO_RADIANS(angle) (angle / 180.0 * M_PI)
 */
export function degreesToRadians(deg: number): number {
  'worklet';
  return (deg / 180) * Math.PI;
}

/**
 * Convert radians to degrees.
 */
export function radiansToDegrees(rad: number): number {
  'worklet';
  return (rad * 180) / Math.PI;
}

/**
 * Normalize an angle to [0, 360).
 */
export function normalizeAngle(angle: number): number {
  'worklet';
  return ((angle % 360) + 360) % 360;
}

/**
 * Euclidean distance between two 2D points.
 * Original C: distanceBetweenPoints in OneFingerRotationGestureRecognizer.m
 *   return sqrt(dx*dx + dy*dy)
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  'worklet';
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * Returns true if point (px, py) lies within an annular zone
 * centred at (cx, cy) with inner and outer radii.
 * Used for ring hit detection (pure utility version without ring structs).
 */
export function isPointInAnnulus(
  px: number, py: number,
  cx: number, cy: number,
  innerRadius: number,
  outerRadius: number,
): boolean {
  'worklet';
  const d = distance(px, py, cx, cy);
  return d >= innerRadius && d <= outerRadius;
}

/**
 * Round to a given number of decimal places.
 */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
