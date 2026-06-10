/**
 * DebugOverlay.tsx
 * Development-only overlay for the Spinny gameplay screen.
 *
 * Shows:
 *   • Current angle of every ring (updated ~60 fps via useAnimatedReaction)
 *   • Which ring is currently active
 *   • Per-ring solved state
 *   • Geometric info (inner/outer radius) from ring descriptors
 *
 * How angle values cross from UI thread to JS thread:
 *   useAnimatedReaction runs on the UI thread and reads SharedValues there.
 *   It calls runOnJS(setAngles) only when values change by ≥1°, so the JS
 *   thread is not hammered on every frame — only when something meaningfully
 *   changes.
 *
 * This component is rendered only when DEBUG_SPINNY=true and is tree-shaken
 * (or simply not imported) in production builds.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import type { RingDescriptor } from '../../game/spinny/types';
import { SNAP_TOLERANCE_DEG } from '../../constants/gameConstants';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface DebugOverlayProps {
  ringDescriptors: RingDescriptor[];
  ringAngles:      SharedValue<number>[];
  ringSolved:      SharedValue<boolean>[];
  activeRingIndex: SharedValue<number>;
  boardSize:       number;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function DebugOverlay({
  ringDescriptors,
  ringAngles,
  ringSolved,
  activeRingIndex,
  boardSize,
}: DebugOverlayProps): React.JSX.Element {
  const count = ringDescriptors.length;

  // JS-thread state — updated from UI thread via useAnimatedReaction.
  const [angles,      setAngles]      = useState<number[]>(Array(count).fill(0));
  const [solvedFlags, setSolvedFlags] = useState<boolean[]>(Array(count).fill(false));
  const [activeIdx,   setActiveIdx]   = useState<number>(-1);

  // ── Sync angles → JS state ─────────────────────────────────────────────
  // useAnimatedReaction fires on every UI-thread frame when values change.
  // We throttle JS updates with a ≥1° threshold.
  useAnimatedReaction(
    () => ringAngles.map((sv) => Math.round(sv.value)),
    (current, previous) => {
      const changed = !previous || current.some((v, i) => v !== previous[i]);
      if (changed) runOnJS(setAngles)(current);
    },
  );

  useAnimatedReaction(
    () => ringSolved.map((sv) => sv.value),
    (current, previous) => {
      const changed = !previous || current.some((v, i) => v !== previous[i]);
      if (changed) runOnJS(setSolvedFlags)(current);
    },
  );

  useAnimatedReaction(
    () => activeRingIndex.value,
    (current, previous) => {
      if (current !== previous) runOnJS(setActiveIdx)(current);
    },
  );

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.header}>⚙ DEBUG</Text>
      <Text style={styles.subheader}>Board: {boardSize}×{boardSize}px  Snap: ±{SNAP_TOLERANCE_DEG}°</Text>

      {ringDescriptors.map((ring, i) => {
        const angle   = angles[i]      ?? 0;
        const solved  = solvedFlags[i] ?? false;
        const isActive = activeIdx === i;
        const nearSnap = Math.abs(angle) < SNAP_TOLERANCE_DEG + 8 || Math.abs(angle) > (360 - SNAP_TOLERANCE_DEG - 8);

        return (
          <View
            key={ring.id}
            style={[
              styles.row,
              isActive && styles.rowActive,
              solved   && styles.rowSolved,
            ]}
          >
            {/* Ring label */}
            <Text style={styles.label}>
              R{ring.id}
              {isActive ? ' 👆' : '   '}
              {solved   ? ' ✓' : '  '}
            </Text>

            {/* Angle bar */}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:           `${Math.min(Math.abs(angle) / 360 * 100, 100)}%`,
                    backgroundColor: solved
                      ? '#22c55e'
                      : nearSnap
                        ? '#fbbf24'   // yellow when close to snap
                        : '#7c3aed',
                  },
                ]}
              />
            </View>

            {/* Numeric angle */}
            <Text style={[styles.angleText, nearSnap && styles.nearSnapText]}>
              {angle > 0 ? '+' : ''}{angle}°
            </Text>

            {/* Geometry info */}
            <Text style={styles.geoText}>
              {ring.innerRadius.toFixed(0)}–{ring.outerRadius.toFixed(0)}r
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
  container: {
    position:   'absolute',
    bottom:     100,
    left:       12,
    right:      12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius:    10,
    padding:         10,
    borderWidth:     1,
    borderColor:     '#4c1d95',
  },
  header: {
    color:      '#a78bfa',
    fontSize:   12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  subheader: {
    color:     '#6b7280',
    fontSize:  10,
    marginBottom: 6,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    marginVertical:  2,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius:    6,
  },
  rowActive: { backgroundColor: 'rgba(124,58,237,0.25)' },
  rowSolved: { backgroundColor: 'rgba(34,197,94,0.15)' },

  label: {
    color:     '#d1d5db',
    fontSize:  11,
    width:     50,
    fontFamily: 'monospace',
  },
  barTrack: {
    flex:            1,
    height:          6,
    backgroundColor: '#1f2937',
    borderRadius:    3,
    overflow:        'hidden',
    marginHorizontal: 6,
  },
  barFill: {
    height:       6,
    borderRadius: 3,
  },
  angleText: {
    color:     '#9ca3af',
    fontSize:  10,
    width:     40,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  nearSnapText: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  geoText: {
    color:     '#4b5563',
    fontSize:   9,
    width:     44,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
});
