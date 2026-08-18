/**
 * JigsawLevelsScreen.tsx
 * Jigsaw level picker — 5-column serpentine (snake-path) grid.
 *
 * ─── Data ──────────────────────────────────────────────────────────────────────
 *  Calls jigsawService.getJigsawLevels() (bundled j1-j8 + MMKV-cached server
 *  levels) on mount, then kicks off jigsawService.syncJigsawLevels() in the
 *  background — same pipeline as ObjC fetchDownloadedLevelsWithLocalDataFor… +
 *  sendFetchLevelsRequestForVersionWithCompletion.
 *
 * ─── Layout ───────────────────────────────────────────────────────────────────
 *  Dark purple bg + animated dots; FredokaOne title; home button top-left.
 *  5-col snake: even rows L→R (▶ arrows), odd rows R→L (◀ arrows), ▼ at joins.
 *  Stars straddle each cell's top border (half above, half inside).
 *
 * ─── Animations ───────────────────────────────────────────────────────────────
 *  Entry: cells scale+fade in staggered (matches ObjC cell alpha animation).
 *  Tap: brief scale-down then bounce-back via Animated.sequence.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JigsawStackParamList } from '../../navigation/types';
import type { Level } from '../../types/models';

import { useProgressStore }    from '../../stores/useProgressStore';
import { getLevelStars }       from '../../storage/progressStorage';
import { FREE_JIGSAW_COUNT }   from '../../constants/gameConstants';
import { soundService }        from '../../services/audio/soundService';
import { contractCircle } from '../../utils/circularReveal';
import {
  getJigsawLevels,
  syncJigsawLevels,
  type JigsawLevel,
}                              from '../../services/data/jigsawService';

// ─── Design constants (orientation-independent) ───────────────────────────────
const COLS      = 5;
const ARROW_W   = 20;      // px — the ◀/▶ triangle
const ARROW_GAP = 6;       // px each side of an arrow
const MAX_CELL  = 110;     // never exceed this — prevents overflow on small screens
const CORNER_R  = 10;
const STAR_COLS = 3;

const BG_COLOR    = '#2C1A3A';
const CELL_TEAL   = '#5DDAC9';
const CELL_LOCKED = '#4A3858';
const ARROW_CLR   = '#6B5280';

// ─── Floating dots (generated once, positions relative to 1×1 unit square) ───
const DOT_DATA = Array.from({ length: 22 }, (_, i) => ({
  id: i, r: 1.5 + Math.random() * 3,
  rx: Math.random(), ry: Math.random(),
  dur: 3800 + Math.random() * 3400, delay: Math.random() * 2000,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FloatingDot({ dot, W, H }: { dot: (typeof DOT_DATA)[number]; W: number; H: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity    = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.45, 0.08] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.r,
      width: dot.r * 2, height: dot.r * 2, backgroundColor: '#FFF',
      left: dot.rx * W, top: dot.ry * H, opacity, transform: [{ translateY }],
    }} />
  );
}

function RowArrow({ dir }: { dir: 'left' | 'right' }) {
  const half = ARROW_W * 0.36, body = ARROW_W * 0.60;
  const s = dir === 'right'
    ? { borderTopWidth: half, borderBottomWidth: half, borderLeftWidth: body,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: ARROW_CLR }
    : { borderTopWidth: half, borderBottomWidth: half, borderRightWidth: body,
        borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: ARROW_CLR };
  return <View style={s} />;
}

function DownArrow({ size }: { size: number }) {
  const h = size * 0.36, b = size * 0.60;
  return (
    <View style={{
      borderLeftWidth: h, borderRightWidth: h, borderTopWidth: b,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: ARROW_CLR,
    }} />
  );
}

// ─── Level cell ───────────────────────────────────────────────────────────────

interface CellProps {
  level: JigsawLevel;
  displayNum: number;
  isAccessible: boolean;
  /** First accessible + not-yet-completed level — whole box pulses scale. */
  isCurrent: boolean;
  starCount: number;
  cellSize: number;
  starSize: number;
  onPress: () => void;
}

function LevelCell({ level, displayNum, isAccessible, isCurrent, starCount, cellSize, starSize, onPress }: CellProps) {
  // Continuous scale pulse — mirrors YGPulseView scale 1.0→1.1, autoReverse, 0.5s
  // Applied to the entire teal box (not just a border ring).
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCurrent) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); pulseAnim.setValue(1); };
  }, [isCurrent, pulseAnim]);

  const handlePress = useCallback(() => {
    soundService.play('button_click');
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(pressAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
    onPress();
  }, [onPress, pressAnim]);

  const halfStar = starSize / 2;
  const cornerR  = Math.round(cellSize * 0.1);

  // Combine pulse + press into one scale value (multiply keeps them independent)
  const combinedScale = Animated.multiply(pulseAnim, pressAnim);

  return (
    <View style={{ width: cellSize, paddingTop: halfStar }}>
      {/* Stars — absolute, centred on cell's top border */}
      <View style={[ss.starsAbsolute, { top: 0 }]}>
        {[0, 1, 2].map((i) => (
          <Image
            key={i}
            source={i < starCount
              ? require('../../assets/images/star_filled.png')
              : require('../../assets/images/star_empty.png')}
            style={{ width: starSize, height: starSize, marginHorizontal: 2 }}
            resizeMode="contain"
          />
        ))}
      </View>

      {/* Cell box — pulse + press scale applied together to the whole teal box */}
      <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
        <TouchableOpacity
          activeOpacity={isAccessible ? 0.85 : 1}
          onPress={isAccessible ? handlePress : undefined}
          style={[
            ss.cell,
            {
              width: cellSize, height: cellSize,
              borderRadius: cornerR,
              backgroundColor: isAccessible ? CELL_TEAL : CELL_LOCKED,
            },
          ]}
        >
          {isAccessible ? (
            <Text style={[ss.cellNum, { fontSize: Math.round(cellSize * 0.36) }]}>
              {displayNum}
            </Text>
          ) : (
            <Image
              source={require('../../assets/images/lock.png')}
              style={{ width: cellSize * 0.38, height: cellSize * 0.42 }}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<JigsawStackParamList, 'JigsawLevels'>;

export default function JigsawLevelsScreen({ navigation }: Props): React.JSX.Element {
  // Use live dimensions so the layout is always correct regardless of orientation
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);   // landscape long edge
  const H = Math.min(winW, winH);   // landscape short edge

  // ── Computed layout ───────────────────────────────────────────────────────
  const hMargin  = Math.round(W * 0.016);
  const arrowGap = ARROW_GAP;
  const cellRaw  = Math.floor(
    (W - 2 * hMargin - (COLS - 1) * (ARROW_W + 2 * arrowGap)) / COLS,
  );
  const CELL    = Math.min(cellRaw, MAX_CELL);
  const STAR_SZ = Math.round(CELL * 0.28);
  const DA_SZ   = Math.round(CELL * 0.22);   // down-arrow size
  const BTN_SZ  = Math.round(H * 0.13);
  const BTN_X   = Platform.OS === 'ios' ? 14 : 10;

  // ── Data state ────────────────────────────────────────────────────────────
  const [levels, setLevels] = useState<JigsawLevel[]>(() => getJigsawLevels());
  const { isCompleted } = useProgressStore();

  useFocusEffect(useCallback(() => {
    soundService.play('settings_buttons_appear');
    soundService.playMusic('menu_music');

    const fresh = getJigsawLevels();
    setLevels(fresh);

    syncJigsawLevels().then((updated) => {
      if (updated.length !== fresh.length) setLevels(updated);
    });
  }, []));

  // ── Star/accessibility helpers ────────────────────────────────────────────
  const accessible = (idx: number): boolean => {
    if (idx === 0) return true;
    if (idx > FREE_JIGSAW_COUNT) return false;
    const prev = levels[idx - 1];
    return prev ? isCompleted('Jigsaw', prev.name) : false;
  };

  // The "current" level = first accessible level not yet completed.
  // Mirrors ObjC: currentLevel tracks the next puzzle to play.
  const currentLevelIdx = levels.findIndex(
    (jl, i) => accessible(i) && !isCompleted('Jigsaw', jl.name),
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const openLevel = useCallback((jl: JigsawLevel, displayNum: number) => {
    const level: Level = {
      id:              jl.name,
      name:            jl.name,
      packageName:     'Jigsaw',
      imgUrl:          jl.isInitialData ? '' : jl.imgPath,
      imgPath:         jl.imgPath,
      // jl.index = 0-based sorted display position → used by modeForLevelIndex
      // to derive Easy/Medium/Hard. jl.order is negative for bundled levels.
      order:           jl.index,
      imageDownloaded: jl.isInitialData,
      levelCompleted:  isCompleted('Jigsaw', jl.name),
      isInitialData:   jl.isInitialData,
      descrip:         '',
      titleColor:      '#FFFFFF',
    };
    navigation.navigate('JigsawGame', { level });
  }, [isCompleted, navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  // ── Build snake rows ──────────────────────────────────────────────────────
  const rows: number[][] = [];
  for (let i = 0; i < levels.length; i += COLS) {
    rows.push(Array.from({ length: Math.min(COLS, levels.length - i) }, (_, j) => i + j));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {/* Background animated dots */}
      {DOT_DATA.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      <SafeAreaView style={ss.safe}>
        {/* Top bar */}
        <View style={ss.topBar}>
          <TouchableOpacity
            style={[ss.homeBtn, { left: BTN_X }]}
            onPress={goBack}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Image
              source={require('../../assets/images/btnLevels.png')}
              style={{ width: BTN_SZ, height: BTN_SZ }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={[ss.title, { fontSize: Math.round(H * 0.065) }]}>JIGSAW</Text>
          <View style={{ width: BTN_SZ + BTN_X }} />
        </View>

        {/* Snake grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ss.gridContent, { paddingHorizontal: hMargin, paddingTop: Math.round(H * 0.035) }]}
        >
          {rows.map((row, rowIdx) => {
            const isEvenRow  = rowIdx % 2 === 0;
            const displayRow = isEvenRow ? row : [...row].reverse();
            const arrowDir   = isEvenRow ? 'right' : 'left';

            return (
              <View key={rowIdx}>
                {/* Cells + row arrows */}
                <View style={ss.row}>
                  {displayRow.map((levelIdx, colIdx) => {
                    const jl = levels[levelIdx]!;
                    const isAcc = accessible(levelIdx);
                    const starCnt = getLevelStars('Jigsaw', jl.name);

                    return (
                      <React.Fragment key={jl.name}>
                        {colIdx > 0 && (
                          <View style={{
                            width: ARROW_W, height: CELL,
                            marginHorizontal: arrowGap,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <RowArrow dir={arrowDir} />
                          </View>
                        )}
                        <LevelCell
                          level={jl}
                          displayNum={levelIdx + 1}
                          isAccessible={isAcc}
                          isCurrent={levelIdx === currentLevelIdx}
                          starCount={starCnt}
                          cellSize={CELL}
                          starSize={STAR_SZ}
                          onPress={() => openLevel(jl, levelIdx + 1)}
                        />
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* Down arrow between rows */}
                {rowIdx < rows.length - 1 && (
                  <View style={[
                    ss.downRow,
                    isEvenRow ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                    { paddingVertical: Math.round(H * 0.012) },
                  ]}>
                    <View style={{ width: CELL, alignItems: 'center' }}>
                      <DownArrow size={DA_SZ} />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: H * 0.06 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles (non-dynamic)
// ─────────────────────────────────────────────
const ss = StyleSheet.create({
  root:  { flex: 1 },
  safe:  { flex: 1 },

  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 8,
  },
  homeBtn: { position: 'absolute', zIndex: 10 },
  title: {
    flex:          1,
    textAlign:     'center',
    color:         '#FFFFFF',
    fontFamily:    'FredokaOne-Regular',
    letterSpacing: 2,
  },

  gridContent: {},

  row: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },

  downRow: {
    flexDirection: 'row',
  },

  starsAbsolute: {
    position:       'absolute',
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    zIndex:         5,
  },

  cell: {
    borderWidth:    2.5,
    borderColor:    '#FFFFFF',
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellNum: {
    color:      '#FFFFFF',
    fontFamily: 'FredokaOne-Regular',
  },
});
