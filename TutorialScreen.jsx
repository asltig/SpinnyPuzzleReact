import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// TODO: replace with your real asset requires
const ARROW = require('./assets/hint-arrow-trimmed.png'); // 106x187 trimmed
const FINGER = require('./assets/hint-finger.png'); // 546x388
const RING_OUTER = require('./assets/ring-outer.png');
const RING_INNER = require('./assets/ring-inner.png');
const REVEAL_ANIMAL = require('./assets/reveal-animal.png');

const GREEN = '#5cba6f';

function useLoop(duration, easing = Easing.inOut(Easing.ease)) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration / 2, easing, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration]);
  return anim;
}

function useSpin(duration) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [duration]);
  return anim;
}

function ArrowCluster({ style }) {
  const pulse0 = useLoop(1560);
  const pulse1 = useLoop(1560);
  const pulse2 = useLoop(1560);
  const opacities = [pulse0, pulse1, pulse2].map((a) => a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }));
  return (
    <View style={[{ flexDirection: 'row', gap: 3 }, style]}>
      {opacities.map((op, i) => (
        <Animated.Image key={i} source={ARROW} style={{ width: 20, height: 32, opacity: op }} resizeMode="contain" />
      ))}
    </View>
  );
}

export default function TutorialScreen({ onSkip, onFinish }) {
  const [step, setStep] = useState(0); // 0 = outer, 1 = inner
  const [solved, setSolved] = useState(false);
  const outerDeg = useRef(new Animated.Value(55)).current;
  const innerDeg = useRef(new Animated.Value(-70)).current;

  const orbit = useSpin(3900);
  const orbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handSweepOuter = useLoop(2080);
  const handOuterRotate = handSweepOuter.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '35deg'] });
  const handSweepInner = useLoop(1820);
  const handInnerRotate = handSweepInner.interpolate({ inputRange: [0, 1], outputRange: ['35deg', '-15deg'] });

  const glow = useLoop(1690);
  const glowShadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] });

  const pulseBtn = useLoop(1820);
  const btnScale = pulseBtn.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const spinOuter = () => {
    if (solved || step !== 0) return;
    Animated.timing(outerDeg, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    setStep(1);
  };

  const spinInner = () => {
    if (solved || step !== 1) return;
    Animated.timing(innerDeg, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    setTimeout(() => setSolved(true), 380);
  };

  const skip = () => { setSolved(true); onSkip && onSkip(); };

  if (solved) {
    return (
      <View style={styles.screen}>
        <View style={styles.solvedRow}>
          <View style={styles.revealWrap}>
            <View style={styles.revealBg} />
            <Image source={REVEAL_ANIMAL} style={styles.revealImg} resizeMode="cover" />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Great job!</Text>
            <Text style={styles.cardBody}>You aligned both rings. Solve puzzles like this to reveal fun animal facts.</Text>
            <View style={styles.btnWrap}>
              <TouchableOpacity onPress={() => onFinish && onFinish()} style={styles.startBtnTouchable}>
                <Animated.View style={[styles.startBtn, { transform: [{ scale: btnScale }] }]}>
                  <Text style={styles.startBtnText}>Start Playing</Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path fill="#fff" d="M8 5v14l11-7z" />
                  </Svg>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={skip} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.ringArea}>
        <TouchableOpacity onPress={spinOuter} activeOpacity={0.85} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.outerRing, { shadowOpacity: step === 0 ? glowShadowOpacity : 0 }]}>
            <Animated.View
              style={{
                flex: 1,
                borderRadius: 130,
                transform: [{ rotate: outerDeg.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
              }}
            >
              <Image source={RING_OUTER} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity onPress={spinInner} activeOpacity={0.85} style={styles.innerTouchable}>
          <Animated.View style={[styles.innerRing, { shadowOpacity: step === 1 ? glowShadowOpacity : 0 }]}>
            <Animated.View
              style={{
                flex: 1,
                borderRadius: 70,
                transform: [{ rotate: innerDeg.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
              }}
            >
              <Image source={RING_INNER} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>

        <Animated.View style={[styles.orbitWrap, { transform: [{ rotate: orbitRotate }] }]} pointerEvents="none">
          <ArrowCluster style={{ position: 'absolute', top: 59.3 - 16, left: 200.7 - 33, transform: [{ rotate: '45deg' }] }} />
          <ArrowCluster style={{ position: 'absolute', top: 200.7 - 16, left: 59.3 - 33, transform: [{ rotate: '225deg' }] }} />
        </Animated.View>

        {step === 0 ? (
          <Animated.View style={[styles.handPivot, { transform: [{ rotate: handOuterRotate }] }]} pointerEvents="none">
            <Image source={FINGER} style={{ position: 'absolute', top: -100, left: -28, width: 56, height: 40, transform: [{ rotate: '60deg' }] }} resizeMode="contain" />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.handPivot, { transform: [{ rotate: handInnerRotate }] }]} pointerEvents="none">
            <Image source={FINGER} style={{ position: 'absolute', top: -52, left: -25, width: 50, height: 36, transform: [{ rotate: '60deg' }] }} resizeMode="contain" />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  skipBtn: {
    position: 'absolute', top: 18, right: 18, height: 44, paddingHorizontal: 20, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ringArea: { width: 260, height: 260 },
  outerRing: {
    flex: 1, borderRadius: 130, backgroundColor: 'transparent',
    shadowColor: '#fff', shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  innerTouchable: {
    position: 'absolute', top: '50%', left: '50%', width: 140, height: 140,
    marginTop: -70, marginLeft: -70, borderRadius: 70, overflow: 'hidden', borderWidth: 6, borderColor: '#fff',
  },
  innerRing: { flex: 1, borderRadius: 70, shadowColor: '#fff', shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  orbitWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  handPivot: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  solvedRow: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  revealWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  revealBg: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#f4d35e' },
  revealImg: { width: 150, height: 150, borderRadius: 75 },
  card: { width: 320, backgroundColor: '#fff', borderRadius: 28, padding: 22, paddingBottom: 56 },
  cardTitle: { textAlign: 'center', fontWeight: '800', fontSize: 24, letterSpacing: 1, color: '#1f3d2b', marginBottom: 10 },
  cardBody: { textAlign: 'center', fontWeight: '600', fontSize: 15, lineHeight: 22, color: '#4a5a52' },
  btnWrap: { position: 'absolute', bottom: -26, left: '50%', marginLeft: -85 },
  startBtnTouchable: {},
  startBtn: {
    height: 56, paddingHorizontal: 28, borderRadius: 999, backgroundColor: GREEN,
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
