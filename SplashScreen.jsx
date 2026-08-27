import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';

const heroIcon = require('./assets/spinny-puzzle-icon.png');

const BG = '#392635';
const YELLOW = '#f4d35e';

const DOTS = [
  { top: 44, left: 120, size: 8, color: '#c7c93f', duration: 4500, delay: 0 },
  { top: 70, right: 150, size: 7, color: '#a06adf', duration: 3800, delay: 400 },
  { bottom: 70, left: 180, size: 6, color: '#4bb8d6', duration: 5200, delay: 800 },
  { bottom: 110, right: 110, size: 5, color: '#4fc98a', duration: 4000, delay: 1200 },
];

function useLoop(duration, delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, [duration, delay]);
  return anim;
}

function FloatingDot({ dot }) {
  const anim = useLoop(dot.duration, dot.delay);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const { top, left, right, bottom, size, color } = dot;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top, left, right, bottom,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ translateY }],
      }}
    />
  );
}

function LoadingBar() {
  const anim = useLoop(2400);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width }]} />
    </View>
  );
}

export default function SplashScreen({ message = 'Loading your puzzles…' }) {
  const hero = useLoop(1600);
  const scale = hero.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = hero.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <View style={styles.screen}>
      {DOTS.map((dot, i) => (
        <FloatingDot key={i} dot={dot} />
      ))}

      <View style={styles.center}>
        <Animated.Image
          source={heroIcon}
          resizeMode="contain"
          style={{ width: 196, height: 196, transform: [{ scale }, { rotate }] }}
        />
        <Text style={styles.message}>{message}</Text>
        <LoadingBar />
      </View>

      <Text style={styles.footer}>Spinny Puzzle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  message: { color: '#ffffff', fontWeight: '600', fontSize: 15, letterSpacing: 0.5, opacity: 0.75 },
  barTrack: {
    width: 220,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: YELLOW },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
