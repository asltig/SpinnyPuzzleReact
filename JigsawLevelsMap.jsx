import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BG = '#2e1f3d';
const ACCENT = '#a06adf'; // oklch(0.72 0.16 300)
const MINT = '#5fe0c0';

const COLS = 5;
const TOTAL = 30;
const DONE = 3;
const COL_GAP = 160;
const ROW_GAP = 140;
const START_X = 117;
const START_Y = 80;
const NODE = 76;

const STAR_PATH =
  'M12,2.3c0.6,0,1.1,0.4,1.3,0.9l1.6,3.9c0.2,0.4,0.6,0.7,1,0.8l4.2,0.5c1.3,0.2,1.9,1.9,0.9,2.8l-3.1,2.9 c-0.4,0.3-0.5,0.8-0.4,1.3l0.9,4.1c0.3,1.3-1.1,2.4-2.3,1.7l-3.7-2.1c-0.4-0.2-0.9-0.2-1.3,0l-3.7,2.1c-1.2,0.7-2.6-0.3-2.3-1.7 l0.9-4.1c0.1-0.5-0.1-1-0.4-1.3l-3.1-2.9c-1-0.9-0.4-2.6,0.9-2.8l4.2-0.5c0.5-0.1,0.9-0.4,1-0.8l1.6-3.9C10.9,2.7,11.4,2.3,12,2.3z';

function buildLayout() {
  const levels = [];
  const pts = [];

  for (let i = 0; i < TOTAL; i++) {
    const row = Math.floor(i / COLS);
    const colRaw = i % COLS;
    const col = row % 2 === 0 ? colRaw : COLS - 1 - colRaw;
    const x = START_X + col * COL_GAP;
    const y = START_Y + row * ROW_GAP;
    pts.push({ x, y, row });

    const isDone = i < DONE;
    const isCurrent = i === DONE;
    const isLocked = i > DONE;
    const starCount = isDone ? (i % 3) + 1 : 0;

    levels.push({
      x, y, num: i + 1,
      nodeBg: isDone ? ACCENT : isCurrent ? MINT : 'rgba(255,255,255,0.07)',
      nodeBorder: isDone || isCurrent ? '#ffffff' : 'rgba(255,255,255,0.3)',
      isCurrent,
      showNum: isCurrent,
      showLock: isLocked,
      hasThumb: !isLocked && !isCurrent,
      starL: starCount >= 2,
      starM: starCount >= 1,
      starR: starCount >= 3,
      starMidSize: starCount === 3 ? 17 : 13,
    });
  }

  const arrows = [];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    if (prev.row === p.row) {
      arrows.push({ x: (prev.x + p.x) / 2, y: p.y, rot: p.x > prev.x ? 0 : 180 });
    } else {
      arrows.push({ x: p.x, y: (prev.y + p.y) / 2, rot: 90 });
    }
  }

  const rows = Math.ceil(TOTAL / COLS);
  const totalHeight = START_Y + (rows - 1) * ROW_GAP + 90;
  return { levels, arrows, totalHeight };
}

function Star({ size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill="#e8930a" transform="translate(0,1)" />
      <Path d={STAR_PATH} fill="#ffcb3d" />
      <Path
        d="M8.3,6.6c1.1-0.9,2.4-1.4,2.4-1.4s-0.9,1.1-1.2,2.3c-0.3,1.1,0.1,2,0.1,2S7.2,7.5,8.3,6.6z"
        fill="#ffffff"
        opacity={0.55}
      />
    </Svg>
  );
}

function LockIcon({ size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="rgba(255,255,255,0.8)"
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10 C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

function CurrentPulse() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: NODE,
        height: NODE,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: '#ffffff',
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function JigsawLevelsMap({ onBack, onSelectLevel }) {
  const { levels, arrows, totalHeight } = buildLayout();

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} accessibilityLabel="Back" style={styles.backBtn}>
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path fill={ACCENT} d="M20,11H7.83l5.59,-5.59L12,4l-8,8l8,8l1.41,-1.41L7.83,13H20V11z" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>JIGSAW</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', height: totalHeight }}>
          {arrows.map((ar, i) => (
            <View
              key={`ar-${i}`}
              style={{
                position: 'absolute',
                left: ar.x - 8,
                top: ar.y - 9,
                transform: [{ rotate: `${ar.rot}deg` }],
              }}
            >
              <Svg width={16} height={18} viewBox="0 0 16 18">
                <Path fill="rgba(255,255,255,0.32)" d="M2 1 L14 9 L2 17 Z" />
              </Svg>
            </View>
          ))}

          {levels.map((lvl, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.85}
              onPress={() => onSelectLevel && onSelectLevel(lvl.num)}
              style={[
                styles.node,
                { left: lvl.x - NODE / 2, top: lvl.y - NODE / 2, backgroundColor: lvl.nodeBg, borderColor: lvl.nodeBorder },
              ]}
            >
              {lvl.isCurrent ? <CurrentPulse /> : null}

              {lvl.hasThumb ? <View style={styles.thumb} /> : null}
              {lvl.showNum ? <Text style={styles.numText}>{lvl.num}</Text> : null}
              {lvl.showLock ? <LockIcon /> : null}

              {lvl.starL || lvl.starM || lvl.starR ? (
                <View style={styles.starRow}>
                  {lvl.starL ? <Star size={13} /> : null}
                  {lvl.starM ? <Star size={lvl.starMidSize} /> : null}
                  {lvl.starR ? <Star size={13} /> : null}
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#ffffff', fontWeight: '700', fontSize: 18, letterSpacing: 1 },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)' },
  numText: { position: 'absolute', fontWeight: '700', fontSize: 26, color: '#ffffff' },
  starRow: {
    position: 'absolute',
    top: -15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
  },
});
