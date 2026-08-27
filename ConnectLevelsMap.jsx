import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/* ---- Palette -------------------------------------------------------------
   Background: '#5cba6f' (green)  other options: '#5aa9d6' '#e8934a' '#7c6bd0' '#e0698a'
   Cards:      '#ffffff' (white)  other options: '#5cc2df' '#FBB02D' '#8fdccb' '#a58ce8'
-------------------------------------------------------------------------- */
const BG = '#5cba6f';
const CARD = '#ffffff';
const GOLD = '#f4d35e';
const STAR_EMPTY = '#dfe6e2';
const RED = '#e3435a';
const GREEN = '#5cba6f';
const GREEN_DARK = '#479457';

const STAR_PATH = 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z';
const COIN_STAR = 'M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z';
const LOCK_PATH = 'M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10 C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z';

const STARS_PER_LEVEL = [3, 2, 3, 3, 1, 2, 3, 2, 3];

function BackIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function LevelCard({ num, state, cardColor, stars, onPress }) {
  const locked = state === 'locked';
  const current = state === 'current';

  return (
    <TouchableOpacity
      activeOpacity={locked ? 1 : 0.9}
      onPress={locked ? undefined : onPress}
      style={[
        styles.card,
        { backgroundColor: locked ? 'rgba(255,255,255,0.18)' : cardColor },
        !locked && styles.cardShadow,
        current && styles.cardCurrent,
      ]}
    >
      <Text style={[styles.num, { color: locked ? 'rgba(255,255,255,0.45)' : '#6b7b86' }]}>{num}</Text>

      {locked ? (
        <Svg width={24} height={24} viewBox="0 0 24 24"><Path fill="rgba(255,255,255,0.85)" d={LOCK_PATH} /></Svg>
      ) : (
        <View style={styles.starRow}>
          {[1, 2, 3].map(i => (
            <Svg key={i} width={18} height={18} viewBox="0 0 24 24">
              <Path fill={stars >= i ? GOLD : STAR_EMPTY} d={STAR_PATH} />
            </Svg>
          ))}
        </View>
      )}

      {current && (
        <View style={styles.playPill}><Text style={styles.playText}>PLAY</Text></View>
      )}
    </TouchableOpacity>
  );
}

export default function ConnectLevelsMap({
  bgColor = BG,
  cardColor = CARD,
  levelCount = 24,
  completed = 9,
  onBack,
  onOpenLevel,
}) {
  const [opened, setOpened] = useState(null);

  const levels = [];
  for (let n = 1; n <= levelCount; n++) {
    levels.push({
      num: n,
      state: n <= completed ? 'done' : n === completed + 1 ? 'current' : 'locked',
      stars: n <= completed ? (STARS_PER_LEVEL[n - 1] || 3) : 0,
    });
  }

  const totalStars = STARS_PER_LEVEL.slice(0, completed).reduce((a, b) => a + b, 0);

  const open = (n) => {
    setOpened(n);
    if (onOpenLevel) onOpenLevel(n);
  };

  return (
    <View style={[styles.stage, { backgroundColor: bgColor }]}>
      <View style={[styles.bubble, { top: 40, left: 400, width: 40, height: 40, borderRadius: 20 }]} />
      <View style={[styles.bubble, { top: 320, left: 130, width: 24, height: 24, borderRadius: 12 }]} />
      <View style={[styles.bubble, { top: 80, left: 740, width: 16, height: 16, borderRadius: 8 }]} />

      <View style={styles.headerLeft}>
        <TouchableOpacity accessibilityLabel="Back" onPress={onBack} style={styles.circleBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>CONNECT</Text>
      </View>

      <Text style={styles.progress}>{completed}/{levelCount}</Text>

      <View style={styles.coinPill}>
        <Svg width={26} height={26} viewBox="0 0 24 24"><Path fill={GOLD} stroke="#e0a92c" strokeWidth={1.2} d={COIN_STAR} /></Svg>
        <Text style={styles.coinText}>{totalStars}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {levels.map(l => (
            <LevelCard
              key={l.num}
              num={l.num}
              state={l.state}
              stars={l.stars}
              cardColor={cardColor}
              onPress={() => open(l.num)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 874, height: 402, overflow: 'hidden', position: 'relative' },
  bubble: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.12)' },

  headerLeft: { position: 'absolute', top: 18, left: 18, flexDirection: 'row', alignItems: 'center', zIndex: 6 },
  circleBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.15)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  title: { marginLeft: 12, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 20, letterSpacing: 1, color: '#ffffff' },
  progress: { position: 'absolute', top: 24, left: 0, width: 874, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: '700', fontSize: 22, color: '#ffffff' },
  coinPill: {
    position: 'absolute', top: 18, right: 18, height: 52, paddingLeft: 10, paddingRight: 16, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center', zIndex: 6,
  },
  coinText: { marginLeft: 8, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 18, color: '#ffffff' },

  scroll: { position: 'absolute', top: 84, left: 0, width: 874, height: 318 },
  scrollInner: { paddingBottom: 24, alignItems: 'center' },
  grid: { width: 798, flexDirection: 'row', flexWrap: 'wrap' },

  card: {
    width: 118, height: 114, borderRadius: 20, marginRight: 18, marginBottom: 16,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  cardShadow: { shadowColor: 'rgba(0,0,0,0.14)', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  cardCurrent: { borderWidth: 4, borderColor: GOLD },
  num: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 34, marginBottom: 6 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  playPill: {
    position: 'absolute', top: -10, right: -10, height: 26, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  playText: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 12, color: '#ffffff' },
});
