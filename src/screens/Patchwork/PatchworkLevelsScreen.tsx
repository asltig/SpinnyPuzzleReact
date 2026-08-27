/**
 * PatchworkLevelsScreen.tsx
 * Patchwork ("Right Position") level picker — 5-column serpentine grid,
 * same shared design as JigsawLevelsScreen (ported from JigsawLevelsMap.jsx):
 * dark purple bg, connecting arrows, pulsing current-level ring. Each node
 * shows the level's own scene image as a thumbnail (background image before
 * completion, full assembled image after) via SerpentineLevelGrid's
 * thumbnail slot — unlike Jigsaw, which has no per-level thumbnail asset.
 *
 * ─── Data ────────────────────────────────────────────────────────────────────
 *  patchworkService.getPatchworkLevels() — 3 bundled + any server levels
 *  Syncs from POST /levels (packageName="RightPosition") on focus.
 *
 * ─── Lock logic ──────────────────────────────────────────────────────────────
 *  Only the shared paywall gate applies (isLevelLockedByPaywall — 'paywall'
 *  monetization mode + no FULL_PACKAGE_KEY purchase). No per-package
 *  "FREE_PATCHWORK_COUNT" cap: the original app's PatchworkController.m
 *  isPackageLocked: always `return NO` regardless of the count check (a
 *  dead copy-paste bug), so every level was actually always unlocked there.
 *  No strict sequential order — every unlocked level is simultaneously
 *  playable, so only the first unlocked+incomplete one gets the "current"
 *  pulse; the rest render as "available".
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
  useWindowDimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PatchworkStackParamList } from '../../navigation/types';
import type { Level }                   from '../../types/models';

import { useProgressStore }    from '../../stores/useProgressStore';
import { getLevelStars }       from '../../storage/progressStorage';
import { soundService }        from '../../services/audio/soundService';
import { contractCircle } from '../../utils/circularReveal';
import { fullImgUrl } from '../../services/api/apiClient';
import { LEVELS_BG_COLOR }      from '../../constants/gameColors';
import { isLevelLockedByPaywall } from '../../services/monetization/monetizationService';
import { FullPackagePaywallModal } from '../../components/FullPackagePaywallModal';
import { SerpentineLevelGrid, type SerpentineLevelNode } from '../../components/levelMap/SerpentineLevelGrid';
import {
  getPatchworkLevels,
  syncPatchworkLevels,
  type PatchworkLevel,
} from '../../services/data/patchworkService';

// ─── Image assets ─────────────────────────────────────────────────────────────
const BG_IMAGES: Record<string, ReturnType<typeof require>> = {
  p1_bg:  require('../../assets/images/patchwork_p1_bg.jpg'),
  p2_bg:  require('../../assets/images/patchwork_p2_bg.jpg'),
  p3_bg:  require('../../assets/images/patchwork_p3_bg.jpg'),
};
const DONE_IMAGES: Record<string, ReturnType<typeof require>> = {
  p1_img: require('../../assets/images/patchwork_p1_img.jpg'),
  p2_img: require('../../assets/images/patchwork_p2_img.jpg'),
  p3_img: require('../../assets/images/patchwork_p3_img.jpg'),
};

const PATCHWORK_SCALE = 1.35;   // ObjC: cellH = cellW / PatchworkScale
const BG_COLOR = LEVELS_BG_COLOR.patchwork;

// Back button — same size/padding/style as SpinnyLevelsScreen's.
const IS_PAD = Platform.isPad;
const BTN_X  = Platform.OS === 'ios' ? 20 : 16;

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 18 }, (_, i) => ({
  id: i, size: 2.5 + Math.random() * 3.5,
  x: Math.random(), y: Math.random(),
  dur: 4000 + Math.random() * 3000,
  delay: Math.random() * 2000,
}));

function FloatingDot({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.5, 0.1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.size / 2,
      width: dot.size, height: dot.size, backgroundColor: '#FFFFFF',
      left: dot.x * W, top: dot.y * H, opacity, transform: [{ translateY }],
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

// ─── Main screen ──────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<PatchworkStackParamList, 'PatchworkLevels'>;

export default function PatchworkLevelsScreen({ navigation }: Props): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  const { isCompleted } = useProgressStore();
  const [levels, setLevels] = useState<PatchworkLevel[]>(() => getPatchworkLevels());
  const [showPaywall, setShowPaywall] = useState(false);

  const BTN_SIZE = IS_PAD ? Math.round(H * 0.12) : Math.round(H * 0.15);

  useFocusEffect(useCallback(() => {
    soundService.playMusic('menu_music');
    const fresh = getPatchworkLevels();
    setLevels(fresh);
    syncPatchworkLevels().then((updated) => {
      if (updated.length !== fresh.length) setLevels(updated);
    });
  }, []));

  const openLevel = useCallback((pl: PatchworkLevel) => {
    const level: Level = {
      id:              pl.name,
      name:            pl.name,
      packageName:     'RightPosition',
      imgUrl:          pl.isInitialData ? '' : pl.imgPath,
      imgPath:         pl.imgPath,
      layerImgPath:    pl.bgImgPath,
      order:           pl.order,
      imageDownloaded: pl.isInitialData,
      levelCompleted:  isCompleted('RightPosition', pl.name),
      isInitialData:   pl.isInitialData,
      descrip:         JSON.stringify(pl.pieces),
      titleColor:      '#FFFFFF',
      colorImage:      null,
      layerImage:      null,
    };
    navigation.navigate('PatchworkGame', { level, index: pl.index });
  }, [isCompleted, navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  // No strict play-in-order gate here (unlike Jigsaw) — only the first
  // unlocked-and-incomplete level gets the "current" pulse; the rest of the
  // unlocked-incomplete ones render as plain "available".
  const firstAvailableIdx = levels.findIndex((item) =>
    !isLevelLockedByPaywall(item.index) && !isCompleted('RightPosition', item.name),
  );

  const nodes: SerpentineLevelNode[] = levels.map((item, idx) => {
    const paywallLocked = isLevelLockedByPaywall(item.index);
    const done          = isCompleted('RightPosition', item.name);

    const thumbSrc = done && DONE_IMAGES[item.imgPath]
      ? DONE_IMAGES[item.imgPath]
      : BG_IMAGES[item.bgImgPath]
        ?? (done && item.imgPath ? { uri: fullImgUrl(item.imgPath) } : undefined)
        ?? (item.bgImgPath ? { uri: fullImgUrl(item.bgImgPath) } : undefined);

    return {
      key:        item.name,
      displayNum: idx + 1,
      state:      paywallLocked ? 'locked' : done ? 'done' : idx === firstAvailableIdx ? 'current' : 'available',
      tappable:   true,
      starCount:  getLevelStars('RightPosition', item.name),
      thumbnail:  thumbSrc,
      onPress: () => {
        if (paywallLocked) { setShowPaywall(true); return; }
        soundService.play('button_click');
        openLevel(item);
      },
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      <SafeAreaView style={ss.safe}>
        {/* Top bar — title only; back button floats independently below */}
        <View style={[ss.topBar, { height: Math.round(H * 0.14) }]}>
          <Text style={[ss.title, { fontSize: Math.round(H * 0.05) }]}>PATCHWORK</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <SerpentineLevelGrid nodes={nodes} aspectRatio={1 / PATCHWORK_SCALE} />
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
const ss = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

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
