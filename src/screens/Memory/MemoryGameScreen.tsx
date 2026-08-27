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
  Animated, useWindowDimensions, ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { MemoryGameScreenProps } from '../../navigation/types';
import { useProgressStore } from '../../stores/useProgressStore';
import { useHintsStore }    from '../../stores/useHintsStore';
import { soundService }     from '../../services/audio/soundService';
import { isLevelLockedByPaywall, maybeShowInterstitial, preloadInterstitial } from '../../services/monetization/monetizationService';
import { iapService, HINTS_PRODUCT_ID } from '../../services/iap/iapService';
import { adsService }        from '../../services/ads/adsService';
import { FullPackagePaywallModal } from '../../components/FullPackagePaywallModal';
import {
  logLevelStarted,
  logLevelCompleted,
  logLevelAbandoned,
  logLevelRestarted,
  logNextLevelClicked,
  logHintUsed,
} from '../../services/analytics/analyticsService';

// ─── Palette (matches SpinnyGamePlayScreen's mockup-derived design system) ────
const GREEN            = '#5cba6f';
const TEAL             = '#5cc2df';
const YELLOW           = 'rgb(224,197,110)';
const RED               = '#e3435a';
const PURPLE_BLUE       = 'rgb(103,110,224)';
const PURPLE_BLUE_DARK  = 'rgb(74,80,181)';
const STAR_COLOR        = 'rgb(232,155,72)';
const INK               = '#2c3e50';
const MUTED             = '#8a97a3';

// Back/hint button screen-edge padding — matches SpinnyGamePlayScreen's BTN_X.
const BTN_X = Platform.OS === 'ios' ? 20 : 16;

const STAR_PATH = 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z';
const GRID_PATH = 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z';

const shade = (hex: string, f = 0.72) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

// ─── HUD / popup icons ─────────────────────────────────────────────────────────
function BackIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function HintIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M9,21c0,0.55,0.45,1,1,1h4c0.55,0,1-0.45,1-1v-1H9V21z M12,2C8.14,2,5,5.14,5,9c0,2.38,1.19,4.47,3,5.74V17 c0,0.55,0.45,1,1,1h6c0.55,0,1-0.45,1-1v-2.26c1.81-1.27,3-3.36,3-5.74C19,5.14,15.86,2,12,2z" />
    </Svg>
  );
}

function ShieldCheckIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3c-1.8 2-4 3.4-7 3.8V12c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6.8c-3-.4-5.2-1.8-7-3.8z" fill="#fff" fillOpacity={0.95} />
      <Path d="M9.3 12.2l1.9 1.9 3.6-3.9" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function AdPlayIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.5 6h15v12h-15z" fill="#fff" />
      <Path d="M17.5 10.2l3.6-2.4a.6.6 0 0 1 .9.5v7.4a.6.6 0 0 1-.9.5l-3.6-2.4z" fill="#fff" />
      <Path d="M8.3 9.5l4.4 2.5-4.4 2.5z" fill={PURPLE_BLUE} />
    </Svg>
  );
}

// ─── Finish-overlay icons ──────────────────────────────────────────────────────
function ClockIcon({ size = 32, color = RED }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.6} fill="none" stroke={color} strokeWidth={2.4} />
      <Path fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" d="M12 7.4v5l3 2" />
    </Svg>
  );
}

function RetryIcon({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
      <Path fill="#ffffff" d="M20.8 3.8v5.4h-5.4z" />
    </Svg>
  );
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#ffffff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

function GridIcon({ size = 18, color = '#5b6b78' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={GRID_PATH} />
    </Svg>
  );
}

function StarIcon({ size = 38, color = STAR_COLOR }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={STAR_PATH} />
    </Svg>
  );
}

// ─── Assets ───────────────────────────────────────────────────────────────────
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
  phase:       'won' | 'lost';
  stars:       number;
  W:           number;
  H:           number;
  pairsFound:  number;
  pairsTotal:  number;
  timeLeft:    number;
  hasNext:     boolean;
  onHome:      () => void;
  onRetry:     () => void;
  onNext:      () => void;
}

function FinishOverlay({ phase, stars, W, H, pairsFound, pairsTotal, timeLeft, hasNext, onHome, onRetry, onNext }: FinishOverlayProps) {
  const backdropFade = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.1)).current;
  const cardFade     = useRef(new Animated.Value(0)).current;
  const heroPulse    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(backdropFade, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 1, duration: 300,
          easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        const pulse = Animated.loop(Animated.sequence([
          Animated.timing(heroPulse, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(heroPulse, { toValue: 1.0,  duration: 400, useNativeDriver: true }),
          Animated.delay(1200),
        ]));
        pulse.start();
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SCALE = Math.min(W * (phase === 'won' ? 0.36 : 0.34), phase === 'won' ? 340 : 320) / 330;
  const won = phase === 'won';
  // Won with no next level (last level) falls back to "Play Again" instead of a dead end.
  const heroIsRetry = !won || !hasNext;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 500 }]}>
      {/* Backdrop */}
      <Animated.View
        style={[ss.overlayModal, { opacity: backdropFade }]}
      />

      {/* Confetti (win only) */}
      {won && <Confetti W={W} H={H} />}

      {/* Card */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        pointerEvents="box-none">
        <Animated.View style={[ss.modalCard, {
          width: Math.round(330 * SCALE),
          paddingHorizontal: Math.round(26 * SCALE),
          paddingTop: Math.round((won ? 30 : 26) * SCALE),
          paddingBottom: Math.round((won ? 24 : 22) * SCALE),
          borderRadius: Math.round(32 * SCALE),
          opacity: cardFade,
          transform: [{ scale: cardScale }],
        }]}>
          <View style={[
            ss.iconCircle,
            won ? ss.iconCircleAmber : ss.iconCircleRed,
            { width: Math.round(64 * SCALE), height: Math.round(64 * SCALE), borderRadius: Math.round(32 * SCALE), marginBottom: Math.round(14 * SCALE) },
          ]}>
            {won ? <StarIcon size={Math.round(32 * SCALE)} /> : <ClockIcon size={Math.round(32 * SCALE)} />}
          </View>

          <Text style={[ss.modalTitle, { fontSize: Math.round(21 * SCALE), marginBottom: Math.round(6 * SCALE) }]}>
            {won ? 'Level Completed' : "Time's Up"}
          </Text>
          <Text style={[ss.modalBody, {
            fontSize: Math.round(14 * SCALE), lineHeight: Math.round(20 * SCALE),
            marginBottom: Math.round((won ? 18 : 22) * SCALE),
          }]}>
            {won
              ? `All ${pairsTotal} pairs found with ${timeLeft}s left`
              : `You found ${pairsFound} of ${pairsTotal} pairs`}
          </Text>

          {won && (
            <View style={[ss.starRow, { marginBottom: Math.round(22 * SCALE) }]}>
              {[0, 1, 2].map((i) => (
                <StarIcon
                  key={i}
                  size={Math.round((i === 1 ? 46 : 38) * SCALE)}
                  color={i < stars ? STAR_COLOR : '#e6ebe8'}
                />
              ))}
            </View>
          )}

          <View style={ss.btnRow}>
            <TouchableOpacity
              onPress={onHome}
              activeOpacity={0.85}
              style={[ss.secondaryBtn, {
                width: Math.round(104 * SCALE), paddingVertical: Math.round(14 * SCALE), borderRadius: Math.round(16 * SCALE),
              }]}
            >
              <GridIcon size={Math.round(18 * SCALE)} />
              <Text style={[ss.secondaryLabel, { fontSize: Math.round(14 * SCALE), marginLeft: Math.round(7 * SCALE) }]}>Levels</Text>
            </TouchableOpacity>

            <Animated.View style={{ flex: 1, marginLeft: Math.round(10 * SCALE), transform: [{ scale: heroPulse }] }}>
              <TouchableOpacity
                onPress={heroIsRetry ? onRetry : onNext}
                activeOpacity={0.85}
                style={[ss.heroBtn, { paddingVertical: Math.round(18 * SCALE), borderRadius: Math.round(18 * SCALE) }]}
              >
                {heroIsRetry ? <RetryIcon size={Math.round(19 * SCALE)} /> : null}
                <Text style={[ss.heroLabel, { fontSize: Math.round(17 * SCALE), marginHorizontal: Math.round(9 * SCALE) }]}>
                  {!won ? 'Try Again' : hasNext ? 'Play Next Level' : 'Play Again'}
                </Text>
                {!heroIsRetry ? <PlayIcon size={Math.round(18 * SCALE)} /> : null}
              </TouchableOpacity>
            </Animated.View>
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
          <View style={{
            width: size, height: size, borderRadius: corner, overflow: 'hidden',
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            shadowColor: 'rgba(0,0,0,0.14)', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
          }}>
            {imgSrc && (
              <Image source={imgSrc}
                style={{ width: size * 0.65, height: size * 0.65 }} resizeMode="contain" />
            )}
          </View>
        ) : (
          <View style={{
            width: size, height: size, borderRadius: corner, overflow: 'hidden',
            backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
            shadowColor: shade(TEAL), shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
          }}>
            <View style={{ position: 'absolute', width: size * 0.86, height: size * 0.86, borderRadius: size * 0.43, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ position: 'absolute', width: size * 0.58, height: size * 0.58, borderRadius: size * 0.29, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <Text style={{ fontFamily: 'FredokaOne-Regular', fontSize: size * 0.4, color: '#f3e3c8' }}>?</Text>
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
  const hintsLeft      = useHintsStore((s) => s.hintsCount);
  const useHint         = useHintsStore((s) => s.useHint);
  const addHintsFromAd  = useHintsStore((s) => s.addHintsFromAd);
  const addHints        = useHintsStore((s) => s.addHints);

  const { rows, cols } = useMemo(() => gridForLevel(level), [level]);
  const deck  = useMemo(() => buildDeck(rows, cols), [rows, cols]);
  const total = deck.length;

  // ── Layout ─────────────────────────────────────────────────────────────────
  const BTN    = Math.round(H * 0.115);
  const TOP_H  = BTN_X + BTN + BTN_X;
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
  const [showPaywall, setShowPaywall] = useState(false);
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [buyHintsLoading, setBuyHintsLoading] = useState(false);
  const [watchAdLoading, setWatchAdLoading] = useState(false);
  const hintsProduct = iapService.getProduct(HINTS_PRODUCT_ID);
  const hintsPrice   = hintsProduct?.localizedPrice ?? '$0.99';

  // ── Deal animation values ──────────────────────────────────────────────────
  const dealAnims = useRef(
    deck.map(() => ({ scale: new Animated.Value(0), opacity: new Animated.Value(0) })),
  ).current;

  // ── Analytics refs ─────────────────────────────────────────────────────────
  const attemptNumberRef = useRef(0);
  const didCompleteRef   = useRef(false);
  const hintsUsedRef     = useRef(0);

  useEffect(() => {
    attemptNumberRef.current = logLevelStarted({
      game:  'memory',
      world: 'Memory',
      level: `level_${level}`,
    });
    didCompleteRef.current = false;
    hintsUsedRef.current = 0;
    preloadInterstitial();
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

  // ── Win completion (shared by tap-match and hint-match) ──────────────────────
  const completeWin = useCallback((nm: Set<number>) => {
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
      hints_used:      hintsUsedRef.current,
      moves:           nm.size / 2,
    });
  }, [timeLeft, level, markCompleted, setLevelStars]);

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
      if (nm.size === total) completeWin(nm);
    } else {
      setBusy(true);
      setTimeout(() => {
        setFaceUp((prev) => new Set([...prev].filter((x) => x !== firstSel && x !== i)));
        setBusy(false);
      }, 900);
    }
  }, [busy, phase, matched, faceUp, firstSel, deck, total, completeWin]);

  // ── Hint ─────────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (phase !== 'playing' || busy) return;
    if (hintsLeft <= 0) { setShowHintPopup(true); return; }

    const remaining: Record<string, number[]> = {};
    deck.forEach((c, i) => {
      if (matched.has(i)) return;
      (remaining[c.animal] ??= []).push(i);
    });
    const pairIdxs = Object.values(remaining).find((idxs) => idxs.length === 2);
    if (!pairIdxs) return;

    const consumed = useHint();
    if (!consumed) return;
    hintsUsedRef.current++;
    logHintUsed({
      game:        'memory',
      world:       'Memory',
      level:       `level_${level}`,
      hint_number: hintsUsedRef.current,
    });

    soundService.play('memory_correct');
    ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true });
    setFaceUp((prev) => new Set([...prev].filter((x) => x !== firstSel)));
    setFirst(null);
    const nm = new Set([...matched, ...pairIdxs]);
    setMatched(nm);
    if (nm.size === total) completeWin(nm);
  }, [phase, busy, hintsLeft, deck, matched, firstSel, total, useHint, level, completeWin]);

  const handleBuyHints = useCallback(async () => {
    setBuyHintsLoading(true);
    const ok = await iapService.purchaseHints();
    setBuyHintsLoading(false);
    if (ok) { addHints(10); setShowHintPopup(false); }
  }, [addHints]);

  const handleWatchAd = useCallback(async () => {
    setWatchAdLoading(true);
    const earned = await adsService.showRewardedAd();
    setWatchAdLoading(false);
    if (earned) { addHintsFromAd(); setShowHintPopup(false); }
  }, [addHintsFromAd]);

  const goBack = useCallback(async () => {
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
    if (didCompleteRef.current) await maybeShowInterstitial();
    navigation.goBack();
  }, [navigation, level, timeLeft]);

  return (
    <View style={[ss.root, { backgroundColor: GREEN, width: W, height: H }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      {/* HUD — back/hint buttons pinned at BTN_X from the edges, same as SpinnyGamePlayScreen.
          Wrappers use pointerEvents="box-none" so their layout boxes (hudCenter spans the
          full width) never swallow taps meant for the buttons in the other wrappers. */}
      <View pointerEvents="box-none" style={[ss.hudLeft, { left: BTN_X, top: BTN_X }]}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[ss.circleBtn, { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: '#fff' }]}
        >
          <BackIcon size={Math.round(BTN * 0.5)} />
        </TouchableOpacity>
        <Text style={[ss.hudTxt, { fontSize: Math.round(H * 0.048) }]}>
          {matched.size}/{total}
        </Text>
      </View>

      <View pointerEvents="box-none" style={[ss.hudCenter, { top: BTN_X + (BTN - Math.round(H * 0.055)) / 2 }]}>
        <Text style={[ss.hudTxt, { fontSize: Math.round(H * 0.055) }]}>
          Timer : {timeLeft}
        </Text>
      </View>

      <View pointerEvents="box-none" style={[ss.hudRight, { right: BTN_X, top: BTN_X }]}>
        <TouchableOpacity
          onPress={handleHint}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[ss.circleBtn, { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: YELLOW }]}
        >
          <HintIcon size={Math.round(BTN * 0.48)} />
        </TouchableOpacity>
        <View style={[ss.badge, { width: BTN * 0.44, height: BTN * 0.44, borderRadius: BTN * 0.22, top: -BTN * 0.12, right: -BTN * 0.12 }]}>
          <Text style={ss.badgeTxt}>{hintsLeft}</Text>
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
          pairsFound={matched.size / 2}
          pairsTotal={total / 2}
          timeLeft={timeLeft}
          hasNext={level < 29}
          onHome={goBack}
          onRetry={() => {
            logLevelRestarted({ game: 'memory', world: 'Memory', level: `level_${level}` });
            navigation.replace('MemoryGame', { level });
          }}
          onNext={async () => {
            logNextLevelClicked({ game: 'memory', world: 'Memory', level: `level_${level}` });
            await maybeShowInterstitial();
            if (isLevelLockedByPaywall(level)) { setShowPaywall(true); return; }
            navigation.replace('MemoryGame', { level: level + 1 });
          }}
        />
      )}

      {/* Hint popup */}
      {showHintPopup && (
        <View style={ss.hintOverlay}>
          <View style={ss.hintCard}>
            <TouchableOpacity
              onPress={() => setShowHintPopup(false)}
              style={ss.hintClose}
              activeOpacity={0.75}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path fill="none" stroke="#4a5a52" strokeWidth={3.2} strokeLinecap="round" d="M5 5 L19 19 M19 5 L5 19" />
              </Svg>
            </TouchableOpacity>

            <View style={ss.hintIconWrap}>
              <HintIcon size={32} />
            </View>
            <Text style={ss.hintPopupTitle}>Out of Hints</Text>
            <Text style={ss.hintPopupSubtitle}>Get more hints to keep going</Text>

            <View style={ss.hintOptions}>
              <TouchableOpacity
                onPress={handleBuyHints}
                disabled={buyHintsLoading || watchAdLoading}
                activeOpacity={0.85}
                style={[ss.hintOption, { backgroundColor: GREEN, shadowColor: shade(GREEN) }]}
              >
                <View style={ss.hintOptionLeft}>
                  <ShieldCheckIcon size={24} />
                  <Text style={ss.hintOptionText}>Buy 10 Hints</Text>
                </View>
                <View style={ss.hintPriceBadge}>
                  {buyHintsLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={ss.hintPriceText}>{hintsPrice}</Text>}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleWatchAd}
                disabled={buyHintsLoading || watchAdLoading}
                activeOpacity={0.85}
                style={[ss.hintOption, { backgroundColor: PURPLE_BLUE, shadowColor: PURPLE_BLUE_DARK }]}
              >
                <View style={ss.hintOptionLeft}>
                  <AdPlayIcon size={24} />
                  <Text style={ss.hintOptionText}>Watch Ad</Text>
                </View>
                <View style={ss.hintPriceBadge}>
                  {watchAdLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={ss.hintPriceText}>+5</Text>}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FullPackagePaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { overflow: 'hidden' },

  hudLeft:   { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10 },
  hudCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  hudRight:  { position: 'absolute', alignItems: 'center', zIndex: 10 },

  hudTxt: {
    color: '#FFFFFF', fontFamily: 'FredokaOne-Regular',
    textShadowColor: '#3A7A10', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2,
  },
  circleBtn: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 0, elevation: 4,
  },
  badge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: RED, borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 0, elevation: 4,
  },
  badgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Hint popup
  hintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,20,0.55)',
    alignItems: 'center', justifyContent: 'center', zIndex: 400,
  },
  hintCard: {
    width: 306, backgroundColor: '#fff', borderRadius: 28,
    paddingTop: 26, paddingHorizontal: 26, paddingBottom: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 10,
  },
  hintClose: {
    position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: 999,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, elevation: 4,
  },
  hintIconWrap: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  hintPopupTitle: { fontWeight: '800', fontSize: 20, color: '#1f3d2b', marginBottom: 4 },
  hintPopupSubtitle: { fontWeight: '600', fontSize: 14, color: '#4a5a52', marginBottom: 20 },
  hintOptions: { width: '100%', gap: 12 },
  hintOption: {
    height: 58, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  hintOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintOptionText: { fontWeight: '700', fontSize: 16, color: '#fff' },
  hintPriceBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 12, minWidth: 44, alignItems: 'center',
  },
  hintPriceText: { fontWeight: '800', fontSize: 15, color: '#fff' },

  // Finish overlay — flat white modal card, matches MemoryGameScreen.jsx
  overlayModal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,18,36,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff', alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.35)', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 1, shadowRadius: 48, elevation: 12,
  },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  iconCircleRed:   { backgroundColor: '#fde3e6', shadowColor: 'rgba(200,60,80,0.32)',  shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  iconCircleAmber: { backgroundColor: '#fdead9', shadowColor: 'rgba(210,120,40,0.35)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  modalTitle: { textAlign: 'center', fontFamily: 'FredokaOne-Regular', color: INK },
  modalBody:  { textAlign: 'center', fontFamily: 'FredokaOne-Regular', color: MUTED },
  starRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  btnRow: { flexDirection: 'row', alignItems: 'stretch' },
  secondaryBtn: {
    borderWidth: 2, borderColor: '#e3e8ec', backgroundColor: '#ffffff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  secondaryLabel: { fontFamily: 'FredokaOne-Regular', color: '#5b6b78' },
  heroBtn: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#479457', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  heroLabel: { fontFamily: 'FredokaOne-Regular', color: '#ffffff' },
});