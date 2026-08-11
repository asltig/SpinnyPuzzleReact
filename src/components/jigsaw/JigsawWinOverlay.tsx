/**
 * JigsawWinOverlay.tsx
 * Full win sequence matching ObjC JigsawGameController.finishGame:
 *
 * ─── Animation timeline ────────────────────────────────────────────────────────
 *  t=0.0 s  Board image zooms from puzzle area → full screen (0.9 s ease-in-out)
 *           Board border fades out
 *  t=0.9 s  White semi-transparent overlay fades in on the image (0.5 s)
 *           Confetti particles begin falling
 *  t=1.4 s  Popup card scales in 0.1 → 1.0 (0.3 s ease-in-out)
 *           Play button starts pulsing (1→1.4→0.9→1.2→0.9→1, loops)
 *
 * ─── Popup layout ─────────────────────────────────────────────────────────────
 *  alertBase.png  — card frame (blue header + white body)
 *  Stars          — 1-3 gold stars overhanging the top edge
 *  "Well Done!"   — purple bold text in header
 *  "Level Completed!" — gold bold text in body
 *  3 buttons      — icHomeWithShadow / icPlayWithShadow (pulse) / icLevelsWithShadow
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

// ─── Jigsaw image sources ─────────────────────────────────────────────────────
const JIGSAW_SOURCES: Record<string, ReturnType<typeof require>> = {
  j1: require('../../assets/images/jigsaw/j1.jpg'),
  j2: require('../../assets/images/jigsaw/j2.jpg'),
  j3: require('../../assets/images/jigsaw/j3.jpg'),
  j4: require('../../assets/images/jigsaw/j4.jpg'),
  j5: require('../../assets/images/jigsaw/j5.jpg'),
  j6: require('../../assets/images/jigsaw/j6.jpg'),
  j7: require('../../assets/images/jigsaw/j7.jpg'),
  j8: require('../../assets/images/jigsaw/j8.jpg'),
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#9B59B6', '#E74C3C', '#3498DB', '#F1C40F',
  '#2ECC71', '#E67E22', '#FF69B4', '#00BCD4',
];

interface ConfettiPiece {
  id:    number;
  x:     number;
  color: string;
  size:  number;
  delay: number;
  dur:   number;
  tilt:  number;
  anim:  Animated.Value;
}

function Confetti({ W, H }: { W: number; H: number }) {
  const pieces = useMemo<ConfettiPiece[]>(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id:    i,
      x:     Math.random() * W,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      size:  6 + Math.random() * 8,
      delay: Math.random() * 1200,
      dur:   2500 + Math.random() * 2000,
      tilt:  (Math.random() - 0.5) * 360,
      anim:  new Animated.Value(0),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  useEffect(() => {
    const animations = pieces.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: p.dur, useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 0,     useNativeDriver: true }),
        ]),
      ),
    );
    Animated.parallel(animations).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {pieces.map((p) => (
        <Animated.View
          key={p.id}
          pointerEvents="none"
          style={{
            position:        'absolute',
            left:            p.x,
            top:             0,           // static — native driver can't animate layout props
            width:           p.size,
            height:          p.size * 0.5,
            backgroundColor: p.color,
            borderRadius:    1,
            opacity:         p.anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              // translateY replaces animated top — transform IS supported by native driver
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, H + 20] }) },
              { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.tilt}deg`] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface JigsawWinOverlayProps {
  visible:     boolean;
  imageName:   string;
  stars:       number;          // 1–3
  boardX:      number;
  boardY:      number;
  boardW:      number;
  boardH:      number;
  screenW:     number;
  screenH:     number;
  onHome:      () => void;
  onNext:      () => void;
  onLevels:    () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function JigsawWinOverlay({
  visible, imageName, stars,
  boardX, boardY, boardW, boardH,
  screenW, screenH,
  onHome, onNext, onLevels,
}: JigsawWinOverlayProps): React.JSX.Element | null {
  const [phase, setPhase] = useState<'idle'|'zoom'|'white'|'popup'>('idle');

  // ── Layout animated values ─────────────────────────────────────────────────
  const imgLeft   = useRef(new Animated.Value(boardX)).current;
  const imgTop    = useRef(new Animated.Value(boardY)).current;
  const imgWidth  = useRef(new Animated.Value(boardW)).current;
  const imgHeight = useRef(new Animated.Value(boardH)).current;
  const whiteFade = useRef(new Animated.Value(0)).current;
  const popScale  = useRef(new Animated.Value(0.1)).current;
  const popFade   = useRef(new Animated.Value(0)).current;

  // Play-button pulse (loops indefinitely once popup shows)
  const playPulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation>();

  const startPulse = useCallback(() => {
    pulseLoop.current?.stop();
    const seq = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, { toValue: 1.4, duration: 267, useNativeDriver: true }),
        Animated.timing(playPulse, { toValue: 0.9, duration: 267, useNativeDriver: true }),
        Animated.timing(playPulse, { toValue: 1.2, duration: 267, useNativeDriver: true }),
        Animated.timing(playPulse, { toValue: 0.9, duration: 267, useNativeDriver: true }),
        Animated.timing(playPulse, { toValue: 1.0, duration: 267, useNativeDriver: true }),
        Animated.delay(1500),
      ]),
    );
    pulseLoop.current = seq;
    seq.start();
  }, [playPulse]);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      imgLeft.setValue(boardX);
      imgTop.setValue(boardY);
      imgWidth.setValue(boardW);
      imgHeight.setValue(boardH);
      whiteFade.setValue(0);
      popScale.setValue(0.1);
      popFade.setValue(0);
      pulseLoop.current?.stop();
      return;
    }

    // ── Phase 1: Board zooms to full screen (0.9 s) ────────────────────────
    setPhase('zoom');
    Animated.parallel([
      Animated.timing(imgLeft,   { toValue: 0,        duration: 900, easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: false }),
      Animated.timing(imgTop,    { toValue: 0,        duration: 900, easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: false }),
      Animated.timing(imgWidth,  { toValue: screenW,  duration: 900, easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: false }),
      Animated.timing(imgHeight, { toValue: screenH,  duration: 900, easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: false }),
    ]).start(() => {
      // ── Phase 2: White overlay + confetti appear (0.5 s) ────────────────
      setPhase('white');
      Animated.timing(whiteFade, { toValue: 0.55, duration: 500, useNativeDriver: true }).start(() => {
        // ── Phase 3: Popup scales in (0.3 s) ────────────────────────────
        setPhase('popup');
        Animated.parallel([
          Animated.timing(popScale, { toValue: 1, duration: 300, easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: true }),
          Animated.timing(popFade,  { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start(() => startPulse());
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible && phase === 'idle') return null;

  const imgSrc = JIGSAW_SOURCES[imageName] ?? JIGSAW_SOURCES['j1']!;

  // Popup sizing — alertBase.png is 1224×900 (exact aspect 900/1224).
  // Cap at 360 so the card always fits even when the device is in portrait
  // (min iPhone portrait width is 375px on SE; 360 < 375 with room to center).
  const popW    = Math.round(Math.min(screenW * 0.55, 360));
  const popH    = Math.round(popW * (900 / 1224));
  const btnSz   = Math.round(popH * 0.28);
  const starSz  = Math.round(popW * 0.20);
  // Blue header occupies the top ~27% of the alertBase card image
  const headerH = Math.round(popH * 0.27);

  return (
    <>
      {/* ── Zooming puzzle image ───────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left:     imgLeft,
          top:      imgTop,
          width:    imgWidth,
          height:   imgHeight,
          overflow: 'hidden',
        }}
      >
        <Image source={imgSrc} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Animated.View>

      {/* ── White semi-transparent overlay (ObjC: vwWhite alpha 0→0.2/0.55) */}
      {(phase === 'white' || phase === 'popup') && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', opacity: whiteFade }]}
        />
      )}

      {/* ── Confetti ──────────────────────────────────────────────────────── */}
      {(phase === 'white' || phase === 'popup') && (
        <Confetti W={screenW} H={screenH} />
      )}

      {/* ── Win popup ─────────────────────────────────────────────────────── */}
      {phase === 'popup' && (
        <View style={[StyleSheet.absoluteFill, ss.popupWrapper]} pointerEvents="box-none">
          <Animated.View
            style={[
              ss.popup,
              { width: popW, height: popH },
              { opacity: popFade, transform: [{ scale: popScale }] },
            ]}
          >
            {/* alertBase.png card background */}
            <Image
              source={require('../../assets/images/alertBase.png')}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="stretch"
            />

            {/* Stars — centered on the card's top edge (half above, half below) */}
            <View style={[ss.starsRow, { top: -(starSz * 0.5) }]}>
              {[0, 1, 2].map((i) => (
                <Image
                  key={i}
                  source={i < stars
                    ? require('../../assets/images/star_filled.png')
                    : require('../../assets/images/star_empty.png')}
                  style={{ width: starSz, height: starSz, marginHorizontal: 2 }}
                  resizeMode="contain"
                />
              ))}
            </View>

            {/* Blue header zone — "Well Done!" below the star overhang */}
            <View style={[ss.header, { height: headerH, paddingTop: Math.round(starSz * 0.5) }]}>
              <Text style={[ss.wellDone, { fontSize: Math.round(popH * 0.13) }]}>
                Well Done!
              </Text>
            </View>

            {/* White body zone — "Level Completed!" + action buttons */}
            <View style={[ss.body, { paddingBottom: Math.round(popH * 0.04) }]}>
              {/* "Level Completed!" with candy decorations on each side */}
              <View style={ss.levelRow}>
                <Image
                  source={require('../../assets/images/icCandyLeft.png')}
                  style={{ width: Math.round(popH * 0.24), height: Math.round(popH * 0.24) }}
                  resizeMode="contain"
                />
                <Text style={[ss.levelCompleted, {
                  fontSize: Math.round(popH * 0.10),
                  lineHeight: Math.round(popH * 0.115),
                }]}>
                  Level{'\n'}Completed!
                </Text>
                <Image
                  source={require('../../assets/images/icCandyRight.png')}
                  style={{ width: Math.round(popH * 0.24), height: Math.round(popH * 0.24) }}
                  resizeMode="contain"
                />
              </View>

              <View style={ss.btnRow}>
                {/* Home */}
                <TouchableOpacity onPress={onHome} activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Image
                    source={require('../../assets/images/icHomeWithShadow.png')}
                    style={{ width: btnSz, height: btnSz }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                {/* Play / Next — pulsing */}
                <Animated.View style={{ transform: [{ scale: playPulse }] }}>
                  <TouchableOpacity onPress={onNext} activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Image
                      source={require('../../assets/images/icPlayWithShadow.png')}
                      style={{ width: Math.round(btnSz * 1.15), height: Math.round(btnSz * 1.15) }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </Animated.View>

                {/* Levels */}
                <TouchableOpacity onPress={onLevels} activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Image
                    source={require('../../assets/images/icLevelsWithShadow.png')}
                    style={{ width: btnSz, height: btnSz }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
const ss = StyleSheet.create({
  popupWrapper: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  popup: {
    position:       'relative',
    overflow:       'visible',
    flexDirection:  'column',
  },

  starsRow: {
    position:       'absolute',
    left:            0,
    right:           0,
    flexDirection:  'row',
    justifyContent: 'center',
    zIndex:          10,
  },

  // Blue header zone — flex row to center "Well Done!" vertically below star overhang
  header: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  wellDone: {
    textAlign:        'center',
    fontFamily:       'FredokaOne-Regular',
    color:            '#6A1FA0',   // deep violet matching original header text
    textShadowColor:  'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  4,
  },

  // White body zone — flex column, space distributed evenly
  body: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'space-evenly',
  },

  levelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             8,
  },

  levelCompleted: {
    textAlign:        'center',
    fontFamily:       'FredokaOne-Regular',
    color:            '#C85A00',   // warm amber-orange matching original body text
    textShadowColor:  'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  2,
  },

  btnRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:             14,
  },
});