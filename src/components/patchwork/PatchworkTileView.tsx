/**
 * PatchworkTileView.tsx
 * Renders a single draggable Patchwork tile.
 *
 * ─── Rendering ────────────────────────────────────────────────────────────────
 *   Skia Canvas for the tile face (triple-rect border technique, same as Jigsaw).
 *   RN Text layered on top for the tile number and placed checkmark.
 *   Color changes from TILE_COLOR → PLACED_COLOR when isPlaced fires.
 *
 * ─── Position ─────────────────────────────────────────────────────────────────
 *   posX / posY SharedValues drive absolute left/top on the UI thread.
 *
 * ─── Scale (centered origin) ──────────────────────────────────────────────────
 *   Pre/post translate trick keeps the tile center anchored while scale grows:
 *     translateX(+hw) translateY(+hh) → scale(s) → translateX(-hw) translateY(-hh)
 *
 * ─── Z-ordering ───────────────────────────────────────────────────────────────
 *   active → zIndex 100 / elevation 10
 *   placed → zIndex 50  / elevation 0
 *   idle   → zIndex 1   / elevation 2
 *
 * ─── isPlaced color bridge ────────────────────────────────────────────────────
 *   Skia Canvas is outside Reanimated's render tree; useAnimatedReaction syncs
 *   isPlaced (UI thread) → placedUI (JS state) to trigger a React re-render
 *   with the solved color. Same pattern as JigsawPieceView.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import type { PatchworkTileState } from '../../game/patchwork/usePatchworkGame';

// ─────────────────────────────────────────────
// Visual constants
// ─────────────────────────────────────────────

const TILE_COLORS = [
  '#dc2626',   // 0 — red
  '#2563eb',   // 1 — blue
  '#16a34a',   // 2 — green
  '#d97706',   // 3 — amber
];

const PLACED_COLOR = '#22c55e';
const BORDER_COLOR = 'rgba(255,255,255,0.28)';

/** Inset from Animated.View edge to drawn rect — leaves shadow room. */
const INSET    = 4;
const RADIUS   = 10;
const BORDER_W = 3;

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface PatchworkTileViewProps {
  state:        PatchworkTileState;
  tileW:        number;
  tileH:        number;
  /** When true, renders a 1px purple border showing the tile's bounding box. */
  debugMode?:   boolean;
  /** True while any tile on the board is being dragged.
   *  Unplaced non-active tiles fade to 0.55 opacity during a drag so the
   *  active tile reads clearly against the board. */
  isAnyActive:  SharedValue<boolean>;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PatchworkTileView({
  state,
  tileW,
  tileH,
  debugMode = false,
  isAnyActive,
}: PatchworkTileViewProps): React.JSX.Element {
  const { descriptor, posX, posY, isPlaced, isActive, scale, gesture } = state;

  const hw = tileW / 2;
  const hh = tileH / 2;

  // ── Sync isPlaced UI-thread → JS for Skia face color ─────────────────────
  const [placedUI, setPlacedUI] = useState(false);
  useAnimatedReaction(
    () => isPlaced.value,
    (current, previous) => {
      if (current !== previous) runOnJS(setPlacedUI)(current);
    },
  );

  // ── Animated position, z-ordering, scale, shadow ─────────────────────────
  const animStyle = useAnimatedStyle(() => {
    const active = isActive.value;
    const placed = isPlaced.value;
    const s      = scale.value;
    const anyActive = isAnyActive.value;

    // Opacity:
    //   active tile   → 0.88 (slight transparency reveals the slot beneath)
    //   placed tile   → always 1.0 (solved tiles stay fully visible)
    //   idle unplaced → 0.55 when another tile is being dragged (subtle fade),
    //                   smooth 150 ms transition in/out via withTiming
    const opacity = active
      ? 0.88
      : placed
        ? 1.0
        : withTiming(anyActive ? 0.55 : 1.0, { duration: 150 });

    return {
      left:   posX.value,
      top:    posY.value,
      zIndex: active ? 100 : (placed ? 50 : 1),

      opacity,

      // Centered-origin scale: translate to center → scale → translate back.
      transform: [
        { translateX:  hw },
        { translateY:  hh },
        { scale: s },
        { translateX: -hw },
        { translateY: -hh },
      ],

      // Drop shadow (iOS) — stronger values for a more lifted feel while dragging.
      shadowColor:   '#000000',
      shadowOpacity: active ? 0.52 : 0,
      shadowRadius:  active ? 18   : 0,
      shadowOffset:  { width: 0, height: active ? 10 : 0 },

      // Elevation (Android) — higher value = more lifted + deeper shadow.
      elevation: active ? 12 : (placed ? 0 : 2),
    };
  });

  // ── Face color ────────────────────────────────────────────────────────────
  const faceColor = placedUI
    ? PLACED_COLOR
    : (TILE_COLORS[descriptor.id % TILE_COLORS.length] ?? '#7c3aed');

  // Drawing bounds (inset gives shadow room on all sides).
  const rw = tileW - INSET * 2;
  const rh = tileH - INSET * 2;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[styles.container, { width: tileW, height: tileH }, animStyle]}
    >
      <GestureDetector gesture={gesture}>
        <View style={{ width: tileW, height: tileH }}>

          {/* Skia face — fill + triple-rect border ring */}
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Base fill */}
            <RoundedRect
              x={INSET} y={INSET}
              width={rw} height={rh}
              r={RADIUS} color={faceColor}
            />
            {/* Border ring */}
            <RoundedRect
              x={INSET} y={INSET}
              width={rw} height={rh}
              r={RADIUS} color={BORDER_COLOR}
            />
            {/* Re-fill interior — cuts the ring to border width only */}
            <RoundedRect
              x={INSET + BORDER_W}        y={INSET + BORDER_W}
              width={rw - BORDER_W * 2}   height={rh - BORDER_W * 2}
              r={RADIUS - 1} color={faceColor}
            />
          </Canvas>

          {/* Debug footprint — 1px border showing the full tile bounding box.
              Static (not driven by SharedValue) so it doesn't animate.
              Visible whenever debugMode is true, regardless of drag state. */}
          {debugMode && (
            <View style={styles.debugBorder} pointerEvents="none" />
          )}

          {/* Tile number + checkmark — RN Text over Skia Canvas */}
          <View style={styles.labelWrapper} pointerEvents="none">
            <Text style={styles.label}>{descriptor.id + 1}</Text>
            {placedUI && <Text style={styles.check}>✓</Text>}
          </View>

        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  labelWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             4,
  },
  label: {
    color:            '#ffffff',
    fontSize:          28,
    fontWeight:       '700',
    textShadowColor:  'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  3,
  },
  check: {
    color:      '#ffffff',
    fontSize:    18,
    fontWeight: '700',
  },
  /** Tile footprint overlay — shows the full bounding box in debug mode. */
  debugBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth:  1,
    borderColor:  '#7c3aed',
    borderRadius: RADIUS,
  },
});
