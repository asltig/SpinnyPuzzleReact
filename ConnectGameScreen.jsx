import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ---- Palette (current selection) -----------------------------------------
   Background: '#e0698a' (pink)   other options: '#5cba6f' '#5aa9d6' '#e8934a' '#7c6bd0'
   Tiles:      '#ffffff' (white)  other options: '#5cc2df' '#FBB02D' '#8fdccb' '#a58ce8'
-------------------------------------------------------------------------- */
const BG = '#e0698a';
const TILE = '#ffffff';
const AMBER = 'rgb(226,168,86)';    // hint button  — oklch(0.80 0.15 75)
const PURPLE = 'rgb(150,79,196)';   // shuffle      — oklch(0.62 0.19 300)
const RED = '#e3435a';              // badges / back arrow
const GOLD = '#f4d35e';             // link cord + selection ring
const GREEN = '#5cba6f';
const GREEN_DARK = '#479457';
const PURPLE_BLUE = 'rgb(103,110,224)';
const PURPLE_BLUE_DARK = 'rgb(74,80,181)';

const COLS = 5, ROWS = 3, TW = 92, TH = 80, GX = 14, GY = 12;
const BOARD_W = COLS * TW + (COLS - 1) * GX;   // 516
const BOARD_H = ROWS * TH + (ROWS - 1) * GY;   // 264

// TODO: replace with your real asset requires, e.g. require('./assets/goat.png')
const ART = { goat: null, rabbit: null, duck: null, cat: null, bull: null, sheep: null, horse: null };

const START_BOARD = [
  'goat', 'rabbit', 'duck', 'cat', 'cat',
  'bull', 'sheep', null, 'goat', 'duck',
  'horse', 'bull', 'horse', 'sheep', 'rabbit',
];
const TOTAL_PAIRS = 7;

const center = (i) => ({
  x: (i % COLS) * (TW + GX) + TW / 2,
  y: Math.floor(i / COLS) * (TH + GY) + TH / 2,
});

// L-route: out of tile A into the lane between rows, across, then into B
function route(a, b) {
  const p = center(a), q = center(b);
  if (p.y === q.y || p.x === q.x) return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
  const laneY = p.y < q.y ? p.y + (TH / 2 + GY / 2) : p.y - (TH / 2 + GY / 2);
  return `M ${p.x} ${p.y} L ${p.x} ${laneY} L ${q.x} ${laneY} L ${q.x} ${q.y}`;
}

function BackIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function HintIcon({ size = 22, color = '#ffffff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M9,21c0,0.55,0.45,1,1,1h4c0.55,0,1-0.45,1-1v-1H9V21z M12,2C8.14,2,5,5.14,5,9c0,2.38,1.19,4.47,3,5.74V17 c0,0.55,0.45,1,1,1h6c0.55,0,1-0.45,1-1v-2.26c1.81-1.27,3-3.36,3-5.74C19,5.14,15.86,2,12,2z" />
    </Svg>
  );
}

function ShuffleIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" d="M4 7h4l8 10h4M16 7h4M4 17h4l3-3.6" />
      <Path fill="#ffffff" d="M18 4.4l3 2.6-3 2.6zM18 14.4l3 2.6-3 2.6z" />
    </Svg>
  );
}

function StarIcon({ size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={GOLD} stroke="#e0a92c" strokeWidth={1.2} d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z" />
    </Svg>
  );
}

/** Draws the connecting cord: white halo + gold cord, revealed with a dash sweep. */
function LinkLine({ d }) {
  const dash = useRef(new Animated.Value(900)).current;

  useEffect(() => {
    dash.setValue(900);
    Animated.timing(dash, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [d]);

  if (!d) return null;
  return (
    <Svg width={BOARD_W} height={BOARD_H} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <AnimatedPath d={d} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[900, 900]} strokeDashoffset={dash} />
      <AnimatedPath d={d} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[900, 900]} strokeDashoffset={dash} />
    </Svg>
  );
}

function Tile({ index, value, selected, clearing, tileColor, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!clearing) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.14, duration: 130, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.6, duration: 170, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 170, useNativeDriver: true }),
      ]),
    ]).start();
  }, [clearing]);

  useEffect(() => {
    if (clearing) return;
    Animated.spring(scale, { toValue: selected ? 1.04 : 1, useNativeDriver: true, friction: 6 }).start();
  }, [selected, clearing]);

  if (!value && !clearing) return <View style={styles.tileSlot} />;

  return (
    <View style={styles.tileSlot}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.tile,
            selected && styles.tileSelected,
            { backgroundColor: tileColor, transform: [{ scale }], opacity },
          ]}
        >
          {/* Drop the animal artwork here: <Image source={ART[value]} style={styles.art} /> */}
          <View style={styles.art} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

export default function ConnectGameScreen({ bgColor = BG, tileColor = TILE, onBack, onNextLevel }) {
  const [board, setBoard] = useState(START_BOARD);
  const [selected, setSelected] = useState([]);
  const [link, setLink] = useState(null);
  const [clearing, setClearing] = useState([]);
  const [coins, setCoins] = useState(0);
  const [hints, setHints] = useState(5);
  const [shuffles, setShuffles] = useState(3);
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [seconds, setSeconds] = useState(53);

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const tap = (i, forcedFirst) => {
    if (!board[i] || clearing.length) return;
    const current = forcedFirst !== undefined ? [forcedFirst] : selected;
    if (current.includes(i)) { setSelected([]); return; }
    const next = current.concat(i);
    if (next.length < 2) { setSelected(next); return; }

    const [a, b] = next;
    if (board[a] === board[b]) {
      setSelected(next);
      setLink(route(a, b));
      setTimeout(() => {
        setClearing([a, b]);
        setLink(null);
        setTimeout(() => {
          setBoard(bd => { const nb = bd.slice(); nb[a] = null; nb[b] = null; return nb; });
          setClearing([]);
          setSelected([]);
          setCoins(c => c + 10);
        }, 300);
      }, 320);
    } else {
      setSelected(next);
      setTimeout(() => setSelected([]), 420);
    }
  };

  const useHint = () => {
    if (hints <= 0) { setShowHintPopup(true); return; }
    const seen = {};
    for (let i = 0; i < board.length; i++) {
      const v = board[i];
      if (!v) continue;
      if (seen[v] !== undefined) { setHints(h => h - 1); tap(i, seen[v]); return; }
      seen[v] = i;
    }
  };

  const shuffle = () => {
    if (shuffles <= 0) return;
    const filled = board.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    const vals = filled.map(i => board[i]);
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    const nb = board.slice();
    filled.forEach((idx, k) => { nb[idx] = vals[k]; });
    setBoard(nb); setShuffles(s => s - 1); setSelected([]); setLink(null);
  };

  const left = board.filter(Boolean).length / 2;
  const cleared = left === 0;
  const timeLabel = `Time ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.stage, { backgroundColor: bgColor }]}>
      <View style={[styles.bubble, { top: 40, left: 400, width: 40, height: 40, borderRadius: 20 }]} />
      <View style={[styles.bubble, { top: 320, left: 130, width: 24, height: 24, borderRadius: 12 }]} />
      <View style={[styles.bubble, { top: 80, left: 740, width: 16, height: 16, borderRadius: 8 }]} />
      <View style={[styles.bubble, { top: 250, left: 60, width: 12, height: 12, borderRadius: 6 }]} />

      <View style={styles.headerLeft}>
        <TouchableOpacity accessibilityLabel="Back" onPress={onBack} style={[styles.circleBtn, { backgroundColor: '#ffffff' }]}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.progress}>{TOTAL_PAIRS - left}/{TOTAL_PAIRS}</Text>
      </View>

      <Text style={styles.timer}>{timeLabel}</Text>

      <View style={styles.headerRight}>
        <View style={styles.coinPill}>
          <StarIcon />
          <Text style={styles.coinText}>{coins}</Text>
        </View>

        <View style={styles.btnWrap}>
          <TouchableOpacity accessibilityLabel="Shuffle" onPress={shuffle} style={[styles.circleBtn, { backgroundColor: PURPLE }]}>
            <ShuffleIcon />
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeText}>{shuffles}</Text></View>
        </View>

        <View style={styles.btnWrap}>
          <TouchableOpacity accessibilityLabel="Hint" onPress={useHint} style={[styles.circleBtn, { backgroundColor: AMBER }]}>
            <HintIcon />
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeText}>{hints}</Text></View>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {board.map((v, i) => (
            <Tile
              key={i}
              index={i}
              value={v}
              tileColor={tileColor}
              selected={selected.includes(i)}
              clearing={clearing.includes(i)}
              onPress={() => tap(i)}
            />
          ))}
        </View>
        <LinkLine d={link} />
      </View>

      {!cleared && <Text style={styles.tip}>Tap two matching animals to link them</Text>}

      {cleared && (
        <TouchableOpacity onPress={onNextLevel} style={styles.nextBtn}>
          <Text style={styles.nextText}>Next Level</Text>
          <Svg width={16} height={16} viewBox="0 0 24 24"><Path fill="#ffffff" d="M8 5v14l11-7z" /></Svg>
        </TouchableOpacity>
      )}

      {showHintPopup && (
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <TouchableOpacity accessibilityLabel="Close" onPress={() => setShowHintPopup(false)} style={styles.closeBtn}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path fill="none" stroke="#4a5a52" strokeWidth={3.2} strokeLinecap="round" d="M5 5 L19 19 M19 5 L5 19" />
              </Svg>
            </TouchableOpacity>

            <View style={styles.popupIcon}><HintIcon size={32} /></View>
            <Text style={styles.popupTitle}>Out of Hints</Text>
            <Text style={styles.popupBody}>Get more hints to keep going</Text>

            <TouchableOpacity
              onPress={() => { setHints(h => h + 10); setShowHintPopup(false); }}
              style={[styles.shopBtn, { backgroundColor: GREEN, shadowColor: GREEN_DARK }]}
            >
              <Text style={styles.shopLabel}>Buy 10 Hints</Text>
              <Text style={styles.shopPrice}>$0.99</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setHints(h => h + 5); setShowHintPopup(false); }}
              style={[styles.shopBtn, { backgroundColor: PURPLE_BLUE, shadowColor: PURPLE_BLUE_DARK, marginTop: 12 }]}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Rect x={2.5} y={6} width={15} height={12} rx={2.5} fill="#ffffff" />
                <Path d="M17.5 10.2l3.6-2.4a.6.6 0 0 1 .9.5v7.4a.6.6 0 0 1-.9.5l-3.6-2.4z" fill="#ffffff" />
              </Svg>
              <Text style={styles.shopLabel}>Watch Ad</Text>
              <Text style={styles.shopPrice}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 874, height: 402, overflow: 'hidden', position: 'relative' },
  bubble: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.12)' },

  headerLeft: { position: 'absolute', top: 18, left: 18, flexDirection: 'row', alignItems: 'center', zIndex: 6 },
  headerRight: { position: 'absolute', top: 18, right: 18, flexDirection: 'row', alignItems: 'center', zIndex: 6 },
  btnWrap: { position: 'relative', marginLeft: 12 },
  circleBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.15)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  coinPill: { height: 52, paddingLeft: 10, paddingRight: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center' },
  coinText: { marginLeft: 8, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 18, color: '#ffffff' },
  progress: { marginLeft: 12, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 20, color: '#ffffff' },
  timer: { position: 'absolute', top: 24, left: 0, width: 874, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: '700', fontSize: 22, color: '#ffffff' },
  badge: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontWeight: '700', fontSize: 12, fontFamily: 'Fredoka' },

  boardWrap: { position: 'absolute', top: 84, left: (874 - BOARD_W) / 2, width: BOARD_W, height: BOARD_H },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: BOARD_W },
  tileSlot: { width: TW, height: TH, marginRight: GX, marginBottom: GY, position: 'relative' },
  tile: {
    flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.14)', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  tileSelected: { borderWidth: 4, borderColor: GOLD },
  art: { width: '100%', height: '100%' },

  tip: { position: 'absolute', top: 362, left: 0, width: 874, textAlign: 'center', color: '#ffffff', fontFamily: 'Fredoka', fontWeight: '600', fontSize: 14, opacity: 0.85 },

  nextBtn: {
    position: 'absolute', bottom: 14, alignSelf: 'center', height: 56, paddingHorizontal: 28, borderRadius: 999,
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center',
    shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  nextText: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 16, color: '#ffffff', marginRight: 8 },

  overlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,20,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  popup: { width: 306, backgroundColor: '#ffffff', borderRadius: 28, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  popupIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  popupTitle: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 20, color: '#1f3d2b', marginBottom: 4 },
  popupBody: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: 14, color: '#4a5a52', marginBottom: 20 },
  shopBtn: {
    height: 58, borderRadius: 18, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  shopLabel: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 16, color: '#ffffff' },
  shopPrice: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 15, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
