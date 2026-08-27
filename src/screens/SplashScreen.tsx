/**
 * SplashScreen.tsx
 * App entry screen — visual design ported from SplashScreen.jsx.
 *
 * Owns the app bootstrap sequence that used to live in ChooseGameTypeScreen's
 * mount effect (which only ever ran once anyway, since ChooseGameTypeScreen
 * stays mounted at the base of the stack for the whole session). Runs it
 * once here instead, shows the loading UI while it's in flight, then
 * replaces itself with ChooseGameType so Splash never sits in the back stack.
 *
 * Bootstrap never blocks forever on a failure — same as the effect it
 * replaced, any error is swallowed and the app proceeds to the home screen
 * regardless (best-effort init).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { useSettingsStore } from '../stores/useSettingsStore';
import { soundService }     from '../services/audio/soundService';
import { iapService }       from '../services/iap/iapService';
import { pushService }      from '../services/notifications/pushService';
import { syncCatalogIfNeeded } from '../services/api/catalogSyncService';
import { syncAdsInfo }         from '../services/api/adsInfoService';

const BG     = '#392635';
const YELLOW = '#f4d35e';

/** Never show the splash for less than this, even if bootstrap finishes instantly. */
const MIN_DISPLAY_MS = 1200;

const DOTS = [
  { top: 44, left: 120, size: 8, color: '#c7c93f', duration: 4500, delay: 0 },
  { top: 70, right: 150, size: 7, color: '#a06adf', duration: 3800, delay: 400 },
  { bottom: 70, left: 180, size: 6, color: '#4bb8d6', duration: 5200, delay: 800 },
  { bottom: 110, right: 110, size: 5, color: '#4fc98a', duration: 4000, delay: 1200 },
] as const;

/**
 * `active` lets a caller stop the loop imperatively (not just on unmount) —
 * used right before navigating away so the native side has actually
 * processed the stop before the view is torn down. Removing a view while a
 * useNativeDriver loop is still mid-flight is a known RN crash ("'parentNode'
 * is a required parameter" inside flushUIBlocksWithCompletion).
 */
function useLoop(duration: number, delay = 0, active = true, nativeDriver = true): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
        Animated.timing(anim, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, delay, active, nativeDriver]);
  return anim;
}

function FloatingDot({ dot, active }: { dot: (typeof DOTS)[number]; active: boolean }): React.JSX.Element {
  const anim = useLoop(dot.duration, dot.delay, active);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const { top, left, right, bottom, size, color } = dot as {
    top?: number; left?: number; right?: number; bottom?: number; size: number; color: string;
  };
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

/** One-shot 0% → 100% fill, timed to MIN_DISPLAY_MS — no looping/resetting. */
function LoadingBar({ width }: { width: number }): React.JSX.Element {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // width can't be driven by the native animated module (only transform/
    // opacity can), so this runs on the JS thread.
    Animated.timing(anim, {
      toValue:         1,
      duration:        MIN_DISPLAY_MS,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim]);
  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[styles.barTrack, { width }]}>
      <Animated.View style={[styles.barFill, { width: fillWidth }]} />
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const shortEdge = Math.min(winW, winH);
  const iconSize  = Math.round(Math.min(shortEdge * 0.5, 196));

  // Flips to false the instant we're ready to leave — stops every
  // useNativeDriver loop (via useLoop's `active` param) a full frame before
  // navigation.replace() actually tears this screen down.
  const [active, setActive] = useState(true);

  const hero = useLoop(1600, 0, active);
  const scale  = hero.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = hero.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  useEffect(() => {
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, MIN_DISPLAY_MS));

    const bootstrap = (async () => {
      // useProgressStore is already hydrated at module load (App.tsx) —
      // synchronous, so it's guaranteed done before this screen ever mounts.
      useSettingsStore.getState().hydrate();
      await iapService.init();
      await pushService.register();
      await soundService.loadAll();
      void syncCatalogIfNeeded();
      await syncAdsInfo();
      // app_open / session_start / first_open are collected automatically by Firebase.
    })().catch(console.error);

    Promise.all([bootstrap, minDelay]).then(() => {
      setActive(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only navigate away once the animations have actually had a frame to stop.
  useEffect(() => {
    if (active) return;
    const id = requestAnimationFrame(() => navigation.replace('ChooseGameType'));
    return () => cancelAnimationFrame(id);
  }, [active, navigation]);

  return (
    <View style={styles.screen}>
      {DOTS.map((dot, i) => <FloatingDot key={i} dot={dot} active={active} />)}

      <View style={styles.center}>
        <Animated.Image
          source={require('../assets/images/spinny-puzzle-icon.png')}
          resizeMode="contain"
          style={{ width: iconSize, height: iconSize, transform: [{ scale }, { rotate }] }}
        />
        <Text style={styles.message}>Loading your puzzles…</Text>
        <LoadingBar width={Math.round(Math.min(shortEdge * 0.6, 220))} />
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
