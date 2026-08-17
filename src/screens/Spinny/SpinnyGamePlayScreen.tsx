/**
 * SpinnyGamePlayScreen.tsx
 * The ring-rotation puzzle gameplay screen.
 *
 * Solved state matches GameplayScreen.jsx exactly:
 *   LEFT  — animal image contained in package-colored circle
 *   RIGHT — white fact card with:
 *             • falling confetti (loops while solved screen is shown)
 *             • animal name  (bold, letter-spaced, system font)
 *             • description text
 *             • button row: sound (TEAL — replays animal sound) + Next Level pill (pulse)
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated as RNAnimated,
  Easing as RNEasing,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { SpinnyGamePlayScreenProps } from '../../navigation/types';

import { useSpinnyGame }    from '../../game/spinny/useSpinnyGame';
import { RingBoard }        from '../../components/spinny/RingBoard';
import { SnapStarEffect }   from '../../components/spinny/SnapStarEffect';
import { useHintsStore }    from '../../stores/useHintsStore';
import { useProgressStore } from '../../stores/useProgressStore';
import { useGameStore }     from '../../stores/useGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { logLevelCompleted } from '../../services/analytics/analyticsService';
import { adsService }        from '../../services/ads/adsService';
import { soundService }      from '../../services/audio/soundService';
import { getNextLevel }      from '../../services/data/levelLoader';
import { SCREEN_W, SCREEN_H } from '../../utils/deviceUtils';
import {
  LEVEL_ENTER_ANIMATION_MS,
  LEVEL_COMPLETE_NAVIGATE_DELAY_MS,
} from '../../constants/gameConstants';
import { getColorImage, getLayerImage } from '../../assets/images/levels';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const SHORT_EDGE = Math.min(SCREEN_W, SCREEN_H);   // height in landscape
const LONG_EDGE  = Math.max(SCREEN_W, SCREEN_H);   // width  in landscape
const BOARD_SIZE = SHORT_EDGE;
const BTN_SIZE   = Math.round(SHORT_EDGE * 0.15);
const BTN_X      = Platform.OS === 'ios' ? 20 : 16;

// ─── Solved-state dimensions ──────────────────────────────────────────────────
const CARD_SCALE    = 0.8;  // card + buttons are 20 % smaller than reference

// Circle is NOT scaled — only the card/buttons shrink
const CIRCLE_SIZE   = Math.round(Math.min(SHORT_EDGE * 0.70, 300));
const IMG_IN_CIRCLE = Math.round(CIRCLE_SIZE * 0.86);
const SOL_GAP       = Math.round(Math.min(LONG_EDGE * 0.07, 90));

const CARD_MARGIN   = Math.round(16  * CARD_SCALE);
const CARD_W        = Math.round(Math.min(LONG_EDGE * 0.50, 520) * CARD_SCALE);
// How far left the board slides on solve (board-center → left-slot center).
const ANIM_DELTA       = Math.round((SOL_GAP + CARD_W + CARD_MARGIN) / 2);
// Scale the board shrinks to so it matches the left-slot width (CIRCLE_SIZE).
const BOARD_SOLVE_SCALE = CIRCLE_SIZE / BOARD_SIZE;
const CARD_BR       = Math.round(42  * CARD_SCALE);
const CARD_PT       = Math.round(34  * (SHORT_EDGE / 375) * CARD_SCALE);
const CARD_PH       = Math.round(40  * (SHORT_EDGE / 375) * CARD_SCALE);
const CARD_PB       = Math.round(70  * (SHORT_EDGE / 375) * CARD_SCALE);
const SOL_CIRCLE    = Math.round(Math.min(88  * (SHORT_EDGE / 375), 100) * CARD_SCALE);
const SOL_ICON      = Math.round(SOL_CIRCLE * 0.48);
const PILL_H        = Math.round(Math.min(96  * (SHORT_EDGE / 375), 108) * CARD_SCALE);
const PILL_PX       = Math.round(48  * (SHORT_EDGE / 375) * CARD_SCALE);
const PILL_GAP      = Math.round(12  * (SHORT_EDGE / 375) * CARD_SCALE);
const PILL_FONT     = Math.round(Math.min(26  * (SHORT_EDGE / 375), 32)  * CARD_SCALE);
const PLAY_SZ       = Math.round(Math.min(20  * (SHORT_EDGE / 375), 26)  * CARD_SCALE);
const BTN_GAP       = Math.round(22  * (SHORT_EDGE / 375) * CARD_SCALE);
const BTN_BOTTOM    = -Math.round(44 * (SHORT_EDGE / 375) * CARD_SCALE);
const NAME_FONT     = Math.round(Math.min(38  * (SHORT_EDGE / 375), 48)  * CARD_SCALE);
const DESC_FONT     = Math.round(Math.min(22  * (SHORT_EDGE / 375), 28)  * CARD_SCALE);
const DESC_LINE     = Math.round(Math.min(32  * (SHORT_EDGE / 375), 40)  * CARD_SCALE);

// ─── Colours ─────────────────────────────────────────────────────────────────
const GREEN = '#5cba6f';
const TEAL  = '#5cc2df';

// ─── Confetti — matches GameplayScreen.jsx Confetti component exactly ─────────
// Pieces fall from the top of the fact card in a looping animation
const CONFETTI_PIECES = [
  { left: Math.round(CARD_W * 0.115), color: '#f4d35e', size: 12, delay: 0 },
  { left: Math.round(CARD_W * 0.269), color: GREEN,     size: 10, delay: 150 },
  { left: Math.round(CARD_W * 0.731), color: '#e3435a', size: 12, delay: 300 },
  { left: Math.round(CARD_W * 0.846), color: '#9a5cc9', size: 9,  delay: 60 },
  { left: Math.round(CARD_W * 0.500), color: TEAL,      size: 10, delay: 220 },
];
const CONFETTI_DROP = Math.round(90 * (SHORT_EDGE / 375));

function Confetti({ active }: { active: boolean }) {
  const anims = useRef(CONFETTI_PIECES.map(() => new RNAnimated.Value(0))).current;

  useEffect(() => {
    if (!active) return;
    const loops = anims.map((v, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(CONFETTI_PIECES[i]!.delay),
          RNAnimated.timing(v, { toValue: 1, duration: 1700, easing: RNEasing.in(RNEasing.quad), useNativeDriver: true }),
          RNAnimated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {CONFETTI_PIECES.map((c, i) => (
        <RNAnimated.View
          key={i}
          style={{
            position:        'absolute',
            top:             -14,
            left:             c.left,
            width:            c.size,
            height:           c.size,
            borderRadius:     c.size / 3,
            backgroundColor:  c.color,
            opacity:          anims[i]!.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: anims[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, CONFETTI_DROP] }) },
              { rotate:     anims[i]!.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ─── Background bubbles ───────────────────────────────────────────────────────
const BUBBLES = [
  { size: 170, top: -40,               left: SCREEN_W * 0.12,  opacity: 0.07, duration: 7200, delay: 0 },
  { size: 110, bottom: -25,            right: SCREEN_W * 0.18, opacity: 0.08, duration: 6400, delay: 800 },
  { size: 72,  top: SCREEN_H * 0.28,  left: SCREEN_W * 0.04,  opacity: 0.10, duration: 5800, delay: 400 },
  { size: 52,  top: SCREEN_H * 0.08,  right: SCREEN_W * 0.08, opacity: 0.10, duration: 6800, delay: 1200 },
  { size: 36,  top: SCREEN_H * 0.65,  left: SCREEN_W * 0.40,  opacity: 0.12, duration: 5400, delay: 600 },
  { size: 24,  top: SCREEN_H * 0.18,  right: SCREEN_W * 0.38, opacity: 0.14, duration: 7000, delay: 200 },
  { size: 18,  bottom: SCREEN_H * 0.20, left: SCREEN_W * 0.22, opacity: 0.12, duration: 6200, delay: 900 },
];

const Bubble = memo(function Bubble({ b }: { b: typeof BUBBLES[number] }) {
  const scale = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.09, duration: b.duration, delay: b.delay, useNativeDriver: true }),
        RNAnimated.timing(scale, { toValue: 1,    duration: b.duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pos: Record<string, number> = {};
  if ('top'    in b) pos.top    = (b as { top: number }).top;
  if ('bottom' in b) pos.bottom = (b as { bottom: number }).bottom;
  if ('left'   in b) pos.left   = (b as { left: number }).left;
  if ('right'  in b) pos.right  = (b as { right: number }).right;

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={[
        {
          position:        'absolute',
          width:           b.size,
          height:          b.size,
          borderRadius:    b.size / 2,
          backgroundColor: `rgba(255,255,255,${b.opacity})`,
          transform:       [{ scale }],
        },
        pos,
      ]}
    />
  );
});

// ─── Gameplay button icons ────────────────────────────────────────────────────
function BackIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#e3435a" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function HintIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M9,21c0,0.55,0.45,1,1,1h4c0.55,0,1-0.45,1-1v-1H9V21z M12,2C8.14,2,5,5.14,5,9c0,2.38,1.19,4.47,3,5.74V17 c0,0.55,0,1,1,1h6c0.55,0,1-0.45,1-1v-2.26c1.81-1.27,3-3.36,3-5.74C19,5.14,15.86,2,12,2z" />
    </Svg>
  );
}

// ─── Solved-state icons ───────────────────────────────────────────────────────
function SoundIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M3,9v6h4l5,5V4L7,9H3z M16.5,12c0,-1.77,-1.02,-3.29,-2.5,-4.03v8.05C15.48,15.29,16.5,13.77,16.5,12z M14,3.23v2.06c2.89,0.86,5,3.54,5,6.71s-2.11,5.85,-5,6.71v2.06c4.01,-0.91,7,-4.49,7,-8.77S18.01,4.14,14,3.23z" />
    </Svg>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SpinnyGamePlayScreen({
  navigation,
  route,
}: SpinnyGamePlayScreenProps): React.JSX.Element {
  const { level, packageInfo } = route.params;
  const pkg = packageInfo.package;

  const bgColor = pkg.backgroundColorDark;
  const circleRangeColors: string[] = (() => {
    try { return JSON.parse(pkg.circleRangeColors) as string[]; }
    catch { return ['#e0b830', '#d4a820', '#c89010', '#bc8000']; }
  })();

  const animalImage = getColorImage(level.name) ?? getLayerImage(level.name);

  // ── Stores ───────────────────────────────────────────────────────────────
  const hintsLeft = useHintsStore((s) => s.hintsCount);
  const useHint   = useHintsStore((s) => s.useHint);
  const { markCompleted, setLastPlayedLevel, setLevelStars } = useProgressStore();
  const setPendingAutoPlay    = useGameStore((s) => s.setPendingAutoPlay);
  const setPendingWorldUnlock = useGameStore((s) => s.setPendingWorldUnlock);
  const languageCode          = useSettingsStore((s) => s.languageCode);

  useEffect(() => {
    setLastPlayedLevel(level.packageName, level.name);
  }, [level.packageName, level.name, setLastPlayedLevel]);

  useEffect(() => {
    soundService.playMusic('game_music');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Elapsed timer ────────────────────────────────────────────────────────
  const [elapsedS, setElapsedS] = useState(0);
  const timerOnRef = useRef(true);
  useEffect(() => {
    const id = setInterval(() => {
      if (timerOnRef.current) setElapsedS((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Solved state ─────────────────────────────────────────────────────────
  const [isSolved, setIsSolved] = useState(false);

  // ── Solved-state entry animations ────────────────────────────────────────
  const cardTranslateX   = useSharedValue(CARD_W + CARD_MARGIN + 60);
  const nextScale        = useSharedValue(1);
  // Ring color: 0 = all rings uniform (#86D8F2), 1 = individual solved colors.
  const colorProgress    = useSharedValue(0);
  // Board slide + shrink: animates to left slot after ring colors are done.
  const boardTranslateX  = useSharedValue(0);

  // How long ring colors are shown at full opacity before the board moves.
  const RING_ANIM_MS = 700;

  useEffect(() => {
    if (!isSolved) return;

    // Step 1: ring colors animate on the fully-visible, stationary board.
    colorProgress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

    // Step 2: the existing board (rings + animal) slides left and shrinks into
    // the left slot.  Nothing new is created — the same board moves.
    boardTranslateX.value = withDelay(RING_ANIM_MS, withTiming(-ANIM_DELTA, { duration: 480, easing: Easing.out(Easing.cubic) }));
    boardScale.value      = withDelay(RING_ANIM_MS, withTiming(BOARD_SOLVE_SCALE, { duration: 480, easing: Easing.out(Easing.cubic) }));

    // Step 3: fact card slides in from the right while the board is moving.
    cardTranslateX.value = withDelay(RING_ANIM_MS + 140, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
    // Pulse matching GameplayScreen.jsx: 0→1.06 over 700ms, loops
    nextScale.value = withDelay(
      RING_ANIM_MS + 700,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0,  { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );

    // Auto-play animal sound on reveal
    const audioPath = (() => {
      if (languageCode === 'fr') return level.audio_fr ?? level.audio;
      if (languageCode === 'es') return level.audio_es ?? level.audio;
      if (languageCode === 'ru') return level.audio_ru ?? level.audio;
      return level.audio;
    })();
    if (audioPath) soundService.playAnimalSound(audioPath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolved]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardTranslateX.value }],
  }));
  const nextBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value }],
  }));

  // ── Solved-state actions ─────────────────────────────────────────────────
  const goNext = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    const next = getNextLevel(level);
    if (next) {
      setPendingAutoPlay({ packageName: next.level.packageName, levelName: next.level.name });
    } else {
      setPendingWorldUnlock(level.packageName);
    }
    navigation.popToTop();
  }, [level, navigation, setPendingAutoPlay, setPendingWorldUnlock]);

  // Sound button: always on (TEAL), replays the animal sound on press
  const replayAnimalSound = useCallback(() => {
    soundService.play('button_click');
    const audioPath = (() => {
      if (languageCode === 'fr') return level.audio_fr ?? level.audio;
      if (languageCode === 'es') return level.audio_es ?? level.audio;
      if (languageCode === 'ru') return level.audio_ru ?? level.audio;
      return level.audio;
    })();
    if (audioPath) soundService.playAnimalSound(audioPath);
  }, [level, languageCode]);

  // ── Win guard ────────────────────────────────────────────────────────────
  const isHandlingCompleteRef = useRef(false);

  const triggerWinHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactHeavy', { enableVibrateFallback: true });
  }, []);

  const handleLevelComplete = useCallback(async () => {
    if (isHandlingCompleteRef.current) return;
    isHandlingCompleteRef.current = true;
    timerOnRef.current = false;

    try {
      const stars = elapsedS < 30 ? 3 : elapsedS < 90 ? 2 : 1;
      setLevelStars(level.packageName, level.name, stars);
      await markCompleted(level.packageName, level.name);
      void logLevelCompleted(level.name, level.packageName);
      triggerWinHaptic();

      soundService.play('correct');
      [1, 2, 3, 4].forEach((n, i) => {
        setTimeout(() => soundService.play(`animal_reveal_ring_${n}`), i * 180);
      });

      await new Promise<void>((r) => setTimeout(r, LEVEL_COMPLETE_NAVIGATE_DELAY_MS + 720));

      void adsService.showInterstitial();
      setIsSolved(true);
    } catch (e) {
      console.error('[handleLevelComplete]', e);
    }
  }, [level, navigation, markCompleted, setLevelStars, triggerWinHaptic, elapsedS]);

  // ── Snap star animation ───────────────────────────────────────────────────
  const [snapEvents, setSnapEvents] = useState<Array<{ id: number; ringIndex: number }>>([]);
  const snapIdRef = useRef(0);

  const handleRingSnapped = useCallback((ringIndex: number) => {
    const id = ++snapIdRef.current;
    setSnapEvents((prev) => [...prev, { id, ringIndex }]);
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

  // ── Entry animation ───────────────────────────────────────────────────────
  const boardScale   = useSharedValue(0.05);
  const boardOpacity = useSharedValue(0);
  const hudOpacity   = useSharedValue(0);

  useEffect(() => {
    boardScale.value   = withTiming(1, { duration: LEVEL_ENTER_ANIMATION_MS, easing: Easing.out(Easing.cubic) });
    boardOpacity.value = withTiming(1, { duration: LEVEL_ENTER_ANIMATION_MS, easing: Easing.out(Easing.quad) });
    hudOpacity.value   = withTiming(1, { duration: 300,                       easing: Easing.out(Easing.quad) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boardStyle = useAnimatedStyle(() => ({
    opacity:   boardOpacity.value,
    transform: [{ translateX: boardTranslateX.value }, { scale: boardScale.value }],
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

      {BUBBLES.map((b, i) => <Bubble key={i} b={b} />)}

      {/* Back — always visible */}
      <Animated.View style={[styles.floatBtn, { left: BTN_X, top: BTN_X }, hudStyle]}>
        <TouchableOpacity
          onPress={() => {
            soundService.play('button_click');
            soundService.play('transition_out');
            isHandlingCompleteRef.current = false;
            resetLevel();
            navigation.goBack();
          }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: '#fff' }]}
        >
          <BackIcon size={Math.round(BTN_SIZE * 0.5)} />
        </TouchableOpacity>
      </Animated.View>

      {/* Hint — hidden when solved */}
      {!isSolved && (
        <Animated.View style={[styles.floatBtn, { right: BTN_X, top: BTN_X }, hudStyle]}>
          <TouchableOpacity
            onPress={handleHint}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: 'rgb(224,197,110)' }]}
          >
            <HintIcon size={Math.round(BTN_SIZE * 0.48)} />
            <View style={[styles.badge, { width: BTN_SIZE * 0.44, height: BTN_SIZE * 0.44, borderRadius: BTN_SIZE * 0.22, top: -BTN_SIZE * 0.12, right: -BTN_SIZE * 0.12 }]}>
              <Text style={styles.badgeText}>{hintsLeft}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Ring board — stays rendered; fades out and becomes non-interactive when solved */}
      <View style={styles.boardContainer} pointerEvents={isSolved ? 'none' : 'auto'}>
        <Animated.View style={[{ width: BOARD_SIZE, height: BOARD_SIZE }, boardStyle]}>
          <RingBoard
            boardSize={BOARD_SIZE}
            ringDescriptors={ringDescriptors}
            ringAngles={ringAngles}
            ringSolved={ringSolved}
            activeRingIndex={activeRingIndex}
            panGesture={panGesture}
            ringColors={circleRangeColors}
            uniformRingColor={circleRangeColors[0] ?? '#86D8F2'}
            colorProgress={colorProgress}
            animalImage={animalImage}
          />
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

      {/* ── Solved state ─────────────────────────────────────────────────── */}
      {isSolved && (
        <View style={[styles.solvedRow, { gap: SOL_GAP }]}>

          {/* LEFT spacer — holds the exact footprint of the board's final position
              so the fact card aligns correctly beside it. The board itself (absolute,
              behind) slides into this space. */}
          <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }} />

          {/* RIGHT: fact card */}
          <Animated.View
            style={[
              styles.factCard,
              { width: CARD_W, marginRight: CARD_MARGIN, paddingTop: CARD_PT, paddingHorizontal: CARD_PH, paddingBottom: CARD_PB },
              cardStyle,
            ]}
          >
            {/* Confetti — looping falling pieces from top of card */}
            <Confetti active={isSolved} />

            {/* Animal name — system font, weight 800, letter-spaced */}
            <Text
              style={[styles.factTitle, { fontSize: NAME_FONT, color: level.titleColor || '#1f3d2b' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {level.name.toUpperCase()}
            </Text>

            {/* Description — system font, weight 600 */}
            <ScrollView style={[styles.descripScroll, { maxHeight: SHORT_EDGE * 0.42 * CARD_SCALE }]} showsVerticalScrollIndicator={false}>
              {level.descrip ? (
                <Text style={[styles.factText, { fontSize: DESC_FONT, lineHeight: DESC_LINE }]}>
                  {level.descrip}
                </Text>
              ) : null}
            </ScrollView>

            {/* Button row — overlaps card bottom edge */}
            <View style={[styles.factButtonRow, { bottom: BTN_BOTTOM, gap: BTN_GAP }]}>

              {/* Sound — always TEAL, replays animal sound */}
              <TouchableOpacity
                onPress={replayAnimalSound}
                activeOpacity={0.75}
                style={[styles.circleBtn, { width: SOL_CIRCLE, height: SOL_CIRCLE, borderRadius: SOL_CIRCLE / 2, backgroundColor: TEAL }]}
              >
                <SoundIcon size={SOL_ICON} />
              </TouchableOpacity>

              {/* Next Level — green pill, pulsing */}
              <TouchableOpacity onPress={goNext} activeOpacity={0.75}>
                <Animated.View style={[styles.nextLevelBtn, { height: PILL_H, paddingHorizontal: PILL_PX, gap: PILL_GAP }, nextBtnStyle]}>
                  <Text style={[styles.nextLevelText, { fontSize: PILL_FONT }]}>Next Level</Text>
                  <PlayIcon size={PLAY_SZ} />
                </Animated.View>
              </TouchableOpacity>

            </View>
          </Animated.View>

        </View>
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── HUD ───────────────────────────────────────────────────────────────────
  floatBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  circleBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
  badge: {
    position:        'absolute',
    backgroundColor: '#e3435a',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.15,
    shadowRadius:    0,
    elevation:       4,
  },
  badgeText: {
    color:      '#fff',
    fontWeight: '700',
    fontSize:   Math.round(BTN_SIZE * 0.26),
  },

  boardContainer: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Solved state ──────────────────────────────────────────────────────────
  solvedRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },

  revealCircle: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  factCard: {
    backgroundColor: '#fff',
    borderRadius:    CARD_BR,
    alignSelf:       'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 14 },
    shadowOpacity:   0.18,
    shadowRadius:    30,
    elevation:       10,
    overflow:        'visible',
    position:        'relative',
  },

  // Title: system font (no fontFamily), weight 800 so it renders truly bold
  factTitle: {
    fontWeight:    '800',
    textAlign:     'center',
    letterSpacing: 1.5,
    marginBottom:  14,
  },

  descripScroll: {
    flexGrow: 0,
  },

  // Description: system font, semi-bold — colour matches reference (#4a5a52)
  factText: {
    fontWeight: '600',
    textAlign:  'center',
    color:      '#4a5a52',
  },

  factButtonRow: {
    position:       'absolute',
    left:            0,
    right:           0,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },

  nextLevelBtn: {
    borderRadius:    999,
    backgroundColor: GREEN,
    flexDirection:  'row',
    alignItems:     'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.20,
    shadowRadius:   0,
    elevation:      6,
  },
  nextLevelText: {
    color:      '#fff',
    fontWeight: '700',
  },
});
