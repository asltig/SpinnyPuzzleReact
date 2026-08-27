/**
 * SerpentineLevelGrid.tsx
 * Shared 5-column snake-path level picker grid — used by JigsawLevelsScreen
 * and PatchworkLevelsScreen. Visual design ported from JigsawLevelsMap.jsx
 * (dark purple bg, rounded-square nodes, connecting chevron arrows, pulsing
 * ring on the current level).
 *
 * Game screens compute a flat array of SerpentineLevelNode from their own
 * level data (state/tappable/stars/onPress); this component only knows how
 * to lay them out in the snake pattern with connecting arrows and per-state
 * styling — no game-specific data types here.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { soundService } from '../../services/audio/soundService';

export type SerpentineLevelState = 'done' | 'current' | 'available' | 'locked';

export interface SerpentineLevelNode {
  key:         string;
  displayNum:  number;
  state:       SerpentineLevelState;
  /** Whether a tap does anything — a paywall-locked node stays tappable
   *  (opens the purchase prompt) even though it's visually locked. */
  tappable:    boolean;
  starCount:   number;
  /** Real per-level thumbnail/scene image, if the game has one (Patchwork).
   *  Always shown as the cell's background when present, regardless of
   *  state; games without thumbnails (Jigsaw) fall back to abstract
   *  state-based styling (number / placeholder / lock). */
  thumbnail?:  ImageSourcePropType;
  onPress:     () => void;
}

interface Props {
  nodes:          SerpentineLevelNode[];
  /** Cell height ÷ width — 1 = square (default). Patchwork's scene images
   *  are wider than tall, so it passes something < 1. */
  aspectRatio?:   number;
  /** Extra space below the last row. Defaults to a size relative to screen height. */
  bottomPadding?: number;
}

const COLS      = 5;
const ARROW_W   = 20;
const ARROW_GAP = 6;
const MAX_CELL  = 110;

const ACCENT      = '#a06adf'; // done
const MINT        = '#5fe0c0'; // current / available
const LOCKED_BG   = 'rgba(255,255,255,0.07)';
const BORDER_SOFT = 'rgba(255,255,255,0.3)';
const ARROW_CLR   = 'rgba(255,255,255,0.32)';

const STAR_PATH =
  'M12,2.3c0.6,0,1.1,0.4,1.3,0.9l1.6,3.9c0.2,0.4,0.6,0.7,1,0.8l4.2,0.5c1.3,0.2,1.9,1.9,0.9,2.8l-3.1,2.9 c-0.4,0.3-0.5,0.8-0.4,1.3l0.9,4.1c0.3,1.3-1.1,2.4-2.3,1.7l-3.7-2.1c-0.4-0.2-0.9-0.2-1.3,0l-3.7,2.1c-1.2,0.7-2.6-0.3-2.3-1.7 l0.9-4.1c0.1-0.5-0.1-1-0.4-1.3l-3.1-2.9c-1-0.9-0.4-2.6,0.9-2.8l4.2-0.5c0.5-0.1,0.9-0.4,1-0.8l1.6-3.9C10.9,2.7,11.4,2.3,12,2.3z';

// ─── Star — same as SpinnyLevelsScreen's: two-tone gold with a white glow ──────

function Star({ size }: { size: number }): React.JSX.Element {
  return (
    <View style={{ shadowColor: '#fff', shadowRadius: 4, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR_PATH} fill="#e8930a" transform="translate(0,1)" />
        <Path d={STAR_PATH} fill="#ffcb3d" />
      </Svg>
    </View>
  );
}

// ─── Arrows ───────────────────────────────────────────────────────────────────

function RowArrow({ dir }: { dir: 'left' | 'right' }): React.JSX.Element {
  const half = ARROW_W * 0.36, body = ARROW_W * 0.60;
  const s = dir === 'right'
    ? { borderTopWidth: half, borderBottomWidth: half, borderLeftWidth: body,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: ARROW_CLR }
    : { borderTopWidth: half, borderBottomWidth: half, borderRightWidth: body,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: ARROW_CLR };
  return <View style={s} />;
}

function DownArrow({ size }: { size: number }): React.JSX.Element {
  const h = size * 0.36, b = size * 0.60;
  return (
    <View style={{
      borderLeftWidth: h, borderRightWidth: h, borderTopWidth: b,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: ARROW_CLR,
    }} />
  );
}

// ─── Current-level pulse — expanding, fading ring ──────────────────────────────

function CurrentPulseRing({ size }: { size: number }): React.JSX.Element {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size, borderRadius: Math.round(size * 0.24),
        borderWidth: 3, borderColor: '#ffffff', transform: [{ scale }], opacity,
      }}
    />
  );
}

// ─── Level cell ───────────────────────────────────────────────────────────────

function LevelCell({
  node, cellW, cellH, starSize,
}: {
  node:     SerpentineLevelNode;
  cellW:    number;
  cellH:    number;
  starSize: number;
}): React.JSX.Element {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const halfStar  = starSize / 2;
  const cornerR   = Math.round(Math.min(cellW, cellH) * 0.24);
  const iconSize  = Math.min(cellW, cellH);
  const isCurrent = node.state === 'current';

  // Continuous breathing scale on the current level's cell — makes it clearly
  // stand out from the grid without needing to wait for the CurrentPulseRing loop.
  useEffect(() => {
    if (!isCurrent) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 550, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0,  duration: 550, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); pulseAnim.setValue(1); };
  }, [isCurrent, pulseAnim]);

  const handlePress = () => {
    soundService.play('button_click');
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(pressAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
    node.onPress();
  };

  const bg = node.thumbnail ? undefined
    : node.state === 'done' ? ACCENT
    : node.state === 'current' || node.state === 'available' ? MINT
    : LOCKED_BG;
  const border = node.state === 'locked' ? BORDER_SOFT : '#ffffff';

  // Only earned stars render at all — no dimmed/empty placeholders — and the
  // middle star is bigger when all 3 are earned. Matches JigsawLevelsMap.jsx
  // exactly (no star row at all until at least 1 is earned).
  const starMidSize = node.starCount === 3 ? starSize * 1.3 : starSize;

  return (
    <View style={{ width: cellW, paddingTop: halfStar }}>
      {node.starCount > 0 && (
        <View style={[gridStyles.starsAbsolute, { top: 0 }]}>
          {node.starCount >= 2 && <Star size={starSize} />}
          <Star size={starMidSize} />
          {node.starCount >= 3 && <Star size={starSize} />}
        </View>
      )}

      <Animated.View style={{ transform: [{ scale: pressAnim }, { scale: pulseAnim }] }}>
        <TouchableOpacity
          activeOpacity={node.tappable ? 0.85 : 1}
          onPress={node.tappable ? handlePress : undefined}
          style={[
            gridStyles.cell,
            { width: cellW, height: cellH, borderRadius: cornerR, backgroundColor: bg, borderColor: border },
          ]}
        >
          {node.thumbnail && (
            <Image source={node.thumbnail} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          {isCurrent ? <CurrentPulseRing size={iconSize} /> : null}

          {node.state === 'locked' ? (
            <View style={node.thumbnail ? gridStyles.lockOverlay : undefined}>
              <Image
                source={require('../../assets/images/lock.png')}
                style={{ width: iconSize * 0.38, height: iconSize * 0.42 }}
                resizeMode="contain"
              />
            </View>
          ) : node.thumbnail ? null : (
            <Text style={[gridStyles.cellNum, { fontSize: Math.round(iconSize * 0.36) }]}>
              {node.displayNum}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function SerpentineLevelGrid({ nodes, aspectRatio = 1, bottomPadding }: Props): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  const hMargin = Math.round(W * 0.016);
  const cellRaw = Math.floor((W - 2 * hMargin - (COLS - 1) * (ARROW_W + 2 * ARROW_GAP)) / COLS);
  const CELL_W  = Math.min(cellRaw, MAX_CELL);
  const CELL_H  = Math.round(CELL_W * aspectRatio);
  const STAR_SZ = Math.round(CELL_W * 0.28);
  const DA_SZ   = Math.round(CELL_W * 0.22);

  const rows: number[][] = [];
  for (let i = 0; i < nodes.length; i += COLS) {
    rows.push(Array.from({ length: Math.min(COLS, nodes.length - i) }, (_, j) => i + j));
  }

  return (
    <View style={{ paddingHorizontal: hMargin, paddingTop: Math.round(H * 0.035) }}>
      {rows.map((row, rowIdx) => {
        const isEvenRow  = rowIdx % 2 === 0;
        const displayRow = isEvenRow ? row : [...row].reverse();
        const arrowDir   = isEvenRow ? 'right' : 'left';

        return (
          <View key={rowIdx}>
            <View style={gridStyles.row}>
              {displayRow.map((idx, colIdx) => (
                <React.Fragment key={nodes[idx]!.key}>
                  {colIdx > 0 && (
                    <View style={{
                      width: ARROW_W, height: CELL_H, marginHorizontal: ARROW_GAP,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <RowArrow dir={arrowDir} />
                    </View>
                  )}
                  <LevelCell node={nodes[idx]!} cellW={CELL_W} cellH={CELL_H} starSize={STAR_SZ} />
                </React.Fragment>
              ))}
            </View>

            {rowIdx < rows.length - 1 && (
              <View style={[
                gridStyles.downRow,
                isEvenRow ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                { paddingVertical: Math.round(H * 0.012) },
              ]}>
                <View style={{ width: CELL_W, alignItems: 'center' }}>
                  <DownArrow size={DA_SZ} />
                </View>
              </View>
            )}
          </View>
        );
      })}
      <View style={{ height: bottomPadding ?? H * 0.06 }} />
    </View>
  );
}

const gridStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-end' },
  downRow: { flexDirection: 'row' },
  starsAbsolute: {
    position: 'absolute', left: 0, right: 0, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', zIndex: 5,
  },
  cell: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellNum: { color: '#ffffff', fontFamily: 'FredokaOne-Regular' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
});
