/**
 * PatchworkBoard.tsx
 * The game board: cell outlines (Skia) + slot highlights + draggable tiles
 * + optional debug overlay.
 *
 * ─── Layer order (bottom → top) ───────────────────────────────────────────────
 *   1. Skia Canvas (absoluteFill) — faint static cell outlines. Never redraws.
 *   2. SlotHighlight × N — Animated.View per tile's target cell, opacity driven
 *      by isNearTarget. Each is a standalone component (hooks-in-loops rule).
 *   2.5 GhostView × N — ghost footprint at the snapped cell while dragging.
 *      Green tint if the cell is the correct target, red tint otherwise.
 *      Opacity 0 when tile is inactive; fades in (80 ms) when active.
 *   3. PatchworkTileView × N — draggable tiles.
 *   4. Debug overlay (conditional) — target cell boxes with tile ID + coords.
 *
 * ─── Highlight semantics ──────────────────────────────────────────────────────
 *   isNearTarget is true while the tile's drag position is inside its correct
 *   target cell (computed by isTileOverTarget in onUpdate). The highlight
 *   illuminates that cell in green — valid placement signal.
 *   Wrong-cell drops produce no highlight (clean, minimal).
 *
 * ─── Coordinate space ─────────────────────────────────────────────────────────
 *   All coords are board-local (board top-left = 0,0). Cell frames are
 *   derived from (col * tileW, row * tileH) — no screen offset conversion.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';

import { PatchworkTileView }  from './PatchworkTileView';
import type { PatchworkTileState } from '../../game/patchwork/usePatchworkGame';
import type { PatchworkGridConfig } from '../../game/patchwork/types';
import { pixelToGridCell } from '../../game/patchwork/patchworkMath';
import { SLOT_HIGHLIGHT_MS } from '../../constants/gameConstants';

// ─────────────────────────────────────────────
// Slot styling
// ─────────────────────────────────────────────

const SLOT_FILL     = 'rgba(255,255,255,0.04)';
const SLOT_BORDER   = 'rgba(255,255,255,0.16)';
const SLOT_RADIUS   = 8;
const SLOT_INSET    = 3;
const SLOT_BORDER_W = 2;

const NEAR_BG     = 'rgba(34,197,94,0.18)';
const NEAR_BORDER = 'rgba(34,197,94,0.55)';
// SLOT_HIGHLIGHT_MS imported from gameConstants — shared with Jigsaw for consistency.

// Ghost preview — shown at the snapped-cell footprint while dragging.
const GHOST_VALID_BG     = 'rgba(34,197,94,0.30)';
const GHOST_VALID_BORDER = 'rgba(34,197,94,0.75)';
const GHOST_INVALID_BG   = 'rgba(239,68,68,0.20)';
const GHOST_INVALID_BORDER = 'rgba(239,68,68,0.50)';
const GHOST_FADE_MS      = 80;

// ─────────────────────────────────────────────
// SlotHighlight — standalone so useAnimatedStyle
// is called once per instance, not in a map loop.
// ─────────────────────────────────────────────

interface SlotHighlightProps {
  x:            number;
  y:            number;
  width:        number;
  height:       number;
  isNearTarget: SharedValue<boolean>;
}

function SlotHighlight({ x, y, width, height, isNearTarget }: SlotHighlightProps) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(isNearTarget.value ? 1 : 0, { duration: SLOT_HIGHLIGHT_MS }),
  }));
  return (
    <Animated.View
      style={[
        styles.highlight,
        {
          left:            x,
          top:             y,
          width,
          height,
          borderRadius:    SLOT_RADIUS,
          backgroundColor: NEAR_BG,
          borderColor:     NEAR_BORDER,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

// ─────────────────────────────────────────────
// GhostView — standalone so useAnimatedStyle
// is called once per instance (hooks-in-loops).
//
// Shows the exact grid-cell footprint the tile
// would occupy if dropped at the current drag
// position. Updates on the UI thread only via
// SharedValue reads — zero JS-thread involvement.
//
// Color semantics:
//   green — tile center is over its correct target cell
//   red   — tile center is over any other cell
// ─────────────────────────────────────────────

interface GhostViewProps {
  posX:         SharedValue<number>;
  posY:         SharedValue<number>;
  isActive:     SharedValue<boolean>;
  isNearTarget: SharedValue<boolean>;
  tileW:        number;
  tileH:        number;
  boardSize:    number;
  config:       PatchworkGridConfig;
}

function GhostView({
  posX, posY, isActive, isNearTarget,
  tileW, tileH, boardSize, config,
}: GhostViewProps) {
  // Worklet-local mutable position cache (lives on the UI thread, persists
  // across style recomputations for this GhostView instance).
  // When isActive becomes false the ghost fades out from its last known cell
  // position instead of snapping to (0,0) — which would cause a brief flash
  // at the board's top-left corner during the 80 ms fade-out.
  let lastLeft = 0;
  let lastTop  = 0;

  const style = useAnimatedStyle(() => {
    const active = isActive.value;

    // When the tile is not being dragged, fade out from the last rendered cell.
    if (!active) {
      return {
        opacity:         withTiming(0, { duration: GHOST_FADE_MS }),
        left:            lastLeft,
        top:             lastTop,
        backgroundColor: GHOST_INVALID_BG,
        borderColor:     GHOST_INVALID_BORDER,
      };
    }

    // Compute which discrete cell the tile center is currently over.
    // pixelToGridCell is a worklet — safe to call on the UI thread.
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    const cell  = pixelToGridCell(
      posX.value + halfW,
      posY.value + halfH,
      boardSize, boardSize,
      config,
    );

    // Update cache so the fade-out anchors to this position.
    lastLeft = cell.col * tileW;
    lastTop  = cell.row * tileH;

    const valid = isNearTarget.value;
    return {
      opacity:         withTiming(1, { duration: GHOST_FADE_MS }),
      left:            lastLeft,
      top:             lastTop,
      backgroundColor: valid ? GHOST_VALID_BG     : GHOST_INVALID_BG,
      borderColor:     valid ? GHOST_VALID_BORDER  : GHOST_INVALID_BORDER,
    };
  });

  return (
    <Animated.View
      style={[styles.ghost, { width: tileW, height: tileH }, style]}
      pointerEvents="none"
    />
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface PatchworkBoardProps {
  boardSize:    number;
  tileW:        number;
  tileH:        number;
  config:       PatchworkGridConfig;
  tileStates:   PatchworkTileState[];
  debugMode?:   boolean;
  /** True while any tile is being dragged — fades non-active tiles + enables ghost previews. */
  isAnyActive:  SharedValue<boolean>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PatchworkBoard({
  boardSize,
  tileW,
  tileH,
  config,
  tileStates,
  debugMode = false,
  isAnyActive,
}: PatchworkBoardProps): React.JSX.Element {
  const { cols, rows } = config;

  // Build the flat list of (row, col) pairs for the Skia grid.
  // Memoized: rows and cols are stable for the lifetime of a level
  // (config comes from a useMemo in the engine), so this only runs once.
  const cells = useMemo(() => {
    const result: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({ row: r, col: c });
      }
    }
    return result;
  }, [rows, cols]);

  return (
    <View style={[styles.board, { width: boardSize, height: boardSize }]}>

      {/* ── Layer 1: Static cell outlines (Skia — never redraws) ────────── */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {cells.map(({ row, col }) => {
          const x = col * tileW + SLOT_INSET;
          const y = row * tileH + SLOT_INSET;
          const w = tileW - SLOT_INSET * 2;
          const h = tileH - SLOT_INSET * 2;
          return (
            <React.Fragment key={`cell-${row}-${col}`}>
              {/* Cell fill */}
              <RoundedRect x={x} y={y} width={w} height={h} r={SLOT_RADIUS} color={SLOT_FILL} />
              {/* Border ring */}
              <RoundedRect x={x} y={y} width={w} height={h} r={SLOT_RADIUS} color={SLOT_BORDER} />
              {/* Re-fill interior — leaves only the border ring visible */}
              <RoundedRect
                x={x + SLOT_BORDER_W}        y={y + SLOT_BORDER_W}
                width={w - SLOT_BORDER_W * 2} height={h - SLOT_BORDER_W * 2}
                r={SLOT_RADIUS - 1} color={SLOT_FILL}
              />
            </React.Fragment>
          );
        })}
      </Canvas>

      {/* ── Layer 2: Per-tile slot highlights (Animated.View — UI thread) ── */}
      {tileStates.map((state) => {
        const { row, col } = state.descriptor.target;
        return (
          <SlotHighlight
            key={`hl-${state.descriptor.id}`}
            x={col * tileW + SLOT_INSET}
            y={row * tileH + SLOT_INSET}
            width={tileW  - SLOT_INSET * 2}
            height={tileH - SLOT_INSET * 2}
            isNearTarget={state.isNearTarget}
          />
        );
      })}

      {/* ── Layer 2.5: Ghost previews (one per tile) ─────────────────────── */}
      {/* Each ghost occupies the exact grid-cell footprint the tile would    */}
      {/* snap to if dropped now. Visible only while isActive is true.        */}
      {/* Rendered BELOW the actual tile (Layer 3) so the live tile sits on  */}
      {/* top of its own ghost, giving clear visual depth.                    */}
      {tileStates.map((state) => (
        <GhostView
          key={`ghost-${state.descriptor.id}`}
          posX={state.posX}
          posY={state.posY}
          isActive={state.isActive}
          isNearTarget={state.isNearTarget}
          tileW={tileW}
          tileH={tileH}
          boardSize={boardSize}
          config={config}
        />
      ))}

      {/* ── Layer 3: Draggable tiles ─────────────────────────────────────── */}
      {tileStates.map((state) => (
        <PatchworkTileView
          key={state.descriptor.id}
          state={state}
          tileW={tileW}
          tileH={tileH}
          debugMode={debugMode}
          isAnyActive={isAnyActive}
        />
      ))}

      {/* ── Layer 4: Debug overlay ───────────────────────────────────────── */}
      {debugMode && tileStates.map((state) => {
        const { row, col } = state.descriptor.target;
        return (
          <View
            key={`dbg-${state.descriptor.id}`}
            style={[
              styles.debugCell,
              {
                left:   col * tileW,
                top:    row * tileH,
                width:  tileW,
                height: tileH,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.debugLabel}>
              {`T${state.descriptor.id}  (${row},${col})\n${Math.round(col * tileW)},${Math.round(row * tileH)}`}
            </Text>
          </View>
        );
      })}

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    // overflow:visible lets tiles be dragged outside the board area.
    overflow: 'visible',
  },
  highlight: {
    position:    'absolute',
    borderWidth:  2,
  },
  ghost: {
    position:     'absolute',
    borderWidth:   2,
    borderRadius:  SLOT_RADIUS,
  },
  debugCell: {
    position:        'absolute',
    borderWidth:      1,
    borderColor:     '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.10)',
    borderRadius:     SLOT_RADIUS,
    padding:          3,
  },
  debugLabel: {
    color:      '#a78bfa',
    fontSize:    9,
    fontFamily: 'monospace',
    lineHeight:  13,
  },
});
