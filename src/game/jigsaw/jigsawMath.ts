
/**
 * jigsawMath.ts
 * Pure layout math for the Jigsaw game.
 * Mirrors JigsawGameController.m board/panel sizing and piece placement.
 *
 * ObjC grid sizes (from prepareForStartWithImage:…):
 *   Easy   → pieceHCount=3 cols, pieceVCount=2 rows = 6 pieces
 *   Medium → 4 cols × 3 rows = 12 pieces
 *   Hard   → 5 cols × 4 rows = 20 pieces
 *
 * Tab depth:
 *   deepnessH = cubeHeightValue / 4   (vertical  tab depth)
 *   deepnessV = cubeWidthValue  / 4   (horizontal tab depth)
 */

import type { GameMode }       from '../../types/models';
import type { JigsawGridConfig, JigsawPiece, Frame } from './types';
import { generateTabTypes }    from './jigsawShapes';
import { JIGSAW_SNAP_TOLERANCE } from '../../constants/gameConstants';

// ─── Grid config ──────────────────────────────────────────────────────────────

export function gridConfigForMode(mode: GameMode): JigsawGridConfig {
  const map: Record<GameMode, JigsawGridConfig> = {
    easy:   { cols: 3, rows: 2, snapTolerance: JIGSAW_SNAP_TOLERANCE.easy   },
    medium: { cols: 4, rows: 3, snapTolerance: JIGSAW_SNAP_TOLERANCE.medium },
    hard:   { cols: 5, rows: 4, snapTolerance: JIGSAW_SNAP_TOLERANCE.hard   },
  };
  return map[mode];
}

/**
 * Derive GameMode from the level's 0-based display index.
 * Mirrors ObjC JigsawController.m cellForItemAtIndexPath:
 *   CGFloat div = (indexPath.item+1) / 3.0;
 *   int bb = div; div -= bb;
 *   index = (div==0) ? Hard : (div<0.5) ? Easy : Medium
 *
 * Pattern (repeating every 3 levels):
 *   0 → easy   (6 pieces)
 *   1 → medium (12 pieces)
 *   2 → hard   (20 pieces)
 */
export function modeForLevelIndex(levelIndex: number): GameMode {
  const div  = (levelIndex + 1) / 3;
  const frac = div - Math.floor(div);
  if (frac < 0.01) return 'hard';    // multiple of 3 → hard
  if (frac < 0.5)  return 'easy';
  return 'medium';
}

// ─── Layout dimensions ────────────────────────────────────────────────────────

export interface JigsawLayout {
  boardFrame: Frame;
  baseW: number; baseH: number;
  tabW:  number; tabH:  number;
  canvasW: number; canvasH: number;
  panelScale: number;
  leftPanel: Frame; rightPanel: Frame;
  topBarH: number;
  /** Columns per side panel (1 for Easy, 2 for Medium/Hard). */
  panelCols: number;
  /** Rows per side panel (3 for Easy/Medium, 5 for Hard). */
  panelRows: number;
}

/**
 * Compute the full layout for a given screen size and grid config.
 * Mirrors ObjC: leftAreaPiecesFrame + rightAreaPiecesFrame calculations.
 *
 * @param screenW  landscape long edge
 * @param screenH  landscape short edge
 * @param topBarH  height of the HUD bar (timer + buttons)
 * @param cfg      grid config for the chosen difficulty
 */
export function computeLayout(
  screenW: number,
  screenH: number,
  topBarH: number,
  cfg:     JigsawGridConfig,
): JigsawLayout {
  const availH = screenH - topBarH;

  // Board height = available height with a small margin
  const boardH = Math.round(availH * 0.90);
  // Board width = boardH × aspect ratio (keep square for simplicity;
  // real images maintain their own ratio but this keeps the math clean)
  const boardW = Math.round(boardH * (cfg.cols / cfg.rows));   // natural ratio

  // Center the board on screen
  const boardX = Math.round((screenW - boardW) / 2);
  const boardY = Math.round(topBarH + (availH - boardH) / 2);

  const baseW = boardW / cfg.cols;
  const baseH = boardH / cfg.rows;

  // Tab depth: ObjC = cubeWidth/4, cubeHeight/4
  const tabW = baseW / 4;
  const tabH = baseH / 4;
  const canvasW = baseW + 2 * tabW;
  const canvasH = baseH + 2 * tabH;

  // Panel frames: from screen edge to board edge
  const gap = 6;
  const leftPanel: Frame = {
    x:      0,
    y:      topBarH + gap,
    width:  boardX - gap,
    height: availH - 2 * gap,
  };
  const rightPanel: Frame = {
    x:      boardX + boardW + gap,
    y:      topBarH + gap,
    width:  screenW - (boardX + boardW) - gap,
    height: availH - 2 * gap,
  };

  // ── Panel grid dimensions ────────────────────────────────────────────────
  // Easy  (6  pieces): 1 col × 3 rows per side
  // Medium(12 pieces): 2 col × 3 rows per side
  // Hard  (20 pieces): 2 col × 5 rows per side
  const piecesPerSide = Math.ceil((cfg.rows * cfg.cols) / 2);
  const panelCols     = piecesPerSide <= 3 ? 1 : 2;
  const panelRows     = Math.ceil(piecesPerSide / panelCols);

  // Slot size within one panel
  const slotW = leftPanel.width  / panelCols;
  const slotH = leftPanel.height / panelRows;

  // Scale: visual piece (canvasW × scale) must fit the slot with padding.
  // Scale is from VIEW CENTER so visual size = canvas × scale.
  const panelScale = Math.min(
    (slotW * 0.82) / canvasW,
    (slotH * 0.80) / canvasH,
    0.72,
  );

  return {
    boardFrame: { x: boardX, y: boardY, width: boardW, height: boardH },
    baseW, baseH, tabW, tabH, canvasW, canvasH,
    panelScale, panelCols, panelRows,
    leftPanel, rightPanel,
    topBarH,
  };
}

// ─── Piece generation ─────────────────────────────────────────────────────────

/**
 * Generate all pieces with their panel slot positions.
 *
 * Panel grid layout per side:
 *   Easy   (6  pieces) : 1 col × 3 rows   → single column of 3
 *   Medium (12 pieces) : 2 cols × 3 rows  → two columns of 3
 *   Hard   (20 pieces) : 2 cols × 5 rows  → two columns of 5
 *
 * The first half of pieces (row-major order) go to the LEFT panel,
 * the second half to the RIGHT panel — filling top-to-bottom,
 * left-column first.
 *
 * RN note: scale transform is applied from the VIEW CENTER, so
 *   panelX = slotCenterX - canvasW/2  (not the scaled half-width).
 */
export function generatePieces(layout: JigsawLayout, cfg: JigsawGridConfig): JigsawPiece[] {
  const { boardFrame, baseW, baseH, tabW, tabH, canvasW, canvasH,
          panelScale, panelCols, panelRows, leftPanel, rightPanel } = layout;
  const { cols, rows } = cfg;

  const tabTypes      = generateTabTypes(rows, cols);
  const totalPieces   = rows * cols;
  const piecesPerSide = Math.ceil(totalPieces / 2);

  // Slot dimensions within a panel
  const slotW = (panel: Frame) => panel.width  / panelCols;
  const slotH = (panel: Frame) => panel.height / panelRows;

  const pieces: JigsawPiece[] = [];
  let leftIdx  = 0;
  let rightIdx = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id    = row * cols + col;
      const sides = tabTypes[row]![col]!;

      // Board target: canvas top-left when fully placed
      const targetX = boardFrame.x + col * baseW - tabW;
      const targetY = boardFrame.y + row * baseH - tabH;

      // Assign first half → left, second half → right
      const panelSide = id < piecesPerSide ? 'left' : 'right';
      const panel     = panelSide === 'left' ? leftPanel : rightPanel;
      const slotIdx   = panelSide === 'left' ? leftIdx++ : rightIdx++;

      // Grid position within the panel (column-major: fill top→bottom, then next col)
      const pc = slotIdx % panelCols;   // panel column (0-based)
      const pr = Math.floor(slotIdx / panelCols); // panel row

      const sw = slotW(panel);
      const sh = slotH(panel);

      // Slot center in screen coords
      const slotCenterX = panel.x + pc * sw + sw / 2;
      const slotCenterY = panel.y + pr * sh + sh / 2;

      // panelX/Y = VIEW top-left so that view center = slotCenter (scale from center)
      const panelX = slotCenterX - canvasW / 2;
      const panelY = slotCenterY - canvasH / 2;

      pieces.push({
        id, row, col, sides,
        targetX, targetY,
        panelX, panelY,
        panelSide, panelScale,
      });
    }
  }

  return pieces;
}

// ─── Snap check ───────────────────────────────────────────────────────────────

/**
 * True if the dragged piece canvas top-left is close enough to its target.
 * ObjC: fabs(frame.origin.x - originalFrame.origin.x) < 10
 */
export function isPieceNearTarget(
  posX:    number, posY: number,
  targetX: number, targetY: number,
  tol:     number,
): boolean {
  'worklet';
  return Math.abs(posX - targetX) <= tol && Math.abs(posY - targetY) <= tol;
}