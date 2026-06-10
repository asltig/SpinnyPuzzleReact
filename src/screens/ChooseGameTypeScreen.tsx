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
  Image,
  Dimensions,
  Animated,
  SafeAreaView,
  Platform,
} from 'react-native';
import { expandCircle } from '../utils/circularReveal';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

import { useSettingsStore }  from '../stores/useSettingsStore';
import { useProgressStore }  from '../stores/useProgressStore';
import { useGameStore }      from '../stores/useGameStore';
import { syncIfNeeded }      from '../services/api/syncService';
import { logAppOpen }        from '../services/analytics/analyticsService';
import { iapService }        from '../services/iap/iapService';
import { adsService }        from '../services/ads/adsService';
import { pushService }       from '../services/notifications/pushService';
import { soundService }      from '../services/audio/soundService';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseGameType'>;

// In landscape the long edge is always width; use screen (not window) to be safe.
const screen = Dimensions.get('screen');
const W = Math.max(screen.width, screen.height);
const H = Math.min(screen.width, screen.height);

// iOS: lblName.font = FredokaOne-Regular size 25*deviceScale, deviceScale = screenHeight/375
// In landscape H is the short edge (maps to iOS portrait screenHeight)
const LABEL_FONT_SIZE = 25 * (H / 375);

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

// ─── Settings fan-out menu ───────────────────────────────────────────────────
// Mirrors SettingsAnimationManager: 3 buttons fan out from the gear in a
// quarter-circle arc (startDegree -90°, sweeping +90° → ends pointing right).
// In landscape the gear sits top-left, so buttons fan down and to the right.

// iOS ChooseGameTypeVC uses startDegree=0, layoutDegree=π/2:
//   buttons fan from 0° (right) sweeping to 90° (down).
// Gear sits top-left → this fans items to the right and downward, always on-screen.
const BTN_R      = Math.round(H * 0.055);   // half the gear button diameter
const FAN_BTN_R  = Math.round(H * 0.048);   // half each fan button diameter
const FAN_R      = Math.round(H * 0.145);   // orbit radius from gear centre
const FAN_ANGLES = [0, Math.PI / 4, Math.PI / 2] as const; // 0°, 45°, 90°

interface SettingsMenuProps {
  onLanguage: () => void;
}

function SettingsMenu({ onLanguage }: SettingsMenuProps) {
  const { isMusicOn, isSoundOn, setMusicOn, setSoundOn } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(anim,    { toValue, useNativeDriver: true, bounciness: 10 }),
      Animated.timing(rotAnim, { toValue, duration: 250, useNativeDriver: true }),
    ]).start();
    setOpen(!open);
  };

  const close = () => {
    Animated.parallel([
      Animated.timing(anim,    { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(rotAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const gearRotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const ITEMS = [
    {
      key:    'language',
      img:    require('../assets/images/btnLanguage.png'),
      onPress: () => { close(); onLanguage(); },
    },
    {
      key:    'music',
      img:    isMusicOn
        ? require('../assets/images/btnMusic.png')
        : require('../assets/images/btnMusicMuted.png'),
      onPress: () => setMusicOn(!isMusicOn),
    },
    {
      key:    'sound',
      img:    isSoundOn
        ? require('../assets/images/btnSound.png')
        : require('../assets/images/btnSoundMuted.png'),
      onPress: () => setSoundOn(!isSoundOn),
    },
  ] as const;

  return (
    <View style={smStyles.root} pointerEvents="box-none">
      {/* Invisible backdrop to close menu on outside tap */}
      {open && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={close}
        />
      )}

      {/* Fan buttons */}
      {ITEMS.map((item, idx) => {
        const angle  = FAN_ANGLES[idx]!;
        const tx     = Math.cos(angle) * FAN_R;
        const ty     = Math.sin(angle) * FAN_R;
        const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, tx] });
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, ty] });
        const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
        const scale      = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

        return (
          <Animated.View
            key={item.key}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              smStyles.fanBtn,
              { transform: [{ translateX }, { translateY }, { scale }], opacity },
            ]}
          >
            <TouchableOpacity onPress={item.onPress} activeOpacity={0.75} style={smStyles.fanBtnInner}>
              <Image source={item.img} style={smStyles.fanIcon} resizeMode="contain" />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Center gear button */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={smStyles.centerBtn}>
        <Animated.Image
          source={require('../assets/images/green_settings.png')}
          style={[smStyles.centerIcon, { transform: [{ rotate: gearRotate }] }]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const smStyles = StyleSheet.create({
  // Root is just large enough for the gear; fan buttons use absolute positioning
  // and extend beyond — parent View has overflow:visible so they show.
  root: {
    width:  BTN_R * 2,
    height: BTN_R * 2,
    overflow: 'visible',
  },
  centerBtn: {
    width:           BTN_R * 2,
    height:          BTN_R * 2,
    borderRadius:    BTN_R,
    backgroundColor: 'rgba(148,210,215,0.85)',
    borderWidth:     1.5,
    borderColor:     'rgba(177,219,221,0.9)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  centerIcon: {
    width:  BTN_R * 1.3,
    height: BTN_R * 1.3,
  },
  // fan buttons are absolutely positioned at the gear's centre (top:BTN_R, left:BTN_R
  // would be centre — but we put them at 0,0 and let the animated translate do the work)
  fanBtn: {
    position: 'absolute',
    top:      BTN_R - FAN_BTN_R,   // vertically centre on gear centre
    left:     BTN_R - FAN_BTN_R,   // horizontally centre on gear centre
  },
  fanBtnInner: {
    width:           FAN_BTN_R * 2,
    height:          FAN_BTN_R * 2,
    borderRadius:    FAN_BTN_R,
    backgroundColor: 'rgba(148,210,215,0.85)',
    borderWidth:     1.5,
    borderColor:     'rgba(177,219,221,0.9)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  fanIcon: {
    width:  FAN_BTN_R * 1.2,
    height: FAN_BTN_R * 1.2,
  },
});

// ─── Game card ───────────────────────────────────────────────────────────────
// Both rows must fit inside H minus the top bar and safe-area insets.
// Top bar ≈ BTN_R*2 + 8pt margin. Safe area ≈ 16pt.
// Available for 2 rows + 3 × rowMargin(4pt) ≈ H - BTN_R*2 - 24 - 24 = H - BTN_R*2 - 48
const CARD_H = Math.floor((H - BTN_R * 2 - 56) / 2);
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

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} disabled={!available}>
      <Animated.View ref={viewRef} style={[styles.card, { transform: [{ scale }] }, !available && styles.cardDimmed]}>
        <View style={styles.cardImgWrapper}>
          <Image source={item.image} style={styles.cardImg} resizeMode="contain" />
        </View>
        <Text style={styles.cardLabel} numberOfLines={1} adjustsFontSizeToFit>{item.name}</Text>
        {!available && (
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>Soon</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChooseGameTypeScreen({ navigation }: Props): React.JSX.Element {
  const { hydrate: hydrateSettings } = useSettingsStore();
  const { hydrate: hydrateProgress } = useProgressStore();
  const { setGameType } = useGameStore();

  useEffect(() => {
    (async () => {
      await hydrateSettings();
      hydrateProgress();
      await iapService.init();
      adsService.loadAds();
      await pushService.register();
      await soundService.loadAll();
      soundService.playMusic('menu_music');
      void syncIfNeeded();
      void logAppOpen();
    })();
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
        {/* Top bar */}
        <View style={styles.topBar}>
          {/* Settings fan-out — positioned so the gear sits at the top-left corner */}
          <View style={styles.settingsAnchor}>
            <SettingsMenu onLanguage={() => navigation.navigate('Language')} />
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('IAP', { packageName: 'remove_ads' })}>
              <Image source={require('../assets/images/btnUnlock.png')} style={styles.topIcon} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('RateUs')}>
              <Image source={require('../assets/images/btnRate.png')} style={styles.topIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cards area — centred vertically in remaining space */}
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
        </View>{/* end cardsArea */}
      </SafeAreaView>
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

  // top bar
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    // overflow visible so the fan can extend beyond the bar height
    overflow: 'visible',
    zIndex: 20,
  },
  settingsAnchor: {
    // gives the fan-out space without affecting bar height
    overflow: 'visible',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIcon: {
    width: 36,
    height: 36,
  },

  // cards area — fills remaining space and centres rows vertically
  cardsArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // card rows
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },

  // card
  card: {
    width: CARD_W,
    height: CARD_H,
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  cardDimmed: {
    opacity: 0.55,
  },
  cardImgWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImg: {
    width: CARD_W * 0.82,
    height: CARD_W * 0.82,
  },
  cardLabel: {
    color: '#fff',
    fontFamily: 'FredokaOne-Regular',
    fontSize: LABEL_FONT_SIZE,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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