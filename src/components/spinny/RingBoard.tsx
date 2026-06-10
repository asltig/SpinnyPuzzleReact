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

import React from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { type SharedValue } from 'react-native-reanimated';

import { CircleRing } from './CircleRing';
import type { RingDescriptor } from '../../game/spinny/types';

interface RingBoardProps {
  boardSize:       number;
  ringDescriptors: RingDescriptor[];
  ringAngles:      SharedValue<number>[];
  ringSolved:      SharedValue<boolean>[];
  activeRingIndex: SharedValue<number>;
  panGesture:      GestureType;
  ringColors:      string[];
  animalImage:     ImageSourcePropType | null;
}

export function RingBoard({
  boardSize,
  ringDescriptors,
  ringAngles,
  ringSolved,
  activeRingIndex,
  panGesture,
  ringColors,
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
                ringColor={ringColor}
                animalImage={animalImage}
                boardSize={boardSize}
              />
            </View>
          );
        })}
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