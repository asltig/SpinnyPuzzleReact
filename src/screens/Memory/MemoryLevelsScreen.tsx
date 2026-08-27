/**
 * MemoryLevelsScreen.tsx
 * Memory level picker — same 5-column serpentine (snake-path) grid, back
 * button and title-bar style as JigsawLevelsScreen/PatchworkLevelsScreen
 * (shared SerpentineLevelGrid component), with the background colour
 * matching MemoryGameScreen's gameplay background.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { MemoryLevelsScreenProps } from '../../navigation/types';

import { useProgressStore }    from '../../stores/useProgressStore';
import { getLevelStars }       from '../../storage/progressStorage';
import { soundService }        from '../../services/audio/soundService';
import { contractCircle } from '../../utils/circularReveal';
import { isLevelLockedByPaywall } from '../../services/monetization/monetizationService';
import { FullPackagePaywallModal } from '../../components/FullPackagePaywallModal';
import { SerpentineLevelGrid, type SerpentineLevelNode } from '../../components/levelMap/SerpentineLevelGrid';
import { LEVELS_BG_COLOR } from '../../constants/gameColors';

// ─── Design constants ──────────────────────────────────────────────────────────
const TOTAL    = 30;
const BG_COLOR = LEVELS_BG_COLOR.memory;

// Back button — same size/padding/style as JigsawLevelsScreen's (ported from SpinnyLevelsScreen's).
const IS_PAD = Platform.isPad;
const BTN_X  = Platform.OS === 'ios' ? 20 : 16;

// ─── Floating dots (generated once, positions relative to 1×1 unit square) ───
const DOT_DATA = Array.from({ length: 22 }, (_, i) => ({
  id: i, r: 1.5 + Math.random() * 3,
  rx: Math.random(), ry: Math.random(),
  dur: 3800 + Math.random() * 3400, delay: Math.random() * 2000,
}));

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

function BackChevron({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#e3435a" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function MemoryLevelsScreen({ navigation }: MemoryLevelsScreenProps): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);   // landscape long edge
  const H = Math.min(winW, winH);   // landscape short edge

  const BTN_SIZE = IS_PAD ? Math.round(H * 0.12) : Math.round(H * 0.15);

  const [showPaywall, setShowPaywall] = useState(false);
  const { isCompleted } = useProgressStore();

  useFocusEffect(useCallback(() => {
    soundService.play('settings_buttons_appear');
    soundService.playMusic('menu_music');
  }, []));

  // ── Star/accessibility helpers ────────────────────────────────────────────
  const accessible = (idx: number): boolean =>
    idx === 0 || isCompleted('Memory', `level_${idx - 1}`);

  // The "current" level = first accessible level not yet completed.
  const currentLevelIdx = Array.from({ length: TOTAL }, (_, i) => i).findIndex(
    (idx) => accessible(idx) && !isCompleted('Memory', `level_${idx}`),
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const openLevel = useCallback((idx: number) => {
    soundService.play('button_click');
    navigation.navigate('MemoryGame', { level: idx });
  }, [navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  // ── Build shared-grid nodes ────────────────────────────────────────────────
  const nodes: SerpentineLevelNode[] = Array.from({ length: TOTAL }, (_, idx) => {
    const isAcc = accessible(idx);
    const isCur = idx === currentLevelIdx;
    const paywallHere = isCur && isLevelLockedByPaywall(idx);
    const done = isCompleted('Memory', `level_${idx}`);
    const locked = !isAcc || paywallHere;

    return {
      key:        `level_${idx}`,
      displayNum: idx + 1,
      state:      locked ? 'locked' : done ? 'done' : isCur ? 'current' : 'available',
      tappable:   isAcc || paywallHere,
      starCount:  getLevelStars('Memory', `level_${idx}`),
      onPress: () => {
        if (paywallHere) { setShowPaywall(true); return; }
        openLevel(idx);
      },
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {/* Background animated dots */}
      {DOT_DATA.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      <SafeAreaView style={ss.safe}>
        {/* Top bar — title only; back button floats independently below */}
        <View style={[ss.topBar, { height: Math.round(H * 0.14) }]}>
          <Text style={[ss.title, { fontSize: Math.round(H * 0.05) }]}>MEMORY MATCH</Text>
        </View>

        {/* Snake grid */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <SerpentineLevelGrid nodes={nodes} />
        </ScrollView>
      </SafeAreaView>

      {/* Back button — floating, same size/padding/style as SpinnyLevelsScreen */}
      <View style={[ss.floatBtn, { left: BTN_X, top: BTN_X }]}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[ss.backBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2 }]}
        >
          <BackChevron size={Math.round(BTN_SIZE * 0.5)} />
        </TouchableOpacity>
      </View>

      <FullPackagePaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
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
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Same as SpinnyLevelsScreen's floatBtn/circleBtn.
  floatBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  backBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
  title: {
    color:         '#FFFFFF',
    fontFamily:    'FredokaOne-Regular',
    letterSpacing: 1,
  },
});
