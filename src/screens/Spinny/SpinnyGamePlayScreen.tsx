/**
 * SpinnyGamePlayScreen.tsx
 * The ring-rotation puzzle gameplay screen.
 *
 * ─── Visual design (matches screenshot + SPGamePlayViewController) ────────────
 *   • Background: package backgroundColorDark (flat, full-screen)
 *   • Floating colored dots — same BackgroundAnimationManager as levels screen
 *   • Board centered, zooms in on mount (ObjC levelStartAnimation 0.5s)
 *   • Back button: btnBack image, circular, top-left
 *   • Hint button: lightbulb icon + count badge, top-right
 *   • No level-name label, no debug controls in production
 *
 * ─── Thread model ─────────────────────────────────────────────────────────────
 *   All rotation math runs on the UI thread via Reanimated worklets.
 *   JS thread receives only: haptic triggers, sound, win callback.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated as RNAnimated,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { SpinnyGamePlayScreenProps } from '../../navigation/types';

import { useSpinnyGame }    from '../../game/spinny/useSpinnyGame';
import { RingBoard }        from '../../components/spinny/RingBoard';
import { SnapStarEffect }   from '../../components/spinny/SnapStarEffect';
import { useHintsStore }    from '../../stores/useHintsStore';
import { useProgressStore } from '../../stores/useProgressStore';
import { logLevelCompleted } from '../../services/analytics/analyticsService';
import { adsService }        from '../../services/ads/adsService';
import { soundService }      from '../../services/audio/soundService';
import { SCREEN_W, SCREEN_H } from '../../utils/deviceUtils';
import {
  LEVEL_ENTER_ANIMATION_MS,
  LEVEL_COMPLETE_NAVIGATE_DELAY_MS,
} from '../../constants/gameConstants';
import { getColorImage, getLayerImage } from '../../assets/images/levels';

// ─── Dimensions ───────────────────────────────────────────────────────────────
// ObjC: circleWidth = screenHeight / circleCounts / 1.25
//        boardSize  = circleWidth * circleCounts = screenHeight / 1.25
// computeRingDescriptors divides by divisor internally, so we pass the full
// short-edge. The outermost ring will fill (1/1.25 = 80%) of BOARD_SIZE.
const SHORT_EDGE = Math.min(SCREEN_W, SCREEN_H);
const BOARD_SIZE = SHORT_EDGE;               // rings scale to 80% internally
const BTN_SIZE   = Math.round(SHORT_EDGE * 0.15);
const BTN_X      = Platform.OS === 'ios' ? 20 : 16;

// ─── Floating dots (same as levels screen) ────────────────────────────────────
const DOT_COLORS = ['#ffffff', '#ffffff88', '#ffffffaa'];
const DOTS = Array.from({ length: 8 }, (_, i) => ({
  id:       i,
  size:     3 + Math.random() * 5,
  x:        Math.random() * SCREEN_W,
  y:        Math.random() * SCREEN_H,
  duration: 4000 + Math.random() * 4000,
  delay:    Math.random() * 3000,
}));

function FloatingDot({ dot }: { dot: (typeof DOTS)[number] }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(anim, { toValue: 1, duration: dot.duration, delay: dot.delay, useNativeDriver: true }),
        RNAnimated.timing(anim, { toValue: 0, duration: dot.duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.6, 0.1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        width:           dot.size,
        height:          dot.size,
        borderRadius:    dot.size / 2,
        backgroundColor: '#ffffff',
        left:            dot.x,
        top:             dot.y,
        opacity,
        transform:       [{ translateY }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SpinnyGamePlayScreen({
  navigation,
  route,
}: SpinnyGamePlayScreenProps): React.JSX.Element {
  const { level, packageInfo } = route.params;
  const pkg = packageInfo.package;

  // ── Package colors ───────────────────────────────────────────────────────
  const bgColor = pkg.backgroundColorDark;
  const circleRangeColors: string[] = (() => {
    try { return JSON.parse(pkg.circleRangeColors) as string[]; }
    catch { return ['#e0b830', '#d4a820', '#c89010', '#bc8000']; }
  })();

  // ── Animal image ─────────────────────────────────────────────────────────
  // Color image — Farm/Insects/Savana are fully bundled; other packages use
  // tutorial animal images. getRandomNotCompletedSpinnyLevel already prefers
  // levels with a bundled color image so this is non-null in normal gameplay.
  const animalImage = getColorImage(level.name) ?? getLayerImage(level.name);

  // ── Stores ───────────────────────────────────────────────────────────────
  const hintsLeft = useHintsStore((s) => s.hintsCount);
  const useHint   = useHintsStore((s) => s.useHint);
  const { markCompleted, setLastPlayedLevel } = useProgressStore();

  useEffect(() => {
    setLastPlayedLevel(level.packageName, level.name);
  }, [level.packageName, level.name, setLastPlayedLevel]);

  useEffect(() => {
    soundService.playMusic('game_music');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Win guard ────────────────────────────────────────────────────────────
  const isHandlingCompleteRef = useRef(false);

  const triggerWinHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactHeavy', { enableVibrateFallback: true });
  }, []);

  const handleLevelComplete = useCallback(async () => {
    if (isHandlingCompleteRef.current) return;
    isHandlingCompleteRef.current = true;

    await markCompleted(level.packageName, level.name);
    void logLevelCompleted(level.name, level.packageName);
    triggerWinHaptic();

    // Play Animal Reveal Ring 1–4 staggered (mirrors AnimationManager.m)
    [1, 2, 3, 4].forEach((n, i) => {
      setTimeout(() => soundService.play(`animal_reveal_ring_${n}`), i * 180);
    });

    await new Promise<void>((r) => setTimeout(r, LEVEL_COMPLETE_NAVIGATE_DELAY_MS + 720));

    // Guard against the back-button having been pressed during the delay.
    if (!navigation.isFocused()) return;

    void adsService.showInterstitial();
    try {
      navigation.replace('LevelComplete', { level, packageInfo });
    } catch {
      // Navigation can fail if the screen was already replaced; swallow silently.
    }
  }, [level, packageInfo, navigation, markCompleted, triggerWinHaptic]);

  // ── Snap star animation ───────────────────────────────────────────────────
  // Each snap event gets a unique id so the SnapStarEffect remounts (fresh anim).
  // Mirrors ObjC: circlePlacedToCorrectPosition → createCircleAnimationWithFrame
  const [snapEvents, setSnapEvents] = useState<Array<{ id: number; ringIndex: number }>>([]);
  const snapIdRef = useRef(0);

  const handleRingSnapped = useCallback((ringIndex: number) => {
    const id = ++snapIdRef.current;
    setSnapEvents((prev) => [...prev, { id, ringIndex }]);
    // Remove after animation finishes (lifetime 900ms + buffer)
    setTimeout(() => {
      setSnapEvents((prev) => prev.filter((e) => e.id !== id));
    }, 1200);
  }, []);

  // ── Game engine ──────────────────────────────────────────────────────────
  const {
    ringDescriptors,
    ringAngles,
    ringSolved,
    activeRingIndex,
    panGesture,
    snapNextRing,
    resetLevel,
  } = useSpinnyGame({
    boardSize:       BOARD_SIZE,
    onLevelComplete: handleLevelComplete,
    onRingSnapped:   handleRingSnapped,
  });

  // ── Entry animation — board zooms in (ObjC: levelStartAnimation 0.5s) ───
  const boardScale   = useSharedValue(0.05);
  const boardOpacity = useSharedValue(0);
  const hudOpacity   = useSharedValue(0);

  useEffect(() => {
    boardScale.value = withTiming(1, {
      duration: LEVEL_ENTER_ANIMATION_MS,
      easing:   Easing.out(Easing.cubic),
    });
    boardOpacity.value = withTiming(1, {
      duration: LEVEL_ENTER_ANIMATION_MS,
      easing:   Easing.out(Easing.quad),
    });
    hudOpacity.value = withTiming(1, {
      duration: 300,
      easing:   Easing.out(Easing.quad),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boardStyle = useAnimatedStyle(() => ({
    opacity:   boardOpacity.value,
    transform: [{ scale: boardScale.value }],
  }));
  const hudStyle = useAnimatedStyle(() => ({ opacity: hudOpacity.value }));

  // ── Hint ─────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    const consumed = useHint();
    if (!consumed) return;
    snapNextRing();
  }, [useHint, snapNextRing]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>

      {/* Floating dots — matches BackgroundAnimationManager */}
      {DOTS.map(d => <FloatingDot key={d.id} dot={d} />)}

      {/* Back button — top-left, btnBack image, same position as levels screen */}
      <Animated.View style={[styles.backBtn, { left: BTN_X, top: BTN_X }, hudStyle]}>
        <TouchableOpacity
          onPress={() => {
            soundService.play('button_click');
            soundService.play('transition_out');
            isHandlingCompleteRef.current = false;
            resetLevel();
            navigation.goBack();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Image
            source={require('../../assets/images/btnBack.png')}
            style={{ width: BTN_SIZE, height: BTN_SIZE }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Hint button — top-right, yellow circle + lightbulb + badge (matches btnHint) */}
      <Animated.View style={[styles.hintBtn, { right: BTN_X, top: BTN_X }, hudStyle]}>
        <TouchableOpacity
          onPress={handleHint}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.hintCircle, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2 }]}>
            <Text style={styles.hintIcon}>💡</Text>
            {/* Badge — matches badgeView with hintsCount */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{hintsLeft}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Board — centered, zooms in on mount */}
      <View style={styles.boardContainer}>
        <Animated.View style={[{ width: BOARD_SIZE, height: BOARD_SIZE }, boardStyle]}>
          <RingBoard
            boardSize={BOARD_SIZE}
            ringDescriptors={ringDescriptors}
            ringAngles={ringAngles}
            ringSolved={ringSolved}
            activeRingIndex={activeRingIndex}
            panGesture={panGesture}
            ringColors={circleRangeColors}
            animalImage={animalImage}
          />

          {/* Star burst particles — rendered in board-local coordinates so they
              align with the ring circles. One SnapStarEffect per snap event;
              force-remounted via key so the animation replays fresh each time.
              Mirrors ObjC: circlePlacedToCorrectPosition → createCircleAnimation */}
          {snapEvents.map((evt) => (
            <SnapStarEffect
              key={evt.id}
              descriptor={ringDescriptors[evt.ringIndex]!}
              boardSize={BOARD_SIZE}
              ringIndex={evt.ringIndex}
            />
          ))}
        </Animated.View>
      </View>

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:     1,
    overflow: 'hidden',
  },

  backBtn: {
    position: 'absolute',
    zIndex:   10,
  },

  hintBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  hintCircle: {
    backgroundColor: '#F9D84E',
    alignItems:      'center',
    justifyContent:  'center',
  },
  hintIcon: {
    fontSize: BTN_SIZE * 0.45,
  },
  badge: {
    position:        'absolute',
    top:             -2,
    right:           -2,
    backgroundColor: '#e53e3e',
    borderRadius:    10,
    minWidth:        20,
    height:          20,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color:      '#ffffff',
    fontSize:   11,
    fontWeight: '700',
  },

  boardContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
});