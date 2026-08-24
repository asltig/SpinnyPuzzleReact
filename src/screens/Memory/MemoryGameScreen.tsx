/**
 * MemoryGameScreen.tsx
 *
 * ─── Flip animation (scaleX squeeze) ─────────────────────────────────────────
 *  Phase 1 (150 ms): scaleX 1 → 0  (card squeezes — back disappears)
 *  Phase 2 (150 ms): scaleX 0 → 1  (card expands — front appears)
 *  Content is swapped between phases.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { MemoryGameScreenProps } from '../../navigation/types';
import { useProgressStore } from '../../stores/useProgressStore';
import { soundService }     from '../../services/audio/soundService';
import {
  logLevelStarted,
  logLevelCompleted,
  logLevelAbandoned,
  logLevelRestarted,
  logNextLevelClicked,
} from '../../services/analytics/analyticsService';

// ─── Assets ───────────────────────────────────────────────────────────────────
const CARD_BACK_IMG = require('../../assets/images/memory/closedCellBlue.png');
const CARD_OPEN_BG  = require('../../assets/images/memory/openedCellBlue.png');
const QUESTION_IMG  = require('../../assets/images/memory/icQuestion.png');
const ALERT_BASE    = require('../../assets/images/alertBase.png');
const STAR_FILLED   = require('../../assets/images/star_filled.png');
const STAR_EMPTY    = require('../../assets/images/star_empty.png');
const IC_HOME       = require('../../assets/images/icHomeWithShadow.png');
const IC_PLAY       = require('../../assets/images/icPlayWithShadow.png');
const IC_LEVELS     = require('../../assets/images/icLevelsWithShadow.png');

const CARD_IMGS: Record<string, ReturnType<typeof require>> = {
  bee:     require('../../assets/images/memory/mg_bee.png'),
  bull:    require('../../assets/images/memory/mg_bull.png'),
  cat:     require('../../assets/images/memory/mg_cat.png'),
  chicken: require('../../assets/images/memory/mg_chicken.png'),
  cow:     require('../../assets/images/memory/mg_cow.png'),
  dog:     require('../../assets/images/memory/mg_dog.png'),
  doonkey: require('../../assets/images/memory/mg_doonkey.png'),
  duck:    require('../../assets/images/memory/mg_duck.png'),
  goat:    require('../../assets/images/memory/mg_goat.png'),
  goose:   require('../../assets/images/memory/mg_goose.png'),
  horse:   require('../../assets/images/memory/mg_horse.png'),
  pig:     require('../../assets/images/memory/mg_pig.png'),
  rabbit:  require('../../assets/images/memory/mg_rabbit.png'),
  rooster: require('../../assets/images/memory/mg_rooster.png'),
  sheep:   require('../../assets/images/memory/mg_sheep.png'),
  turkey:  require('../../assets/images/memory/mg_turkey.png'),
};
const ANIMALS = Object.keys(CARD_IMGS);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gridForLevel(lv: number): { rows: number; cols: number } {
  if (lv === 0) return { rows: 2, cols: 2 };
  if (lv === 1) return { rows: 2, cols: 3 };
  if (lv <= 4)  return { rows: 3, cols: 4 };
  if (lv <= 9)  return { rows: 2, cols: 5 };
  if (lv <= 15) return { rows: 3, cols: 8 };
  if (lv <= 27) return { rows: 4, cols: 8 };
  return { rows: 5, cols: 8 };
}
const timerTotal = (lv: number) => 25 + lv * 5;
const showMs     = (lv: number) => lv <= 1 ? 2000 : lv <= 3 ? 2750 : lv <= 5 ? 3000 : 3250;

interface CardInfo { id: number; animal: string }

function buildDeck(rows: number, cols: number): CardInfo[] {
  const picks: string[] = [];
  const src = [...ANIMALS];
  for (let i = 0; i < (rows * cols) / 2; i++) {
    if (src.length === 0) src.push(...ANIMALS);
    const j = Math.floor(Math.random() * src.length);
    picks.push(src.splice(j, 1)[0]!);
  }
  const deck: CardInfo[] = [...picks, ...picks].map((a, i) => ({ id: i, animal: a }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  id: i, r: 2 + Math.random() * 4,
  rx: Math.random(), ry: Math.random(),
  dur: 3800 + Math.random() * 3000, delay: Math.random() * 2500,
}));

function FloatingDot({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.r, width: dot.r * 2, height: dot.r * 2,
      backgroundColor: '#FFF', left: dot.rx * W, top: dot.ry * H,
      opacity: a.interpolate({ inputRange: [0,0.5,1], outputRange: [0.12,0.55,0.12] }),
      transform: [{ translateY: a.interpolate({ inputRange:[0,1], outputRange:[0,-8] }) }],
    }} />
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#9B59B6','#E74C3C','#3498DB','#F1C40F','#2ECC71','#E67E22','#FF69B4','#00BCD4'];

function Confetti({ W, H }: { W: number; H: number }) {
  const pieces = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i, x: Math.random() * W,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 1000,
      dur: 2200 + Math.random() * 1800,
      tilt: (Math.random() - 0.5) * 360,
      anim: new Animated.Value(0),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.loop(Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: p.dur, useNativeDriver: true }),
        Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    );
    Animated.parallel(anims).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {pieces.map((p) => (
        <Animated.View key={p.id} pointerEvents="none" style={{
          position: 'absolute', left: p.x, top: 0,
          width: p.size, height: p.size * 0.5,
          backgroundColor: p.color, borderRadius: 1,
          opacity: p.anim.interpolate({ inputRange:[0,0.1,0.85,1], outputRange:[0,1,1,0] }),
          transform: [
            { translateY: p.anim.interpolate({ inputRange:[0,1], outputRange:[-20, H+20] }) },
            { rotate: p.anim.interpolate({ inputRange:[0,1], outputRange:['0deg', `${p.tilt}deg`] }) },
          ],
        }} />
      ))}
    </>
  );
}

// ─── Finish overlay ───────────────────────────────────────────────────────────
interface FinishOverlayProps {
  phase:    'won' | 'lost';
  stars:    number;
  W:        number;
  H:        number;
  level:    number;
  hasNext:  boolean;
  onHome:   () => void;
  onRetry:  () => void;
  onNext:   () => void;
}

function FinishOverlay({ phase, stars, W, H, level, hasNext, onHome, onRetry, onNext }: FinishOverlayProps) {
  const backdropFade = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.1)).current;
  const cardFade     = useRef(new Animated.Value(0)).current;
  const playPulse    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(backdropFade, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 1, duration: 300,
          easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        const pulse = Animated.loop(Animated.sequence([
          Animated.timing(playPulse, { toValue: 1.35, duration: 267, useNativeDriver: true }),
          Animated.timing(playPulse, { toValue: 0.9,  duration: 267, useNativeDriver: true }),
          Animated.timing(playPulse, { toValue: 1.2,  duration: 267, useNativeDriver: true }),
          Animated.timing(playPulse, { toValue: 0.9,  duration: 267, useNativeDriver: true }),
          Animated.timing(playPulse, { toValue: 1.0,  duration: 267, useNativeDriver: true }),
          Animated.delay(1500),
        ]));
        pulse.start();
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popW   = Math.round(Math.min(W * 0.58, 400));
  const popH   = Math.round(popW * (450 / 612));
  const btnSz  = Math.round(popH * 0.30);
  const starSz = Math.round(popW * 0.16);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 500 }]}>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,80,10,0.75)', opacity: backdropFade }]}
      />

      {/* Confetti (win only) */}
      {phase === 'won' && <Confetti W={W} H={H} />}

      {/* Card */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        pointerEvents="box-none">
        <Animated.View style={{
          width: popW, height: popH,
          opacity: cardFade,
          transform: [{ scale: cardScale }],
        }}>
          {/* alertBase card frame */}
          <Image source={ALERT_BASE}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            resizeMode="stretch" />

          {/* Stars — straddling top edge (win only) */}
          {phase === 'won' && (
            <View style={[ss.starsRow, { top: -(starSz * 0.55) }]}>
              {[0,1,2].map((i) => (
                <Image key={i}
                  source={i < stars ? STAR_FILLED : STAR_EMPTY}
                  style={{ width: starSz, height: starSz, marginHorizontal: 3 }}
                  resizeMode="contain" />
              ))}
            </View>
          )}

          {/* Header text */}
          <Text style={[ss.headerTxt, { fontSize: Math.round(popH * 0.105) }]}>
            {phase === 'won' ? 'Well Done!' : "Time's Up!"}
          </Text>

          {/* Body text (win only) */}
          {phase === 'won' && (
            <Text style={[ss.bodyTxt, { fontSize: Math.round(popH * 0.09) }]}>
              Level{'\n'}Completed!
            </Text>
          )}

          {/* Buttons */}
          <View style={ss.btnRow}>
            <TouchableOpacity onPress={onHome} activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Image source={IC_HOME} style={{ width: btnSz, height: btnSz }} resizeMode="contain" />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: playPulse }] }}>
              <TouchableOpacity onPress={onRetry} activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Image source={IC_PLAY}
                  style={{ width: Math.round(btnSz * 1.1), height: Math.round(btnSz * 1.1) }}
                  resizeMode="contain" />
              </TouchableOpacity>
            </Animated.View>

            {phase === 'won' && hasNext && (
              <TouchableOpacity onPress={onNext} activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Image source={IC_LEVELS} style={{ width: btnSz, height: btnSz }} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Single card component ────────────────────────────────────────────────────
interface MemCardProps {
  animal:   string;
  size:     number;
  corner:   number;
  faceUp:   boolean;
  onPress:  () => void;
  disabled: boolean;
  dealAnim: { scale: Animated.Value; opacity: Animated.Value };
}

function MemCard({ animal, size, corner, faceUp, onPress, disabled, dealAnim }: MemCardProps) {
  const scaleX      = useRef(new Animated.Value(1)).current;
  const [showFront, setShowFront] = useState(false);
  const prevFaceUp  = useRef(faceUp);

  useEffect(() => {
    if (prevFaceUp.current === faceUp) return;
    prevFaceUp.current = faceUp;
    Animated.timing(scaleX, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowFront(faceUp);
      Animated.timing(scaleX, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [faceUp, scaleX]);

  const imgSrc = CARD_IMGS[animal];

  return (
    <Animated.View style={{
      width: size, height: size,
      opacity: dealAnim.opacity,
      transform: [{ scale: dealAnim.scale }, { scaleX }],
    }}>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.82}
        style={{ width: size, height: size }}>
        {showFront ? (
          <View style={{ width: size, height: size, borderRadius: corner, overflow: 'hidden' }}>
            <Image source={CARD_OPEN_BG} style={{ width: size, height: size }} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              {imgSrc && (
                <Image source={imgSrc}
                  style={{ width: size * 0.65, height: size * 0.65 }} resizeMode="contain" />
              )}
            </View>
          </View>
        ) : (
          <View style={{ width: size, height: size, borderRadius: corner, overflow: 'hidden' }}>
            <Image source={CARD_BACK_IMG} style={{ width: size, height: size }} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Image source={QUESTION_IMG}
                style={{ width: size * 0.42, height: size * 0.50 }} resizeMode="contain" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MemoryGameScreen({ navigation, route }: MemoryGameScreenProps): React.JSX.Element {
  const { level } = route.params;
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  const { markCompleted, setLevelStars } = useProgressStore();

  const { rows, cols } = useMemo(() => gridForLevel(level), [level]);
  const deck  = useMemo(() => buildDeck(rows, cols), [rows, cols]);
  const total = deck.length;

  // ── Layout ─────────────────────────────────────────────────────────────────
  const TOP_H  = 62;
  const GAP    = 6;
  const PAD    = 14;
  const CARD   = Math.floor(Math.min(
    (W - PAD * 2 - (cols - 1) * GAP) / cols,
    (H - TOP_H - PAD - (rows - 1) * GAP) / rows,
    110,
  ));
  const CORNER = Math.round(CARD * 0.12);
  const gridW  = cols * CARD + (cols - 1) * GAP;
  const gridH  = rows * CARD + (rows - 1) * GAP;
  const gridL  = (W - gridW) / 2;
  const gridT  = TOP_H + (H - TOP_H - gridH) / 2;

  // ── Game state ─────────────────────────────────────────────────────────────
  type Phase = 'dealing' | 'preview' | 'playing' | 'won' | 'lost';
  const [phase,    setPhase]  = useState<Phase>('dealing');
  const [faceUp,   setFaceUp] = useState<Set<number>>(new Set());
  const [matched,  setMatched]= useState<Set<number>>(new Set());
  const [firstSel, setFirst]  = useState<number | null>(null);
  const [busy,     setBusy]   = useState(true);
  const [timeLeft, setTime]   = useState(timerTotal(level));
  const [timerOn,  setTimerOn]= useState(false);
  const [winStars, setWinStars]= useState(1);

  // ── Deal animation values ──────────────────────────────────────────────────
  const dealAnims = useRef(
    deck.map(() => ({ scale: new Animated.Value(0), opacity: new Animated.Value(0) })),
  ).current;

  // ── Analytics refs ─────────────────────────────────────────────────────────
  const attemptNumberRef = useRef(0);
  const didCompleteRef   = useRef(false);

  useEffect(() => {
    attemptNumberRef.current = logLevelStarted({
      game:  'memory',
      world: 'Memory',
      level: `level_${level}`,
    });
    didCompleteRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealStarted = useRef(false);
  useEffect(() => {
    if (CARD === 0 || dealStarted.current) return;
    dealStarted.current = true;
    soundService.playMusic('game_music');

    const durMs = level <= 1 ? 220 : 180;
    dealAnims.forEach((a) => { a.scale.setValue(0); a.opacity.setValue(0); });

    setTimeout(() => {
      deck.forEach((_, i) => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(dealAnims[i]!.scale,   { toValue: 1, duration: durMs, useNativeDriver: true }),
            Animated.timing(dealAnims[i]!.opacity, { toValue: 1, duration: durMs, useNativeDriver: true }),
          ]).start();
        }, i * durMs * 0.6);
      });
    }, 800);

    const allMs = 800 + deck.length * durMs * 0.6 + durMs + 1000;
    setTimeout(() => {
      setPhase('preview');
      setFaceUp(new Set(deck.map((_, i) => i)));
    }, allMs);

    setTimeout(() => {
      setFaceUp(new Set());
      setPhase('playing');
      setBusy(false);
      setTimerOn(true);
    }, allMs + showMs(level));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CARD]);

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerOn || phase !== 'playing') return;
    if (timeLeft <= 0) {
      setPhase('lost');
      setTimerOn(false);
      soundService.play('memory_level_failed');
      return;
    }
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, timerOn, phase]);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = useCallback((i: number) => {
    if (busy || phase !== 'playing') return;
    if (matched.has(i) || faceUp.has(i)) return;

    soundService.play(firstSel === null ? 'memory_click1' : 'memory_click2');
    ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true });

    const newFaceUp = new Set([...faceUp, i]);
    setFaceUp(newFaceUp);

    if (firstSel === null) { setFirst(i); return; }

    const a = deck[firstSel]!, b = deck[i]!;
    setFirst(null);

    if (a.animal === b.animal) {
      soundService.play('memory_correct');
      ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
      const nm = new Set([...matched, firstSel, i]);
      setMatched(nm);
      if (nm.size === total) {
        setPhase('won');
        setTimerOn(false);
        soundService.play('memory_level_complete');
        const pct = timeLeft / timerTotal(level);
        const s = pct >= 0.76 ? 3 : pct >= 0.50 ? 2 : 1;
        setWinStars(s);
        setLevelStars('Memory', `level_${level}`, s);
        void markCompleted('Memory', `level_${level}`);
        didCompleteRef.current = true;
        logLevelCompleted({
          game:            'memory',
          world:           'Memory',
          level:           `level_${level}`,
          attempt_number:  attemptNumberRef.current,
          completion_time: timerTotal(level) - timeLeft,
          stars:           s,
          hints_used:      0,
          moves:           nm.size / 2,
        });
      }
    } else {
      setBusy(true);
      setTimeout(() => {
        setFaceUp((prev) => new Set([...prev].filter((x) => x !== firstSel && x !== i)));
        setBusy(false);
      }, 900);
    }
  }, [busy, phase, matched, faceUp, firstSel, deck, timeLeft, total, level, markCompleted, setLevelStars]);

  const goBack = useCallback(() => {
    if (!didCompleteRef.current) {
      logLevelAbandoned({
        game:           'memory',
        world:          'Memory',
        level:          `level_${level}`,
        attempt_number: attemptNumberRef.current,
        time_spent:     timerTotal(level) - timeLeft,
      });
    }
    soundService.play('button_click');
    soundService.play('transition_out');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation, level, timeLeft]);

  const BTN = Math.round(H * 0.115);

  return (
    <View style={[ss.root, { backgroundColor: '#9FD555', width: W, height: H }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      {/* HUD */}
      <View style={[ss.hud, { height: TOP_H }]}>
        <View style={ss.hudLeft}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.85}>
            <Image source={require('../../assets/images/icLevelsWithShadow.png')}
              style={{ width: BTN, height: BTN }} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={[ss.hudTxt, { fontSize: Math.round(H * 0.048) }]}>
            {matched.size}/{total}
          </Text>
        </View>

        <View style={ss.hudCenter}>
          <Text style={[ss.hudTxt, { fontSize: Math.round(H * 0.055) }]}>
            Timer : {timeLeft}
          </Text>
        </View>

        <View style={ss.hudRight}>
          <TouchableOpacity activeOpacity={0.85}>
            <Image source={require('../../assets/images/btnHint.png')}
              style={{ width: BTN, height: BTN }} resizeMode="contain" />
          </TouchableOpacity>
          <View style={ss.badge}><Text style={ss.badgeTxt}>5</Text></View>
        </View>
      </View>

      {/* Card grid */}
      {deck.map((card, i) => {
        const isMatched = matched.has(i);
        const r = Math.floor(i / cols);
        const c = i % cols;
        const left = gridL + c * (CARD + GAP);
        const top  = gridT + r * (CARD + GAP);
        return (
          <View key={card.id} style={{ position: 'absolute', left, top, width: CARD, height: CARD }}>
            <MemCard
              animal={card.animal}
              size={CARD}
              corner={CORNER}
              faceUp={isMatched || faceUp.has(i)}
              onPress={() => handleTap(i)}
              disabled={isMatched || busy || phase !== 'playing'}
              dealAnim={dealAnims[i]!}
            />
          </View>
        );
      })}

      {/* Finish overlay */}
      {(phase === 'won' || phase === 'lost') && (
        <FinishOverlay
          phase={phase}
          stars={winStars}
          W={W}
          H={H}
          level={level}
          hasNext={level < 29}
          onHome={goBack}
          onRetry={() => {
            logLevelRestarted({ game: 'memory', world: 'Memory', level: `level_${level}` });
            navigation.replace('MemoryGame', { level });
          }}
          onNext={() => {
            logNextLevelClicked({ game: 'memory', world: 'Memory', level: `level_${level}` });
            navigation.replace('MemoryGame', { level: level + 1 });
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { overflow: 'hidden' },

  hud:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6, zIndex: 10 },
  hudLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 90 },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudRight:  { minWidth: 55, alignItems: 'center', position: 'relative' },

  hudTxt: {
    color: '#FFFFFF', fontFamily: 'FredokaOne-Regular',
    textShadowColor: '#3A7A10', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2,
  },
  badge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: '#E74C3C', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Finish overlay
  starsRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', zIndex: 10,
  },
  headerTxt: {
    position: 'absolute', left: 0, right: 0, top: '16%',
    textAlign: 'center', fontFamily: 'FredokaOne-Regular',
    color: '#7B2FBE',
    textShadowColor: '#ffffff', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    zIndex: 5,
  },
  bodyTxt: {
    position: 'absolute', left: 0, right: 0, top: '43%',
    textAlign: 'center', fontFamily: 'FredokaOne-Regular',
    color: '#D4760A', zIndex: 5,
  },
  btnRow: {
    position: 'absolute', left: 0, right: 0, bottom: '5%',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 16, zIndex: 5,
  },
});