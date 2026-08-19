import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

// TODO: replace with your real asset requires, e.g. require('./assets/ring-outer-ant.png')
const RING_OUTER_ART = null;
const RING_INNER_ART = null;
const REVEAL_ART = null;

const GREEN = '#5cba6f';
const YELLOW = 'rgb(224,197,110)'; // oklch(0.82 0.14 90) approximation
const RED = '#e3435a'; // oklch(0.62 0.22 15) approximation
const PURPLE = '#9a5cc9'; // oklch(0.62 0.14 300) approximation
const TEAL = '#5cc2df';
const MUTED_GREY = '#b9c4c9';
const PURPLE_BLUE = 'rgb(103,110,224)'; // oklch(0.68 0.19 265) approximation
const PURPLE_BLUE_DARK = 'rgb(74,80,181)'; // oklch(0.55 0.19 265) approximation

function BackIcon({ size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function HintIcon({ size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M9,21c0,0.55,0.45,1,1,1h4c0.55,0,1-0.45,1-1v-1H9V21z M12,2C8.14,2,5,5.14,5,9c0,2.38,1.19,4.47,3,5.74V17 c0,0.55,0.45,1,1,1h6c0.55,0,1-0.45,1-1v-2.26c1.81-1.27,3-3.36,3-5.74C19,5.14,15.86,2,12,2z"
      />
    </Svg>
  );
}

function GridIcon({ size = 34 }) {
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c })));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {cells.map(({ r, c }) => (
        <Path key={`${r}-${c}`} fill="#fff" d={`M${3 + c * 6.5} ${3 + r * 6.5} h6 v6 h-6 z`} />
      ))}
    </Svg>
  );
}

function SoundIcon({ size = 34, muted = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M3,9v6h4l5,5V4L7,9H3z M16.5,12c0,-1.77,-1.02,-3.29,-2.5,-4.03v8.05C15.48,15.29,16.5,13.77,16.5,12z M14,3.23v2.06c2.89,0.86,5,3.54,5,6.71s-2.11,5.85,-5,6.71v2.06c4.01,-0.91,7,-4.49,7,-8.77S18.01,4.14,14,3.23z"
      />
      {muted ? <Line x1="2" y1="22" x2="22" y2="2" stroke="#fff" strokeWidth="2.5" /> : null}
    </Svg>
  );
}

function PlayIcon({ size = 30 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

function ShieldCheckIcon({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3c-1.8 2-4 3.4-7 3.8V12c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6.8c-3-.4-5.2-1.8-7-3.8z" fill="#fff" fillOpacity={0.95} />
      <Path d="M9.3 12.2l1.9 1.9 3.6-3.9" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function AdPlayIcon({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.5 6h15v12h-15z" fill="#fff" />
      <Path d="M17.5 10.2l3.6-2.4a.6.6 0 0 1 .9.5v7.4a.6.6 0 0 1-.9.5l-3.6-2.4z" fill="#fff" />
      <Path d="M8.3 9.5l4.4 2.5-4.4 2.5z" fill={PURPLE_BLUE} />
    </Svg>
  );
}

const OUTER_SIZE = 440;
const INNER_SIZE = 237;

const CONFETTI = [
  { left: 60, color: '#f4d35e', size: 12, delay: 0 },
  { left: 140, color: GREEN, size: 10, delay: 150 },
  { left: 380, color: '#e3435a', size: 12, delay: 300 },
  { left: 440, color: '#9a5cc9', size: 9, delay: 60 },
  { left: 260, color: '#5cc2df', size: 10, delay: 220 },
];

function Confetti({ active }) {
  const anims = useRef(CONFETTI.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return;
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(CONFETTI[i].delay),
          Animated.timing(v, { toValue: 1, duration: 1700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]);

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {CONFETTI.map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -14,
            left: c.left,
            width: c.size,
            height: c.size,
            borderRadius: c.size / 3,
            backgroundColor: c.color,
            opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 90] }) },
              { rotate: anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function GameplayScreen({ onBack, onOpenLevels, onNextLevel }) {
  const [outerClicks, setOuterClicks] = useState(0);
  const [innerClicks, setInnerClicks] = useState(0);
  const [solved, setSolved] = useState(false);
  const [hints, setHints] = useState(5);
  const [soundOn, setSoundOn] = useState(true);
  const [showHintPopup, setShowHintPopup] = useState(false);

  const useHint = () => {
    if (hints <= 0) { setShowHintPopup(true); return; }
    setHints((h) => h - 1);
  };
  const buyHints = () => { setHints((h) => h + 10); setShowHintPopup(false); }; // $0.99
  const watchAdForHints = () => { setHints((h) => h + 5); setShowHintPopup(false); };

  const outerRot = useRef(new Animated.Value(55)).current;
  const innerRot = useRef(new Animated.Value(-70)).current;

  const rotateTo = (anim, deg) =>
    Animated.timing(anim, { toValue: deg, duration: 320, easing: Easing.elastic(0.6), useNativeDriver: true }).start();

  const checkSolved = (oClicks, iClicks) => {
    if (oClicks >= 3 && iClicks >= 2) setTimeout(() => setSolved(true), 380);
  };

  const spinOuter = () => {
    if (solved) return;
    const next = outerClicks + 1;
    const deg = next >= 3 ? 0 : 55 + next * 55;
    setOuterClicks(next);
    rotateTo(outerRot, deg);
    checkSolved(next, innerClicks);
  };

  const spinInner = () => {
    if (solved) return;
    const next = innerClicks + 1;
    const deg = next >= 2 ? 0 : -70 + next * 70;
    setInnerClicks(next);
    rotateTo(innerRot, deg);
    checkSolved(outerClicks, next);
  };

  const outerSpin = outerRot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  const innerSpin = innerRot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!solved) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [solved]);
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.root}>
      <View style={[styles.bubble, { top: 40, left: 400, width: 40, height: 40 }]} />
      <View style={[styles.bubble, { top: 320, left: 130, width: 24, height: 24 }]} />
      <View style={[styles.bubble, { top: 80, right: 60, width: 16, height: 16 }]} />

      <TouchableOpacity onPress={onBack} accessibilityLabel="Back" style={[styles.circleBtn, styles.backBtn, { backgroundColor: '#fff' }]}>
        <BackIcon />
      </TouchableOpacity>

      {!solved && (
        <View style={styles.hintCluster}>
          <TouchableOpacity onPress={useHint} accessibilityLabel="Hint" style={[styles.circleBtn, { backgroundColor: YELLOW }]}>
            <HintIcon />
          </TouchableOpacity>
          <View style={styles.hintBadge}>
            <Text style={styles.hintBadgeText}>{hints}</Text>
          </View>
        </View>
      )}

      {!solved && (
        <View style={styles.puzzleWrap}>
          <TouchableOpacity activeOpacity={0.85} onPress={spinOuter} style={styles.outerRingShadow}>
            <Animated.View style={[styles.outerRingMask, { transform: [{ rotate: outerSpin }] }]}>
              {RING_OUTER_ART ? (
                <Image source={RING_OUTER_ART} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : null}
            </Animated.View>
            <View style={styles.ringLabelTop} pointerEvents="none">
              <Text style={styles.ringLabelLight}>Outer ring art</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={spinInner} style={styles.innerRingShadow}>
            <Animated.View style={[styles.innerRingMask, { transform: [{ rotate: innerSpin }] }]}>
              {RING_INNER_ART ? (
                <Image source={RING_INNER_ART} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : null}
            </Animated.View>
            <View style={styles.ringLabelCenter} pointerEvents="none">
              <Text style={styles.ringLabelDark}>Inner ring art</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {!solved && <Text style={styles.hintText}>Tap the rings to rotate them into place</Text>}

      {solved && (
        <View style={styles.solvedRow}>
          <View style={styles.revealCircle}>
            {REVEAL_ART ? <Image source={REVEAL_ART} style={{ width: 250, height: 250, borderRadius: 125, resizeMode: 'cover' }} /> : null}
          </View>

          <View style={styles.factCard}>
            <Confetti active={solved} />
            <Text style={styles.factTitle}>ANT</Text>
            <Text style={styles.factText}>
              Ants are incredibly strong and can lift 50 times their own body weight. They live in colonies of millions with queens, workers, and soldiers.
            </Text>

            <View style={styles.factButtonRow}>
              <TouchableOpacity onPress={() => setSoundOn((v) => !v)} accessibilityLabel="Sound" style={[styles.circleBtn, { backgroundColor: soundOn ? TEAL : MUTED_GREY }]}>
                <SoundIcon muted={!soundOn} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onNextLevel} accessibilityLabel="Next level">
                <Animated.View style={[styles.nextLevelBtn, { transform: [{ scale: pulseScale }] }]}>
                  <Text style={styles.nextLevelText}>Next Level</Text>
                  <PlayIcon size={20} />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showHintPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <TouchableOpacity onPress={() => setShowHintPopup(false)} accessibilityLabel="Close" style={styles.popupClose}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path fill="none" stroke="#4a5a52" strokeWidth={3.2} strokeLinecap="round" d="M5 5 L19 19 M19 5 L5 19" />
              </Svg>
            </TouchableOpacity>

            <View style={styles.popupIconWrap}>
              <HintIcon size={32} />
            </View>

            <Text style={styles.popupTitle}>Out of Hints</Text>
            <Text style={styles.popupSubtitle}>Get more hints to keep going</Text>

            <View style={styles.popupOptions}>
              <TouchableOpacity onPress={buyHints} style={[styles.popupOption, { backgroundColor: GREEN, shadowColor: '#479457' }]}>
                <View style={styles.popupOptionLeft}>
                  <ShieldCheckIcon size={24} />
                  <Text style={styles.popupOptionText}>Buy 10 Hints</Text>
                </View>
                <View style={styles.popupPriceBadge}>
                  <Text style={styles.popupPriceText}>$0.99</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={watchAdForHints} style={[styles.popupOption, { backgroundColor: PURPLE_BLUE, shadowColor: PURPLE_BLUE_DARK }]}>
                <View style={styles.popupOptionLeft}>
                  <AdPlayIcon size={24} />
                  <Text style={styles.popupOptionText}>Watch Ad</Text>
                </View>
                <View style={styles.popupPriceBadge}>
                  <Text style={styles.popupPriceText}>+5</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  circleBtn: {
    width: 88, height: 88, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 0, elevation: 4,
  },
  backBtn: { position: 'absolute', top: 36, left: 24, zIndex: 6 },
  hintCluster: { position: 'absolute', top: 36, right: 24, zIndex: 6 },
  hintBadge: {
    position: 'absolute', top: -10, right: -10, width: 36, height: 36, borderRadius: 999, backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, elevation: 4,
  },
  hintBadgeText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  puzzleWrap: { position: 'absolute', top: '50%', left: '50%', width: OUTER_SIZE, height: OUTER_SIZE, marginTop: -OUTER_SIZE / 2, marginLeft: -OUTER_SIZE / 2 },
  outerRingShadow: {
    position: 'absolute', top: 0, left: 0, width: OUTER_SIZE, height: OUTER_SIZE, borderRadius: OUTER_SIZE / 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, elevation: 6, overflow: 'hidden',
  },
  outerRingMask: { position: 'absolute', top: 0, left: 0, width: OUTER_SIZE, height: OUTER_SIZE, borderRadius: OUTER_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  ringLabelTop: { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' },
  ringLabelLight: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  innerRingShadow: {
    position: 'absolute', top: '50%', left: '50%', width: INNER_SIZE, height: INNER_SIZE, marginTop: -INNER_SIZE / 2, marginLeft: -INNER_SIZE / 2,
    borderRadius: INNER_SIZE / 2, borderWidth: 10, borderColor: '#fff', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, elevation: 5,
  },
  innerRingMask: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: INNER_SIZE / 2, backgroundColor: 'rgba(0,0,0,0.06)' },
  ringLabelCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ringLabelDark: { fontSize: 18, fontWeight: '600', color: 'rgba(0,0,0,0.6)', textAlign: 'center' },
  hintText: { position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '600', fontSize: 20, opacity: 0.85 },
  solvedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90 },
  revealCircle: { width: 300, height: 300, borderRadius: 150, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  factCard: {
    width: 520, backgroundColor: '#fff', borderRadius: 42, paddingTop: 34, paddingHorizontal: 40, paddingBottom: 70, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 10,
  },
  factTitle: { textAlign: 'center', fontWeight: '800', fontSize: 38, letterSpacing: 1.5, color: '#1f3d2b', marginBottom: 14 },
  factText: { textAlign: 'center', fontWeight: '600', fontSize: 22, lineHeight: 32, color: '#4a5a52' },
  factButtonRow: { position: 'absolute', bottom: -44, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  nextLevelBtn: {
    height: 96, paddingHorizontal: 48, borderRadius: 999, backgroundColor: GREEN,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 0, elevation: 6,
  },
  nextLevelText: { color: '#fff', fontWeight: '700', fontSize: 26 },
  popupOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,30,20,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  popupCard: {
    width: 306, backgroundColor: '#fff', borderRadius: 28, paddingTop: 26, paddingHorizontal: 26, paddingBottom: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 10,
  },
  popupClose: {
    position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, elevation: 4,
  },
  popupIconWrap: { width: 64, height: 64, borderRadius: 999, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  popupTitle: { fontWeight: '800', fontSize: 20, color: '#1f3d2b', marginBottom: 4 },
  popupSubtitle: { fontWeight: '600', fontSize: 14, color: '#4a5a52', marginBottom: 20 },
  popupOptions: { width: '100%', gap: 12 },
  popupOption: {
    height: 58, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  popupOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  popupOptionText: { fontWeight: '700', fontSize: 16, color: '#fff' },
  popupPriceBadge: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  popupPriceText: { fontWeight: '800', fontSize: 15, color: '#fff' },
});
