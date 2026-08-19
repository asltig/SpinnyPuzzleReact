import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SpinnyStackParamList }   from '../../navigation/types';
import type { Level, PackageWithLevels } from '../../types/models';

import { useProgressStore }            from '../../stores/useProgressStore';
import { useGameStore }                from '../../stores/useGameStore';
import { getSpinnyPackagesWithLevels } from '../../services/data/levelLoader';
import { getColorImage, getLayerImage } from '../../assets/images/levels';
import FastImage from 'react-native-fast-image';
import { soundService }                from '../../services/audio/soundService';
import { contractCircle, markRevealScreenReady } from '../../utils/circularReveal';

// ─── Screen dimensions ────────────────────────────────────────────────────────
const sc  = Dimensions.get('screen');
const W   = Math.max(sc.width, sc.height);
const H   = Math.min(sc.width, sc.height);

const BTN_SIZE  = Math.round(H * 0.15);
const BTN_X     = Platform.OS === 'ios' ? 20 : 16;
const MAP_H     = H;

// Scale every LevelsMap.jsx constant proportionally to our map height
// (LevelsMap was authored for a 330 px tall map area)
const SCALE           = MAP_H / 330;
const CENTER_Y        = Math.round(190 * SCALE);
const ICON_W          = Math.round(198 * SCALE);
const ICON_SLOT       = Math.round(298 * SCALE);
const GAP             = Math.round(100 * SCALE);
const START_X         = Math.round(60  * SCALE);
// Offsets that connect the dashed path to each world-icon column
const PATH_FROM_ICON  = Math.round(99 * SCALE); // iconX + this → path start x
const PATH_TO_ICON    = Math.round(99 * SCALE);  // iconX + this → path end   x
const ICON_TOP        = CENTER_Y - Math.round(ICON_W * 0.89 / 2); // line bisects the icon vertically

const NODE_SIZE = 87;  // 56 × 1.3 (approx)
const NODE_R    = NODE_SIZE / 2;

// ─── World icon assets ────────────────────────────────────────────────────────
const WORLD_ICONS: Record<string, number> = {
  Farm:       require('../../assets/images/farm-world-icon.png'),
  Insects:    require('../../assets/images/insects-world-icon.png'),
  Savana:     require('../../assets/images/savana-world-icon.png'),
  Seaworld:   require('../../assets/images/seaworld-world-icon.png'),
  Jungle:     require('../../assets/images/jungle-world-icon.png'),
  Vehicles:   require('../../assets/images/vehicles-world-icon.png'),
  Dinosaurs:  require('../../assets/images/dinosaurs-world-icon.png'),
  ComingSoon: require('../../assets/images/comingsoon-world-icon.png'),
};

// ─── Accent colours (hex equivalents of LevelsMap HUE_COLOR) ─────────────────
const PKG_COLOR: Record<string, string> = {
  Farm:       '#f9d84f',
  Insects:    '#7fc95a',
  Savana:     '#e0a53f',
  Seaworld:   '#4bb8d6',
  Jungle:     '#4fc98a',
  Vehicles:   '#5c9fe0',
  Dinosaurs:  '#e07a4f',
  ComingSoon: '#a06adf',
};

// ─── SVG star path ────────────────────────────────────────────────────────────
const STAR_PATH =
  'M12,2.3c0.6,0,1.1,0.4,1.3,0.9l1.6,3.9c0.2,0.4,0.6,0.7,1,0.8l4.2,0.5c1.3,0.2,1.9,1.9,0.9,2.8' +
  'l-3.1,2.9c-0.4,0.3-0.5,0.8-0.4,1.3l0.9,4.1c0.3,1.3-1.1,2.4-2.3,1.7l-3.7-2.1' +
  'c-0.4-0.2-0.9-0.2-1.3,0l-3.7,2.1c-1.2,0.7-2.6-0.3-2.3-1.7l0.9-4.1' +
  'c0.1-0.5-0.1-1-0.4-1.3l-3.1-2.9c-1-0.9-0.4-2.6,0.9-2.8l4.2-0.5' +
  'c0.5-0.1,0.9-0.4,1-0.8l1.6-3.9C10.9,2.7,11.4,2.3,12,2.3z';

// ─── Floating background dots ─────────────────────────────────────────────────
const DOT_COLORS = ['#ff6666', '#66aaff', '#66ffaa', '#ffcc55', '#cc66ff', '#ffffff55'];
const DOTS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  size:     4 + Math.random() * 8,
  x:        Math.random() * W,
  y:        Math.random() * H,
  color:    DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
  duration: 3000 + Math.random() * 4000,
  delay:    Math.random() * 3000,
}));

function FloatingDot({ dot }: { dot: (typeof DOTS)[number] }) {
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
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const op = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.6, 0.15] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: dot.size, height: dot.size,
               borderRadius: dot.size / 2, backgroundColor: dot.color,
               left: dot.x, top: dot.y, opacity: op, transform: [{ translateY: ty }] }}
    />
  );
}

// ─── Small icon components ────────────────────────────────────────────────────
function Star({ size = 13 }: { size?: number }) {
  return (
    <View style={{
      shadowColor:   '#fff',
      shadowRadius:  4,
      shadowOpacity: 1,
      shadowOffset:  { width: 0, height: 0 },
    }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR_PATH} fill="#e8930a" transform="translate(0,1)" />
        <Path d={STAR_PATH} fill="#ffcb3d" />
      </Svg>
    </View>
  );
}

function LockIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="rgba(255,255,255,0.8)"
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

// ─── Layout types ─────────────────────────────────────────────────────────────
interface Segment {
  type: 'line' | 'arc';
  x1: number; y1: number; x2: number; y2: number;
  sweep?: number; radius?: number;
}

interface WorldLabel {
  x: number;
  iconKey: string;
  accessible: boolean;
}

interface LevelNode {
  x: number; y: number;
  nodeBg: string; nodeBorder: string;
  isCurrent: boolean; showLock: boolean;
  starL: boolean; starM: boolean; starR: boolean; starMidSize: number;
  level: Level; pkg: PackageWithLevels;
}

// ─── Layout builder ───────────────────────────────────────────────────────────
function buildLayout(
  packages: PackageWithLevels[],
  isCompleted: (pkg: string, lvl: string) => boolean,
  getLevelStars: (pkg: string, lvl: string) => number,
  accessibleSet: Set<string>,
): {
  levels: LevelNode[];
  worldLabels: WorldLabel[];
  segments: Segment[];
  totalWidth: number;
  levelXMap: Map<string, number>;
} {
  const levels: LevelNode[]       = [];
  const worldLabels: WorldLabel[] = [];
  const pts: Array<{
    x: number; y: number;
    isFirst: boolean; isLast: boolean;
    iconX: number;
  }> = [];
  const levelXMap = new Map<string, number>();
  let cursorX = START_X;

  // Process the 7 real packages
  for (const pwl of packages) {
    const pkgName      = pwl.package.name;
    const color        = PKG_COLOR[pkgName] ?? '#ffffff';
    const iconX        = cursorX;
    cursorX           += ICON_SLOT;
    const isAccessible = accessibleSet.has(pkgName);
    const total        = pwl.levels.length;

    // Sequential progress: find first incomplete level
    const firstIncomplete = isAccessible
      ? pwl.levels.findIndex(l => !isCompleted(pkgName, l.name))
      : 0;
    const doneIdx = firstIncomplete === -1 ? total : firstIncomplete;

    worldLabels.push({ x: iconX, iconKey: pkgName, accessible: isAccessible });

    for (let i = 0; i < total; i++) {
      const level = pwl.levels[i]!;
      const x     = cursorX;
      levelXMap.set(`${pkgName}_${level.name}`, x);
      pts.push({ x, y: CENTER_Y, isFirst: i === 0, isLast: i === total - 1, iconX });

      const isDone    = isAccessible && i < doneIdx;
      const isCurrent = isAccessible && i === doneIdx;
      const isLocked  = !isAccessible || i > doneIdx;
      const stars     = isDone ? Math.max(1, getLevelStars(pkgName, level.name)) : 0;

      levels.push({
        x, y: CENTER_Y,
        nodeBg:     isDone ? color : isCurrent ? '#83d8f4' : 'rgba(255,255,255,0.1)',
        nodeBorder: isDone ? '#83d8f4' : isCurrent ? '#ffffff' : 'rgba(255,255,255,0.3)',
        isCurrent, showLock: isLocked,
        starL: stars >= 2, starM: stars >= 1, starR: stars >= 3,
        starMidSize: stars === 3 ? 17 : 13,
        level, pkg: pwl,
      });

      cursorX += GAP;
    }
  }

  // "More Soon" world — no level nodes, just an icon at the end
  const comingSoonX = cursorX;
  worldLabels.push({ x: comingSoonX, iconKey: 'ComingSoon', accessible: false });
  // totalWidth reserves the icon slot
  const totalWidth = comingSoonX + ICON_SLOT + 40;

  // Build dashed path segments
  const radius = GAP / 2;
  const segments: Segment[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (p.isFirst) {
      segments.push({
        type: 'line',
        x1: p.iconX + PATH_FROM_ICON, y1: CENTER_Y,
        x2: p.x - NODE_R,             y2: CENTER_Y,
      });
    } else {
      const sweep = i % 2 === 0 ? 1 : 0;
      const prev  = pts[i - 1]!;
      segments.push({ type: 'arc', x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, sweep, radius });
    }
    if (p.isLast) {
      // Connect to next world icon or to "More Soon"
      const nextIconX = i + 1 < pts.length ? pts[i + 1]!.iconX : comingSoonX;
      segments.push({
        type: 'line',
        x1: p.x + NODE_R,          y1: CENTER_Y,
        x2: nextIconX + PATH_TO_ICON, y2: CENTER_Y,
      });
    }
  }

  return { levels, worldLabels, segments, totalWidth, levelXMap };
}

// ─── Dashed path SVG ──────────────────────────────────────────────────────────
function DashedPath({ segments, totalWidth }: { segments: Segment[]; totalWidth: number }) {
  return (
    <Svg width={totalWidth} height={MAP_H} style={StyleSheet.absoluteFill} pointerEvents="none">
      {segments.map((s, i) => {
        const d = s.type === 'line'
          ? `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`
          : `M ${s.x1} ${s.y1} A ${s.radius} ${s.radius} 0 0 ${s.sweep} ${s.x2} ${s.y2}`;
        return (
          <Path
            key={i}
            d={d}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="4"
            strokeDasharray="2 14"
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}

// ─── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7',
  '#F97316', '#10B981', '#3B82F6', '#EC4899', '#FBBF24', '#F472B6',
];
const CONFETTI_COUNT    = 70;
const CONFETTI_GRAVITY  = 650;   // px / s²
const CONFETTI_DURATION = 2000;  // ms per piece
const CONFETTI_T_SEC    = CONFETTI_DURATION / 1000;
const CONFETTI_FRAMES   = [0, 0.15, 0.30, 0.50, 0.70, 0.85, 1.0];

function cX(vx: number, f: number)  { return vx * f * CONFETTI_T_SEC; }
function cY(vy: number, f: number)  {
  const t = f * CONFETTI_T_SEC;
  return vy * t + 0.5 * CONFETTI_GRAVITY * t * t;
}

const ConfettiPiece = memo(function ConfettiPiece({
  originX, originY,
}: { originX: number; originY: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  const color  = useRef(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!).current;
  const w      = useRef(5 + Math.random() * 8).current;
  const h      = useRef(w * (0.3 + Math.random() * 0.4)).current;
  const angle  = useRef(Math.random() * Math.PI * 2).current;
  const spd    = useRef(180 + Math.random() * 320).current;
  const vx     = useRef(Math.cos(angle) * spd).current;
  const vy     = useRef(-Math.abs(Math.sin(angle) * spd) - 60).current; // always shoot upward initially
  const maxRot = useRef((Math.random() > 0.5 ? 1 : -1) * (300 + Math.random() * 400)).current;
  const delay  = useRef(Math.random() * 400).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, { toValue: 1, duration: CONFETTI_DURATION, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateX = progress.interpolate({ inputRange: CONFETTI_FRAMES, outputRange: CONFETTI_FRAMES.map(f => cX(vx, f)) });
  const translateY = progress.interpolate({ inputRange: CONFETTI_FRAMES, outputRange: CONFETTI_FRAMES.map(f => cY(vy, f)) });
  const opacity    = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.9, 0] });
  const rotate     = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${maxRot}deg`] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        left:            originX - w / 2,
        top:             originY - h / 2,
        width:           w,
        height:          h,
        backgroundColor: color,
        borderRadius:    1,
        opacity,
        transform:       [{ translateX }, { translateY }, { rotate }],
      }}
    />
  );
});

function ConfettiOverlay({
  originX, originY, onDone,
}: { originX: number; originY: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, CONFETTI_DURATION + 500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <ConfettiPiece key={i} originX={originX} originY={originY} />
      ))}
    </View>
  );
}

// ─── World icon (with optional unlock animation) ──────────────────────────────
const WorldIconView = memo(function WorldIconView({
  source, unlocking, onAnimationEnd,
}: { source: number; unlocking: boolean; onAnimationEnd: () => void }) {
  const bounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!unlocking) return;
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.25, duration: 200, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0.92, duration: 120, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 1.10, duration: 100, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 1.00, duration: 100, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onAnimationEnd();
    });
  }, [unlocking]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ transform: [{ scale: bounce }] }}>
      <Image source={source} style={{ width: ICON_W, height: ICON_W * 0.89 }} resizeMode="contain" />
    </Animated.View>
  );
});

// ─── Level node ───────────────────────────────────────────────────────────────
// Character image stays at the original 50 px so the larger circle frames it
const IMG_SIZE = 50;

const LevelNodeCell = memo(function LevelNodeCell({
  node, onPress,
}: { node: LevelNode; onPress: (node: LevelNode) => void }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const sonar1     = useRef(new Animated.Value(0)).current;
  const sonar2     = useRef(new Animated.Value(0)).current;
  const colorImage = getColorImage(node.level.colorImage);
  const layerImage = getLayerImage(node.level.layerImage);

  // Breathing pulse so the node visibly grows and shrinks
  useEffect(() => {
    if (!node.isCurrent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.12, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [node.isCurrent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Two staggered sonar rings that expand outward and fade — clearly signals "tap here"
  useEffect(() => {
    if (!node.isCurrent) return;
    const makePing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,   useNativeDriver: true }),
        ]),
      );
    const l1 = makePing(sonar1, 0);
    const l2 = makePing(sonar2, 450);
    l1.start();
    l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [node.isCurrent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.88, duration: 70,  useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start(() => onPress(node));
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={node.showLock ? 1 : 0.8}
      style={[
        styles.node,
        {
          left:            node.x - NODE_R,
          top:             node.y - NODE_R,
          backgroundColor: node.nodeBg,
          borderColor:     node.nodeBorder,
        },
      ]}
    >
      <Animated.View
        style={{
          transform: [
            { scale: node.isCurrent ? pulseScale : pressScale },
          ],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Completed — full colour character */}
        {!node.showLock && !node.isCurrent && colorImage != null ? (
          <FastImage source={colorImage} style={styles.nodeImg} resizeMode="contain" />
        ) : null}

        {/* Current (next to play) — silhouette + breathing pulse handled above */}
        {node.isCurrent && layerImage != null ? (
          <FastImage source={layerImage as number} style={styles.nodeImg} resizeMode="contain" />
        ) : null}

        {/* Locked or no image available — frosted circle fallback */}
        {(node.showLock ||
          (node.isCurrent && layerImage == null) ||
          (!node.isCurrent && !node.showLock && colorImage == null)) ? (
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: node.showLock ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)',
          }} />
        ) : null}

        {node.showLock ? (
          <View style={styles.nodeOverlay}><LockIcon /></View>
        ) : null}
      </Animated.View>

      {(node.starL || node.starM || node.starR) ? (
        <View style={styles.starRow}>
          {node.starL ? <Star size={13} /> : null}
          {node.starM ? <Star size={node.starMidSize} /> : null}
          {node.starR ? <Star size={13} /> : null}
        </View>
      ) : null}

      {/* Sonar rings — two staggered expanding circles that signal "tap here" */}
      {node.isCurrent ? (
        <>
          {([sonar1, sonar2] as Animated.Value[]).map((anim, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position:     'absolute',
                width:        NODE_SIZE,
                height:       NODE_SIZE,
                borderRadius: NODE_R,
                borderWidth:  3,
                borderColor:  '#ffffff',
                opacity:      anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0] }),
                transform:    [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] }) }],
              }}
            />
          ))}
        </>
      ) : null}
    </TouchableOpacity>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<SpinnyStackParamList, 'SpinnyLevels'>;

export default function SpinnyLevelsScreen({ navigation }: Props): React.JSX.Element {
  const isCompleted              = useProgressStore((s) => s.isCompleted);
  const getLevelStars            = useProgressStore((s) => s.getLevelStars);
  const completedCountForPackage = useProgressStore((s) => s.completedCountForPackage);
  const isPackagePurchased       = useProgressStore((s) => s.isPackagePurchased);
  const completedKeys = useProgressStore((s) => s.completedKeys); // subscribe + use in memo deps

  const pendingAutoPlay        = useGameStore((s) => s.pendingAutoPlay);
  const clearPendingAutoPlay   = useGameStore((s) => s.clearPendingAutoPlay);
  const pendingWorldUnlock     = useGameStore((s) => s.pendingWorldUnlock);
  const clearPendingWorldUnlock = useGameStore((s) => s.clearPendingWorldUnlock);

  const packages   = useMemo(() => getSpinnyPackagesWithLevels(), []);
  const scrollRef  = useRef<ScrollView>(null);
  const hasSignaledReady = useRef(false);
  const pendingRef = useRef(pendingAutoPlay);
  pendingRef.current = pendingAutoPlay;
  const pendingUnlockRef = useRef(pendingWorldUnlock);
  pendingUnlockRef.current = pendingWorldUnlock;

  const [unlockingIconKey, setUnlockingIconKey] = useState<string | null>(null);
  const [showConfetti,     setShowConfetti]     = useState(false);
  // Confetti fires from the world icon which is scrolled to screen center
  const confettiOriginX = W / 2;
  const confettiOriginY = CENTER_Y;

  // Farm always accessible; subsequent worlds unlock only when ALL levels of
  // the previous world are completed, or the package was purchased via IAP.
  // completedKeys subscription ensures this recomputes whenever progress changes.
  const accessibleSet = useMemo(() => {
    const set = new Set<string>();
    packages.forEach((pwl, idx) => {
      const name = pwl.package.name;
      if (idx === 0)                { set.add(name); return; }
      if (isPackagePurchased(name)) { set.add(name); return; }
      const prev      = packages[idx - 1]!;
      const prevTotal = prev.levels.length;
      if (prevTotal > 0 && completedCountForPackage(prev.package.name) >= prevTotal) {
        set.add(name);
      }
    });
    return set;
  }, [packages, isPackagePurchased, completedCountForPackage, completedKeys]);

  const { levels, worldLabels, segments, totalWidth, levelXMap } = useMemo(
    () => buildLayout(packages, isCompleted, getLevelStars, accessibleSet),
    [packages, isCompleted, getLevelStars, accessibleSet, completedKeys],
  );

  // Keep a ref so the stale useFocusEffect closure can read the latest levels.
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const navigateToLevel = useCallback((node: LevelNode) => {
    if (node.showLock) return;
    soundService.play('button_click');
    soundService.play('transition_in');
    navigation.navigate('SpinnyGamePlay', { level: node.level, packageInfo: node.pkg });
  }, [navigation]);

  // Scroll to current/pending level whenever the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      // ── Case 1: auto-play the next level ──────────────────────────────────
      const auto = pendingRef.current;
      if (auto) {
        clearPendingAutoPlay();
        const { packageName, levelName } = auto;
        const targetX       = levelXMap.get(`${packageName}_${levelName}`);
        const targetPkgInfo = packages.find((p) => p.package.name === packageName);
        const targetLevel   = targetPkgInfo?.levels.find((l) => l.name === levelName);
        if (targetX != null && targetPkgInfo && targetLevel) {
          let gameTimer: ReturnType<typeof setTimeout>;
          const initTimer = setTimeout(() => {
            scrollRef.current?.scrollTo({ x: targetX - W / 2, animated: true });
            gameTimer = setTimeout(() => {
              navigation.navigate('SpinnyGamePlay', { level: targetLevel, packageInfo: targetPkgInfo });
            }, 750);
          }, 300);
          return () => { clearTimeout(initTimer); clearTimeout(gameTimer!); };
        }
      }

      // ── Case 2: completed last level in world — reveal the next world ─────
      const completedPkg = pendingUnlockRef.current;
      if (completedPkg) {
        clearPendingWorldUnlock();
        const completedIdx = packages.findIndex((p) => p.package.name === completedPkg);
        const nextPkg = packages[completedIdx + 1];
        if (nextPkg) {
          const nextIconKey = nextPkg.package.name;
          const nextLabel   = worldLabels.find((wl) => wl.iconKey === nextIconKey);
          if (nextLabel) {
            const scrollX = nextLabel.x + ICON_W / 2 - W / 2;
            const scrollTimer = setTimeout(() => {
              scrollRef.current?.scrollTo({ x: Math.max(0, scrollX), animated: true });
              const animTimer = setTimeout(() => {
                setUnlockingIconKey(nextIconKey);
                setShowConfetti(true);
              }, 600);
              return () => clearTimeout(animTimer);
            }, 300);
            return () => clearTimeout(scrollTimer);
          }
        }
      }

      // ── Case 3: normal open — scroll so the current level is centred ──────
      const currentNode = levelsRef.current.find(n => n.isCurrent);
      if (currentNode) {
        const scrollX = Math.max(0, currentNode.x - W / 2);
        const t = setTimeout(() => {
          scrollRef.current?.scrollTo({ x: scrollX, animated: false });
        }, 50);
        return () => clearTimeout(t);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View
      style={styles.screen}
      onLayout={() => {
        if (!hasSignaledReady.current) {
          hasSignaledReady.current = true;
          markRevealScreenReady();
        }
      }}
    >
      {DOTS.map(d => <FloatingDot key={d.id} dot={d} />)}

      {/* Back button — floating, matches SpinnyGamePlayScreen */}
      <View style={[styles.floatBtn, { left: BTN_X, top: BTN_X }]}>
        <TouchableOpacity
          onPress={() => {
            soundService.play('button_click');
            soundService.play('transition_out');
            contractCircle();
            navigation.goBack();
          }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.circleBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, backgroundColor: '#fff' }]}
        >
          <Svg width={Math.round(BTN_SIZE * 0.5)} height={Math.round(BTN_SIZE * 0.5)} viewBox="0 0 24 24">
            <Path fill="none" stroke="#e3435a" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Horizontal level map — fills the full screen */}
      <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
          >
            <View style={{ width: totalWidth, height: MAP_H }}>
              {/* Dashed connecting path */}
              <DashedPath segments={segments} totalWidth={totalWidth} />

              {/* World icons — positioned exactly as in LevelsMap.jsx */}
              {worldLabels.map((wl, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left:     wl.x,
                    top:      ICON_TOP,
                    width:    ICON_W,
                  }}
                >
                  <WorldIconView
                    source={WORLD_ICONS[wl.iconKey]!}
                    unlocking={unlockingIconKey === wl.iconKey}
                    onAnimationEnd={() => setUnlockingIconKey(null)}
                  />
                </View>
              ))}

              {/* Level nodes */}
              {levels.map((lvl, i) => (
                <LevelNodeCell
                  key={i}
                  node={lvl}
                  onPress={navigateToLevel}
                />
              ))}
            </View>
          </ScrollView>
        </View>

      {/* Confetti burst — absolute overlay, fires when a new world unlocks */}
      {showConfetti && (
        <ConfettiOverlay
          originX={confettiOriginX}
          originY={confettiOriginY}
          onDone={() => setShowConfetti(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: '#392b38',
  },
  floatBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  circleBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.15,
    shadowRadius:   0,
    elevation:      4,
  },
  scroll: {
    flex: 1,
  },
  node: {
    position:       'absolute',
    width:          NODE_SIZE,
    height:         NODE_SIZE,
    borderRadius:   NODE_R,
    borderWidth:    3,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'visible',
  },
  nodeImg: {
    width:        IMG_SIZE,
    height:       IMG_SIZE,
    borderRadius: IMG_SIZE / 2,
  },
  nodeOverlay: {
    position: 'absolute',
  },
  starRow: {
    position:       'absolute',
    top:            -17,
    left:           0,
    right:          0,
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'center',
    gap:            1,
  },
});
