/**
 * PatchworkGameScreen.tsx
 * "Right Position" (Patchwork) puzzle — pixel-accurate port of PatchworkGameController.m
 *
 * ─── Screen composition (ObjC configSize) ────────────────────────────────────
 *  imgBg     : full-screen background (same image, dimmed — decorative layer)
 *  imgGame   : height=H, width=H*1.35 (capped at W*0.9), centered; cornerRadius=50, border 1pt white
 *  vwPieceBG : circle, size=H*0.8, CENTER at (W, H) → bottom-right quarter visible
 *              border 5pt white; piece image at 30% of holder size centered at (0.3*size, 0.3*size)
 *  btnBack   : top-left (white circle + chevron)
 *  vwNext    : same size as btnBack, bottom-right, hidden during play → pulsing after win
 *
 * ─── Drag mechanics ───────────────────────────────────────────────────────────
 *  • Dragged copy center follows finger (ObjC: selectedImage.center = touchLocation)
 *  • Snap: piece frame.origin within SNAP_TOL of origFrame.origin
 *  • origFrame = (frameValue/scale + imgGame.originX, .../+originY, w/scale, h/scale)
 *  • Failed: animate back to holder position in 0.1s
 *
 * ─── Coordinate note ──────────────────────────────────────────────────────────
 *  Ghost overlays added to imgGame (relative coords): left=x/scale, top=y/scale
 *  origFrame for snap check in SCREEN coords: x/scale + imgX, y/scale + imgY
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, StyleSheet,
  Animated, PanResponder, useWindowDimensions, Platform,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import type { PatchworkGameScreenProps } from '../../navigation/types';
import { useProgressStore }     from '../../stores/useProgressStore';
import { soundService }         from '../../services/audio/soundService';
import { JigsawSnapEffect }     from '../../components/jigsaw/JigsawSnapEffect';

// ─── Background scene images ───────────────────────────────────────────────
const BG_IMAGES: Record<string, ReturnType<typeof require>> = {
  p1_bg: require('../../assets/images/patchwork_p1_bg.jpg'),
  p2_bg: require('../../assets/images/patchwork_p2_bg.jpg'),
  p3_bg: require('../../assets/images/patchwork_p3_bg.jpg'),
};

// ─── Piece sprite images ───────────────────────────────────────────────────
const PIECE_IMAGES: Record<string, ReturnType<typeof require>> = {
  'g3_11_airplane':        require('../../assets/images/patchwork/g3_11_airplane.png'),
  'g3_11_ball':            require('../../assets/images/patchwork/g3_11_ball.png'),
  'g3_11_car':             require('../../assets/images/patchwork/g3_11_car.png'),
  'g3_11_duck':            require('../../assets/images/patchwork/g3_11_duck.png'),
  'g3_11_motorcycle':      require('../../assets/images/patchwork/g3_11_motorcycle.png'),
  'g3_11_pail-and-shovel': require('../../assets/images/patchwork/g3_11_pail-and-shovel.png'),
  'g3_11_pyramid':         require('../../assets/images/patchwork/g3_11_pyramid.png'),
  'g3_11_robot':           require('../../assets/images/patchwork/g3_11_robot.png'),
  'g3_11_tower':           require('../../assets/images/patchwork/g3_11_tower.png'),
  'g3_11_train':           require('../../assets/images/patchwork/g3_11_train.png'),
  'g3_2_ant':     require('../../assets/images/patchwork/g3_2_ant.png'),
  'g3_2_bee':     require('../../assets/images/patchwork/g3_2_bee.png'),
  'g3_2_fly':     require('../../assets/images/patchwork/g3_2_fly.png'),
  'g3_2_ladybug': require('../../assets/images/patchwork/g3_2_ladybug.png'),
  'g3_2_snail':   require('../../assets/images/patchwork/g3_2_snail.png'),
  'g3_2_spider':  require('../../assets/images/patchwork/g3_2_spider.png'),
  'g3_7_1': require('../../assets/images/patchwork/g3_7_1.png'),
  'g3_7_2': require('../../assets/images/patchwork/g3_7_2.png'),
  'g3_7_3': require('../../assets/images/patchwork/g3_7_3.png'),
  'g3_7_4': require('../../assets/images/patchwork/g3_7_4.png'),
  'g3_7_5': require('../../assets/images/patchwork/g3_7_5.png'),
};

// ─── ObjC constants ────────────────────────────────────────────────────────
const SOURCE_W      = 1950;   // source image width (l11_full_image.jpg)
const PATCHWORK_SCALE = 1.35; // image aspect ratio
const SNAP_TOL      = 26;     // snap tolerance px
const RETURN_MS     = 100;    // failed-snap return duration (ObjC: 0.1s)
const BG_CORNER_R   = 50;     // imgGame cornerRadius (ObjC: 50pt)
const HOLDER_RATIO  = 0.80;   // vwPieceBG = screenH * 0.8 (iPhone)
const BG_COLOR      = '#2C1A3A';

// ─── Types ─────────────────────────────────────────────────────────────────
interface Piece { name: string; frame: [number, number, number, number] }
interface SnapEvt { id: number; cx: number; cy: number; pw: number; ph: number }

// ─── Win confetti — mirrors ObjC createLeft/RightAngleAnimationOnView ──────
const CONFETTI_COLORS = ['#9B59B6','#E74C3C','#3498DB','#F1C40F','#2ECC71','#E67E22','#FF69B4'];

function WinConfetti({ W, H }: { W: number; H: number }) {
  const particles = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => {
      const fromRight = i % 2 === 0;
      const angle = fromRight
        ? Math.PI * (0.5 + Math.random() * 0.6)
        : Math.PI * (-0.1 + Math.random() * 0.6);
      const speed  = 60 + Math.random() * 80;
      return {
        id: i, angle, speed,
        startX: fromRight ? W + 10 : -10,
        startY: H + 10,
        color:  CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        size:   5 + Math.random() * 5,
        delay:  Math.random() * 800,
        dur:    1800 + Math.random() * 1200,
        spin:   (Math.random() - 0.5) * 720,
        anim:   new Animated.Value(0),
      };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  useEffect(() => {
    Animated.stagger(18, particles.map((p) =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: p.dur, useNativeDriver: true }),
      ]),
    )).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {particles.map((p) => (
        <Animated.View key={p.id} pointerEvents="none" style={{
          position: 'absolute', left: p.startX, top: p.startY,
          width: p.size, height: p.size * 0.5,
          backgroundColor: p.color, borderRadius: 1, zIndex: 415,
          opacity: p.anim.interpolate({ inputRange: [0,0.1,0.8,1], outputRange: [0,1,1,0] }),
          transform: [
            { translateX: p.anim.interpolate({ inputRange:[0,1], outputRange:[0, Math.cos(p.angle)*p.speed] }) },
            { translateY: p.anim.interpolate({ inputRange:[0,1], outputRange:[0, -Math.sin(p.angle)*p.speed - p.speed*0.5] }) },
            { rotate:     p.anim.interpolate({ inputRange:[0,1], outputRange:['0deg', `${p.spin}deg`] }) },
          ],
        }} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PatchworkGameScreen({ navigation, route }: PatchworkGameScreenProps): React.JSX.Element {
  const { level } = route.params;
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  // ── Stores ────────────────────────────────────────────────────────────────
  const { markCompleted, setLastPlayedLevel, setLevelStars } = useProgressStore();
  useEffect(() => {
    setLastPlayedLevel(level.packageName, level.name);
  }, [level.packageName, level.name, setLastPlayedLevel]);

  // ── Parse pieces ──────────────────────────────────────────────────────────
  const allPieces: Piece[] = useMemo(() => {
    try { return JSON.parse(level.descrip ?? '[]') as Piece[]; }
    catch { return []; }
  }, [level.descrip]);

  // ── imgGame sizing (ObjC: height=H, width=H*1.35, max W*0.9, centered) ───
  const imgH = H;
  const imgW = Math.min(imgH * PATCHWORK_SCALE, W * 0.9);
  const imgX = (W - imgW) / 2;
  const imgY = (H - imgH) / 2;   // centered vertically (ObjC: imgGame.center = view.center)
  const displayScale = SOURCE_W / imgW;

  // ── vwPieceBG sizing (ObjC: size=H*0.8, CENTER at (W,H)) ─────────────────
  const holderSize = Math.round(H * HOLDER_RATIO);
  // ObjC: vwPieceBG.center = CGPointMake(screenWidth, screenHeight)
  // → left = W - holderSize/2, top = H - holderSize/2
  const holderLeft = W - holderSize / 2;
  const holderTop  = H - holderSize / 2;

  // ── Piece display size in holder (ObjC: 30% of holder size) ──────────────
  const getPieceSize = useCallback((piece: Piece) => {
    const [,, sw, sh] = piece.frame;
    const ratio = sw / sh;
    if (sw >= sh) {
      const w = holderSize * 0.30;
      return { w, h: w / ratio };
    } else {
      const h = holderSize * 0.30;
      return { w: h * ratio, h };
    }
  }, [holderSize]);

  // ── Target frame on screen (ObjC: numX/scale + imgGame.origin.x) ─────────
  const getTargetFrame = useCallback((piece: Piece) => {
    const [sx, sy, sw, sh] = piece.frame;
    return {
      x: imgX + sx / displayScale,
      y: imgY + sy / displayScale,
      w: sw / displayScale,
      h: sh / displayScale,
    };
  }, [imgX, imgY, displayScale]);

  // ── Game state ────────────────────────────────────────────────────────────
  const [remaining,  setRemaining]  = useState<Piece[]>(allPieces);
  const [placed,     setPlaced]     = useState<string[]>([]);
  const [solved,     setSolved]     = useState(false);
  const [winStars,   setWinStars]   = useState(1);
  const [elapsedS,   setElapsedS]   = useState(0);
  const [timerOn,    setTimerOn]    = useState(true);
  const [snapEvents, setSnapEvents] = useState<SnapEvt[]>([]);
  const snapIdRef = useRef(0);

  // Timer
  useEffect(() => {
    if (!timerOn || solved) return;
    const id = setInterval(() => setElapsedS((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerOn, solved]);

  // ── Win animations ────────────────────────────────────────────────────────
  const overlayFade = useRef(new Animated.Value(0)).current;
  // translateY for text: starts at -500 (above screen), bounces to 0 (at rest).
  // The text has a STATIC top = H/2-30 (final center position), so this is safe
  // with useNativeDriver: true (transform only, no layout props animated).
  const textY = useRef(new Animated.Value(-500)).current;
  const nextFade    = useRef(new Animated.Value(0)).current;
  const nextScale   = useRef(new Animated.Value(0.8)).current;
  const pulseLoop   = useRef<Animated.CompositeAnimation | null>(null);

  const startWinAnimations = useCallback((_screenH: number) => {
    // textY is translateY offset from the text's static top (H/2-30).
    // -500 = off-screen above. 0 = final resting position. Bounce ±30/±20.
    Animated.timing(overlayFade, { toValue: 0.80, duration: 600, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(textY, { toValue:   0, duration: 600, useNativeDriver: true }),
      Animated.timing(textY, { toValue: -30, duration: 100, useNativeDriver: true }),
      Animated.timing(textY, { toValue:   0, duration: 100, useNativeDriver: true }),
      Animated.timing(textY, { toValue: -20, duration: 100, useNativeDriver: true }),
      Animated.timing(textY, { toValue:   0, duration: 100, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.timing(nextFade, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(nextScale, { toValue: 1.1, duration: 333, useNativeDriver: true }),
          Animated.timing(nextScale, { toValue: 0.9, duration: 333, useNativeDriver: true }),
          Animated.timing(nextScale, { toValue: 1.1, duration: 333, useNativeDriver: true }),
          Animated.timing(nextScale, { toValue: 0.9, duration: 333, useNativeDriver: true }),
          Animated.timing(nextScale, { toValue: 1.0, duration: 333, useNativeDriver: true }),
          Animated.delay(1500),
        ]));
        pulseLoop.current = loop;
        loop.start();
      });
    }, 300);
  }, [overlayFade, textY, nextFade, nextScale]);

  // ── Holder slide-in animation (ObjC: 0.5s delay → 0.3s slide to center W,H) ──
  // Uses transform/opacity (native driver) on a View with static position (holderLeft, holderTop)
  const offTX = W;   // starts fully off-screen right (ObjC initial: frameX = screenWidth)
  const offTY = H;   // starts fully off-screen bottom
  const holderTX   = useRef(new Animated.Value(offTX)).current;
  const holderTY   = useRef(new Animated.Value(offTY)).current;
  const holderFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    soundService.playMusic('game_music');
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(holderTX,   { toValue: 0,    duration: 300, useNativeDriver: true }),
        Animated.timing(holderTY,   { toValue: 0,    duration: 300, useNativeDriver: true }),
        Animated.timing(holderFade, { toValue: 1,    duration: 300, useNativeDriver: true }),
      ]).start();
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snap piece ────────────────────────────────────────────────────────────
  const snapPiece = useCallback((piece: Piece) => {
    const tf = getTargetFrame(piece);
    soundService.play('ring_snap');
    ReactNativeHapticFeedback.trigger('impactMedium', { enableVibrateFallback: true });
    const id = ++snapIdRef.current;
    setSnapEvents((prev) => [...prev, { id, cx: tf.x + tf.w/2, cy: tf.y + tf.h/2, pw: tf.w, ph: tf.h }]);
    setTimeout(() => setSnapEvents((prev) => prev.filter((e) => e.id !== id)), 1000);
    setPlaced((prev) => [...prev, piece.name]);
    setRemaining((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setTimerOn(false);
        setSolved(true);
        const stars = elapsedS < 30 ? 3 : elapsedS < 90 ? 2 : 1;
        setWinStars(stars);
        setLevelStars(level.packageName, level.name, stars);
        void markCompleted(level.packageName, level.name);
        soundService.play('correct');
        Animated.parallel([
          Animated.timing(holderTX,   { toValue: offTX, duration: 300, useNativeDriver: true }),
          Animated.timing(holderTY,   { toValue: offTY, duration: 300, useNativeDriver: true }),
          Animated.timing(holderFade, { toValue: 0,     duration: 300, useNativeDriver: true }),
        ]).start(() => startWinAnimations(H));
      }
      return next;
    });
  }, [getTargetFrame, elapsedS, level, markCompleted, setLevelStars, holderTX, holderTY, holderFade, offTX, offTY, startWinAnimations, H]);

  // ── Stable refs for PanResponder (avoids stale closures) ─────────────────
  const currentPieceRef   = useRef<Piece | undefined>(undefined);
  const snapPieceRef      = useRef<(p: Piece) => void>(() => {});
  const getTargetFrameRef = useRef(getTargetFrame);
  currentPieceRef.current   = remaining[0];
  snapPieceRef.current      = snapPiece;
  getTargetFrameRef.current = getTargetFrame;

  // ── Drag ──────────────────────────────────────────────────────────────────
  const dragPos     = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragOpacity = useRef(new Animated.Value(0)).current;
  const isDragging  = useRef(false);
  const dragActive  = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !isDragging.current,
    onMoveShouldSetPanResponder:  () => !isDragging.current,

    onPanResponderGrant: (evt) => {
      const piece = currentPieceRef.current;
      if (!piece || isDragging.current) return;
      isDragging.current = true;
      dragActive.current = true;
      const { pageX, pageY } = evt.nativeEvent;
      dragPos.setValue({ x: pageX, y: pageY });
      dragOpacity.setValue(1);
      soundService.play('button_click');
    },
    onPanResponderMove: (evt) => {
      if (!dragActive.current || !currentPieceRef.current) return;
      const { pageX, pageY } = evt.nativeEvent;
      dragPos.setValue({ x: pageX, y: pageY });
    },
    onPanResponderRelease: (evt) => {
      const piece = currentPieceRef.current;
      if (!dragActive.current || !piece) return;
      dragActive.current = false;
      isDragging.current = false;
      const { pageX, pageY } = evt.nativeEvent;
      const tf = getTargetFrameRef.current(piece);
      const ox = pageX - tf.w / 2, oy = pageY - tf.h / 2;
      const snapped = Math.abs(ox - tf.x) < SNAP_TOL && Math.abs(oy - tf.y) < SNAP_TOL;
      if (snapped) {
        dragOpacity.setValue(0);
        snapPieceRef.current(piece);
      } else {
        // Return to piece position in holder (ObjC: 0.1s)
        // Piece center in holder = (holderLeft + holderSize*0.3, holderTop + holderSize*0.3)
        Animated.timing(dragPos, {
          toValue: { x: holderLeft + holderSize * 0.3, y: holderTop + holderSize * 0.3 },
          duration: RETURN_MS, useNativeDriver: false,
        }).start(() => { dragOpacity.setValue(0); });
      }
    },
    onPanResponderTerminate: () => {
      dragActive.current = false;
      isDragging.current = false;
      dragOpacity.setValue(0);
    },
  })).current;

  // ── Navigation / goBack ───────────────────────────────────────────────────
  const goBack = useCallback(() => {
    pulseLoop.current?.stop();
    soundService.play('button_click');
    soundService.play('transition_out');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation]);

  const BTN_SZ = Math.round(H * 0.135); // ObjC: screenHeight * BACK_SCALE (0.15)
  const currentPiece = remaining[0];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { width: W, height: H, backgroundColor: BG_COLOR }]}>

      {/* imgBg — full-screen dimmed background layer (ObjC: imgBg.frame = view.frame) */}
      {(() => {
        const bgKey = level.layerImgPath ?? level.imgPath ?? 'p1_bg';
        const bgSrc = BG_IMAGES[bgKey] ?? BG_IMAGES['p1_bg']!;
        return (
          <Image
            source={bgSrc}
            style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
            resizeMode="cover"
          />
        );
      })()}

      {/* imgGame — centered scene image with rounded corners + white border ─ */}
      <View style={[ss.imgGame, {
        left: imgX, top: imgY, width: imgW, height: imgH,
        borderRadius: BG_CORNER_R,
      }]}>
        {(() => {
          const bgKey = level.layerImgPath ?? level.imgPath ?? 'p1_bg';
          const bgSrc = BG_IMAGES[bgKey] ?? BG_IMAGES['p1_bg']!;
          return (
            <Image source={bgSrc} style={{ width: imgW, height: imgH }} resizeMode="cover" />
          );
        })()}

        {/* Ghost overlays — white-tinted piece sprites at target positions
            Added to imgGame (relative coords): left = sx/scale, top = sy/scale  */}
        {allPieces.map((piece) => {
          if (placed.includes(piece.name)) return null;
          const [sx, sy, sw, sh] = piece.frame;
          const pLeft = sx / displayScale;
          const pTop  = sy / displayScale;
          const pW    = sw / displayScale;
          const pH    = sh / displayScale;
          const src   = PIECE_IMAGES[piece.name];
          if (!src) return null;
          return (
            <Image
              key={`ghost_${piece.name}`}
              source={src}
              tintColor="rgba(255,255,255,0.55)"
              style={{ position: 'absolute', left: pLeft, top: pTop, width: pW, height: pH }}
              resizeMode="contain"
            />
          );
        })}

        {/* Placed pieces — full opacity at their target positions */}
        {allPieces.filter((p) => placed.includes(p.name)).map((piece) => {
          const [sx, sy, sw, sh] = piece.frame;
          const src = PIECE_IMAGES[piece.name];
          if (!src) return null;
          return (
            <Image
              key={`placed_${piece.name}`}
              source={src}
              style={{
                position: 'absolute',
                left:     sx / displayScale,
                top:      sy / displayScale,
                width:    sw / displayScale,
                height:   sh / displayScale,
              }}
              resizeMode="contain"
            />
          );
        })}
      </View>

      {/* Snap star effects */}
      {snapEvents.map((evt) => (
        <JigsawSnapEffect key={evt.id} centerX={evt.cx} centerY={evt.cy} pieceW={evt.pw} pieceH={evt.ph} />
      ))}

      {/* vwPieceBG — circular holder, center=(W,H), half off-screen ──────────
          ObjC: center = CGPointMake(screenWidth, screenHeight) → left = W-size/2 */}
      {!solved && currentPiece && (
        <Animated.View
          style={[ss.holder, {
            left:         holderLeft,
            top:          holderTop,
            width:        holderSize,
            height:       holderSize,
            borderRadius: holderSize / 2,
            opacity:      holderFade,
            transform:    [{ translateX: holderTX }, { translateY: holderTY }],
          }]}
          {...panResponder.panHandlers}
        >
          {/* Current piece — 30% of holder size, centered at (0.3*size, 0.3*size) */}
          {(() => {
            const { w, h } = getPieceSize(currentPiece);
            const src = PIECE_IMAGES[currentPiece.name];
            if (!src) return null;
            // ObjC: imgPiece.center = CGPointMake(vwPieceBG.frameWidth*0.3, vwPieceBG.frameWidth*0.3)
            const cx = holderSize * 0.30;
            const cy = holderSize * 0.30;
            return (
              <Image
                source={src}
                style={{
                  position: 'absolute',
                  left:     cx - w / 2,
                  top:      cy - h / 2,
                  width:    w,
                  height:   h,
                }}
                resizeMode="contain"
              />
            );
          })()}

          {/* Remaining count badge */}
          <View style={ss.badge}>
            <Animated.Text style={[ss.badgeText, { opacity: holderFade }]}>
              {remaining.length}
            </Animated.Text>
          </View>
        </Animated.View>
      )}

      {/* Dragging piece copy — center follows finger */}
      {currentPiece && (() => {
        const tf  = getTargetFrame(currentPiece);
        const src = PIECE_IMAGES[currentPiece.name];
        if (!src) return null;
        return (
          <Animated.View pointerEvents="none" style={{
            position:   'absolute',
            left:        dragPos.x,
            top:         dragPos.y,
            width:       tf.w,
            height:      tf.h,
            marginLeft: -(tf.w / 2),
            marginTop:  -(tf.h / 2),
            opacity:     dragOpacity,
            zIndex:      300,
          }}>
            <Image source={src} style={{ width: tf.w, height: tf.h }} resizeMode="contain" />
          </Animated.View>
        );
      })()}

      {/* btnBack — top-left (ObjC: always visible) */}
      <View style={[ss.topBar, { zIndex: 200 }]}>
        <TouchableOpacity
          style={[ss.backBtn, { width: BTN_SZ, height: BTN_SZ, borderRadius: BTN_SZ / 2 }]}
          onPress={goBack}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../../assets/images/jigsawBack.png')}
            style={{ width: BTN_SZ * 0.55, height: BTN_SZ * 0.55 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* ── Win overlay (finishGame) ───────────────────────────────────────────
           ObjC: imgWinBlur fades in → createCompleteLevel (text drop+bounce)
                 → startNextButtonAnimation (pulse loop) → fireworks           */}
      {solved && (
        <>
          {/* ── Step 1: Dark blur overlay (ObjC: imgWinBlur alpha 0→1 in 0.6s) ── */}
          <Animated.View pointerEvents="box-none" style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.72)', opacity: overlayFade, zIndex: 400 },
          ]} />

          {/* ── Step 2: Left + right angle confetti emitters ──────────────────── */}
          <WinConfetti W={W} H={H} />

          {/* ── Step 3: "LEVEL COMPLETED!" — FredokaOne, white outlined stroke ───
               ObjC: NSStrokeColorWhite + NSForegroundColorClear = hollow outline text.
               In RN we approximate with white text + strong dark multi-shadow halo.  */}
          <Animated.View style={{
            position: 'absolute',
            left: 0, right: 0,
            top:  H / 2 - Math.round(H * 0.11),   // static final position
            zIndex: 420,
            alignItems: 'center',
            transform: [{ translateY: textY }],     // native driver: moves from -500→0
          }}>
            {/* Outer glow layer — gives the "outline" look */}
            <Text style={[ss.winTextGlow, { fontSize: Math.round(H * 0.09) }]}>
              LEVEL COMPLETED!
            </Text>
            {/* Inner solid layer */}
            <Text style={[ss.winTextSolid, { fontSize: Math.round(H * 0.09) }]} numberOfLines={1}>
              LEVEL COMPLETED!
            </Text>
          </Animated.View>

          {/* ── Stars earned — shown below the text ──────────────────────────── */}
          <Animated.View style={{
            position: 'absolute',
            left: 0, right: 0,
            top:  H / 2 + Math.round(H * 0.045),
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            zIndex: 421,
            transform: [{ translateY: textY }],
          }}>
            {[0, 1, 2].map((i) => (
              <Image key={i}
                source={i < winStars
                  ? require('../../assets/images/star_filled.png')
                  : require('../../assets/images/star_empty.png')}
                style={{ width: Math.round(H * 0.1), height: Math.round(H * 0.1) }}
                resizeMode="contain"
              />
            ))}
          </Animated.View>

          {/* ── vwNext / imgNext — pulsing Next button + Home button ──────────────
               ObjC: single pulsing green button at bottom-right.
               RN: adds Home button for better UX.                               */}
          <Animated.View style={{
            position:        'absolute',
            bottom:           Math.round(H * 0.06),
            left:             0, right: 0,
            flexDirection:   'row',
            justifyContent:  'center',
            gap:              Math.round(W * 0.04),
            zIndex:           430,
            opacity:          nextFade,
          }}>
            {/* Home button */}
            <TouchableOpacity
              onPress={() => { pulseLoop.current?.stop(); soundService.play('button_click'); goBack(); }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/icHomeWithShadow.png')}
                style={{ width: BTN_SZ, height: BTN_SZ }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Next/Play button — pulsing (ObjC: startNextButtonAnimation) */}
            <Animated.View style={{ transform: [{ scale: nextScale }] }}>
              <TouchableOpacity
                onPress={() => { pulseLoop.current?.stop(); soundService.play('button_click'); goBack(); }}
                activeOpacity={0.85}
              >
                <Image
                  source={require('../../assets/images/icPlayWithShadow.png')}
                  style={{ width: BTN_SZ * 1.25, height: BTN_SZ * 1.25 }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Levels button */}
            <TouchableOpacity
              onPress={() => { pulseLoop.current?.stop(); soundService.play('button_click'); goBack(); }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/icLevelsWithShadow.png')}
                style={{ width: BTN_SZ, height: BTN_SZ }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { overflow: 'hidden' },

  // imgGame: centered, rounded corners, 1pt white border
  imgGame: {
    position:    'absolute',
    overflow:    'hidden',
    borderWidth:  1,
    borderColor: '#FFFFFF',
  },

  topBar: {
    position: 'absolute',
    top:      Platform.OS === 'ios' ? 12 : 8,
    left:     Platform.OS === 'ios' ? 14 : 10,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.25,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },

  // vwPieceBG: white circle, 5pt border
  holder: {
    position:        'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth:     5,
    borderColor:     '#FFFFFF',
    shadowColor:     '#000',
    shadowOpacity:   0.35,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 5 },
    elevation:       10,
    overflow:        'visible',
  },

  badge: {
    position:        'absolute',
    bottom:          10,
    right:           10,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#5DDAC9',
    alignItems:      'center',
    justifyContent:  'center',
  },
  badgeText: { color: '#FFF', fontFamily: 'FredokaOne-Regular', fontSize: 13 },

  // Win screen
  winText: {
    position:         'absolute',
    left:              0,
    right:             0,
    textAlign:        'center',
    color:            '#FFFFFF',
    fontFamily:       'FredokaOne-Regular',
    textShadowColor:  '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius:  4,
  },
});
