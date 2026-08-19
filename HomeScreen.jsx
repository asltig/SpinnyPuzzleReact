import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  Easing,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import heroIcon from './assets/spinny-puzzle-icon.png';

const TEAL = '#5cc2df';
const MUTED_GREY = '#b9c4c9';
const BG_BLUE = '#3fa9d1';
const ORANGE = '#e08a3f'; // oklch(0.72 0.16 48) approximation
const ORANGE_DARK = '#b8672a'; // oklch(0.58 0.15 48) approximation
const PURPLE = '#9a5cc9'; // oklch(0.72 0.16 300) approximation
const PURPLE_DARK = '#7a3fa3'; // oklch(0.58 0.15 300) approximation

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Chinese'];

const HOLD_DURATION = 1100;

function GearIcon({ color = '#fff', size = 42 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
      />
    </Svg>
  );
}

function SoundIcon({ color = '#fff', size = 34, muted = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M3,9v6h4l5,5V4L7,9H3z M16.5,12c0,-1.77,-1.02,-3.29,-2.5,-4.03v8.05C15.48,15.29,16.5,13.77,16.5,12z M14,3.23v2.06c2.89,0.86,5,3.54,5,6.71s-2.11,5.85,-5,6.71v2.06c4.01,-0.91,7,-4.49,7,-8.77S18.01,4.14,14,3.23z"
      />
      {muted ? <Line x1="2" y1="22" x2="22" y2="2" stroke={color} strokeWidth="2.5" /> : null}
    </Svg>
  );
}

function MusicIcon({ color = '#fff', size = 30, muted = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12,3v10.55c-0.59,-0.34,-1.27,-0.55,-2,-0.55c-2.21,0,-4,1.79,-4,4s1.79,4,4,4s4,-1.79,4,-4V7h4V3H12z"
      />
      {muted ? <Line x1="2" y1="22" x2="22" y2="2" stroke={color} strokeWidth="2.5" /> : null}
    </Svg>
  );
}

function GlobeIcon({ color = '#fff', size = 32 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M11.99,2C6.47,2,2,6.48,2,12s4.47,10,9.99,10C17.52,22,22,17.52,22,12S17.52,2,11.99,2z M18.92,8h-2.95c-0.32,-1.25,-0.78,-2.45,-1.38,-3.56C16.19,5.08,17.79,6.34,18.92,8z M12,4.04c0.83,1.2,1.48,2.53,1.91,3.96h-3.82C10.52,6.57,11.17,5.24,12,4.04z M4.26,14C4.1,13.36,4,12.69,4,12s0.1,-1.36,0.26,-2h3.38C7.55,10.66,7.5,11.33,7.5,12s0.05,1.34,0.14,2H4.26z M5.08,16h2.95c0.32,1.25,0.78,2.45,1.38,3.56C7.81,18.92,6.21,17.66,5.08,16z M8.03,8H5.08c1.13,-1.66,2.73,-2.92,4.33,-3.56C8.81,5.55,8.35,6.75,8.03,8z M12,19.96c-0.83,-1.2,-1.48,-2.53,-1.91,-3.96h3.82C13.48,17.43,12.83,18.76,12,19.96z M14.34,14H9.66c-0.1,-0.66,-0.16,-1.33,-0.16,-2s0.06,-1.35,0.16,-2h4.68c0.1,0.65,0.16,1.32,0.16,2S14.44,13.34,14.34,14z M14.59,19.56c0.6,-1.11,1.06,-2.31,1.38,-3.56h2.95C17.79,17.65,16.21,18.92,14.59,19.56z M16.36,14c0.09,-0.66,0.14,-1.33,0.14,-2s-0.05,-1.34,-0.14,-2h3.38c0.16,0.64,0.26,1.31,0.26,2s-0.1,1.36,-0.26,2H16.36z"
      />
    </Svg>
  );
}

function LockIcon({ color = '#fff', size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10 C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

function StarIcon({ color = ORANGE, size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z"
      />
    </Svg>
  );
}

function CloseIcon({ color = '#7a8a99', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12z"
      />
    </Svg>
  );
}

const SECONDARY_TILES_LEFT = [
  { name: 'Memory Match', bg: '#cfe8d8', caption: 'shark illustration' },
  { name: 'Patch Work', bg: '#bfe3f7', caption: 'plane illustration' },
];
const SECONDARY_TILES_RIGHT = [
  { name: 'Jigsaw Puzzle', bg: '#3a2e44', caption: 'puzzle piece illustration', dark: true },
  { name: 'oNet Connect', bg: '#8fd0c9', caption: 'animals illustration' },
];

function GameTile({ tile }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: 84, height: 84, borderRadius: 20, backgroundColor: '#fff', padding: 4, elevation: 5 }}>
        <View style={{ flex: 1, borderRadius: 16, backgroundColor: tile.bg }} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [adsPopupOpen, setAdsPopupOpen] = useState(false);
  const [toast, setToast] = useState('');

  const heroAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(0)).current;
  const gearAnim = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);
  const holdAnimRef = useRef(null);

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: settingsOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    Animated.timing(gearAnim, {
      toValue: settingsOpen ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [settingsOpen]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(heroAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 2200);
  };

  const startHold = () => {
    holdAnim.setValue(0);
    holdAnimRef.current = Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holdAnimRef.current.start(({ finished }) => {
      if (finished) setAdsPopupOpen(true);
    });
  };

  const cancelHold = () => {
    if (holdAnimRef.current) holdAnimRef.current.stop();
    holdAnim.setValue(0);
  };

  const gearRotate = gearAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '75deg'] });
  const panelOpacity = panelAnim;
  const panelTranslate = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const panelScale = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const ringStrokeDashoffset = holdAnim.interpolate({ inputRange: [0, 1], outputRange: [226, 0] });
  const toastTranslate = toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const heroScale = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const heroRotate = heroAnim.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <View style={styles.root}>
      {/* decorative bubbles */}
      <View style={[styles.bubble, { top: 60, left: 120, width: 120, height: 120 }]} />
      <View style={[styles.bubble, { top: 520, left: 60, width: 60, height: 60 }]} />
      <View style={[styles.bubble, { top: 180, right: 100, width: 40, height: 40 }]} />
      <View style={[styles.bubble, { top: 760, right: 300, width: 90, height: 90 }]} />

      {/* Settings cluster */}
      <View style={styles.settingsCluster}>
        <TouchableOpacity
          onPress={() => setSettingsOpen((v) => !v)}
          accessibilityLabel="Settings"
          style={[styles.circleBtn, { width: 88, height: 88, backgroundColor: settingsOpen ? '#3a92ad' : TEAL }]}
        >
          <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
            <GearIcon />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View
          pointerEvents={settingsOpen ? 'auto' : 'none'}
          style={[
            styles.expandRow,
            {
              opacity: panelOpacity,
              transform: [{ translateX: panelTranslate }, { scale: panelScale }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setSoundOn((v) => !v)}
            accessibilityLabel="Sound"
            style={[styles.circleBtn, { width: 76, height: 76, backgroundColor: soundOn ? TEAL : MUTED_GREY }]}
          >
            <SoundIcon muted={!soundOn} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMusicOn((v) => !v)}
            accessibilityLabel="Music"
            style={[styles.circleBtn, { width: 76, height: 76, backgroundColor: musicOn ? TEAL : MUTED_GREY }]}
          >
            <MusicIcon muted={!musicOn} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLanguageOpen(true)}
            accessibilityLabel="Language"
            style={[styles.circleBtn, { width: 76, height: 76, backgroundColor: '#5cc2df' }]}
          >
            <GlobeIcon />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Ads / Rate cluster */}
      <View style={styles.utilityCluster}>
        <View style={{ width: 88, height: 88 }}>
          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            accessibilityLabel="Remove Ads"
            style={[styles.circleBtn, { width: 88, height: 88, backgroundColor: PURPLE }]}
          >
            <LockIcon />
          </Pressable>
          <Svg
            width={88}
            height={88}
            viewBox="0 0 88 88"
            style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}
            pointerEvents="none"
          >
            <AnimatedCircle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="#ffffff"
              strokeWidth={6}
              strokeDasharray={226}
              strokeDashoffset={ringStrokeDashoffset}
            />
          </Svg>
        </View>

        <TouchableOpacity
          onPress={() => { setRatingValue(0); setRatingOpen(true); }}
          accessibilityLabel="Rate App"
          style={[styles.circleBtn, { width: 88, height: 88, backgroundColor: '#ffffff' }]}
        >
          <StarIcon />
        </TouchableOpacity>
      </View>

      {/* Game tiles: podium row, Spinny Puzzle as hero */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        {SECONDARY_TILES_LEFT.map((tile) => (
          <GameTile key={tile.name} tile={tile} />
        ))}
        <Animated.Image
          source={heroIcon}
          resizeMode="contain"
          style={{
            width: 300,
            height: 300,
            marginTop: -24,
            transform: [{ scale: heroScale }, { rotate: heroRotate }],
          }}
        />
        {SECONDARY_TILES_RIGHT.map((tile) => (
          <GameTile key={tile.name} tile={tile} />
        ))}
      </View>

      {/* Language picker modal */}
      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setLanguageOpen(false)} style={styles.closeBtn} accessibilityLabel="Close">
              <CloseIcon />
            </TouchableOpacity>
            <View style={[styles.ratingBadge, { backgroundColor: '#e6f6fa', shadowColor: '#3fa9c4', alignSelf: 'center' }]}>
              <GlobeIcon color={TEAL} size={30} />
            </View>
            <Text style={[styles.ratingTitle, { marginBottom: 18 }]}>Choose Language</Text>
            {LANGUAGES.map((lang) => {
              const selected = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => {
                    setLanguage(lang);
                    setLanguageOpen(false);
                  }}
                  style={[styles.langRow, { backgroundColor: selected ? TEAL : '#f4f7f8' }]}
                >
                  <Text style={[styles.langText, { color: selected ? '#ffffff' : '#2c3e50' }]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Remove Ads popup */}
      <Modal visible={adsPopupOpen} transparent animationType="fade" onRequestClose={() => setAdsPopupOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.ratingCard}>
            <TouchableOpacity onPress={() => setAdsPopupOpen(false)} style={styles.closeBtn} accessibilityLabel="Close">
              <CloseIcon />
            </TouchableOpacity>
            <View style={[styles.ratingBadge, { backgroundColor: '#f3e9fb', shadowColor: '#8c5ac0' }]}>
              <LockIcon color={PURPLE} size={30} />
            </View>
            <Text style={styles.ratingTitle}>Remove Ads Forever</Text>
            <Text style={styles.ratingSubtitle}>No interruptions between games — just uninterrupted play time.</Text>
            <Text style={styles.priceText}>$4.99 <Text style={styles.priceUnit}>one-time</Text></Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setAdsPopupOpen(false)} style={styles.notNowBtn}>
                <Text style={styles.notNowText}>Maybe later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setAdsPopupOpen(false); showToast('Ads removed. Thank you!'); }}
                style={[styles.submitBtn, { backgroundColor: PURPLE }]}
              >
                <Text style={styles.submitText}>Remove Ads</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => showToast('No previous purchases found.')} style={{ marginTop: 14 }}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rate us modal */}
      <Modal visible={ratingOpen} transparent animationType="fade" onRequestClose={() => setRatingOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.ratingCard}>
            <TouchableOpacity onPress={() => setRatingOpen(false)} style={styles.closeBtn} accessibilityLabel="Close">
              <CloseIcon />
            </TouchableOpacity>
            <View style={styles.ratingBadge}>
              <StarIcon size={32} />
            </View>
            <Text style={styles.ratingTitle}>Enjoying the game?</Text>
            <Text style={styles.ratingSubtitle}>Tap a star to rate us on the App Store</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((v) => (
                <TouchableOpacity key={v} onPress={() => setRatingValue(v)} accessibilityLabel={`Rate ${v} stars`}>
                  <StarIcon size={42} color={v <= ratingValue ? ORANGE : '#dfe4e8'} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setRatingOpen(false)} style={styles.notNowBtn}>
                <Text style={styles.notNowText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!ratingValue}
                onPress={() => { setRatingOpen(false); showToast('Thanks for rating us!'); }}
                style={[styles.submitBtn, { backgroundColor: ratingValue ? ORANGE : '#c7ccd1' }]}
              >
                <Text style={styles.submitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastAnim, transform: [{ translateY: toastTranslate }] },
          ]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BLUE },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  settingsCluster: { position: 'absolute', top: 36, left: 24, flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 5 },
  utilityCluster: { position: 'absolute', top: 36, right: 24, flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 5 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  circleBtn: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,20,40,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: 320, backgroundColor: '#ffffff', borderRadius: 32, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#2c3e50' },
  closeBtn: {
    position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 999,
    backgroundColor: '#f2f4f6', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  langRow: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18, marginBottom: 10 },
  langText: { fontSize: 18, fontWeight: '600' },
  ratingCard: {
    width: 320, backgroundColor: '#ffffff', borderRadius: 32, padding: 26, alignItems: 'center', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 30, elevation: 14,
  },
  ratingBadge: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: '#fdead9', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: '#d27828', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  ratingTitle: { fontSize: 21, fontWeight: '700', color: '#2c3e50', marginBottom: 6, textAlign: 'center' },
  ratingSubtitle: { fontSize: 14, color: '#8a97a3', fontWeight: '500', marginBottom: 16, textAlign: 'center' },
  starRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  notNowBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: '#e3e8ec', backgroundColor: '#fff', alignItems: 'center' },
  notNowText: { color: '#5b6b78', fontWeight: '700', fontSize: 15 },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', elevation: 4 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  restoreText: { color: '#8a97a3', fontWeight: '600', fontSize: 13, textDecorationLine: 'underline' },
  priceText: { fontWeight: '700', fontSize: 26, color: '#2c3e50', marginBottom: 20, textAlign: 'center' },
  priceUnit: { fontSize: 14, color: '#8a97a3', fontWeight: '600' },
  toast: {
    position: 'absolute',
    bottom: 44,
    left: '50%',
    marginLeft: -140,
    width: 280,
    backgroundColor: '#2c3e50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
  },
  toastText: { color: '#ffffff', fontWeight: '600', fontSize: 16, textAlign: 'center' },
});
