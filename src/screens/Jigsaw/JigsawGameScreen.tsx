/**
 * JigsawGameScreen.tsx
 * Jigsaw puzzle gameplay screen — matches screenshots IMG_1456/1457.
 *
 * ─── Layout (landscape) ──────────────────────────────────────────────────────
 *   • Dark purple background (#2C1A3A) + animated colored dots
 *   • "Time MM:SS" timer — FredokaOne, centered at top  (ObjC: CountUpLabel)
 *   • Top-left: blue circle with grid icon  → back to levels
 *   • Top-right: teal circle + magnifying glass + red hint badge
 *   • Center: white-bordered board with ghost image (0.22 alpha)
 *   • Left panel: unplaced pieces stacked vertically (scaled ~0.65)
 *   • Right panel: unplaced pieces (same)
 *
 * ─── Animations ──────────────────────────────────────────────────────────────
 *   Entry: board + pieces fade in over 500 ms
 *   Snap:  "Ring fall in place" sound + haptic + teal slot highlight
 *   Win:   board scales to fill screen → white overlay fades in
 *
 * ─── Sounds ──────────────────────────────────────────────────────────────────
 *   Piece drag begin : button_click
 *   Piece snap       : ring_snap
 *   Win              : correct (or random win sound)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import type { JigsawGameScreenProps } from '../../navigation/types';
import {
  logLevelStarted,
  logLevelCompleted,
  logLevelAbandoned,
  logNextLevelClicked,
} from '../../services/analytics/analyticsService';
import { useJigsawGame }      from '../../game/jigsaw/useJigsawGame';
import { JigsawBoard }        from '../../components/jigsaw/JigsawBoard';
import { JigsawSnapEffect }   from '../../components/jigsaw/JigsawSnapEffect';
import { JigsawWinOverlay }   from '../../components/jigsaw/JigsawWinOverlay';
import { modeForLevelIndex }  from '../../game/jigsaw/jigsawMath';
import { getJigsawLevels }    from '../../services/data/jigsawService';
import { useProgressStore }   from '../../stores/useProgressStore';
import { soundService }       from '../../services/audio/soundService';
import { useHintsStore }      from '../../stores/useHintsStore';
import type { GameMode, Level } from '../../types/models';

// ─── Bundled jigsaw image map (from src/screens/Jigsaw/ → ../../assets) ──────
const JIGSAW_IMAGES: Record<string, ReturnType<typeof require>> = {
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
// Constants
// ─────────────────────────────────────────────

const TOP_BAR_H   = 66;    // height of timer + button row (includes paddingTop)
const BG_COLOR    = '#2C1A3A';
const TEAL        = '#5DDAC9';
const BTN_BLUE    = '#4BBDE8';

// ─────────────────────────────────────────────
// Floating colored dots (matches ObjC BackgroundAnimationManager)
// ─────────────────────────────────────────────

const DOT_COLORS = ['#e74c3c','#3498db','#f1c40f','#2ecc71','#e67e22','#9b59b6'];
const DOT_DATA = Array.from({ length: 18 }, (_, i) => ({
  id: i, r: 2.5 + Math.random() * 3,
  rx: Math.random(), ry: Math.random(),
  dur: 3500 + Math.random() * 3000,
  delay: Math.random() * 2000,
  color: DOT_COLORS[i % DOT_COLORS.length]!,
}));

function FloatingDot({ dot, W, H }: { dot: (typeof DOT_DATA)[number]; W: number; H: number }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(anim, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      RNAnimated.timing(anim, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.7, 0.15] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <RNAnimated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.r,
      width: dot.r * 2, height: dot.r * 2, backgroundColor: dot.color,
      left: dot.rx * W, top: dot.ry * H,
      opacity, transform: [{ translateY }],
    }} />
  );
}

// ─────────────────────────────────────────────
// Timer hook (count-up, ObjC: CountUpLabel)
// ─────────────────────────────────────────────

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(1, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `Time ${mm}:${ss}`;
}

// ─────────────────────────────────────────────
// Level intro animation
// Mirrors ObjC startGameAnimationForIndex: + prepareForStartWithImage:
//   Phase 1 (0–1.2 s): full puzzle image shown full-screen (fades in 0.4 s, holds)
//   Phase 2 (1.2–2.1 s): image shrinks to board frame (0.9 s ease-in-out)
//   After: calls onDone() → game becomes interactive
// ─────────────────────────────────────────────

interface LevelIntroProps {
  imageName: string;
  boardX: number; boardY: number; boardW: number; boardH: number;
  screenW: number; screenH: number;
  onDone: () => void;
}

function LevelIntro({ imageName, boardX, boardY, boardW, boardH, screenW, screenH, onDone }: LevelIntroProps) {
  const imgSrc = JIGSAW_IMAGES[imageName] ?? JIGSAW_IMAGES['j1']!;

  // All layout-animated values (useNativeDriver: false required)
  const left   = useRef(new RNAnimated.Value(0)).current;
  const top    = useRef(new RNAnimated.Value(0)).current;
  const width  = useRef(new RNAnimated.Value(screenW)).current;
  const height = useRef(new RNAnimated.Value(screenH)).current;
  const alpha  = useRef(new RNAnimated.Value(0)).current;

  const ease = (t: number) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

  useEffect(() => {
    // Fade in full-screen image
    RNAnimated.timing(alpha, { toValue: 1, duration: 400, useNativeDriver: false }).start(() => {
      // Hold 800 ms then shrink to board frame
      setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(left,   { toValue: boardX, duration: 900, easing: ease, useNativeDriver: false }),
          RNAnimated.timing(top,    { toValue: boardY, duration: 900, easing: ease, useNativeDriver: false }),
          RNAnimated.timing(width,  { toValue: boardW, duration: 900, easing: ease, useNativeDriver: false }),
          RNAnimated.timing(height, { toValue: boardH, duration: 900, easing: ease, useNativeDriver: false }),
          RNAnimated.timing(alpha,  { toValue: 0,      duration: 900, easing: ease, useNativeDriver: false }),
        ]).start(() => onDone());
      }, 800);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, width, height, opacity: alpha, overflow: 'hidden' }}
    >
      <Image source={imgSrc} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </RNAnimated.View>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function JigsawGameScreen({
  navigation,
  route,
}: JigsawGameScreenProps): React.JSX.Element {
  const { level } = route.params;
  const { width: winW, height: winH } = useWindowDimensions();

  // Always treat as landscape
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  // ObjC formula: (levelIndex+1)/3 fractional part → easy/medium/hard
  // level.order = 0-based display index set in JigsawLevelsScreen
  const gameMode: GameMode = modeForLevelIndex(level.order);

  // ── Stores ──────────────────────────────────────────────────────────────
  const { markCompleted, setLastPlayedLevel, setLevelStars } = useProgressStore();
  const hintsCount = useHintsStore((s) => s.hintsCount);
  const useHint    = useHintsStore((s) => s.useHint);

  useEffect(() => {
    setLastPlayedLevel(level.packageName, level.name);
  }, [level.packageName, level.name, setLastPlayedLevel]);

  // ── Analytics refs ─────────────────────────────────────────────────────────
  const attemptNumberRef = useRef(0);
  const didCompleteRef   = useRef(false);
  const piecesPlacedRef  = useRef(0);

  useEffect(() => {
    attemptNumberRef.current = logLevelStarted({
      game:  'jigsaw',
      world: 'Jigsaw',
      level: level.name,
    });
    didCompleteRef.current  = false;
    piecesPlacedRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Level intro (full image shown before pieces appear) ─────────────────
  const [introPlaying, setIntroPlaying] = useState(true);

  // ── Win state ────────────────────────────────────────────────────────────
  const [solved,  setSolved]  = useState(false);
  const [winStars, setWinStars] = useState(1);
  const [timerOn, setTimerOn] = useState(false);  // starts only after intro finishes
  const elapsedRef            = useRef(0);
  const timerStr = useTimer(timerOn && !solved);

  const handleComplete = useCallback(async () => {
    if (solved) return;
    setTimerOn(false);
    soundService.play('correct');
    ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });

    // Stars: ObjC < 25s = 3, < 60s = 2, else = 1
    const stars = elapsedRef.current < 25 ? 3 : elapsedRef.current < 60 ? 2 : 1;
    setWinStars(stars);
    setLevelStars(level.packageName, level.name, stars);
    await markCompleted(level.packageName, level.name);
    didCompleteRef.current = true;
    logLevelCompleted({
      game:            'jigsaw',
      world:           'Jigsaw',
      level:           level.name,
      attempt_number:  attemptNumberRef.current,
      completion_time: elapsedRef.current,
      stars,
      hints_used:      0,
      moves:           piecesPlacedRef.current,
    });
    setSolved(true);   // triggers JigsawWinOverlay
  }, [solved, level, markCompleted, setLevelStars]);

  // ── Snap star effects ─────────────────────────────────────────────────────
  const [snapEvents, setSnapEvents] = useState<Array<{ id: number; cx: number; cy: number }>>([]);
  const snapIdRef      = useRef(0);
  // Stable ref: callback is set AFTER hook returns; fires only on user gesture
  const onSnappedRef   = useRef<(idx: number) => void>();

  // ── Game engine ──────────────────────────────────────────────────────────
  const { pieceStates, pieces, boardFrame,
          baseW, baseH, tabW, tabH, canvasW, canvasH, resetLevel } =
    useJigsawGame({
      screenW:    W,
      screenH:    H,
      topBarH:    TOP_BAR_H,
      mode:       gameMode,
      onComplete: handleComplete,
      onPieceSnapped: useCallback((idx: number) => onSnappedRef.current?.(idx), []),
    });

  // Update the ref after every render so it always reads fresh values
  onSnappedRef.current = useCallback((pieceIdx: number) => {
    piecesPlacedRef.current++;
    const piece = pieces[pieceIdx];
    if (!piece) return;
    const cx = boardFrame.x + piece.col * baseW + baseW / 2;
    const cy = boardFrame.y + piece.row * baseH + baseH / 2;
    const id = ++snapIdRef.current;
    setSnapEvents((prev) => [...prev, { id, cx, cy }]);
    setTimeout(() => setSnapEvents((prev) => prev.filter((e) => e.id !== id)), 1000);
  }, [pieces, boardFrame, baseW, baseH]);

  // ── Entry animations ──────────────────────────────────────────────────────
  // HUD (top bar) fades in immediately; board fades+scales in after intro ends.
  const hudOpacity   = useSharedValue(0);
  const boardOpacity = useSharedValue(0);
  const boardScale   = useSharedValue(0.92);

  useEffect(() => {
    hudOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    soundService.playMusic('game_music');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (introPlaying) return;
    boardOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    boardScale.value   = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPlaying]);

  // Fade out the top bar (timer + buttons) when the win sequence starts
  useEffect(() => {
    if (!solved) return;
    hudOpacity.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const hudStyle   = useAnimatedStyle(() => ({ opacity: hudOpacity.value }));
  const boardStyle = useAnimatedStyle(() => ({
    opacity:   boardOpacity.value,
    transform: [{ scale: boardScale.value }],
  }));

  // ── Hint ─────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (hintsCount <= 0) return;
    useHint();
    soundService.play('button_click');
  }, [hintsCount, useHint]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (!didCompleteRef.current) {
      logLevelAbandoned({
        game:           'jigsaw',
        world:          'Jigsaw',
        level:          level.name,
        attempt_number: attemptNumberRef.current,
        time_spent:     elapsedRef.current,
      });
    }
    soundService.play('button_click');
    soundService.play('transition_out');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation, level]);

  // Win popup actions (ObjC: closeHandler / playHandler / levelsHandler)
  const onWinHome = useCallback(() => {
    soundService.play('button_click');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation]);

  const onWinNext = useCallback(() => {
    logNextLevelClicked({ game: 'jigsaw', world: 'Jigsaw', level: level.name });
    soundService.play('button_click');
    soundService.playMusic('game_music');

    // Find next level in the sorted jigsaw level list (ObjC: currentLevel += 1)
    const allLevels = getJigsawLevels();
    const nextJL    = allLevels.find((jl) => jl.index === level.order + 1);
    if (!nextJL) {
      // No more levels — return to levels screen
      navigation.goBack();
      return;
    }

    const nextLevel: Level = {
      id:              nextJL.name,
      name:            nextJL.name,
      packageName:     'Jigsaw',
      imgUrl:          nextJL.isInitialData ? '' : nextJL.imgPath,
      imgPath:         nextJL.imgPath,
      order:           nextJL.index,
      imageDownloaded: nextJL.isInitialData,
      levelCompleted:  false,
      isInitialData:   nextJL.isInitialData,
      descrip:         '',
      titleColor:      '#FFFFFF',
      colorImage:      null,
      layerImage:      null,
    };
    // Replace so pressing back from the new level goes to JigsawLevels, not here
    navigation.replace('JigsawGame', { level: nextLevel });
  }, [level.order, navigation]);

  const onWinLevels = useCallback(() => {
    soundService.play('button_click');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation]);

  const BTN_SZ = Math.round(H * 0.12);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    // Full-screen container — pieces use absoluteX/Y (screen coords), so
    // this View must span the full screen to match coordinate spaces.
    <View style={ss.root}>
      {/* Colored floating dots */}
      {DOT_DATA.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <Animated.View style={[ss.topBar, { height: TOP_BAR_H, zIndex: 100 }, hudStyle]}>
        {/* Back button — btnHome (blue circle + house icon) */}
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../../assets/images/btnHome.png')}
            style={{ width: BTN_SZ, height: BTN_SZ }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Timer — FredokaOne, white, centered */}
        <Text style={[ss.timerText, { fontSize: Math.round(H * 0.052) }]}>
          {timerStr}
        </Text>

        {/* Hint button — yellow circle + 💡 emoji + red badge (matches Spinny) */}
        <View style={{ overflow: 'visible' }}>
          <TouchableOpacity
            onPress={handleHint}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[ss.hintCircle, { width: BTN_SZ, height: BTN_SZ, borderRadius: BTN_SZ / 2 }]}>
              <Text style={[ss.hintIcon, { fontSize: BTN_SZ * 0.45 }]}>💡</Text>
            </View>
          </TouchableOpacity>
          <View style={ss.badge}>
            <Text style={ss.badgeText}>{hintsCount}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Level intro — full image zooms to board, then game starts ────── */}
      {introPlaying && !solved && (
        <LevelIntro
          imageName={level.name}
          boardX={boardFrame.x}
          boardY={boardFrame.y}
          boardW={boardFrame.width}
          boardH={boardFrame.height}
          screenW={W}
          screenH={H}
          onDone={() => {
            setIntroPlaying(false);
            setTimerOn(true);   // timer starts after intro
          }}
        />
      )}

      {/* ── Game area — board + pieces (shown after intro, hidden on win) ── */}
      {!introPlaying && !solved && (
        <Animated.View style={[StyleSheet.absoluteFill, boardStyle]} pointerEvents="box-none">
          <JigsawBoard
            boardX={boardFrame.x}
            boardY={boardFrame.y}
            boardW={boardFrame.width}
            boardH={boardFrame.height}
            baseW={baseW} baseH={baseH}
            tabW={tabW}   tabH={tabH}
            canvasW={canvasW} canvasH={canvasH}
            pieces={pieces}
            pieceStates={pieceStates}
            imageName={level.name}
          />
          {/* Snap star effects */}
          {snapEvents.map((evt) => (
            <JigsawSnapEffect
              key={evt.id}
              centerX={evt.cx}
              centerY={evt.cy}
              pieceW={baseW}
              pieceH={baseH}
            />
          ))}
        </Animated.View>
      )}

      {/* ── Win overlay — full animation sequence (zoom + confetti + popup) ── */}
      <JigsawWinOverlay
        visible={solved}
        imageName={level.name}
        stars={winStars}
        boardX={boardFrame.x}
        boardY={boardFrame.y}
        boardW={boardFrame.width}
        boardH={boardFrame.height}
        screenW={W}
        screenH={H}
        onHome={onWinHome}
        onNext={onWinNext}
        onLevels={onWinLevels}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const ss = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: BG_COLOR,
    overflow:        'hidden',
  },
  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingLeft:     14,
    paddingRight:    18,   // extra room so badge doesn't clip on right edge
    paddingTop:      10,
  },
  hintCircle: {
    backgroundColor: '#F9D84E',
    alignItems:      'center',
    justifyContent:  'center',
  },
  hintIcon: {
    // fontSize set inline as BTN_SZ * 0.45
  },
  timerText: {
    color:       '#FFFFFF',
    fontFamily:  'FredokaOne-Regular',
    letterSpacing: 1,
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
  gameArea: {
    position: 'relative',
    overflow: 'visible',
  },

  // Win overlay
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,26,58,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  winCard: {
    backgroundColor:   'rgba(93,220,201,0.12)',
    borderRadius:       20,
    paddingHorizontal:  40,
    paddingVertical:    36,
    alignItems:        'center',
    borderWidth:         1.5,
    borderColor:        TEAL,
    gap:                 10,
    minWidth:           260,
  },
  winIcon:    { fontSize: 52 },
  winTitle: {
    color:      '#FFFFFF',
    fontFamily: 'FredokaOne-Regular',
    fontSize:   28,
  },
  winTimer: {
    color:      TEAL,
    fontFamily: 'FredokaOne-Regular',
    fontSize:   18,
    marginBottom: 8,
  },
  winBtn: {
    backgroundColor:   TEAL,
    borderRadius:       12,
    paddingHorizontal:  32,
    paddingVertical:    12,
    width:             '100%',
    alignItems:        'center',
  },
  winBtnText: {
    color:      '#2C1A3A',
    fontFamily: 'FredokaOne-Regular',
    fontSize:   17,
  },
  winBtnSecondary:     { paddingVertical: 8 },
  winBtnSecondaryText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});