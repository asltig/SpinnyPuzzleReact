/**
 * CircleRing.tsx
 * One concentric ring in the Spinny puzzle.
 *
 * ─── Two-layer structure ──────────────────────────────────────────────────────
 *   Outer Animated.View  → rotation + scale + DROP SHADOW (no overflow:hidden,
 *                          because iOS clips shadows when masksToBounds = YES).
 *   Inner View           → overflow:'hidden' + borderRadius  clips the animal
 *                          image to the circle without clipping the shadow.
 *
 * ─── Shadow instead of border ────────────────────────────────────────────────
 *   Un-solved rings get a dark drop shadow indicating they are out of position.
 *   The designated (currently active) ring gets a larger, brighter shadow.
 *   Solved rings lose the shadow (snapped into place, no depth cue needed).
 *   Matches ObjC md_outterShadow on selectedCircleView + no shadow on isEnded.
 *
 * ─── Image positioning ────────────────────────────────────────────────────────
 *   Mirrors ObjC updateImageSize: — full-size image centered inside each ring;
 *   the circular clip window creates the "lens / slice" illusion.
 *
 * Replaces: CircleView.m
 */

import React from 'react';
import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import type { RingDescriptor } from '../../game/spinny/types';
import {
  SNAP_ANIMATION_MS,
  SNAP_PULSE_MS,
  SNAP_PULSE_SCALE,
} from '../../constants/gameConstants';

export interface CircleRingProps {
  descriptor:      RingDescriptor;
  rotateAngle:     SharedValue<number>;
  isSolved:        SharedValue<boolean>;
  /** Which ring is currently being dragged (-1 = none). Shadow is stronger on it. */
  activeRingIndex: SharedValue<number>;
  ringIndex:       number;
  ringColor:       string;
  animalImage:     ImageSourcePropType | null;
  boardSize:       number;
  debugMode?:      boolean;
}

export function CircleRing({
  descriptor,
  rotateAngle,
  isSolved,
  activeRingIndex,
  ringIndex,
  ringColor,
  animalImage,
  boardSize,
  debugMode = false,
}: CircleRingProps): React.JSX.Element {
  const { outerRadius, size } = descriptor;

  // ── Snap pulse ────────────────────────────────────────────────────────────
  const scale = useSharedValue(1);

  useAnimatedReaction(
    () => isSolved.value,
    (current, previous) => {
      'worklet';
      if (current && !previous) {
        scale.value = withSequence(
          withTiming(SNAP_PULSE_SCALE, {
            duration: Math.round(SNAP_PULSE_MS * 0.35),
            easing:   Easing.out(Easing.quad),
          }),
          withTiming(1, {
            duration: Math.round(SNAP_PULSE_MS * 0.65),
            easing:   Easing.out(Easing.cubic),
          }),
        );
      }
    },
  );

  useAnimatedReaction(
    () => isSolved.value,
    (current) => {
      'worklet';
      if (!current) scale.value = 1;
    },
  );

  // ── Animated style: rotation + scale + shadow ─────────────────────────────
  // Shadow lives on the outer Animated.View (no overflow:hidden) so iOS does
  // not clip it via masksToBounds.
  // Active (being dragged) ring → strong shadow; all other unsolved → subtle;
  // solved → no shadow (ring is locked in place, no depth cue needed).
  const ringStyle = useAnimatedStyle(() => {
    const solved   = isSolved.value;
    const isActive = !solved && activeRingIndex.value === ringIndex;

    const shadowOpacity = solved ? 0 : (isActive ? 0.65 : 0.28);
    const shadowRadius  = isActive ? 16 : 7;
    const shadowOffsetY = isActive ? 7  : 3;
    const elevation     = solved ? 0 : (isActive ? 14 : 5);

    return {
      opacity:      solved ? 0.95 : 1.0,
      transform:    [{ rotate: `${rotateAngle.value}deg` }, { scale: scale.value }],
      shadowColor:  '#000000',
      shadowOpacity,
      shadowRadius,
      shadowOffset: { width: 0, height: shadowOffsetY },
      elevation,
    };
  });

  // Image offset: center boardSize image inside the ring's local coordinates.
  // ObjC: circleimageView.frame.origin = { ringSize/2 − imgMain.size/2, … }
  const imgOffset = outerRadius - boardSize / 2;

  return (
    // overflow:'hidden' + borderRadius on the same Animated.View works correctly on
    // Android with Reanimated. A separate inner View was used previously but caused
    // the image to be invisible on Android because Android can't apply borderRadius
    // clipping to children of a view that has a hardware layer (elevation/animation)
    // when the clipping view is a different node from the animated one.
    <Animated.View
      style={[
        {
          position:        'absolute',
          width:           size,
          height:          size,
          borderRadius:    outerRadius,
          backgroundColor: ringColor,
          overflow:        'hidden',
        },
        ringStyle,
      ]}
    >
      {animalImage != null && (
        <Image
          source={animalImage}
          style={{
            position: 'absolute',
            width:    boardSize,
            height:   boardSize,
            left:     imgOffset,
            top:      imgOffset,
          }}
          resizeMode="contain"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({});