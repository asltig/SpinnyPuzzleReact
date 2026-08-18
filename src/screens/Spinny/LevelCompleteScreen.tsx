/**
 * LevelCompleteScreen.tsx
 * Shown after a Spinny ring puzzle is solved.
 *
 * ─── Layout (matches SPLevelCompletedViewController) ─────────────────────────
 *   • Full-screen background: package backgroundColorDark + floating white dots
 *   • LEFT 50 %: animal image on a package-colored circle (pop-out: image > circle)
 *   • RIGHT 50 %: white rounded card
 *       ┌─────────────────────┐
 *       │  ANIMAL NAME        │  ← FredokaOne, titleColor from level
 *       │  Description text   │  ← FredokaOne, textColor from package, large auto-size
 *       │                     │
 *       └─[Levels][Sound][Next]┘  ← buttons half-overlap card bottom edge
 *
 * ─── Animations ──────────────────────────────────────────────────────────────
 *   • Animal (left): scale 0.2→1 with back-easing overshoot, slides from left
 *   • Card (right): slides in from right edge (translateX), ease-out cubic
 *   • Next button: continuous scale pulse loop (matches ObjC [btnNext pulse:…])
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

import type { LevelCompleteScreenProps } from '../../navigation/types';
import { getNextLevel } from '../../services/data/levelLoader';
import { useProgressStore }                 from '../../stores/useProgressStore';
import { useGameStore }                     from '../../stores/useGameStore';
import { getColorImage }                    from '../../assets/images/levels';
import { soundService }                     from '../../services/audio/soundService';
import { useSettingsStore }                 from '../../stores/useSettingsStore';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const W = Math.max(SW, SH);   // long edge
const H = Math.min(SW, SH);   // short edge
const isLandscape = SW > SH;

// Card width matches ObjC: 280 * deviceScale (deviceScale = H/375)
const CARD_W      = Math.round(280 * (H / 375));
const CARD_MARGIN = Math.round(20  * (H / 375));
// Button size: 70 * deviceScale
const BTN_SIZE    = Math.round(70  * (H / 375));

// ─── Font sizes — FredokaOne, matches ObjC viewDidLoad ────────────────────────
// lblName.font size 30; lblDescription adjustsFontSizeToFitWidth max 100
const NAME_FONT = Math.round(30  * (H / 375));
const DESC_FONT = Math.round(22  * (H / 375));  // auto-shrinks via adjustsFontSizeToFit

// ─── Circle size for animal display ───────────────────────────────────────────
// In ObjC, mainImage = screenHeight × screenHeight; customControl = screenHeight/1.25.
// We make the circle 65% of H and the image 85% of H so it pops ~20% beyond circle.
const CIRCLE_SIZE = Math.round(H * 0.65);
const IMAGE_SIZE  = Math.round(H * 0.82);

// ─── Button colours (GameplayScreen.jsx solved-state palette) ─────────────────
const BTN_PURPLE = '#9a5cc9';
const BTN_TEAL   = '#5cc2df';
const BTN_GREEN  = '#5cba6f';

// ─── Button icons (from GameplayScreen.jsx) ───────────────────────────────────
const ICON = Math.round(BTN_SIZE * 0.52);

function GridIcon() {
  const cells = [0,1,2].flatMap(r => [0,1,2].map(c => ({ r, c })));
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {cells.map(({ r, c }) => (
        <Path key={`${r}-${c}`} fill="#fff" d={`M${3 + c * 6.5} ${3 + r * 6.5} h6 v6 h-6 z`} />
      ))}
    </Svg>
  );
}

function SoundIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path fill="#fff" d="M3,9v6h4l5,5V4L7,9H3z M16.5,12c0,-1.77,-1.02,-3.29,-2.5,-4.03v8.05C15.48,15.29,16.5,13.77,16.5,12z M14,3.23v2.06c2.89,0.86,5,3.54,5,6.71s-2.11,5.85,-5,6.71v2.06c4.01,-0.91,7,-4.49,7,-8.77S18.01,4.14,14,3.23z" />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path fill="#fff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOT_POSITIONS = Array.from({ length: 8 }, (_, i) => ({
  id:       i,
  size:     3 + Math.random() * 5,
  x:        Math.random() * W,
  y:        Math.random() * H,
  duration: 4000 + Math.random() * 4000,
  delay:    Math.random() * 3000,
}));

function FloatingDot({ dot }: { dot: (typeof DOT_POSITIONS)[number] }) {
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

  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.55, 0.1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

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
        transform: [{ translateY }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LevelCompleteScreen({
  navigation,
  route,
}: LevelCompleteScreenProps): React.JSX.Element {
  const { level, packageInfo } = route.params;
  const pkg = packageInfo.package;

  const animalImage = getColorImage(level.name);
  const setPendingAutoPlay    = useGameStore((s) => s.setPendingAutoPlay);
  const setPendingWorldUnlock = useGameStore((s) => s.setPendingWorldUnlock);
  const languageCode       = useSettingsStore((s) => s.languageCode);

  // ── Navigation ──────────────────────────────────────────────────────────
  // ObjC: openNextLevel → fetchRandomNotCompletedLevel → openNextLevelForLevel:
  // Picks a RANDOM incomplete level from ANY of the 7 Spinny packages.
  // Stores it in useGameStore.pendingAutoPlay, then pops back to SpinnyLevels.
  // SpinnyLevelsScreen reads pendingAutoPlay via useFocusEffect, scrolls to
  // the target cell (animated), then auto-opens the game — matching ObjC's
  // scrollViewDidEndScrollingAnimation → openPuzzleWithAnimation: sequence.
  const goNext = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    const next = getNextLevel(level);
    if (next) {
      // More levels in this world — auto-play the next one
      setPendingAutoPlay({ packageName: next.level.packageName, levelName: next.level.name });
    } else {
      // Last level in this world — signal levels map to show unlock animation
      setPendingWorldUnlock(level.packageName);
    }
    navigation.popToTop();
  }, [level, navigation, setPendingAutoPlay, setPendingWorldUnlock]);

  const goLevels = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    navigation.popToTop();
  }, [navigation]);

  // ── Animal sound (mirrors SPLevelCompletedViewController.playSound) ──────
  const playAnimalSound = useCallback(() => {
    soundService.play('button_click');
    const audioPath = (() => {
      if (languageCode === 'fr') return level.audio_fr ?? level.audio;
      if (languageCode === 'es') return level.audio_es ?? level.audio;
      if (languageCode === 'ru') return level.audio_ru ?? level.audio;
      return level.audio;
    })();
    if (audioPath) soundService.playAnimalSound(audioPath);
  }, [level, languageCode]);

  // Auto-play animal sound when screen appears (matches ObjC [levelCompletedView playSound])
  useEffect(() => {
    playAnimalSound();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entry animations ─────────────────────────────────────────────────────
  // Animal slides in from left + pops
  const animalOpacity    = useSharedValue(0);
  const animalScale      = useSharedValue(0.2);
  const animalTranslateX = useSharedValue(-IMAGE_SIZE * 0.5);
  // Card: use RNAnimated so the initial opacity:0 is committed to native
  // on the very first render — Reanimated applies too late (after first frame).
  const cardOpacity = useRef(new RNAnimated.Value(0)).current;
  // Next button: continuous pulse
  const nextScale        = useSharedValue(1);

  useEffect(() => {
    animalOpacity.value = withTiming(1, { duration: 80 });
    animalScale.value   = withTiming(1, { duration: 480, easing: Easing.out(Easing.back(1.5)) });
    animalTranslateX.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    RNAnimated.timing(cardOpacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    // Next button pulse starts after card is fully visible
    nextScale.value = withDelay(
      480,
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 320, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0,  { duration: 320, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animalStyle = useAnimatedStyle(() => ({
    opacity: animalOpacity.value,
    transform: [
      { scale:      animalScale.value },
      { translateX: animalTranslateX.value },
    ],
  }));
  const nextBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value }],
  }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: pkg.backgroundColorDark }]}>

      {/* Floating white dots */}
      {DOT_POSITIONS.map(d => <FloatingDot key={d.id} dot={d} />)}

      {/* ── LEFT: animal on circle ─────────────────────────────────────── */}
      <View style={styles.leftPanel}>
        <Animated.View style={[styles.animalWrap, animalStyle]}>
          {/* Circle background — package circleColor (light blue for Farm) */}
          <View
            style={[
              styles.circle,
              {
                width:           CIRCLE_SIZE,
                height:          CIRCLE_SIZE,
                borderRadius:    CIRCLE_SIZE / 2,
                backgroundColor: pkg.circleColor,
              },
            ]}
          />
          {/* Animal image — larger than circle → pops out (3D effect) */}
          {animalImage != null && (
            <Image
              source={animalImage}
              style={[
                styles.animalImage,
                { width: IMAGE_SIZE, height: IMAGE_SIZE },
              ]}
              resizeMode="contain"
            />
          )}
        </Animated.View>
      </View>

      {/* ── RIGHT: description card ────────────────────────────────────── */}
      <RNAnimated.View
        style={[
          styles.card,
          {
            width:         CARD_W,
            marginRight:   CARD_MARGIN,
            paddingBottom: BTN_SIZE / 2 + 16,
            opacity:       cardOpacity,
          },
        ]}
      >
        {/* Animal name — FredokaOne, title_color from level */}
        <Text
          style={[
            styles.nameText,
            { fontSize: NAME_FONT, color: level.titleColor || '#3d2b0a' },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {level.name.toUpperCase()}
        </Text>

        {/* Description — FredokaOne, text_color from package */}
        <ScrollView
          style={styles.descripScroll}
          contentContainerStyle={styles.descripContent}
          showsVerticalScrollIndicator={false}
        >
          {level.descrip ? (
            <Text
              style={[
                styles.descripText,
                { fontSize: DESC_FONT, color: pkg.textColor },
              ]}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {level.descrip}
            </Text>
          ) : null}
        </ScrollView>

        {/* Buttons — sit on the card bottom edge, half inside half outside */}
        <View style={[styles.buttons, { bottom: -(BTN_SIZE / 2) }]}>

          {/* Levels / Home — purple circle */}
          <TouchableOpacity onPress={goLevels} activeOpacity={0.75}
            style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: BTN_PURPLE }]}>
            <GridIcon />
          </TouchableOpacity>

          {/* Animal sound — teal circle */}
          <TouchableOpacity onPress={playAnimalSound} activeOpacity={0.75}
            style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: BTN_TEAL }]}>
            <SoundIcon />
          </TouchableOpacity>

          {/* Next — green circle, continuous pulse */}
          <Animated.View style={nextBtnStyle}>
            <TouchableOpacity onPress={goNext} activeOpacity={0.75}
              style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: BTN_GREEN }]}>
              <PlayIcon />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </RNAnimated.View>

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    overflow:       'hidden',
  },

  // ── Left panel
  leftPanel: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  animalWrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  animalImage: {
    // sits on top of circle (no position:absolute), centered by parent
  },

  // ── Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius:    28,
    paddingHorizontal: 20,
    paddingTop:      24,
    // center vertically
    alignSelf:       'center',
    // shadow
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       8,
    overflow:        'visible',
  },
  nameText: {
    fontFamily:  'FredokaOne-Regular',
    fontWeight:  '400',
    textAlign:   'center',
    marginBottom: 10,
  },
  descripScroll: {
    flexGrow:  0,
    maxHeight: H * 0.42,
  },
  descripContent: {
    flexGrow: 1,
  },
  descripText: {
    fontFamily: 'FredokaOne-Regular',
    fontWeight: '400',
    textAlign:  'center',
    lineHeight: undefined,
  },

  // ── Buttons row at bottom of card
  buttons: {
    position:       'absolute',
    left:            0,
    right:           0,
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
    paddingHorizontal: 16,
  },

  // ── Circle buttons (GameplayScreen.jsx style)
  circleBtn: {
    alignItems:    'center',
    justifyContent:'center',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  0,
    elevation:     4,
  },
});