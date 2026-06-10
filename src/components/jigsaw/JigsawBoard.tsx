/**
 * JigsawBoard.tsx
 * The puzzle board: ghost background image + white border + draggable pieces.
 *
 * Layer order (bottom → top):
 *   1. Ghost image (full puzzle at alpha 0.2) — Skia Image
 *   2. White board border (1.5pt) — View border
 *   3. Near-target slot highlights — Animated.View per piece
 *   4. Placed piece reveals — shown by JigsawPieceView when isPlaced=true
 *   5. Draggable pieces — JigsawPieceView (absolute, overflow visible)
 *
 * Mirrors ObjC: bg alpha=0.2 ghost + vwBorder 1.5pt white + piece views.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Canvas, Image, useImage } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import { JigsawPieceView }   from './JigsawPieceView';
import type { JigsawPieceState } from '../../game/jigsaw/useJigsawGame';
import type { JigsawPiece } from '../../game/jigsaw/types';

// ─────────────────────────────────────────────
// Image source map
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
// Slot near-target highlight
// ─────────────────────────────────────────────

interface SlotHighlightProps {
  x: number; y: number; w: number; h: number;
  isNearTarget: SharedValue<boolean>;
}

function SlotHighlight({ x, y, w, h, isNearTarget }: SlotHighlightProps) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(isNearTarget.value ? 1 : 0, { duration: 80 }),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute', left: x, top: y, width: w, height: h,
        borderRadius: 8, borderWidth: 2,
        borderColor: 'rgba(93,220,201,0.85)',
        backgroundColor: 'rgba(93,220,201,0.15)',
      }, style]}
    />
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface JigsawBoardProps {
  /** Board position and size on screen (absolute). */
  boardX:      number;
  boardY:      number;
  boardW:      number;
  boardH:      number;
  baseW:       number;
  baseH:       number;
  tabW:        number;
  tabH:        number;
  canvasW:     number;
  canvasH:     number;
  pieces:      JigsawPiece[];
  pieceStates: JigsawPieceState[];
  imageName:   string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function JigsawBoard({
  boardX, boardY, boardW, boardH,
  baseW, baseH, tabW, tabH, canvasW, canvasH,
  pieces, pieceStates, imageName,
}: JigsawBoardProps): React.JSX.Element {
  const src   = JIGSAW_SOURCES[imageName] ?? JIGSAW_SOURCES['j1']!;
  const image = useImage(src);

  return (
    <>
      {/* ── Board background (ghost image + white border) ── */}
      <View
        style={[
          styles.board,
          {
            left:        boardX,
            top:         boardY,
            width:       boardW,
            height:      boardH,
          },
        ]}
        pointerEvents="none"
      >
        {/* Ghost image at 0.2 opacity (ObjC: bg.alpha = 0.2) */}
        <Canvas style={StyleSheet.absoluteFill}>
          {image && (
            <Image
              image={image}
              x={0} y={0}
              width={boardW}
              height={boardH}
              fit="fill"
              opacity={0.22}
            />
          )}
        </Canvas>
      </View>

      {/* ── Near-target slot highlights ── */}
      {pieces.map((piece, i) => {
        const state = pieceStates[i];
        if (!state) return null;
        // Target slot position relative to SCREEN (absolute)
        const slotX = boardX + piece.col * baseW;
        const slotY = boardY + piece.row * baseH;
        return (
          <SlotHighlight
            key={`hl_${piece.id}`}
            x={slotX} y={slotY} w={baseW} h={baseH}
            isNearTarget={state.isNearTarget}
          />
        );
      })}

      {/* ── Draggable pieces (all absolute on the game screen) ── */}
      {pieceStates.map((state) => (
        <JigsawPieceView
          key={`piece_${state.descriptor.id}`}
          state={state}
          baseW={baseW} baseH={baseH}
          tabW={tabW}   tabH={tabH}
          canvasW={canvasW} canvasH={canvasH}
          boardW={boardW}   boardH={boardH}
          imageName={imageName}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  board: {
    position:   'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 4,
    overflow:    'hidden',
  },
});