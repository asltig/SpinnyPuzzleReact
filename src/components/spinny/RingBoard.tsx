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

import React, { useMemo } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Canvas, Path, Group, BlurMask, Skia } from '@shopify/react-native-skia';

import { CircleRing } from './CircleRing';
import type { RingDescriptor } from '../../game/spinny/types';

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
          <Path path={shadowPath} fillType="evenOdd" color="black" opacity={0.55}>
            <BlurMask blur={8} style="normal" />
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
  const center     = boardSize / 2;
  const colorCount = ringColors.length;

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

          return (
            <View
              key={ring.id}
              style={{
                position: 'absolute',
                top:  center - ring.outerRadius,
                left: center - ring.outerRadius,
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
            </View>
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