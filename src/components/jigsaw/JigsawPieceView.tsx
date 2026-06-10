/**
 * JigsawPieceView.tsx
 * Renders one draggable jigsaw piece with:
 *  • Actual puzzle image cropped and clipped to the jigsaw bezier shape (Skia)
 *  • White border drawn around the piece outline (Skia Path stroke)
 *  • Scale/position driven by Reanimated SharedValues
 *  • Pan gesture for drag-to-snap interaction
 *
 * Canvas coordinate space:
 *   Canvas size = (baseW + 2·tabW) × (baseH + 2·tabH)
 *   Base cell occupies (tabW, tabH) → (tabW+baseW, tabH+baseH)
 *   Image is drawn at (-col·baseW+tabW-tabW, ...) adjusted so the
 *   correct tile region shows through the clip path.
 */

import React, { useMemo, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas, Group, Path, Image, useImage, SkImage,
} from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { makePiecePath }    from '../../game/jigsaw/jigsawShapes';
import type { JigsawPieceState } from '../../game/jigsaw/useJigsawGame';

// ─────────────────────────────────────────────
// Image source map (bundled j1-j8)
// ─────────────────────────────────────────────

const JIGSAW_SOURCES: Record<string, ReturnType<typeof require>> = {
  j1: require('../../assets/images/jigsaw/j1.jpg'),
  j2: require('../../assets/images/jigsaw/j2.jpg'),
  j3: require('../../assets/images/jigsaw/j3.jpg'),
  j4: require('../../assets/images/jigsaw/j4.jpg'),
  j5: require('../../assets/images/jigsaw/j5.jpg'),
  j6: require('../../assets/images/jigsaw/j6.jpg'),
  j7: require('../../assets/images/jigsaw/j7.jpg'),
  j8: require('../../assets/images/jigsaw/j8.jpg'),
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface Props {
  state:     JigsawPieceState;
  baseW:     number;  // board piece width (without tabs)
  baseH:     number;  // board piece height (without tabs)
  tabW:      number;  // horizontal tab depth = baseW/4
  tabH:      number;  // vertical tab depth   = baseH/4
  canvasW:   number;  // = baseW + 2·tabW
  canvasH:   number;  // = baseH + 2·tabH
  boardW:    number;  // full board rendered width
  boardH:    number;  // full board rendered height
  imageName: string;  // 'j1'…'j8'
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function JigsawPieceView({
  state, baseW, baseH, tabW, tabH, canvasW, canvasH, boardW, boardH, imageName,
}: Props): React.JSX.Element {
  const { descriptor, posX, posY, scale, isPlaced, isActive, gesture } = state;
  const { row, col, sides } = descriptor;

  // ── Load puzzle image ─────────────────────────────────────────────────────
  const src   = JIGSAW_SOURCES[imageName] ?? JIGSAW_SOURCES['j1']!;
  const image = useImage(src);

  // ── Jigsaw clip path (computed once per piece) ────────────────────────────
  const clipPath = useMemo(
    () => makePiecePath(baseW, baseH, tabW, tabH, sides),
    [baseW, baseH, tabW, tabH, sides],
  );

  // ── Sync placed state JS→Skia (Skia canvas is outside Reanimated tree) ────
  const [placed, setPlaced] = useState(false);
  useAnimatedReaction(
    () => isPlaced.value,
    (v, prev) => { if (v !== prev) runOnJS(setPlaced)(v); },
  );

  // ── Animated position + scale + z-order ──────────────────────────────────
  const animStyle = useAnimatedStyle(() => {
    const s = scale.value;
    return {
      position:   'absolute',
      left:       posX.value,
      top:        posY.value,
      width:      canvasW,
      height:     canvasH,
      zIndex:     isActive.value ? 200 : (isPlaced.value ? 50 : 10),
      opacity:    isActive.value ? 0.92 : 1,
      transform:  [{ scale: s }],
    };
  });

  // ── Image draw offset so the correct tile shows through the clip ───────────
  // The clip path lives at (tabW, tabH)→(tabW+baseW, tabH+baseH) in canvas coords.
  // We draw the full board image at an offset so the piece's tile aligns there:
  //   imgX = tabW - col*baseW
  //   imgY = tabH - row*baseH
  const imgX = tabW - col * baseW;
  const imgY = tabH - row * baseH;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={animStyle} pointerEvents={placed ? 'none' : 'auto'}>
      <GestureDetector gesture={gesture}>
        <View style={{ width: canvasW, height: canvasH }}>
          <Canvas style={StyleSheet.absoluteFill}>
            {image && (
              <Group clip={clipPath}>
                {/* Full board image offset so correct tile shows in clip */}
                <Image
                  image={image}
                  x={imgX}
                  y={imgY}
                  width={boardW}
                  height={boardH}
                  fit="fill"
                />
              </Group>
            )}

            {/* White border stroke around the piece shape */}
            <Path
              path={clipPath}
              color="rgba(255,255,255,0.85)"
              style="stroke"
              strokeWidth={placed ? 0 : 2.5}
            />
          </Canvas>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}