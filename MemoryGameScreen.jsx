import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

/* ---- Palette -------------------------------------------------------------
   Background options: '#5cba6f' (green), '#5aa9d6' (blue), '#e8934a' (orange),
                       '#7c6bd0' (purple), '#e0698a' (pink)
   Card options:       '#5cc2df' (blue), '#FBB02D' (amber), '#f4c65e' (yellow),
                       '#f0f4f2' (paper), '#a58ce8' (lilac), '#7fd39a' (mint)
-------------------------------------------------------------------------- */
const BG = '#5cba6f';
const CARD = '#5cc2df';
const AMBER = 'rgb(226,168,86)';   // hint button — oklch(0.80 0.15 75)
const RED = '#e3435a';             // badge / back arrow / time's up
const STAR = 'rgb(232,155,72)';    // oklch(0.72 0.16 48)
const PURPLE_BLUE = 'rgb(103,110,224)';
const PURPLE_BLUE_DARK = 'rgb(74,80,181)';
const GREEN = '#5cba6f';
const GREEN_DARK = '#479457';
const INK = '#2c3e50';
const MUTED = '#8a97a3';

const shade = (hex, f = 0.72) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

// TODO: replace with your real asset requires, e.g. require('./assets/duck.png')
const PAIR_ART = { duck: null, cat: null, sheep: null };

const DECK = [
  { pair: 'duck', label: 'Duck' },
  { pair: 'cat', label: 'Cat' },
  { pair: 'sheep', label: 'Sheep' },
  { pair: 'duck', label: 'Duck' },
  { pair: 'cat', label: 'Cat' },
  { pair: 'sheep', label: 'Sheep' },
];
const PAIR_COUNT = 3;
const ROUND_SECONDS = 28;

const STAR_PATH = 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z';
const GRID_PATH = 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z';

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

function ClockIcon({ size = 32, color = RED }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.6} fill="none" stroke={color} strokeWidth={2.4} />
      <Path fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" d="M12 7.4v5l3 2" />
    </Svg>
  );
}

function RetryIcon({ size = 19 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
      <Path fill="#ffffff" d="M20.8 3.8v5.4h-5.4z" />
    </Svg>
  );
}

function PlayIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#ffffff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

function GridIcon({ size = 18, color = '#5b6b78' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={GRID_PATH} />
    </Svg>
  );
}

function StarIcon({ size = 38, color = STAR }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={STAR_PATH} />
    </Svg>
  );
}

function Card({ card, cardColor, onPress }) {
  const anim = useRef(new Animated.Value(card.open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: card.open ? 1 : 0,
      duration: 340,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  }, [card.open]);

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.cardSlot}>
      <Animated.View
        style={[
          styles.cardFace,
          { backgroundColor: cardColor, shadowColor: shade(cardColor), transform: [{ perspective: 700 }, { rotateY: frontRotate }] },
        ]}
      >
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />
        <Text style={styles.question}>?</Text>
      </Animated.View>

      <Animated.View
        style={[styles.cardFace, styles.cardFaceUp, { transform: [{ perspective: 700 }, { rotateY: backRotate }] }]}
      >
        {/* Drop the pair artwork here: <Image source={PAIR_ART[card.pair]} style={styles.art} /> */}
        <View style={styles.art} />
        <Text style={styles.cardLabel}>{card.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function MemoryGameScreen({ bgColor = BG, cardColor = CARD, onBack, onNextLevel, onOpenLevels }) {
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState(5);
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [popup, setPopup] = useState(null); // null | 'timesup' | 'complete'
  const [seconds, setSeconds] = useState(ROUND_SECONDS);

  const matchedRef = useRef(matched);
  matchedRef.current = matched;
  const clock = useRef(null);

  const startClock = () => {
    if (clock.current) clearInterval(clock.current);
    clock.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1 && matchedRef.current.length < PAIR_COUNT) {
          clearInterval(clock.current);
          setPopup('timesup');
          return 0;
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  useEffect(() => {
    startClock();
    return () => clearInterval(clock.current);
  }, []);

  const flip = (i) => {
    if (busy || popup || flipped.includes(i) || matched.includes(DECK[i].pair)) return;
    const next = flipped.length >= 2 ? [i] : flipped.concat(i);
    setFlipped(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (DECK[a].pair === DECK[b].pair) {
        const all = matched.concat(DECK[a].pair);
        setMatched(all);
        setFlipped([]);
        if (all.length >= PAIR_COUNT) {
          clearInterval(clock.current);
          setTimeout(() => setPopup('complete'), 520);
        }
      } else {
        setBusy(true);
        setTimeout(() => { setFlipped([]); setBusy(false); }, 750);
      }
    }
  };

  const useHint = () => {
    if (hints <= 0) { setShowHintPopup(true); return; }
    const idx = DECK.findIndex((c, i) => !matched.includes(c.pair) && !flipped.includes(i));
    if (idx < 0) return;
    setHints(h => h - 1);
    setMatched(m => m.concat(DECK[idx].pair));
    setFlipped([]);
  };

  const retry = () => {
    setFlipped([]); setMatched([]); setBusy(false); setPopup(null); setSeconds(ROUND_SECONDS);
    startClock();
  };

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
        <Text style={styles.progress}>{matched.length}/{PAIR_COUNT}</Text>
      </View>

      <Text style={styles.timer}>{timeLabel}</Text>

      <View style={styles.headerRight}>
        <TouchableOpacity accessibilityLabel="Hint" onPress={useHint} style={[styles.circleBtn, { backgroundColor: AMBER }]}>
          <HintIcon />
        </TouchableOpacity>
        <View style={styles.badge}><Text style={styles.badgeText}>{hints}</Text></View>
      </View>

      <View style={styles.grid}>
        {DECK.map((c, i) => (
          <Card
            key={i}
            cardColor={cardColor}
            card={{ ...c, open: matched.includes(c.pair) || flipped.includes(i) }}
            onPress={() => flip(i)}
          />
        ))}
      </View>

      {matched.length < PAIR_COUNT && <Text style={styles.tip}>Tap two cards to find a matching pair</Text>}

      {/* ---- Out of hints ---------------------------------------------- */}
      {showHintPopup && (
        <View style={styles.overlayDark}>
          <View style={styles.hintCard}>
            <TouchableOpacity accessibilityLabel="Close" onPress={() => setShowHintPopup(false)} style={styles.closeRound}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path fill="none" stroke="#4a5a52" strokeWidth={3.2} strokeLinecap="round" d="M5 5 L19 19 M19 5 L5 19" />
              </Svg>
            </TouchableOpacity>

            <View style={[styles.iconCircle, { backgroundColor: AMBER, marginBottom: 12 }]}><HintIcon size={32} /></View>
            <Text style={styles.hintTitle}>Out of Hints</Text>
            <Text style={styles.hintBody}>Get more hints to keep going</Text>

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

      {/* ---- Time's Up ------------------------------------------------- */}
      {popup === 'timesup' && (
        <View style={styles.overlayModal}>
          <View style={[styles.modalCard, { width: 320, paddingTop: 26, paddingBottom: 22 }]}>
            <View style={[styles.iconCircle, styles.iconCircleRed]}><ClockIcon /></View>
            <Text style={styles.modalTitle}>Time's Up</Text>
            <Text style={[styles.modalBody, { marginBottom: 22 }]}>You found {matched.length} of {PAIR_COUNT} pairs</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity onPress={onOpenLevels} accessibilityLabel="Back to Levels" style={styles.secondaryBtn}>
                <GridIcon />
                <Text style={styles.secondaryLabel}>Levels</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={retry} style={styles.heroBtn}>
                <RetryIcon />
                <Text style={styles.heroLabel}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ---- Level Completed ------------------------------------------ */}
      {popup === 'complete' && (
        <View style={styles.overlayModal}>
          <View style={[styles.modalCard, { width: 340, paddingTop: 30, paddingBottom: 24 }]}>
            <View style={[styles.iconCircle, styles.iconCircleAmber]}><StarIcon size={32} /></View>
            <Text style={styles.modalTitle}>Level Completed</Text>
            <Text style={styles.modalBody}>All {PAIR_COUNT} pairs found with {seconds}s left</Text>

            <View style={styles.starRow}>
              <StarIcon size={38} />
              <StarIcon size={46} />
              <StarIcon size={38} color="#e6ebe8" />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity onPress={onOpenLevels} accessibilityLabel="Back to Levels" style={styles.secondaryBtn}>
                <GridIcon />
                <Text style={styles.secondaryLabel}>Levels</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onNextLevel} style={styles.heroBtn}>
                <Text style={styles.heroLabel}>Play Next Level</Text>
                <PlayIcon />
              </TouchableOpacity>
            </View>
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
  headerRight: { position: 'absolute', top: 18, right: 18, zIndex: 6 },
  circleBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.15)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  progress: { marginLeft: 12, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 20, color: '#ffffff' },
  timer: { position: 'absolute', top: 24, left: 0, width: 874, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: '700', fontSize: 22, color: '#ffffff' },
  badge: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontWeight: '700', fontSize: 12, fontFamily: 'Fredoka' },

  grid: { position: 'absolute', top: 82, left: 259, width: 384, flexDirection: 'row', flexWrap: 'wrap' },
  cardSlot: { width: 118, height: 114, marginRight: 18, marginBottom: 12 },
  cardFace: {
    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backfaceVisibility: 'hidden',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  cardFaceUp: { backgroundColor: '#ffffff', shadowColor: 'rgba(0,0,0,0.14)', padding: 12 },
  ring: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.15)' },
  ringOuter: { width: 96, height: 96, borderRadius: 48 },
  ringInner: { width: 64, height: 64, borderRadius: 32 },
  question: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 44, color: '#f3e3c8' },
  art: { width: '100%', height: '100%' },
  cardLabel: { position: 'absolute', bottom: 8, fontFamily: 'Fredoka', fontWeight: '600', fontSize: 11, color: '#8a9a92' },

  tip: { position: 'absolute', top: 340, left: 0, width: 874, textAlign: 'center', color: '#ffffff', fontFamily: 'Fredoka', fontWeight: '600', fontSize: 14, opacity: 0.85 },

  overlayDark: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,20,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  overlayModal: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,18,36,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 22 },

  hintCard: { width: 306, backgroundColor: '#ffffff', borderRadius: 28, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24, alignItems: 'center' },
  closeRound: { position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  hintTitle: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 20, color: '#1f3d2b', marginBottom: 4 },
  hintBody: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: 14, color: '#4a5a52', marginBottom: 20 },
  shopBtn: {
    height: 58, borderRadius: 18, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  shopLabel: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 16, color: '#ffffff' },
  shopPrice: { fontFamily: 'Fredoka', fontWeight: '800', fontSize: 15, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },

  modalCard: {
    backgroundColor: '#ffffff', borderRadius: 32, paddingHorizontal: 26,
    shadowColor: 'rgba(0,0,0,0.35)', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 1, shadowRadius: 48, elevation: 12,
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  iconCircleRed: { backgroundColor: '#fde3e6', shadowColor: 'rgba(200,60,80,0.32)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  iconCircleAmber: { backgroundColor: '#fdead9', shadowColor: 'rgba(210,120,40,0.35)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  modalTitle: { textAlign: 'center', fontFamily: 'Fredoka', fontWeight: '700', fontSize: 21, color: INK, marginBottom: 6 },
  modalBody: { textAlign: 'center', fontFamily: 'Fredoka', fontWeight: '500', fontSize: 14, lineHeight: 20, color: MUTED, marginBottom: 18 },
  starRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },

  btnRow: { flexDirection: 'row', alignItems: 'stretch' },
  secondaryBtn: {
    width: 104, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: '#e3e8ec', backgroundColor: '#ffffff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  secondaryLabel: { marginLeft: 7, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 14, color: '#5b6b78' },
  heroBtn: {
    flex: 1, marginLeft: 10, paddingVertical: 18, borderRadius: 18, backgroundColor: GREEN,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN_DARK, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  heroLabel: { marginHorizontal: 9, fontFamily: 'Fredoka', fontWeight: '700', fontSize: 17, color: '#ffffff' },
});
