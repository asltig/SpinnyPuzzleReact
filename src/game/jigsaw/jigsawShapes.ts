/**
 * jigsawShapes.ts
 * Generates Skia paths for jigsaw piece shapes.
 * Ports ObjC UIBezierPath + cubic Bézier tab logic from JigsawGameController.m.
 *
 * Coordinate space of the output path:
 *   Canvas size: (baseW + 2*tabW) × (baseH + 2*tabH)
 *   The piece's grid cell occupies (tabW, tabH) → (tabW+baseW, tabH+baseH).
 *   Tabs extend beyond that into the tab-margin area.
 *
 * Tab conventions (mirrors ObjC piecesTypeValue):
 *   0  = flat edge (border of the puzzle)
 *   1  = tab protrudes outward
 *  -1  = blank (indented, receives neighbor's tab)
 */

import { Skia } from '@shopify/react-native-skia';

// ─── Tab type grid ────────────────────────────────────────────────────────────

export interface PieceSides {
  top:    number;   // 0 | 1 | -1
  right:  number;
  bottom: number;
  left:   number;
}

/**
 * Generate interlocking tab types for the full grid.
 * Deterministic — same seed ⇒ same shapes every time a level loads.
 */
export function generateTabTypes(rows: number, cols: number): PieceSides[][] {
  // Horizontal connectors: hc[r][c] = tab type on the RIGHT side of piece [r,c]
  // (= opposite on the LEFT side of piece [r, c+1])
  const hc: number[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols - 1 }, (_, c) =>
      (r + c) % 2 === 0 ? 1 : -1,
    ),
  );

  // Vertical connectors: vc[r][c] = tab type on the BOTTOM side of piece [r,c]
  const vc: number[][] = Array.from({ length: rows - 1 }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      (r + c + 1) % 2 === 0 ? 1 : -1,
    ),
  );

  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      top:    r === 0          ? 0 :  -(vc[r - 1]?.[c] ?? 0),
      right:  c === cols - 1  ? 0 :    (hc[r]?.[c]     ?? 0),
      bottom: r === rows - 1  ? 0 :    (vc[r]?.[c]     ?? 0),
      left:   c === 0         ? 0 :  -(hc[r]?.[c - 1]  ?? 0),
    })),
  );
}

// ─── Bezier tab helper ────────────────────────────────────────────────────────

/**
 * Appends a jigsaw tab (or blank) bezier segment to an existing Skia path.
 * Mirrors ObjC addCurveToPoint: cubic bezier logic for each side.
 *
 * @param path       Skia path being built (cursor is at x0,y0 on entry)
 * @param x0,y0      side start
 * @param x1,y1      side end
 * @param px,py      outward perpendicular unit vector (tab direction)
 * @param depth      tab protrusion magnitude (always positive; tabType flips sign)
 * @param tabType    1 = protrudes toward px,py   |   -1 = indented
 */
function appendTab(
  path: ReturnType<typeof Skia.Path.Make>,
  x0: number, y0: number,
  x1: number, y1: number,
  px: number, py: number,
  depth: number,
  tabType: number,
): void {
  const sign  = tabType;            // +1 out, -1 in
  const len   = Math.hypot(x1 - x0, y1 - y0);
  const nx    = (x1 - x0) / len;   // side unit vector
  const ny    = (y1 - y0) / len;

  // Tab footprint: the middle 40% of the side
  const tw   = len * 0.4;
  const ta   = (len - tw) / 2;

  // Four key points along the side
  const s1x = x0 + nx * ta,           s1y = y0 + ny * ta;
  const s2x = x0 + nx * (ta + tw),    s2y = y0 + ny * (ta + tw);

  // Tab tip
  const tipX = (x0 + x1) / 2 + px * depth * sign;
  const tipY = (y0 + y1) / 2 + py * depth * sign;

  // Shoulder control-point offset (perpendicular pull)
  const shX = px * depth * sign * 0.6;
  const shY = py * depth * sign * 0.6;

  path.lineTo(s1x, s1y);

  // Rising slope → tip
  path.cubicTo(
    s1x + shX, s1y + shY,
    tipX - nx * tw * 0.25, tipY - ny * tw * 0.25,
    tipX, tipY,
  );

  // Tip → falling slope back to side
  path.cubicTo(
    tipX + nx * tw * 0.25, tipY + ny * tw * 0.25,
    s2x + shX, s2y + shY,
    s2x, s2y,
  );

  path.lineTo(x1, y1);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the full Skia path for one jigsaw piece.
 *
 * The path is in canvas coordinates where the base cell starts at (tabW, tabH).
 * Canvas total size = (baseW + 2*tabW) × (baseH + 2*tabH).
 *
 * Winding: clockwise (top → right → bottom → left), suitable for Skia fill.
 */
export function makePiecePath(
  baseW: number,
  baseH: number,
  tabW:  number,   // = baseW / 4  — horizontal tab depth
  tabH:  number,   // = baseH / 4  — vertical tab depth
  sides: PieceSides,
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();

  const x0 = tabW,          y0 = tabH;
  const x1 = tabW + baseW,  y1 = tabH + baseH;

  path.moveTo(x0, y0);

  // TOP (left→right, outward = up → py = -1)
  if (sides.top !== 0) {
    appendTab(path, x0, y0, x1, y0, 0, -1, tabH, sides.top);
  } else {
    path.lineTo(x1, y0);
  }

  // RIGHT (top→bottom, outward = right → px = +1)
  if (sides.right !== 0) {
    appendTab(path, x1, y0, x1, y1, 1, 0, tabW, sides.right);
  } else {
    path.lineTo(x1, y1);
  }

  // BOTTOM (right→left, outward = down → py = +1)
  if (sides.bottom !== 0) {
    appendTab(path, x1, y1, x0, y1, 0, 1, tabH, sides.bottom);
  } else {
    path.lineTo(x0, y1);
  }

  // LEFT (bottom→top, outward = left → px = -1)
  if (sides.left !== 0) {
    appendTab(path, x0, y1, x0, y0, -1, 0, tabW, sides.left);
  } else {
    path.lineTo(x0, y0);
  }

  path.close();
  return path;
}