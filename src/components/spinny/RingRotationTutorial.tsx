/**
 * RingRotationTutorial.tsx
 * One-time, non-blocking hint overlay shown on the first level of the first
 * Spinny package for first-time players. Demonstrates the drag-to-rotate
 * gesture with a sweeping hand + orbiting arrow cluster.
 *
 * Behaviour (see SpinnyGamePlayScreen for the gating / "seen once" logic):
 *   - Tracks whichever ring is currently active (via activeRingIndex) and
 *     draws the hint over that ring's band — so it guides all 4 rings in
 *     sequence as the player solves them, exactly like the outer ring.
 *   - Instantly fades out while the player is actually dragging (gamePhase
 *     === 'rotating') so it never competes with the real gesture, and fades
 *     back in once released if the ring didn't snap.
 *   - Purely visual: pointerEvents="none" throughout, gameplay is never
 *     blocked by this overlay.
 *
 * Visual language ported from the TutorialScreen.jsx concept screen: a
 * pivoting hand image sweeping back and forth along the ring's arc, plus a
 * slowly-orbiting cluster of pulsing chevron arrows indicating "this ring
 * rotates".
 */

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { GamePhase, RingDescriptor } from '../../game/spinny/types';

const HINT_FINGER = require('../../assets/images/HintFinger.png');
const HINT_ARROW  = require('../../assets/images/HintArrow.png');

// Two clusters on opposite sides of the ring so the "this rotates" hint
// reads no matter where the player is looking.
const ARROW_CLUSTER_ANGLES_DEG = [45, 225];

interface RingRotationTutorialProps {
  boardSize:       number;
  ringDescriptors: RingDescriptor[];
  activeRingIndex: SharedValue<number>;
  gamePhase:       SharedValue<GamePhase>;
}

function useLoopingPulse(duration: number, delay = 0): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [v, duration, delay]);
  return v;
}

function ArrowChevron({
  delay,
  size,
}: {
  delay: number;
  size: number;
}): React.JSX.Element {
  const pulse = useLoopingPulse(1560, delay);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 1]),
  }));
  return (
    <Animated.Image
      source={HINT_ARROW}
      style={[{ width: size, height: size * 1.6, marginHorizontal: 1 }, style]}
      resizeMode="contain"
    />
  );
}

export function RingRotationTutorial({
  boardSize,
  ringDescriptors,
  activeRingIndex,
  gamePhase,
}: RingRotationTutorialProps): React.JSX.Element | null {
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragging,  setDragging]  = useState(false);

  // Mirror the UI-thread gesture state into JS state so the overlay can
  // follow the active ring and hide the instant a drag begins.
  useAnimatedReaction(
    () => ({ idx: activeRingIndex.value, phase: gamePhase.value }),
    (cur, prev) => {
      if (!prev || cur.idx !== prev.idx)     runOnJS(setActiveIdx)(cur.idx);
      if (!prev || cur.phase !== prev.phase) runOnJS(setDragging)(cur.phase === 'rotating');
    },
  );

  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withTiming(dragging ? 0 : 1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [dragging, opacity]);
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const orbit = useSharedValue(0);
  useEffect(() => {
    orbit.value = withRepeat(withTiming(1, { duration: 3900, easing: Easing.linear }), -1, false);
  }, [orbit]);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(orbit.value, [0, 1], [0, 360])}deg` }],
  }));

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [sweep]);
  const handStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(sweep.value, [0, 1], [-18, 34])}deg` }],
  }));

  const ring = ringDescriptors[activeIdx];
  if (!ring) return null;

  const center = boardSize / 2;
  const midR   = (ring.outerRadius + ring.innerRadius) / 2;

  const fingerW = Math.round(boardSize * 0.20);
  const fingerH = Math.round(fingerW * (388 / 546));
  const arrowSz = Math.max(14, Math.round(boardSize * 0.045));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, containerStyle]}>
      {/* Orbiting arrow clusters — hint that the whole ring rotates */}
      <Animated.View style={[StyleSheet.absoluteFill, orbitStyle]}>
        {ARROW_CLUSTER_ANGLES_DEG.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx  = center + midR * Math.cos(rad);
          const cy  = center + midR * Math.sin(rad);
          return (
            <View
              key={deg}
              style={{
                position:      'absolute',
                top:           cy - (arrowSz * 1.6) / 2,
                left:          cx - (arrowSz * 3) / 2,
                flexDirection: 'row',
                // Tangent to the ring at this point, not radial — the chevrons
                // (which point "east" in the source art) end up pointing along
                // the clockwise direction the player must drag.
                transform:     [{ rotate: `${deg + 90}deg` }],
              }}
            >
              {/* Rightmost chevron leads (points furthest along the travel
                  direction) and pulses first, so the cluster reads as a
                  chase animation flowing the way the ring should turn. */}
              {[0, 1, 2].map((i) => (
                <ArrowChevron key={i} delay={(2 - i) * 150} size={arrowSz} />
              ))}
            </View>
          );
        })}
      </Animated.View>

      {/* Pivoting hand — sweeps back and forth to demonstrate the drag gesture */}
      <Animated.View
        style={[{ position: 'absolute', top: center, left: center, width: 0, height: 0 }, handStyle]}
      >
        <Image
          source={HINT_FINGER}
          style={{
            position:  'absolute',
            top:       -midR,
            left:      -fingerW / 2,
            width:     fingerW,
            height:    fingerH,
            transform: [{ rotate: '60deg' }],
          }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}
