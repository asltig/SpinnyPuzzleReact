/**
 * RingBoard.tsx
 * Renders all concentric rings and owns the GestureDetector.
 *
 * ─── Ring color mapping ───────────────────────────────────────────────────────
 *   ObjC INTENDED: circle.backgroundColor = gameRingsArray[i-1] for i=4→1
 *   → outermost ring (i=4) gets circleRangeColors[3] (darkest/last)
 *   → innermost ring (i=1) gets circleRangeColors[0] (lightest/first)
 *   We fix the ObjC bug (second assignment that overrides all to [0]) and use
 *   distinct colors per ring so the bands are visually separable.
 *
 * ─── White outer border ───────────────────────────────────────────────────────
 *   Matches ObjC md_outterShadow on the outermost ring — a white stroke that
 *   creates visual separation from the background.
 *
 * Replaces: CustomControl.m + SPGamePlayViewController.createCircles
 */

import React, { useEffect, useMemo } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Canvas, Path, Group, BlurMask, Skia } from '@shopify/react-native-skia';

import { CircleRing } from './CircleRing';
import { soundService } from '../../services/audio/soundService';
import type { RingDescriptor } from '../../game/spinny/types';

// ─── Ring entry animation ─────────────────────────────────────────────────────
// On mount, rings pop in smallest (innermost) first, growing outward: each
// starts at scale 0 pinned to the board's center point (every ring's box is
// already concentric, so the default center-anchored transform does this for
// free) and grows to full size while unwinding an extra spin. Animal Reveal
// Ring <id> plays as each ring starts its reveal — id 1 = innermost/smallest.
const RING_ENTRY_DURATION_MS = 315; // 450 * 0.7 — 30% faster
// Next ring only starts once the previous one's grow+spin has fully finished
// (and its short reveal sound has long since played out) — a strict
// stagger < duration was firing all 4 sounds within ~450ms total, while the
// rings themselves kept animating for 900ms+, so it read as rushed/garbled.
const RING_ENTRY_STAGGER_MS  = RING_ENTRY_DURATION_MS;
const RING_ENTRY_SPIN_DEG    = 540; // extra spin unwound while growing in

function RingEntryWrapper({
  ring,
  order,
  style,
  children,
}: {
  ring:     RingDescriptor;
  /** 0 = revealed first (smallest ring), increasing outward. */
  order:    number;
  style:    { position: 'absolute'; top: number; left: number; width: number; height: number };
  children: React.ReactNode;
}): React.JSX.Element {
  const scale = useSharedValue(0);
  const spin  = useSharedValue(RING_ENTRY_SPIN_DEG);

  useEffect(() => {
    const delay = order * RING_ENTRY_STAGGER_MS;
    scale.value = withDelay(delay, withTiming(1, { duration: RING_ENTRY_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    spin.value  = withDelay(delay, withTiming(0, { duration: RING_ENTRY_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    const soundTimer = setTimeout(() => soundService.play(`animal_reveal_ring_${ring.id}`), delay);
    return () => clearTimeout(soundTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }],
  }));

  return (
    <Animated.View style={[style, animStyle]}>
      {children}
    </Animated.View>
  );
}

interface RingBoardProps {
  boardSize:        number;
  ringDescriptors:  RingDescriptor[];
  ringAngles:       SharedValue<number>[];
  ringSolved:       SharedValue<boolean>[];
  activeRingIndex:  SharedValue<number>;
  panGesture:       GestureType;
  ringColors:       string[];
  /** Color shared by all rings before the puzzle is solved. */
  uniformRingColor: string;
  /** 0 = uniform color; 1 = individual solved colors. */
  colorProgress:    SharedValue<number>;
  animalImage:      ImageSourcePropType | null;
}

// Inner shadow at small r going toward center — replicates ObjC md_innerShadow.
// Uses Skia's even-odd path trick: large rect + circular hole. BlurMask spreads
// the fill inward through the hole, creating a real soft shadow toward center.
// Rendered above all rings so the shadow is visible on ring N+1's surface.
function InnerRingShadow({
  center,
  innerRadius,
  ringIndex,
  activeRingIndex,
  ringSolved,
}: {
  center:          number;
  innerRadius:     number;
  ringIndex:       number;
  activeRingIndex: SharedValue<number>;
  ringSolved:      SharedValue<boolean>;
}): React.JSX.Element {
  const size = innerRadius * 2;

  // Large rect with circular hole — even-odd fill. Blur spreads inward through
  // the hole exactly as ObjC CAShapeLayer + kCAFillRuleEvenOdd does.
  const shadowPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRect(Skia.XYWHRect(-60, -60, size + 120, size + 120));
    p.addCircle(innerRadius, innerRadius, innerRadius);
    return p;
  }, [size, innerRadius]);

  // Clip to the inner circle so the shadow only appears toward the center.
  const clipPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(innerRadius, innerRadius, innerRadius);
    return p;
  }, [innerRadius]);

  const style = useAnimatedStyle(() => ({
    opacity: (!ringSolved.value && activeRingIndex.value === ringIndex) ? 1 : 0,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: center - innerRadius, left: center - innerRadius },
        style,
      ]}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group clip={clipPath}>
          {/* Bumped up from 0.55/8 for a stronger inward groove shadow, to match. */}
          <Path path={shadowPath} fillType="evenOdd" color="black" opacity={0.7}>
            <BlurMask blur={11} style="normal" />
          </Path>
        </Group>
      </Canvas>
    </Animated.View>
  );
}

export function RingBoard({
  boardSize,
  ringDescriptors,
  ringAngles,
  ringSolved,
  activeRingIndex,
  panGesture,
  ringColors,
  uniformRingColor,
  colorProgress,
  animalImage,
}: RingBoardProps): React.JSX.Element {
  const center = boardSize / 2;
  // Index by the actual ring count, not the color palette length, so a
  // level with fewer rings than colors still ends on circleRangeColors[0]
  // (lightest) at the innermost ring instead of skipping it.
  const colorCount = ringDescriptors.length;

  return (
    <GestureDetector gesture={panGesture}>
      {/* collapsable={false} keeps the node alive so gesture coords stay accurate */}
      <View
        style={[styles.board, { width: boardSize, height: boardSize }]}
        collapsable={false}
      >
        {/*
         * 3D pop-out background image — mirrors ObjC self.mainImage.
         *
         * In ObjC, self.mainImage (screenHeight × screenHeight) sits BEHIND the
         * ring board (screenHeight / 1.25 wide).  The image is 25% larger than
         * the ring circle diameter, so it peeks ~12 % per side beyond the outer
         * ring — giving the animal a "floating above" depth illusion.
         *
         * In RN: boardSize = SCREEN_H (full short edge).
         * Outermost ring diameter = boardSize × 0.8 (computeRingDescriptors).
         * This image (boardSize × boardSize) therefore extends ~10 % per side
         * beyond the ring circle, exactly replicating the ObjC effect.
         *
         * pointerEvents="none" keeps gesture handling on the rings.
         */}
        {animalImage != null && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={animalImage}
              style={styles.bgImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Outermost ring first (behind), innermost last (in front) */}
        {ringDescriptors.map((ring, i) => {
          // Map ring index → color:
          // i=0 (outermost) → circleRangeColors[last] (darkest)
          // i=last (innermost) → circleRangeColors[0] (lightest)
          const colorIdx = colorCount - 1 - (i % colorCount);
          const ringColor = ringColors[colorIdx] ?? '#888888';
          // Reveal order: innermost (highest i) first, outward to i=0 last.
          const entryOrder = ringDescriptors.length - 1 - i;

          return (
            <RingEntryWrapper
              key={ring.id}
              ring={ring}
              order={entryOrder}
              style={{
                position: 'absolute',
                top:    center - ring.outerRadius,
                left:   center - ring.outerRadius,
                width:  ring.size,
                height: ring.size,
              }}
            >
              <CircleRing
                descriptor={ring}
                rotateAngle={ringAngles[i]!}
                isSolved={ringSolved[i]!}
                activeRingIndex={activeRingIndex}
                ringIndex={i}
                uniformColor={uniformRingColor}
                solvedColor={ringColor}
                colorProgress={colorProgress}
                animalImage={animalImage}
                boardSize={boardSize}
              />
            </RingEntryWrapper>
          );
        })}
        {/* Inner shadows at small r — rendered above all rings so the shadow
            appears on the next ring's surface going toward the center.
            Skipped for the innermost ring (innerRadius === 0). */}
        {ringDescriptors.map((ring, i) =>
          ring.innerRadius > 0 ? (
            <InnerRingShadow
              key={`irs-${ring.id}`}
              center={center}
              innerRadius={ring.innerRadius}
              ringIndex={i}
              activeRingIndex={activeRingIndex}
              ringSolved={ringSolved[i]!}
            />
          ) : null,
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: 'transparent',
  },
  // Fills the board square — the outermost ring occupies 80 % of this,
  // so the image naturally extends 10 % per side beyond the ring circle.
  bgImage: {
    position: 'absolute',
    width:    '100%',
    height:   '100%',
  },
});