/**
 * OnetLevelsScreen.tsx
 * oNet Connect level selector — plain wrapping card grid, ported from
 * ConnectLevelsMap.jsx: white number cards with a 3-star row, a lock icon
 * for locked levels, a gold ring + "PLAY" pill on the current level, and a
 * top-right pill showing total stars earned.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions, SafeAreaView, ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { OnetLevelsScreenProps } from '../../navigation/types';
import { useProgressStore } from '../../stores/useProgressStore';
import { getLevelStars }    from '../../storage/progressStorage';
import { soundService }     from '../../services/audio/soundService';
import { contractCircle } from '../../utils/circularReveal';
import { ONET_TOTAL_LEVELS } from '../../services/data/onetService';
import { LEVELS_BG_COLOR }   from '../../constants/gameColors';

// ─── Palette — ported from ConnectLevelsMap.jsx ───────────────────────────────
const BG_COLOR    = LEVELS_BG_COLOR.onet;
const CARD_COLOR  = '#ffffff';
const GOLD        = '#f4d35e';
const STAR_EMPTY  = '#dfe6e2';
const RED         = '#e3435a';
const GREEN       = '#5cba6f';
const GREEN_DARK  = '#479457';

const STAR_PATH = 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z';
const COIN_STAR = 'M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z';
const LOCK_PATH = 'M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10 C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z';

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 18 }, (_, i) => ({
  id: i, r: 2.5 + Math.random() * 4,
  rx: Math.random(), ry: Math.random(),
  dur: 3800 + Math.random() * 3200, delay: Math.random() * 2200,
}));

function FloatingDot({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.r,
      width: dot.r * 2, height: dot.r * 2, backgroundColor: '#FFFFFF',
      left: dot.rx * W, top: dot.ry * H,
      opacity: a.interpolate({ inputRange:[0,0.5,1], outputRange:[0.1,0.55,0.1] }),
      transform: [{ translateY: a.interpolate({ inputRange:[0,1], outputRange:[0,-8] }) }],
    }} />
  );
}

function BackIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

// ─── Level card ────────────────────────────────────────────────────────────────
interface CardProps {
  num:      number;
  locked:   boolean;
  current:  boolean;
  stars:    number;
  cardW:    number;
  cardH:    number;
  onPress:  () => void;
}

function LevelCard({ num, locked, current, stars, cardW, cardH, onPress }: CardProps) {
  const corner  = Math.round(cardW * 0.17);
  const starSz  = Math.round(cardW * 0.15);
  const numSz   = Math.round(cardH * 0.30);

  return (
    <TouchableOpacity
      activeOpacity={locked ? 1 : 0.9}
      onPress={locked ? undefined : onPress}
      style={[
        ss.card,
        {
          width: cardW, height: cardH, borderRadius: corner,
          backgroundColor: locked ? 'rgba(255,255,255,0.18)' : CARD_COLOR,
        },
        !locked && ss.cardShadow,
        current && ss.cardCurrent,
      ]}
    >
      <Text style={[ss.num, { fontSize: numSz, color: locked ? 'rgba(255,255,255,0.45)' : '#6b7b86' }]}>
        {num}
      </Text>

      {locked ? (
        <Svg width={Math.round(cardW * 0.2)} height={Math.round(cardW * 0.2)} viewBox="0 0 24 24">
          <Path fill="rgba(255,255,255,0.85)" d={LOCK_PATH} />
        </Svg>
      ) : (
        <View style={ss.starRow}>
          {[1, 2, 3].map((i) => (
            <Svg key={i} width={starSz} height={starSz} viewBox="0 0 24 24">
              <Path fill={stars >= i ? GOLD : STAR_EMPTY} d={STAR_PATH} />
            </Svg>
          ))}
        </View>
      )}

      {current && (
        <View style={ss.playPill}><Text style={ss.playText}>PLAY</Text></View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnetLevelsScreen({ navigation }: OnetLevelsScreenProps): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.max(winW, winH);
  const H = Math.min(winW, winH);

  const { isCompleted } = useProgressStore();
  const [, setTick] = useState(0);

  useFocusEffect(useCallback(() => {
    setTick((t) => t + 1);
    soundService.playMusic('menu_music');
  }, []));

  const BTN_SZ = Math.round(H * 0.13);
  const SIDE_PAD = 16;
  const CARD_W = Math.min(Math.round(W * 0.10), 130);
  const CARD_H = Math.round(CARD_W * (114 / 118));
  const GAP    = Math.round(CARD_W * 0.16);

  const accessible = (idx: number) =>
    idx === 0 || isCompleted('Onet', `level_${idx - 1}`);

  const currentIdx = Array.from({ length: ONET_TOTAL_LEVELS }, (_, i) => i).findIndex(
    (i) => accessible(i) && !isCompleted('Onet', `level_${i}`),
  );
  const completedCount = currentIdx < 0 ? ONET_TOTAL_LEVELS : currentIdx;

  let totalStars = 0;
  for (let i = 0; i < completedCount; i++) totalStars += getLevelStars('Onet', `level_${i}`);

  const openLevel = useCallback((lvl: number) => {
    soundService.play('button_click');
    navigation.navigate('OnetGame', { level: lvl });
  }, [navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      <SafeAreaView style={ss.safe}>
        <View style={ss.topBar}>
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[ss.circleBtn, { width: BTN_SZ, height: BTN_SZ, borderRadius: BTN_SZ / 2 }]}
          >
            <BackIcon size={Math.round(BTN_SZ * 0.5)} />
          </TouchableOpacity>
          <Text style={[ss.title, { fontSize: Math.round(H * 0.05) }]}>CONNECT</Text>
        </View>

        <View pointerEvents="none" style={ss.progressWrap}>
          <Text style={[ss.progress, { fontSize: Math.round(H * 0.05) }]}>
            {completedCount}/{ONET_TOTAL_LEVELS}
          </Text>
        </View>

        <View pointerEvents="none" style={[ss.coinPill, { height: BTN_SZ }]}>
          <Svg width={Math.round(BTN_SZ * 0.5)} height={Math.round(BTN_SZ * 0.5)} viewBox="0 0 24 24">
            <Path fill={GOLD} stroke="#e0a92c" strokeWidth={1.2} d={COIN_STAR} />
          </Svg>
          <Text style={ss.coinText}>{totalStars}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: SIDE_PAD }}>
          <View style={ss.grid}>
            {Array.from({ length: ONET_TOTAL_LEVELS }, (_, idx) => (
              <View key={idx} style={{ marginRight: GAP, marginBottom: GAP }}>
                <LevelCard
                  num={idx + 1}
                  locked={!accessible(idx)}
                  current={idx === currentIdx}
                  stars={getLevelStars('Onet', `level_${idx}`)}
                  cardW={CARD_W}
                  cardH={CARD_H}
                  onPress={() => openLevel(idx)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  circleBtn: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 0, elevation: 4,
  },
  title: {
    color: '#FFFFFF', fontFamily: 'FredokaOne-Regular', letterSpacing: 1,
  },
  progressWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 12,
  },
  progress: {
    textAlign: 'center', color: '#FFFFFF', fontFamily: 'FredokaOne-Regular',
  },
  coinPill: {
    position: 'absolute', top: 12, right: 16, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 10, paddingRight: 14, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  coinText: { marginLeft: 6, fontFamily: 'FredokaOne-Regular', fontSize: 16, color: '#ffffff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingTop: 8 },

  card: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardShadow: {
    shadowColor: 'rgba(0,0,0,0.14)', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  cardCurrent: { borderWidth: 4, borderColor: GOLD },
  num: { fontFamily: 'FredokaOne-Regular', marginBottom: 6 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  playPill: {
    position: 'absolute', top: -10, right: -10, height: 24, paddingHorizontal: 9, borderRadius: 999,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  playText: { fontFamily: 'FredokaOne-Regular', fontSize: 11, color: '#ffffff' },
});
