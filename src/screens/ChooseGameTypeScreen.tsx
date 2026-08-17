/**
 * ChooseGameTypeScreen.tsx
 * Home screen — matches ChooseGameTypeVC from the iOS ObjC source.
 *
 * Layout: teal radial-gradient-like background, animated floating dots,
 * settings gear (top-left), rate/unlock buttons (top-right), and a 2-row
 * grid of game-type cards (row1: 2 cards, row2: 3 cards).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Dimensions,
  Animated,
  Easing,
  SafeAreaView,
  Platform,
  TextInput,
  Alert,
  Keyboard,
} from 'react-native';
import { expandCircle } from '../utils/circularReveal';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { useSettingsStore }             from '../stores/useSettingsStore';
import { useProgressStore }             from '../stores/useProgressStore';
import { getSpinnyPackagesWithLevels }  from '../services/data/levelLoader';
import { useGameStore }      from '../stores/useGameStore';
import { syncIfNeeded }      from '../services/api/syncService';
import { logAppOpen }        from '../services/analytics/analyticsService';
import { iapService }        from '../services/iap/iapService';
import { adsService }        from '../services/ads/adsService';
import { pushService }       from '../services/notifications/pushService';
import { soundService }      from '../services/audio/soundService';
import Svg, { Circle, Path, Line } from 'react-native-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseGameType'>;

// In landscape the long edge is always width; use screen (not window) to be safe.
const screen = Dimensions.get('screen');
const W = Math.max(screen.width, screen.height);
const H = Math.min(screen.width, screen.height);

// iOS: lblName.font = FredokaOne-Regular size 25*deviceScale, deviceScale = screenHeight/375
// In landscape H is the short edge (maps to iOS portrait screenHeight)
// ─── Game type descriptors (matches iOS arrGameTypes order) ──────────────────
const GAME_TYPES = [
  { name: 'Spinny Puzzle',  image: require('../assets/images/game1.png'), key: 'spinny'    },
  { name: 'Jigsaw Puzzle',  image: require('../assets/images/game2.png'), key: 'jigsaw'    },
  { name: 'Patch Work',     image: require('../assets/images/game3.png'), key: 'patchwork' },
  { name: 'Memory Match',   image: require('../assets/images/game4.png'), key: 'memory'    },
  { name: 'oNet Connect',   image: require('../assets/images/game5.png'), key: 'onet'      },
] as const;

// Background colors for each game — used as the circular reveal fill color
// so the expanding circle blends seamlessly into the destination screen.
const GAME_BG_COLORS: Record<string, string> = {
  spinny:    '#392635',
  jigsaw:    '#2C1A3A',
  patchwork: '#2E1A38',
  memory:    '#9FD555',
  onet:      '#9FD555',
};

// Tile fill colors matching HomeScreen.jsx TILE_ROWS
const TILE_COLORS: Record<string, { bg: string; dark?: boolean }> = {
  spinny:    { bg: '#f4d35e' },
  jigsaw:    { bg: '#3a2e44', dark: true },
  patchwork: { bg: '#bfe3f7' },
  memory:    { bg: '#cfe8d8' },
  onet:      { bg: '#8fd0c9' },
};

// ─── Floating dot config ─────────────────────────────────────────────────────
const DOT_COUNT = 18;
const DOT_COLORS = ['#7fd4e8', '#a8e3ef', '#c4edf5', '#5bbdd4', '#ffffff66'];

function makeDot(i: number) {
  const size = 6 + Math.random() * 14;
  return {
    id: i,
    size,
    x: Math.random() * W,
    y: Math.random() * H,
    color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
    duration: 3000 + Math.random() * 4000,
    delay: Math.random() * 3000,
  };
}
const DOTS = Array.from({ length: DOT_COUNT }, (_, i) => makeDot(i));

function FloatingDot({ dot }: { dot: ReturnType<typeof makeDot> }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dot.duration, delay: dot.delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dot.duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.8, 0.3] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        {
          width:  dot.size,
          height: dot.size,
          borderRadius: dot.size / 2,
          backgroundColor: dot.color,
          left: dot.x,
          top:  dot.y,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

// ─── Design tokens ───────────────────────────────────────────────────────────
const TEAL        = '#5cc2df';
const MUTED_GREY  = '#b9c4c9';
const PURPLE      = '#9a5cc9';
const ORANGE      = '#e08a3f';
const HOLD_DURATION = 1100;

// ─── Icons (from HomeScreen.jsx) ─────────────────────────────────────────────
function GearIcon({ size = 42, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
      />
    </Svg>
  );
}

function SoundIcon({ size = 34, muted = false, color = 'white' }: { size?: number; muted?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3,9v6h4l5,5V4L7,9H3z M16.5,12c0,-1.77,-1.02,-3.29,-2.5,-4.03v8.05C15.48,15.29,16.5,13.77,16.5,12z M14,3.23v2.06c2.89,0.86,5,3.54,5,6.71s-2.11,5.85,-5,6.71v2.06c4.01,-0.91,7,-4.49,7,-8.77S18.01,4.14,14,3.23z" />
      {muted && <Line x1="2" y1="22" x2="22" y2="2" stroke={color} strokeWidth="2.5" />}
    </Svg>
  );
}

function MusicIcon({ size = 30, muted = false, color = 'white' }: { size?: number; muted?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12,3v10.55c-0.59,-0.34,-1.27,-0.55,-2,-0.55c-2.21,0,-4,1.79,-4,4s1.79,4,4,4s4,-1.79,4,-4V7h4V3H12z" />
      {muted && <Line x1="2" y1="22" x2="22" y2="2" stroke={color} strokeWidth="2.5" />}
    </Svg>
  );
}

function GlobeIcon({ size = 32, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M11.99,2C6.47,2,2,6.48,2,12s4.47,10,9.99,10C17.52,22,22,17.52,22,12S17.52,2,11.99,2z M18.92,8h-2.95c-0.32,-1.25,-0.78,-2.45,-1.38,-3.56C16.19,5.08,17.79,6.34,18.92,8z M12,4.04c0.83,1.2,1.48,2.53,1.91,3.96h-3.82C10.52,6.57,11.17,5.24,12,4.04z M4.26,14C4.1,13.36,4,12.69,4,12s0.1,-1.36,0.26,-2h3.38C7.55,10.66,7.5,11.33,7.5,12s0.05,1.34,0.14,2H4.26z M5.08,16h2.95c0.32,1.25,0.78,2.45,1.38,3.56C7.81,18.92,6.21,17.66,5.08,16z M8.03,8H5.08c1.13,-1.66,2.73,-2.92,4.33,-3.56C8.81,5.55,8.35,6.75,8.03,8z M12,19.96c-0.83,-1.2,-1.48,-2.53,-1.91,-3.96h3.82C13.48,17.43,12.83,18.76,12,19.96z M14.34,14H9.66c-0.1,-0.66,-0.16,-1.33,-0.16,-2s0.06,-1.35,0.16,-2h4.68c0.1,0.65,0.16,1.32,0.16,2S14.44,13.34,14.34,14z M14.59,19.56c0.6,-1.11,1.06,-2.31,1.38,-3.56h2.95C17.79,17.65,16.21,18.92,14.59,19.56z M16.36,14c0.09,-0.66,0.14,-1.33,0.14,-2s-0.05,-1.34,-0.14,-2h3.38c0.16,0.64,0.26,1.31,0.26,2s-0.1,1.36,-0.26,2H16.36z" />
    </Svg>
  );
}

function LockIcon({ size = 36, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1s3.1,1.39,3.1,3.1V8z" />
    </Svg>
  );
}

function StarIcon({ size = 40, color = ORANGE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z" />
    </Svg>
  );
}

// ─── Settings cluster ────────────────────────────────────────────────────────
const GEAR_SIZE     = Math.round(H * 0.22);
const FAN_SIZE      = Math.round(H * 0.19);
const UTIL_SIZE     = Math.round(GEAR_SIZE * 0.5175);
const FAN_UTIL_SIZE = Math.round(FAN_SIZE  * 0.5175);
const BTN_GAP       = 14;

interface SettingsMenuProps {
  onLanguage: () => void;
}

function SettingsMenu({ onLanguage }: SettingsMenuProps) {
  const { isMusicOn, isSoundOn, setMusicOn, setSoundOn } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const rotAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(panelAnim, {
        toValue:         open ? 1 : 0,
        duration:        220,
        easing:          Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(rotAnim, {
        toValue:         open ? 1 : 0,
        duration:        260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const gearRotate     = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '75deg'] });
  const panelOpacity   = panelAnim;
  const panelTranslate = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const panelScale     = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  const gearIconSize = Math.round(UTIL_SIZE     * 0.48);
  const fanIconSize  = Math.round(FAN_UTIL_SIZE * 0.46);

  return (
    <View style={smStyles.root} pointerEvents="box-none">
      {/* Gear button */}
      <TouchableOpacity
        onPress={() => {
          soundService.play('settings_show_hide');
          if (!open) soundService.play('settings_buttons_appear');
          setOpen(v => !v);
        }}
        activeOpacity={0.85}
        style={[smStyles.gearBtn, { backgroundColor: open ? '#3a92ad' : TEAL }]}
      >
        <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
          <GearIcon size={gearIconSize} />
        </Animated.View>
      </TouchableOpacity>

      {/* Fan buttons — slide in as a horizontal row */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          smStyles.expandRow,
          {
            opacity:   panelOpacity,
            transform: [{ translateX: panelTranslate }, { scale: panelScale }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => { soundService.play('button_click'); setSoundOn(!isSoundOn); }}
          activeOpacity={0.75}
          style={[smStyles.fanBtn, { backgroundColor: isSoundOn ? TEAL : MUTED_GREY }]}
        >
          <SoundIcon size={fanIconSize} muted={!isSoundOn} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { soundService.play('button_click'); setMusicOn(!isMusicOn); }}
          activeOpacity={0.75}
          style={[smStyles.fanBtn, { backgroundColor: isMusicOn ? TEAL : MUTED_GREY }]}
        >
          <MusicIcon size={fanIconSize} muted={!isMusicOn} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setOpen(false); onLanguage(); }}
          activeOpacity={0.75}
          style={[smStyles.fanBtn, { backgroundColor: TEAL }]}
        >
          <GlobeIcon size={fanIconSize} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const smStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           BTN_GAP,
    overflow:      'visible',
  },
  gearBtn: {
    width:          UTIL_SIZE,
    height:         UTIL_SIZE,
    borderRadius:   UTIL_SIZE / 2,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           BTN_GAP,
  },
  fanBtn: {
    width:          FAN_UTIL_SIZE,
    height:         FAN_UTIL_SIZE,
    borderRadius:   FAN_UTIL_SIZE / 2,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
});

// ─── Game card ───────────────────────────────────────────────────────────────
// Both rows must fit inside H minus the top bar and safe-area insets.
// Top bar ≈ BTN_R*2 + 8pt margin. Safe area ≈ 16pt.
// Available for 2 rows + 3 × rowMargin(4pt) ≈ H - BTN_R*2 - 24 - 24 = H - BTN_R*2 - 48
const CARD_H = Math.floor((H - GEAR_SIZE - 44) / 2);
const CARD_W = CARD_H * 0.92;

function GameCard({
  item,
  onPress,
  available,
}: {
  item: (typeof GAME_TYPES)[number];
  onPress: (cx: number, cy: number) => void;
  available: boolean;
}) {
  const scale   = useRef(new Animated.Value(1)).current;
  const viewRef = useRef<any>(null);

  const handlePress = () => {
    const startAnim = () => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.92, duration: 80,  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    };
    if (viewRef.current) {
      viewRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        startAnim();
        onPress(x + w / 2, y + h / 2);
      });
    } else {
      startAnim();
      onPress(W / 2, H / 2);
    }
  };

  const tileColor = TILE_COLORS[item.key] ?? { bg: '#5cc2df' };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} disabled={!available} style={styles.cardWrapper}>
      {/* White outer tile */}
      <Animated.View ref={viewRef} style={[styles.tile, { transform: [{ scale }] }, !available && styles.cardDimmed]}>
        {/* Colored inner area with game image */}
        <View style={[styles.tileInner, { backgroundColor: tileColor.bg }]}>
          <Image source={item.image} style={styles.tileImg} resizeMode="contain" />
        </View>
        {!available && (
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>Soon</Text>
          </View>
        )}
      </Animated.View>
      {/* Label pill below tile */}
      <View style={styles.labelPill}>
        <Text style={styles.labelText} numberOfLines={1}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Ring dimensions for hold-to-unlock parental gate
const RING_R    = UTIL_SIZE / 2 - 3;
const RING_CIRC = Math.round(2 * Math.PI * RING_R);

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChooseGameTypeScreen({ navigation }: Props): React.JSX.Element {
  const { hydrate: hydrateSettings } = useSettingsStore();
  const { hydrate: hydrateProgress } = useProgressStore();
  const { setGameType } = useGameStore();

  // ── Debug: set Spinny completed level count (DEV only) ───────────────────
  const [debugCount, setDebugCount] = useState('0');
  const { reset, markCompleted, setLevelStars } = useProgressStore();
  const applyDebugCount = useCallback(async () => {
    Keyboard.dismiss();
    const n = parseInt(debugCount, 10);
    if (isNaN(n) || n < 0) { Alert.alert('Invalid number'); return; }
    reset();
    const pkgs = getSpinnyPackagesWithLevels();
    let remaining = n;
    for (const pkg of pkgs) {
      for (const lvl of pkg.levels) {
        if (remaining <= 0) break;
        await markCompleted(pkg.package.name, lvl.name);
        setLevelStars(pkg.package.name, lvl.name, 1);
        remaining--;
      }
      if (remaining <= 0) break;
    }
    Alert.alert('Done', `Set ${n} Spinny levels as completed`);
  }, [debugCount, reset, markCompleted, setLevelStars]);

  // Hold-to-unlock parental gate for Remove Ads
  const holdAnim    = useRef(new Animated.Value(0)).current;
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [ringOffset, setRingOffset] = useState(RING_CIRC);

  // Drive the SVG ring via state so it always updates regardless of SVG animated-prop support
  useEffect(() => {
    const id = holdAnim.addListener(({ value }) => {
      setRingOffset(Math.round(RING_CIRC * (1 - value)));
    });
    return () => holdAnim.removeListener(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startHold = () => {
    holdAnim.setValue(0);
    holdAnimRef.current = Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holdAnimRef.current.start(({ finished }) => {
      if (finished) navigation.navigate('IAP', { packageName: 'remove_ads' });
    });
  };

  const cancelHold = () => {
    if (holdAnimRef.current) holdAnimRef.current.stop();
    holdAnim.setValue(0);
  };

  useEffect(() => {
    (async () => {
      hydrateSettings();
      hydrateProgress();
      await iapService.init();
      adsService.loadAds();
      await pushService.register();
      await soundService.loadAll();
      soundService.playMusic('menu_music');
      void syncIfNeeded();
      void logAppOpen();
    })().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume MenuMusic whenever this screen comes into focus (e.g. after returning from a game).
  useFocusEffect(
    useCallback(() => {
      soundService.playMusic('menu_music');
    }, []),
  );

  const navigate = (key: string, cx: number, cy: number) => {
    soundService.play('transition_in');
    const color = GAME_BG_COLORS[key] ?? '#392635';

    // Navigate inside onComplete — the circle must fully cover the screen before
    // we switch screens, so ChooseGameType stays visible in the background
    // during the entire expand animation (matching the original iOS behavior).
    expandCircle(cx, cy, color, () => {
      switch (key) {
        case 'spinny':
          setGameType('spinny');
          navigation.navigate('SpinnyStack');
          break;
        case 'jigsaw':
          setGameType('jigsaw');
          navigation.navigate('JigsawStack');
          break;
        case 'patchwork':
          setGameType('patchwork');
          navigation.navigate('PatchworkStack');
          break;
        case 'memory':
          navigation.navigate('MemoryStack');
          break;
        case 'onet':
          navigation.navigate('OnetStack');
          break;
        default:
          break;
      }
    });
  };

  const navigable = new Set(['spinny', 'jigsaw', 'patchwork', 'memory', 'onet']);
  const row1 = GAME_TYPES.slice(0, 2);
  const row2 = GAME_TYPES.slice(2, 5);

  return (
    <View style={styles.root}>
      {/* Background dots */}
      {DOTS.map(d => <FloatingDot key={d.id} dot={d} />)}

      <SafeAreaView style={styles.safe}>
        {/* Cards area — rendered first so absolutely-positioned clusters sit on top */}
        <View style={styles.cardsArea}>
          {/* Row 1 — 2 cards centred */}
          <View style={styles.row}>
            {row1.map(item => (
              <GameCard
                key={item.key}
                item={item}
                available={navigable.has(item.key)}
                onPress={(cx, cy) => navigate(item.key, cx, cy)}
              />
            ))}
          </View>

          {/* Row 2 — 3 cards centred */}
          <View style={styles.row}>
            {row2.map(item => (
              <GameCard
                key={item.key}
                item={item}
                available={navigable.has(item.key)}
                onPress={(cx, cy) => navigate(item.key, cx, cy)}
              />
            ))}
          </View>
        </View>

        {/* Settings cluster — absolute top-left, rendered after cards to receive touches */}
        <View style={styles.settingsCluster}>
          <SettingsMenu onLanguage={() => navigation.navigate('Language')} />
        </View>

        {/* Utility cluster — absolute top-right, rendered after cards to receive touches */}
        <View style={styles.utilityCluster}>
          {/* Remove Ads — hold-to-unlock parental gate */}
          <View style={{ width: UTIL_SIZE, height: UTIL_SIZE }}>
            <Pressable
              onPressIn={startHold}
              onPressOut={cancelHold}
              accessibilityLabel="Remove Ads"
              style={[styles.topBtn, styles.topBtnPurple]}
            >
              <LockIcon size={Math.round(UTIL_SIZE * 0.41)} />
            </Pressable>
            {/* Wrap in View so pointerEvents="none" is handled by RN, not SVG */}
            <View
              style={{ position: 'absolute', top: 0, left: 0 }}
              pointerEvents="none"
            >
              <Svg
                width={UTIL_SIZE}
                height={UTIL_SIZE}
                viewBox={`0 0 ${UTIL_SIZE} ${UTIL_SIZE}`}
                style={{ transform: [{ rotate: '-90deg' }] }}
              >
                <Circle
                  cx={UTIL_SIZE / 2}
                  cy={UTIL_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                />
              </Svg>
            </View>
          </View>
          <TouchableOpacity style={[styles.topBtn, styles.topBtnWhite]} onPress={() => navigation.navigate('RateUs')}>
            <StarIcon size={Math.round(UTIL_SIZE * 0.46)} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── DEV-only: set completed Spinny level count ── */}
      {__DEV__ ? (
        <View style={dbgStyles.bar}>
          <Text style={dbgStyles.label}>Spinny completed:</Text>
          <TextInput
            style={dbgStyles.input}
            value={debugCount}
            onChangeText={setDebugCount}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={applyDebugCount}
            selectTextOnFocus
          />
          <TouchableOpacity style={dbgStyles.btn} onPress={applyDebugCount}>
            <Text style={dbgStyles.btnText}>Set</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const BG = '#51adcf';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },

  // dots
  dot: {
    position: 'absolute',
  },

  // button clusters — absolutely positioned so they float above cards
  settingsCluster: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 20 : 12,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BTN_GAP,
    zIndex: 20,
    overflow: 'visible',
  },
  utilityCluster: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 20 : 12,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BTN_GAP,
    zIndex: 20,
  },
  topBtn: {
    width:          UTIL_SIZE,
    height:         UTIL_SIZE,
    borderRadius:   UTIL_SIZE / 2,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
  topBtnPurple: {
    backgroundColor: PURPLE,
  },
  topBtnWhite: {
    backgroundColor: '#ffffff',
  },

  // cards area — fills remaining space and centres rows vertically
  cardsArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: UTIL_SIZE + 8,
  },

  // card rows
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 16,
    marginVertical: 4,
  },

  // tile (HomeScreen.jsx style: white outer + colored inner)
  cardWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  tileInner: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImg: {
    width: CARD_W * 0.78,
    height: CARD_W * 0.78,
  },
  cardDimmed: {
    opacity: 0.55,
  },
  labelPill: {
    backgroundColor: 'rgba(9,54,77,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  soonBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  soonText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});

const dbgStyles = StyleSheet.create({
  bar: {
    position:        'absolute',
    bottom:          8,
    left:            12,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical:   5,
    zIndex:          999,
  },
  label: { color: '#fff', fontSize: 11, fontWeight: '600' },
  input: {
    width:           40,
    color:           '#fff',
    fontSize:        13,
    fontWeight:      '700',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
    textAlign:       'center',
    paddingVertical: 0,
  },
  btn: {
    backgroundColor: '#f9d84f',
    borderRadius:    9,
    paddingHorizontal: 18,
    paddingVertical:   9,
  },
  btnText: { color: '#333', fontSize: 15, fontWeight: '700' },
});