/**
 * MemoryLevelsScreen.tsx
 * Memory Match levels — serpentine snake grid matching screenshot IMG_1470.PNG.
 *
 * Design spec (from screenshot):
 *  • Light green background (#9FD555)
 *  • 5-column snake grid (same pattern as Jigsaw levels)
 *  • Unlocked cells: sky blue (#7DD6F5), white number, white border
 *  • Locked cells: dark charcoal (#545468), gray padlock, white border
 *  • 3 large stars straddle each cell's top border (gold/gray)
 *  • Small triangle arrows (◀/▶) between cells, ▼ at row transitions
 *  • "MEMORY MATCH" white outlined title centered at top
 *  • Blue circle home button top-left (btnHome.png)
 *  • Floating white dots
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions, SafeAreaView, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MemoryLevelsScreenProps } from '../../navigation/types';
import { useProgressStore } from '../../stores/useProgressStore';
import { getLevelStars }    from '../../storage/progressStorage';
import { soundService }     from '../../services/audio/soundService';
import { contractCircle }  from '../../utils/circularReveal';

// ─── Design constants ─────────────────────────────────────────────────────────
const TOTAL     = 30;
const COLS      = 5;
const BG_COLOR  = '#9FD555';   // light lime green
const CELL_BLUE = '#7DD6F5';   // sky blue — unlocked cell
const CELL_DARK = '#545468';   // charcoal — locked cell
const ARROW_CLR = 'rgba(255,255,255,0.75)';

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 18 }, (_, i) => ({
  id: i, r: 2.5 + Math.random() * 4,
  rx: Math.random(), ry: Math.random(),
  dur: 3800 + Math.random() * 3200, delay: Math.random() * 2200,
}));

function FloatingDot({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity    = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.55, 0.1] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.r,
      width: dot.r * 2, height: dot.r * 2, backgroundColor: '#FFFFFF',
      left: dot.rx * W, top: dot.ry * H, opacity, transform: [{ translateY }],
    }} />
  );
}

// ─── ▶ / ◀ row arrows ────────────────────────────────────────────────────────
function RowArrow({ dir }: { dir: 'left' | 'right' }) {
  const h = 8, b = 12;
  const s = dir === 'right'
    ? { borderTopWidth: h, borderBottomWidth: h, borderLeftWidth: b,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: ARROW_CLR }
    : { borderTopWidth: h, borderBottomWidth: h, borderRightWidth: b,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: ARROW_CLR };
  return <View style={s} />;
}

// ─── ▼ down arrow ─────────────────────────────────────────────────────────────
function DownArrow() {
  return <View style={{
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: ARROW_CLR,
  }} />;
}

// ─── Single level cell ────────────────────────────────────────────────────────
interface CellProps {
  number:    number;   // 1-based display
  unlocked:  boolean;
  current:   boolean;  // first accessible + not completed (pulse)
  stars:     number;   // 0-3
  cellW:     number;
  cellH:     number;
  starSz:    number;
  onPress:   () => void;
}

function LevelCell({ number, unlocked, current, stars, cellW, cellH, starSz, onPress }: CellProps) {
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!current) { pulseScale.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseScale, { toValue: 1.08, duration: 550, useNativeDriver: true }),
      Animated.timing(pulseScale, { toValue: 1.0,  duration: 550, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); pulseScale.setValue(1); };
  }, [current, pulseScale]);

  const halfStar = starSz / 2;
  const cornerR  = Math.round(cellW * 0.12);

  return (
    <View style={{ width: cellW, paddingTop: halfStar, alignItems: 'center' }}>
      {/* Stars — half above cell top border */}
      <View style={[ss.starsAbs, { top: 0 }]}>
        {[0, 1, 2].map((i) => (
          <Image key={i}
            source={i < stars
              ? require('../../assets/images/star_filled.png')
              : require('../../assets/images/star_empty.png')}
            style={{ width: starSz, height: starSz, marginHorizontal: 1 }}
            resizeMode="contain"
          />
        ))}
      </View>

      {/* Cell body */}
      <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
        <TouchableOpacity
          activeOpacity={unlocked ? 0.80 : 1}
          onPress={unlocked ? onPress : undefined}
          style={[ss.cell, {
            width:           cellW,
            height:          cellH,
            borderRadius:    cornerR,
            backgroundColor: unlocked ? CELL_BLUE : CELL_DARK,
          }]}
        >
          {unlocked ? (
            <Text style={[ss.cellNum, { fontSize: Math.round(cellH * 0.42) }]}>{number}</Text>
          ) : (
            <Image source={require('../../assets/images/lock.png')}
              style={{ width: cellW * 0.40, height: cellH * 0.42 }} resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MemoryLevelsScreen({ navigation }: MemoryLevelsScreenProps): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  const { isCompleted } = useProgressStore();
  const [, setTick] = useState(0);

  useFocusEffect(useCallback(() => {
    setTick((t) => t + 1);
    soundService.playMusic('menu_music');
  }, []));

  // Measure actual grid width via onLayout
  const [gridW, setGridW] = useState(0);

  const ARROW_W    = 18;
  const ARROW_GAP  = 6;
  const SIDE_PAD   = 12;
  const cellW = gridW > 0
    ? Math.min(Math.floor((gridW - SIDE_PAD * 2 - (COLS - 1) * (ARROW_W + ARROW_GAP * 2)) / COLS), 160)
    : 0;
  const cellH   = cellW > 0 ? Math.round(cellW * 1.1) : 0;  // slightly taller than wide
  const starSz  = Math.round(cellW * 0.30);
  const daSize  = Math.round(cellW * 0.15);
  const BTN_SZ  = Math.round(H * 0.13);

  const levels = Array.from({ length: TOTAL }, (_, i) => i);

  const accessible = (idx: number) =>
    idx === 0 || isCompleted('Memory', `level_${idx - 1}`);

  const currentIdx = levels.findIndex(
    (i) => accessible(i) && !isCompleted('Memory', `level_${i}`),
  );

  const openLevel = useCallback((lvl: number) => {
    soundService.play('button_click');
    navigation.navigate('MemoryGame', { level: lvl });
  }, [navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  // Snake rows
  const rows: number[][] = [];
  for (let i = 0; i < TOTAL; i += COLS) {
    rows.push(Array.from({ length: Math.min(COLS, TOTAL - i) }, (_, j) => i + j));
  }

  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      <SafeAreaView style={ss.safe}>
        {/* Top bar */}
        <View style={ss.topBar}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Image source={require('../../assets/images/btnHome.png')}
              style={{ width: BTN_SZ, height: BTN_SZ }} resizeMode="contain" />
          </TouchableOpacity>

          {/* "MEMORY MATCH" — white with dark shadow for outline effect */}
          <Text style={[ss.title, { fontSize: Math.round(H * 0.068) }]}>
            MEMORY MATCH
          </Text>
          <View style={{ width: BTN_SZ }} />
        </View>

        {/* Snake grid */}
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}>
          <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
            style={{ paddingHorizontal: SIDE_PAD }}>

            {cellW > 0 && rows.map((row, rowIdx) => {
              const isEvenRow  = rowIdx % 2 === 0;
              const displayRow = isEvenRow ? row : [...row].reverse();
              const arrowDir   = isEvenRow ? 'right' : 'left';

              return (
                <View key={rowIdx}>
                  {/* Cells + arrows */}
                  <View style={ss.row}>
                    {displayRow.map((levelIdx, colIdx) => (
                      <React.Fragment key={levelIdx}>
                        {colIdx > 0 && (
                          <View style={{
                            width: ARROW_W, height: cellH,
                            marginHorizontal: ARROW_GAP,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <RowArrow dir={arrowDir} />
                          </View>
                        )}
                        <LevelCell
                          number={levelIdx + 1}
                          unlocked={accessible(levelIdx)}
                          current={levelIdx === currentIdx}
                          stars={getLevelStars('Memory', `level_${levelIdx}`)}
                          cellW={cellW}
                          cellH={cellH}
                          starSz={starSz}
                          onPress={() => openLevel(levelIdx)}
                        />
                      </React.Fragment>
                    ))}
                  </View>

                  {/* Down arrow between rows */}
                  {rowIdx < rows.length - 1 && (
                    <View style={[ss.downRow,
                      isEvenRow ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                    ]}>
                      <View style={{ width: cellW, alignItems: 'center', paddingVertical: 6 }}>
                        <DownArrow />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  title: {
    flex:          1,
    textAlign:     'center',
    color:         '#FFFFFF',
    fontFamily:    'FredokaOne-Regular',
    letterSpacing: 2,
    // Outline effect matching ObjC white stroke text
    textShadowColor:  '#4A8A20',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius:  2,
  },

  row: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    paddingTop:    0,
  },
  downRow: {
    flexDirection: 'row',
  },

  // Stars absolutely centred on cell top border
  starsAbs: {
    position:       'absolute',
    left:            0,
    right:           0,
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    zIndex:          5,
  },

  cell: {
    borderWidth:    2.5,
    borderColor:    '#FFFFFF',
    alignItems:     'center',
    justifyContent: 'center',
    // Soft shadow for depth
    shadowColor:    '#000',
    shadowOpacity:  0.2,
    shadowRadius:   4,
    shadowOffset:   { width: 0, height: 3 },
    elevation:      4,
  },
  cellNum: {
    color:      '#FFFFFF',
    fontFamily: 'FredokaOne-Regular',
    // White text with dark green shadow = outline effect from screenshot
    textShadowColor:  '#3A7A10',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius:  3,
  },
});