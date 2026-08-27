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
import { Image, Platform, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
  interpolateColor,
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
  /** Color used for all rings before the puzzle is solved. */
  uniformColor:    string;
  /** Individual color this ring animates to after solve. */
  solvedColor:     string;
  /** 0 = all rings show uniformColor; 1 = each ring shows its solvedColor. */
  colorProgress:   SharedValue<number>;
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
  uniformColor,
  solvedColor,
  colorProgress,
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

    // Only the selected (active) ring shows a shadow — all others are flat.
    // Values from ObjC UIView+ShadowsIO: shadowRadius macro = 8, offset (0,0).
    // Bumped up from the original 0.70/8/8 for a stronger "lifted" groove look.
    const shadowOpacity = isActive ? 0.85 : 0;
    const shadowRadius  = 11;
    const shadowOffsetY = 0;
    const elevation     = isActive ? 11 : 0;

    const backgroundColor = interpolateColor(
      colorProgress.value,
      [0, 1],
      [uniformColor, solvedColor],
    );

    return {
      backgroundColor,
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

  const ringBase = {
    position:     'absolute' as const,
    width:        size,
    height:       size,
    borderRadius: outerRadius,
  };

  const animalImg = animalImage != null ? (
    <Image
      source={animalImage}
      style={{ position: 'absolute', width: boardSize, height: boardSize, left: imgOffset, top: imgOffset }}
      resizeMode="contain"
    />
  ) : null;

  if (Platform.OS === 'android') {
    // Android: single layer — overflow:hidden clips the image correctly;
    // elevation still shows a drop shadow on Android even with overflow:hidden.
    return (
      <Animated.View style={[ringBase, { overflow: 'hidden' }, ringStyle]}>
        {animalImg}
      </Animated.View>
    );
  }

  // iOS: two-layer structure.
  // Outer Animated.View — has backgroundColor + borderRadius so iOS knows the
  // shadow path is a circle, but NO overflow:hidden so the shadow is not clipped.
  // Inner View — overflow:hidden clips the animal image to the circular window.
  return (
    <Animated.View style={[ringBase, ringStyle]}>
      <View
        style={{
          position:     'absolute',
          top:           0,
          left:          0,
          width:         size,
          height:        size,
          borderRadius:  outerRadius,
          overflow:      'hidden',
        }}
      >
        {animalImg}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({});