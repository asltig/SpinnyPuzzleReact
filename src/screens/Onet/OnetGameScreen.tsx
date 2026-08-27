
/**
 * OnetGameScreen.tsx — oNet Connect (Mahjong-style tile matching)
 *
 * Rules:
 *  • Tap two tiles with the same animal to match them.
 *  • They connect only if a path with ≤ 2 turns exists through empty cells
 *    (and a 1-cell virtual border that is always passable).
 *  • Matched tiles are removed. Clear the board to win.
 *  • Timer counts down; time-out = lose.
 *  • Collecting 50 path-stars awards one extra hint.
 *  • 3 manual shuffles per level. Auto-shuffle fires when no moves remain.
 *
 * Hermes safety: ALL BFS state is local to each function call.
 *   Module-level `new Array(n)` sparse arrays accumulate Hermes HiddenClass
 *   property-transitions permanently across calls, eventually hitting the
 *   196 607-transition limit. This implementation avoids that entirely.
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions, Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { OnetGameScreenProps }  from '../../navigation/types';
import { useProgressStore }          from '../../stores/useProgressStore';
import { soundService }              from '../../services/audio/soundService';
import { isLevelLockedByPaywall, maybeShowInterstitial, preloadInterstitial } from '../../services/monetization/monetizationService';
import { FullPackagePaywallModal }   from '../../components/FullPackagePaywallModal';
import { getOnetLevelConfig }        from '../../services/data/onetService';
import {
  logLevelStarted,
  logLevelCompleted,
  logLevelAbandoned,
  logLevelRestarted,
  logNextLevelClicked,
  logHintUsed,
} from '../../services/analytics/analyticsService';

// ─── Assets ──────────────────────────────────────────────────────────────────
const TILE_IMGS: Record<string, ReturnType<typeof require>> = {
  bee:     require('../../assets/images/memory/mg_bee.png'),
  bull:    require('../../assets/images/memory/mg_bull.png'),
  cat:     require('../../assets/images/memory/mg_cat.png'),
  chicken: require('../../assets/images/memory/mg_chicken.png'),
  cow:     require('../../assets/images/memory/mg_cow.png'),
  dog:     require('../../assets/images/memory/mg_dog.png'),
  doonkey: require('../../assets/images/memory/mg_doonkey.png'),
  duck:    require('../../assets/images/memory/mg_duck.png'),
  goat:    require('../../assets/images/memory/mg_goat.png'),
  goose:   require('../../assets/images/memory/mg_goose.png'),
  horse:   require('../../assets/images/memory/mg_horse.png'),
  pig:     require('../../assets/images/memory/mg_pig.png'),
  rabbit:  require('../../assets/images/memory/mg_rabbit.png'),
  rooster: require('../../assets/images/memory/mg_rooster.png'),
  sheep:   require('../../assets/images/memory/mg_sheep.png'),
  turkey:  require('../../assets/images/memory/mg_turkey.png'),
};
const ALL_ANIMALS = Object.keys(TILE_IMGS);

const STAR_IMG   = require('../../assets/images/star_filled.png');

// ─── Palette — ported from ConnectGameScreen.jsx ──────────────────────────────
const TILE_COLOR = '#ffffff';
// HUD screen-edge padding — matches SpinnyGamePlayScreen/MemoryGameScreen's BTN_X.
const BTN_X = Platform.OS === 'ios' ? 20 : 16;
const AMBER       = 'rgb(226,168,86)';
const PURPLE      = 'rgb(150,79,196)';
const RED         = '#e3435a';
const GOLD        = '#f4d35e';
const GREEN       = '#5cba6f';
const INK         = '#2c3e50';
const MUTED       = '#8a97a3';

const STAR_PATH = 'M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21z';
const GRID_PATH = 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z';

// ─── HUD / tile icons — ported from ConnectGameScreen.jsx ─────────────────────
function BackIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M15 5 L8 12 L15 19" />
    </Svg>
  );
}

function HintIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#fff" d="M9,21c0,0.55,0.45,1,1,1h4c0.55,0,1-0.45,1-1v-1H9V21z M12,2C8.14,2,5,5.14,5,9c0,2.38,1.19,4.47,3,5.74V17 c0,0.55,0.45,1,1,1h6c0.55,0,1-0.45,1-1v-2.26c1.81-1.27,3-3.36,3-5.74C19,5.14,15.86,2,12,2z" />
    </Svg>
  );
}

function ShuffleIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" d="M4 7h4l8 10h4M16 7h4M4 17h4l3-3.6" />
      <Path fill="#ffffff" d="M18 4.4l3 2.6-3 2.6zM18 14.4l3 2.6-3 2.6z" />
    </Svg>
  );
}

function GoldStarIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={GOLD} stroke="#e0a92c" strokeWidth={1.2} d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z" />
    </Svg>
  );
}

// ─── Finish-overlay icons ──────────────────────────────────────────────────────
function ClockIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.6} fill="none" stroke={RED} strokeWidth={2.4} />
      <Path fill="none" stroke={RED} strokeWidth={2.4} strokeLinecap="round" d="M12 7.4v5l3 2" />
    </Svg>
  );
}

function RetryIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
      <Path fill="#ffffff" d="M20.8 3.8v5.4h-5.4z" />
    </Svg>
  );
}

function PlayTriangleIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#ffffff" d="M8 5v14l11-7z" />
    </Svg>
  );
}

function GridIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#5b6b78" d={GRID_PATH} />
    </Svg>
  );
}

function FinishStarIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={STAR_PATH} />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Grid = (string | null)[][];
interface Pt { r: number; c: number; }
type Phase = 'playing' | 'won' | 'lost';

const DIRS: [number, number][] = [[-1,0],[0,1],[1,0],[0,-1]];

// ─── Grid building ────────────────────────────────────────────────────────────
function buildGrid(rows: number, cols: number, emptySet: Set<string>): Grid {
  const pairCount = (rows * cols - emptySet.size) / 2;
  const pool = [...ALL_ANIMALS];
  const picks: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    if (pool.length === 0) pool.push(...ALL_ANIMALS);
    const j = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(j, 1)[0]!);
  }
  const flat = [...picks, ...picks];
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flat[i], flat[j]] = [flat[j]!, flat[i]!];
  }
  let idx = 0;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      emptySet.has(`${r},${c}`) ? null : flat[idx++]!,
    ),
  );
}

function shuffleGrid(grid: Grid, rows: number, cols: number): Grid {
  const positions: Pt[] = [], values: string[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r]![c] !== null) {
        positions.push({ r, c }); values.push(grid[r]![c]!);
      }
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  const next: Grid = grid.map(row => row.map(() => null));
  positions.forEach((p, i) => { next[p.r]![p.c] = values[i]!; });
  return next;
}

// ─── Hermes-safe BFS pathfinding ──────────────────────────────────────────────
//
// ⚠️  All state is LOCAL to each call — no module-level arrays.
//
// Module-level `new Array(n)` sparse arrays accumulate HiddenClass property-
// transitions in Hermes permanently (transitions never decrease even on
// overwrite). With findHint calling canConnect 200+ times per match, the
// 196 607 limit is reached after ~270 BFS calls. Using local `[]` arrays
// that grow from index 0 (dense in Hermes) avoids this entirely.
//
// Virtual border: r ∈ [-1, rows], c ∈ [-1, cols] are always passable.
// Max turns: 2  (classic Onet / Shisen-Sho rule)
//
// State key: (r+1)*C*12 + (c+1)*12 + dir*3 + turns  (small integer ≤ ~1200)
// Stored in a local Set<number> — safe; integers as set members, not
// property keys on a large object.

function _passable(
  grid: Grid, rows: number, cols: number,
  r: number, c: number,
  r1: number, c1: number, r2: number, c2: number,
): boolean {
  if (r === r1 && c === c1) return true;
  if (r === r2 && c === c2) return true;
  if (r < -1 || r > rows || c < -1 || c > cols) return false;
  if (r === -1 || r === rows || c === -1 || c === cols) return true;
  return grid[r]![c] === null;
}

function canConnect(
  grid: Grid, rows: number, cols: number,
  r1: number, c1: number, r2: number, c2: number,
): boolean {
  if (r1 === r2 && c1 === c2) return false;
  const C = cols + 2;
  const visited = new Set<number>();
  const q: number[] = [];  // flat queue: r, c, dir, turns (4 entries per state)
  let head = 0;

  for (let d = 0; d < 4; d++) {
    const k = (r1 + 1) * C * 12 + (c1 + 1) * 12 + d * 3;
    if (!visited.has(k)) { visited.add(k); q.push(r1, c1, d, 0); }
  }

  while (head < q.length) {
    const r = q[head]!, c = q[head+1]!, dir = q[head+2]!, turns = q[head+3]!;
    head += 4;
    const [dr, dc] = DIRS[dir]!;
    const nr = r + dr, nc = c + dc;

    if (!_passable(grid, rows, cols, nr, nc, r1, c1, r2, c2)) continue;
    if (nr === r2 && nc === c2) return true;

    const base = (nr + 1) * C * 12 + (nc + 1) * 12;
    const k0 = base + dir * 3 + turns;
    if (!visited.has(k0)) { visited.add(k0); q.push(nr, nc, dir, turns); }

    if (turns < 2) {
      for (let d2 = 0; d2 < 4; d2++) {
        if (d2 === dir || d2 === (dir + 2) % 4) continue;
        const k1 = base + d2 * 3 + turns + 1;
        if (!visited.has(k1)) { visited.add(k1); q.push(nr, nc, d2, turns + 1); }
      }
    }
  }
  return false;
}

function findPath(
  grid: Grid, rows: number, cols: number,
  r1: number, c1: number, r2: number, c2: number,
): Pt[] | null {
  if (r1 === r2 && c1 === c2) return null;
  const C = cols + 2;
  const visited = new Set<number>();
  const parentKey = new Map<number, number>(); // stateKey → parentKey, -1 = root
  const cellR     = new Map<number, number>(); // stateKey → row
  const cellC     = new Map<number, number>(); // stateKey → col
  const q: number[] = [];
  let head = 0, foundKey = -1;

  for (let d = 0; d < 4; d++) {
    const k = (r1 + 1) * C * 12 + (c1 + 1) * 12 + d * 3;
    if (!visited.has(k)) {
      visited.add(k); parentKey.set(k, -1); cellR.set(k, r1); cellC.set(k, c1);
      q.push(r1, c1, d, 0);
    }
  }

  while (head < q.length) {
    const r = q[head]!, c = q[head+1]!, dir = q[head+2]!, turns = q[head+3]!;
    head += 4;
    const fromKey = (r + 1) * C * 12 + (c + 1) * 12 + dir * 3 + turns;
    const [dr, dc] = DIRS[dir]!;
    const nr = r + dr, nc = c + dc;

    if (!_passable(grid, rows, cols, nr, nc, r1, c1, r2, c2)) continue;
    if (nr === r2 && nc === c2) { foundKey = fromKey; break; }

    const base = (nr + 1) * C * 12 + (nc + 1) * 12;
    const k0 = base + dir * 3 + turns;
    if (!visited.has(k0)) {
      visited.add(k0); parentKey.set(k0, fromKey); cellR.set(k0, nr); cellC.set(k0, nc);
      q.push(nr, nc, dir, turns);
    }

    if (turns < 2) {
      for (let d2 = 0; d2 < 4; d2++) {
        if (d2 === dir || d2 === (dir + 2) % 4) continue;
        const k1 = base + d2 * 3 + turns + 1;
        if (!visited.has(k1)) {
          visited.add(k1); parentKey.set(k1, fromKey); cellR.set(k1, nr); cellC.set(k1, nc);
          q.push(nr, nc, d2, turns + 1);
        }
      }
    }
  }

  if (foundKey === -1) return null;

  const path: Pt[] = [{ r: r2, c: c2 }];
  let cur = foundKey;
  while (cur >= 0) {
    path.unshift({ r: cellR.get(cur)!, c: cellC.get(cur)! });
    cur = parentKey.get(cur) ?? -1;
  }
  return path;
}

function findHint(grid: Grid, rows: number, cols: number): [Pt, Pt] | null {
  for (let r1 = 0; r1 < rows; r1++) {
    for (let c1 = 0; c1 < cols; c1++) {
      if (grid[r1]![c1] === null) continue;
      for (let r2 = r1; r2 < rows; r2++) {
        const c2s = r2 === r1 ? c1 + 1 : 0;
        for (let c2 = c2s; c2 < cols; c2++) {
          if (grid[r2]![c2] !== grid[r1]![c1]) continue;
          if (canConnect(grid, rows, cols, r1, c1, r2, c2))
            return [{ r: r1, c: c1 }, { r: r2, c: c2 }];
        }
      }
    }
  }
  return null;
}

// ─── Path corner reduction ─────────────────────────────────────────────────
function pathCorners(path: Pt[]): Pt[] {
  if (path.length <= 2) return path;
  const out: Pt[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i-1]!, curr = path[i]!, next = path[i+1]!;
    if ((curr.r - prev.r) !== (next.r - curr.r) || (curr.c - prev.c) !== (next.c - curr.c))
      out.push(curr);
  }
  out.push(path[path.length - 1]!);
  return out;
}

// ─── Floating background dots ─────────────────────────────────────────────────
const DOTS = Array.from({ length: 12 }, (_, i) => ({
  id: i, r: 2 + Math.random() * 4,
  rx: Math.random(), ry: Math.random(),
  dur: 4000 + Math.random() * 3000,
  delay: Math.random() * 2500,
}));

const FloatingDot = React.memo(({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue:1, duration:dot.dur, delay:dot.delay, useNativeDriver:true }),
      Animated.timing(a, { toValue:0, duration:dot.dur, useNativeDriver:true }),
    ]));
    loop.start(); return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position:'absolute', borderRadius:dot.r, width:dot.r*2, height:dot.r*2,
      backgroundColor:'rgba(255,255,255,0.5)', left:dot.rx*W, top:dot.ry*H,
      opacity: a.interpolate({ inputRange:[0,0.5,1], outputRange:[0.08,0.45,0.08] }),
      transform:[{ translateY: a.interpolate({ inputRange:[0,1], outputRange:[0,-10] }) }],
    }} />
  );
});

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#9B59B6','#E74C3C','#3498DB','#F1C40F','#2ECC71','#E67E22','#FF69B4','#00BCD4'];

const Confetti = React.memo(({ W, H }: { W: number; H: number }) => {
  const pieces = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i, x: Math.random() * W,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 1000, dur: 2200 + Math.random() * 1800,
      tilt: (Math.random() - 0.5) * 360, anim: new Animated.Value(0),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  useEffect(() => {
    Animated.parallel(pieces.map(p =>
      Animated.loop(Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue:1, duration:p.dur, useNativeDriver:true }),
        Animated.timing(p.anim, { toValue:0, duration:0, useNativeDriver:true }),
      ])),
    )).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {pieces.map(p => (
        <Animated.View key={p.id} pointerEvents="none" style={{
          position:'absolute', left:p.x, top:0, width:p.size, height:p.size*0.5,
          backgroundColor:p.color, borderRadius:1,
          opacity: p.anim.interpolate({ inputRange:[0,0.1,0.85,1], outputRange:[0,1,1,0] }),
          transform:[
            { translateY: p.anim.interpolate({ inputRange:[0,1], outputRange:[-20,H+20] }) },
            { rotate: p.anim.interpolate({ inputRange:[0,1], outputRange:['0deg',`${p.tilt}deg`] }) },
          ],
        }} />
      ))}
    </>
  );
});

// ─── Finish overlay ───────────────────────────────────────────────────────────
// Flat white modal card — ported from the Time's Up / Level Completed popups
// added to ConnectGameScreen.jsx's sibling MemoryGameScreen.jsx mockup (same
// design system/colours as this screen's HUD: RED, GOLD, GREEN, PURPLE).
interface FinishProps {
  phase: 'won' | 'lost'; stars: number;
  W: number; H: number;
  pairsFound: number; pairsTotal: number; timeLeft: number;
  hasNext: boolean;
  onHome: () => void; onRetry: () => void; onNext: () => void;
}
const FinishOverlay = React.memo(({ phase, stars, W, H, pairsFound, pairsTotal, timeLeft, hasNext, onHome, onRetry, onNext }: FinishProps) => {
  const won = phase === 'won';
  const backdropFade = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.1)).current;
  const cardFade     = useRef(new Animated.Value(0)).current;
  const heroPulse    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(backdropFade, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 1, duration: 300,
          easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        const pulse = Animated.loop(Animated.sequence([
          Animated.timing(heroPulse, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(heroPulse, { toValue: 1.0,  duration: 400, useNativeDriver: true }),
          Animated.delay(1200),
        ]));
        pulse.start();
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SCALE = Math.min(W * (won ? 0.36 : 0.34), won ? 340 : 320) / 330;
  // Won with no next level (last level) falls back to "Play Again" instead of a dead end.
  const heroIsRetry = !won || !hasNext;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex:500 }]}>
      <Animated.View style={[fss.overlayModal, { opacity: backdropFade }]} />

      {won && <Confetti W={W} H={H} />}

      <View style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center' }]}
        pointerEvents="box-none">
        <Animated.View style={[fss.modalCard, {
          width: Math.round(330 * SCALE),
          paddingHorizontal: Math.round(26 * SCALE),
          paddingTop: Math.round((won ? 30 : 26) * SCALE),
          paddingBottom: Math.round((won ? 24 : 22) * SCALE),
          borderRadius: Math.round(32 * SCALE),
          opacity: cardFade,
          transform: [{ scale: cardScale }],
        }]}>
          <View style={[
            fss.iconCircle,
            won ? fss.iconCircleAmber : fss.iconCircleRed,
            { width: Math.round(64 * SCALE), height: Math.round(64 * SCALE), borderRadius: Math.round(32 * SCALE), marginBottom: Math.round(14 * SCALE) },
          ]}>
            {won ? <FinishStarIcon size={Math.round(32 * SCALE)} color={GOLD} /> : <ClockIcon size={Math.round(32 * SCALE)} />}
          </View>

          <Text style={[fss.modalTitle, { fontSize: Math.round(21 * SCALE), marginBottom: Math.round(6 * SCALE) }]}>
            {won ? 'Level Completed' : "Time's Up"}
          </Text>
          <Text style={[fss.modalBody, {
            fontSize: Math.round(14 * SCALE), lineHeight: Math.round(20 * SCALE),
            marginBottom: Math.round((won ? 18 : 22) * SCALE),
          }]}>
            {won
              ? `All ${pairsTotal} pairs connected with ${timeLeft}s left`
              : `You connected ${pairsFound} of ${pairsTotal} pairs`}
          </Text>

          {won && (
            <View style={[fss.starRow, { marginBottom: Math.round(22 * SCALE) }]}>
              {[0, 1, 2].map((i) => (
                <FinishStarIcon
                  key={i}
                  size={Math.round((i === 1 ? 46 : 38) * SCALE)}
                  color={i < stars ? GOLD : '#e6ebe8'}
                />
              ))}
            </View>
          )}

          <View style={fss.btnRow}>
            <TouchableOpacity
              onPress={onHome}
              activeOpacity={0.85}
              style={[fss.secondaryBtn, {
                width: Math.round(104 * SCALE), paddingVertical: Math.round(14 * SCALE), borderRadius: Math.round(16 * SCALE),
              }]}
            >
              <GridIcon size={Math.round(18 * SCALE)} />
              <Text style={[fss.secondaryLabel, { fontSize: Math.round(14 * SCALE), marginLeft: Math.round(7 * SCALE) }]}>Levels</Text>
            </TouchableOpacity>

            <Animated.View style={{ flex: 1, marginLeft: Math.round(10 * SCALE), transform: [{ scale: heroPulse }] }}>
              <TouchableOpacity
                onPress={heroIsRetry ? onRetry : onNext}
                activeOpacity={0.85}
                style={[fss.heroBtn, { paddingVertical: Math.round(18 * SCALE), borderRadius: Math.round(18 * SCALE) }]}
              >
                {heroIsRetry ? <RetryIcon size={Math.round(19 * SCALE)} /> : null}
                <Text style={[fss.heroLabel, { fontSize: Math.round(17 * SCALE), marginHorizontal: Math.round(9 * SCALE) }]}>
                  {!won ? 'Try Again' : hasNext ? 'Play Next Level' : 'Play Again'}
                </Text>
                {!heroIsRetry ? <PlayTriangleIcon size={Math.round(18 * SCALE)} /> : null}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
});

const fss = StyleSheet.create({
  overlayModal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,18,36,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff', alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.35)', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 1, shadowRadius: 48, elevation: 12,
  },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  iconCircleRed:   { backgroundColor: '#fde3e6', shadowColor: 'rgba(200,60,80,0.32)',  shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  iconCircleAmber: { backgroundColor: '#fdead9', shadowColor: 'rgba(210,120,40,0.35)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 14, elevation: 4 },
  modalTitle: { textAlign: 'center', fontFamily: 'FredokaOne-Regular', color: INK },
  modalBody:  { textAlign: 'center', fontFamily: 'FredokaOne-Regular', color: MUTED },
  starRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  btnRow: { flexDirection: 'row', alignItems: 'stretch' },
  secondaryBtn: {
    borderWidth: 2, borderColor: '#e3e8ec', backgroundColor: '#ffffff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  secondaryLabel: { fontFamily: 'FredokaOne-Regular', color: '#5b6b78' },
  heroBtn: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#479457', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  heroLabel: { fontFamily: 'FredokaOne-Regular', color: '#ffffff' },
});

// ─── Memoised tile cell ───────────────────────────────────────────────────────
// Defined OUTSIDE the screen component so React never creates a new type on
// parent re-render — essential for React.memo to actually skip re-renders.
const WRONG_COLOR = 'rgba(220,50,50,0.70)';

interface TileCellProps {
  r: number; c: number; animal: string | null;
  isSel: boolean; isHint: boolean; isWrong: boolean;
  onTap: (r: number, c: number) => void;
  disabled: boolean;
  fadeAnim: Animated.Value;
  cellSize: number; corner: number; left: number; top: number;
}
const TileCell = React.memo(({
  r, c, animal, isSel, isHint, isWrong, onTap, disabled,
  fadeAnim, cellSize, corner, left, top,
}: TileCellProps) => {
  const picked = isSel || isHint;
  return (
    <Animated.View style={{
      position:'absolute', left, top, width:cellSize, height:cellSize, opacity:fadeAnim,
    }}>
      <TouchableOpacity
        onPress={() => onTap(r, c)}
        disabled={disabled}
        activeOpacity={0.78}
        style={{ width:cellSize, height:cellSize }}
      >
        <View style={{
          width:cellSize, height:cellSize, borderRadius:corner, overflow:'hidden',
          backgroundColor: TILE_COLOR, alignItems:'center', justifyContent:'center',
          borderWidth: picked ? 4 : 0, borderColor: GOLD,
          shadowColor:'rgba(0,0,0,0.14)', shadowOffset:{width:0,height:5}, shadowOpacity:1, shadowRadius:0, elevation:4,
        }}>
          {animal != null && TILE_IMGS[animal] != null && (
            <Image source={TILE_IMGS[animal]!}
              style={{ width:cellSize*0.64, height:cellSize*0.64 }} resizeMode="contain" />
          )}
        </View>
        {isWrong && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            borderRadius:corner, borderWidth:3,
            borderColor: WRONG_COLOR,
            backgroundColor: 'rgba(220,50,50,0.18)',
          }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Flying star: appears at path point, then flies to the score pill ────────
interface FlyingStarProps {
  id: number;
  startX: number; startY: number;
  endX: number; endY: number;
  size: number; delay: number;
  onDone: (id: number) => void;
}
const FlyingStar = React.memo(({
  id, startX, startY, endX, endY, size, delay, onDone,
}: FlyingStarProps) => {
  const translate = useRef(new Animated.ValueXY({ x:0, y:0 })).current;
  const opacity   = useRef(new Animated.Value(0)).current;
  const scale     = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue:1, duration:80, useNativeDriver:true }),
        Animated.spring(scale, { toValue:1.25, friction:4, tension:120, useNativeDriver:true }),
      ]),
      Animated.parallel([
        Animated.timing(translate, {
          toValue:{ x: endX - startX, y: endY - startY },
          duration:430, useNativeDriver:true,
        }),
        Animated.timing(scale,   { toValue:0.3, duration:430, useNativeDriver:true }),
        Animated.timing(opacity, { toValue:0.5, duration:430, useNativeDriver:true }),
      ]),
    ]).start(() => onDone(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:'absolute',
        left: startX - size / 2,
        top:  startY - size / 2,
        width:size, height:size, zIndex:100,
        opacity,
        transform:[
          { translateX: translate.x },
          { translateY: translate.y },
          { scale },
        ],
      }}
    >
      <Image source={STAR_IMG} style={{ width:size, height:size }} resizeMode="contain" />
    </Animated.View>
  );
});

// ─── Shuffle button ───────────────────────────────────────────────────────────
interface ShuffleBtnProps { count: number; size: number; onPress: () => void; disabled: boolean; }
const ShuffleBtn = React.memo(({ count, size, onPress, disabled }: ShuffleBtnProps) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
    style={[ss.circleBtn, { width:size, height:size, borderRadius:size/2, backgroundColor:PURPLE, opacity: disabled ? 0.35 : 1 }]}>
    <ShuffleIcon size={Math.round(size * 0.48)} />
    <View style={ss.badge}>
      <Text style={ss.badgeTxt}>{count}</Text>
    </View>
  </TouchableOpacity>
));

// ─── Main game screen ─────────────────────────────────────────────────────────
const TOTAL_HINTS    = 5;
const TOTAL_SHUFFLES = 3;
const BG_COLOR       = '#e0698a';   // ConnectGameScreen.jsx pink
const STARS_PER_HINT = 50;          // collect 50 path-stars → earn 1 hint

export default function OnetGameScreen({ navigation, route }: OnetGameScreenProps): React.JSX.Element {
  const { level } = route.params;
  const { width: winW, height: winH } = useWindowDimensions();
  const W = winW;
  const H = winH;
  const minDim = Math.min(winW, winH); // use for UI sizing regardless of orientation

  const { markCompleted, setLevelStars } = useProgressStore();
  const config = useMemo(() => getOnetLevelConfig(level), [level]);
  const { rows, cols, timerSeconds } = config;
  const totalPairs = (rows * cols - config.emptyCells.length) / 2;

  // ── Analytics refs ─────────────────────────────────────────────────────────
  const attemptNumberRef  = useRef(0);
  const didCompleteRef    = useRef(false);
  const analyticsHintNRef = useRef(0);

  useEffect(() => {
    attemptNumberRef.current  = logLevelStarted({ game: 'onet', world: 'Onet', level: `level_${level}` });
    didCompleteRef.current    = false;
    analyticsHintNRef.current = 0;
    preloadInterstitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Layout ─────────────────────────────────────────────────────────────────
  const BTN   = Math.round(minDim * 0.13);
  const TOP_H = BTN_X + BTN + BTN_X;
  const GAP   = 8;   // matches original tile spacing
  const PAD   = 12;
  const CELL  = Math.floor(Math.min(
    (W - PAD * 2 - (cols - 1) * GAP) / cols,
    (H - TOP_H - PAD * 2 - (rows - 1) * GAP) / rows,
    110,
  ));
  const CORNER = Math.round(CELL * 0.14);
  const gridW  = cols * CELL + (cols - 1) * GAP;
  const gridH  = rows * CELL + (rows - 1) * GAP;
  const gridX  = (W - gridW) / 2;
  const gridY  = TOP_H + (H - TOP_H - gridH) / 2;

  const cellCentre = useCallback((r: number, c: number) => ({
    x: gridX + c * (CELL + GAP) + CELL / 2,
    y: gridY + r * (CELL + GAP) + CELL / 2,
  }), [gridX, gridY, CELL, GAP]);

  // ── Game state ─────────────────────────────────────────────────────────────
  const [grid,         setGrid]          = useState<Grid>(() => buildGrid(rows, cols, new Set<string>(config.emptyCells)));
  const [phase,        setPhaseState]    = useState<Phase>('playing');
  const [selected,     setSelectedState] = useState<Pt | null>(null);
  const [wrongPair,    setWrongPair]     = useState<[Pt,Pt] | null>(null);
  const [matchPath,    setMatchPath]     = useState<Pt[] | null>(null);
  const [removing,     setRemoving]      = useState<Set<string>>(new Set());
  const [hintPair,     setHintPair]      = useState<[Pt,Pt] | null>(null);
  const [hintsLeft,    setHintsLeft]     = useState(TOTAL_HINTS);
  const [shufflesLeft, setShufflesLeft]  = useState(TOTAL_SHUFFLES);
  const [timeLeft,     setTimeLeft]      = useState(timerSeconds);
  const [timerOn,      setTimerOn]       = useState(true);
  const [matchedPairs, setMatchedPairs]  = useState(0);
  const [winStars,     setWinStars]      = useState(1);
  const [showPaywall,  setShowPaywall]   = useState(false);
  const [score,        setScore]         = useState(0); // path-stars collected
  const [busy,         setBusyState]     = useState(false);

  // Flying stars: spawn at path cell centres, fly to score pill
  const [flyingStars, setFlyingStars] = useState<
    {id:number; startX:number; startY:number; delay:number}[]
  >([]);
  const flyingStarIdRef = useRef(0);
  const scorePillRef    = useRef<View>(null);
  const scorePillPos    = useRef({ x: 60, y: 32 });  // approximate; updated on layout
  const measureScorePill = useCallback(() => {
    scorePillRef.current?.measureInWindow((x, y, w, h) => {
      scorePillPos.current = { x: x + w / 2, y: y + h / 2 };
    });
  }, []);

  // ── Refs for synchronous access (avoids stale-closure race conditions) ──────
  //  setBusy(true) is async; without a ref a rapid second tap still sees false.
  const busyRef      = useRef(false);
  const selectedRef  = useRef<Pt | null>(null);
  const phaseRef     = useRef<Phase>('playing');
  const scoreRef     = useRef(0);
  const hintsRef     = useRef(TOTAL_HINTS);
  const timeLeftRef  = useRef(timerSeconds);
  const matchedRef   = useRef(0);
  const gridRef      = useRef(grid);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  // Start game music on mount
  useEffect(() => {
    soundService.playMusic('game_music');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel all pending timers on unmount
  useEffect(() => () => {
    [shuffleTimerRef, wrongTimerRef, matchTimerRef, hintTimerRef].forEach(r => {
      if (r.current) { clearTimeout(r.current); }
    });
  }, []);

  // Stable setters: update both ref and React state atomically
  const setBusy = useCallback((v: boolean) => {
    busyRef.current = v; setBusyState(v);
  }, []);
  const setSelected = useCallback((v: Pt | null) => {
    selectedRef.current = v; setSelectedState(v);
  }, []);
  const setPhase = useCallback((v: Phase) => {
    phaseRef.current = v; setPhaseState(v);
  }, []);

  // ── Per-cell fade Animated.Values ──────────────────────────────────────────
  const fadeAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  const getFade = useCallback((r: number, c: number): Animated.Value => {
    const key = `${r},${c}`;
    if (!fadeAnims.has(key)) fadeAnims.set(key, new Animated.Value(1));
    return fadeAnims.get(key)!;
  }, [fadeAnims]);

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerOn || phase !== 'playing') return;
    if (timeLeft <= 0) {
      setPhase('lost');
      setTimerOn(false);
      soundService.play('memory_level_failed');
      return;
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft, timerOn, phase, setPhase]);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = useCallback((r: number, c: number) => {
    if (busyRef.current || phaseRef.current !== 'playing') return;
    if (gridRef.current[r]?.[c] === null || gridRef.current[r]?.[c] === undefined) return;

    // Cancel stale wrong-pair flash before starting fresh interaction
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current); wrongTimerRef.current = null;
      setWrongPair(null);
    }
    setHintPair(null);

    const sel = selectedRef.current;

    // First tap: select the tile
    if (sel === null) {
      setSelected({ r, c });
      soundService.play('memory_click1');
      return;
    }

    // Same tile tapped again: deselect
    if (sel.r === r && sel.c === c) { setSelected(null); return; }

    const { r: r1, c: c1 } = sel;
    setSelected(null);

    // Guard: selection might point at a cell cleared by shuffle
    const animal1 = gridRef.current[r1]?.[c1];
    const animal2 = gridRef.current[r]?.[c];
    if (!animal1 || !animal2) return;

    // Different animals: red flash, no match
    if (animal1 !== animal2) {
      soundService.play('memory_click2');
      setWrongPair([{ r:r1, c:c1 }, { r, c }]);
      wrongTimerRef.current = setTimeout(() => {
        wrongTimerRef.current = null; setWrongPair(null);
      }, 500);
      return;
    }

    // Same animal but no valid path: red flash
    const path = findPath(gridRef.current, rows, cols, r1, c1, r, c);
    if (!path) {
      soundService.play('memory_click2');
      ReactNativeHapticFeedback.trigger('notificationWarning', { enableVibrateFallback:true });
      setWrongPair([{ r:r1, c:c1 }, { r, c }]);
      wrongTimerRef.current = setTimeout(() => {
        wrongTimerRef.current = null; setWrongPair(null);
      }, 500);
      return;
    }

    // ── Match confirmed ──────────────────────────────────────────────────────
    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current); shuffleTimerRef.current = null;
    }

    // Synchronously block further input — ref updated before next tap can arrive
    setBusy(true);
    soundService.play('memory_correct');
    ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback:true });

    // Spawn flying stars at each path cell centre — each flies to the score pill
    const newStars = path.map((pt, i) => {
      const { x, y } = cellCentre(pt.r, pt.c);
      return { id: flyingStarIdRef.current++, startX:x, startY:y, delay: i * 55 };
    });
    setFlyingStars(prev => [...prev, ...newStars]);

    setMatchPath(path);
    setRemoving(prev => {
      const s = new Set(prev); s.add(`${r1},${c1}`); s.add(`${r},${c}`); return s;
    });

    matchTimerRef.current = setTimeout(() => {
      matchTimerRef.current = null;
      setMatchPath(null);

      Animated.parallel([
        Animated.timing(getFade(r1, c1), { toValue:0, duration:250, useNativeDriver:true }),
        Animated.timing(getFade(r,  c),  { toValue:0, duration:250, useNativeDriver:true }),
      ]).start(() => {
        const newGrid = gridRef.current.map(row => [...row]);
        newGrid[r1]![c1] = null;
        newGrid[r]![c]   = null;
        gridRef.current  = newGrid;
        setGrid(newGrid);

        setRemoving(prev => {
          const s = new Set(prev); s.delete(`${r1},${c1}`); s.delete(`${r},${c}`); return s;
        });
        getFade(r1, c1).setValue(1);
        getFade(r,  c).setValue(1);

        const nm = matchedRef.current + 1;
        matchedRef.current = nm;
        setMatchedPairs(nm);

        // Win condition
        if (nm === totalPairs) {
          setPhase('won');
          setTimerOn(false);
          soundService.play('memory_level_complete');
          // Star rating: matches original iOS getStars (time % of total)
          const pct = Math.round((timeLeftRef.current / timerSeconds) * 100);
          const s   = pct >= 76 ? 3 : pct >= 50 ? 2 : 1;
          setWinStars(s);
          setLevelStars('Onet', `level_${level}`, s);
          void markCompleted('Onet', `level_${level}`);
          didCompleteRef.current = true;
          logLevelCompleted({
            game:            'onet',
            world:           'Onet',
            level:           `level_${level}`,
            attempt_number:  attemptNumberRef.current,
            completion_time: timerSeconds - timeLeftRef.current,
            stars:           s,
            hints_used:      analyticsHintNRef.current,
            moves:           nm,
          });
          setBusy(false);
          return;
        }

        // Auto-shuffle if no moves remain; clear selection first so
        // selectedRef doesn't point at a tile that moves after shuffle.
        if (findHint(newGrid, rows, cols) === null) {
          shuffleTimerRef.current = setTimeout(() => {
            shuffleTimerRef.current = null;
            setSelected(null);
            setGrid(g => shuffleGrid(g, rows, cols));
          }, 900);
        }

        setBusy(false);
      });
    }, 380);
  }, [rows, cols, totalPairs, timerSeconds, level, getFade, cellCentre,
      markCompleted, setLevelStars, setBusy, setSelected, setPhase]);

  // ── Hint ────────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (hintsRef.current <= 0 || phaseRef.current !== 'playing' || busyRef.current) return;
    const pair = findHint(gridRef.current, rows, cols);
    if (!pair) return;
    soundService.play('button_click');
    hintsRef.current = hintsRef.current - 1;
    setHintsLeft(h => h - 1);
    analyticsHintNRef.current++;
    logHintUsed({
      game:        'onet',
      world:       'Onet',
      level:       `level_${level}`,
      hint_number: analyticsHintNRef.current,
    });
    setHintPair(pair);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null; setHintPair(null);
    }, 2000);
  }, [rows, cols]);

  // ── Manual shuffle ───────────────────────────────────────────────────────────
  const handleShuffle = useCallback(() => {
    if (shufflesLeft <= 0 || phaseRef.current !== 'playing' || busyRef.current) return;
    soundService.play('button_click');
    setShufflesLeft(s => s - 1);
    setSelected(null);
    if (shuffleTimerRef.current) { clearTimeout(shuffleTimerRef.current); shuffleTimerRef.current = null; }
    setGrid(g => shuffleGrid(g, rows, cols));
  }, [shufflesLeft, rows, cols, setSelected]);

  // Called when each flying star reaches the score pill — increments score by 1
  const onStarDone = useCallback((id: number) => {
    setFlyingStars(prev => prev.filter(s => s.id !== id));
    setScore(prev => {
      const ns = prev + 1;
      scoreRef.current = ns;
      if (ns % STARS_PER_HINT === 0) {
        hintsRef.current += 1;
        setHintsLeft(h => h + 1);
      }
      return ns;
    });
  }, []);

  const goBack = useCallback(async () => {
    if (!didCompleteRef.current) {
      logLevelAbandoned({
        game:           'onet',
        world:          'Onet',
        level:          `level_${level}`,
        attempt_number: attemptNumberRef.current,
        time_spent:     timerSeconds - timeLeftRef.current,
      });
    }
    soundService.play('button_click');
    soundService.play('transition_out');
    soundService.playMusic('menu_music');
    if (didCompleteRef.current) await maybeShowInterstitial();
    navigation.goBack();
  }, [navigation, level, timerSeconds]);

  // ── Path segments — white halo + gold cord, matches ConnectGameScreen.jsx's LinkLine ──
  interface Seg { x: number; y: number; w: number; h: number; horizontal: boolean; }
  const pathSegments = useMemo<Seg[]>(() => {
    if (!matchPath || matchPath.length < 2) return [];
    const corners = pathCorners(matchPath);
    const LINE = Math.max(4, CELL * 0.06);
    return corners.slice(0, -1).map((a, i) => {
      const b = corners[i + 1]!;
      const ca = cellCentre(a.r, a.c);
      const cb = cellCentre(b.r, b.c);
      if (Math.abs(ca.y - cb.y) < 2)
        return { x:Math.min(ca.x,cb.x), y:ca.y - LINE/2, w:Math.abs(cb.x-ca.x), h:LINE, horizontal:true };
      return { x:ca.x - LINE/2, y:Math.min(ca.y,cb.y), w:LINE, h:Math.abs(cb.y-ca.y), horizontal:false };
    });
  }, [matchPath, cellCentre, CELL]);

  // ── Formatted timer (original shows "0:54" format) ──────────────────────────
  const timerColor  = timeLeft < 6 ? '#FF4444' : '#FFFFFF';
  const timerMins   = Math.floor(timeLeft / 60);
  const timerSecs   = timeLeft % 60;
  const timerStr    = `${timerMins}:${timerSecs < 10 ? '0' : ''}${timerSecs}`;
  const timerFontSz = Math.round(minDim * 0.058);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor:BG_COLOR, width:W, height:H }]}>
      {DOTS.map(d => <FloatingDot key={d.id} dot={d} W={W} H={H} />)}

      {/* ── HUD — layout matches original iOS: [back | progress] [Timer: 0:54] [star+score | shuffle | hint] ── */}
      <View style={[ss.hud, { height:TOP_H }]}>

        {/* Left: back button + matched/total progress */}
        <View style={ss.hudLeft}>
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.75}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
            style={[ss.circleBtn, { width:BTN, height:BTN, borderRadius:BTN/2, backgroundColor:'#fff' }]}
          >
            <BackIcon size={Math.round(BTN * 0.5)} />
          </TouchableOpacity>
          <Text style={[ss.hudTxt, { fontSize:Math.round(minDim*0.040) }]}>
            {matchedPairs}/{totalPairs}
          </Text>
        </View>

        {/* Centre: prominent timer in original "0:54" format */}
        <View style={ss.hudCenter}>
          <Text style={[ss.timerTxt, { fontSize:timerFontSz, color:timerColor }]}>
            Timer: {timerStr}
          </Text>
        </View>

        {/* Right: score → shuffle → hint (order matches original) */}
        <View style={ss.hudRight}>
          {/* Score pill — measured so flying stars fly here */}
          <View ref={scorePillRef} onLayout={measureScorePill} style={[ss.scorePill, { height:BTN }]}>
            <GoldStarIcon size={Math.round(BTN * 0.50)} />
            <Text style={[ss.hudTxt, { fontSize:Math.round(minDim*0.040), marginLeft:4 }]}>{score}</Text>
          </View>
          <ShuffleBtn
            count={shufflesLeft} size={BTN}
            onPress={handleShuffle}
            disabled={shufflesLeft <= 0 || phase !== 'playing' || busy}
          />
          <View style={{ alignItems:'center' }}>
            <TouchableOpacity
              onPress={handleHint}
              activeOpacity={0.75}
              disabled={hintsLeft <= 0 || phase !== 'playing' || busy}
              style={[ss.circleBtn, { width:BTN, height:BTN, borderRadius:BTN/2, backgroundColor:AMBER, opacity:hintsLeft > 0 ? 1 : 0.35 }]}
            >
              <HintIcon size={Math.round(BTN * 0.48)} />
            </TouchableOpacity>
            <View style={ss.badge}><Text style={ss.badgeTxt}>{hintsLeft}</Text></View>
          </View>
        </View>

      </View>

      {/* ── Tile grid ── */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const animal: string | null = grid[r]?.[c] ?? null;
          const key    = `${r},${c}`;
          if (animal === null && !removing.has(key)) return null;
          const isSel   = selected?.r === r && selected?.c === c;
          const isHint  = hintPair !== null &&
            ((hintPair[0].r === r && hintPair[0].c === c) ||
             (hintPair[1].r === r && hintPair[1].c === c));
          const isWrong = wrongPair !== null &&
            ((wrongPair[0].r === r && wrongPair[0].c === c) ||
             (wrongPair[1].r === r && wrongPair[1].c === c));
          return (
            <TileCell
              key={key} r={r} c={c} animal={animal}
              isSel={isSel} isHint={isHint} isWrong={isWrong}
              onTap={handleTap}
              disabled={animal === null || phase !== 'playing' || busy}
              fadeAnim={getFade(r, c)}
              cellSize={CELL} corner={CORNER}
              left={gridX + c * (CELL + GAP)}
              top={gridY + r * (CELL + GAP)}
            />
          );
        })
      )}

      {/* ── Path segments ── */}
      {pathSegments.map((seg, i) => {
        const thick = seg.horizontal ? seg.h : seg.w;
        const haloThick = thick * 2;
        const haloInset = (haloThick - thick) / 2;
        return (
          <React.Fragment key={i}>
            {/* White halo — wider, translucent, sits beneath the gold cord */}
            <View pointerEvents="none" style={{
              position:'absolute',
              left:  seg.horizontal ? seg.x : seg.x - haloInset,
              top:   seg.horizontal ? seg.y - haloInset : seg.y,
              width: seg.horizontal ? seg.w : haloThick,
              height:seg.horizontal ? haloThick : seg.h,
              backgroundColor:'rgba(255,255,255,0.55)', borderRadius:haloThick/2, zIndex:39,
            }} />
            {/* Gold cord */}
            <View pointerEvents="none" style={{
              position:'absolute', left:seg.x, top:seg.y, width:seg.w, height:seg.h,
              backgroundColor:GOLD, borderRadius:thick/2, zIndex:40,
            }} />
          </React.Fragment>
        );
      })}

      {/* ── Flying stars (path → score pill) ── */}
      {flyingStars.map(p => (
        <FlyingStar
          key={p.id} id={p.id}
          startX={p.startX} startY={p.startY}
          endX={scorePillPos.current.x} endY={scorePillPos.current.y}
          size={Math.round(CELL * 0.55)} delay={p.delay}
          onDone={onStarDone}
        />
      ))}

      {/* ── Finish overlay ── */}
      {(phase === 'won' || phase === 'lost') && (
        <FinishOverlay
          phase={phase} stars={winStars} W={W} H={H}
          pairsFound={matchedPairs} pairsTotal={totalPairs} timeLeft={timeLeft}
          hasNext={level < 29}
          onHome={goBack}
          onRetry={() => {
            logLevelRestarted({ game: 'onet', world: 'Onet', level: `level_${level}` });
            navigation.replace('OnetGame', { level });
          }}
          onNext={async () => {
            logNextLevelClicked({ game: 'onet', world: 'Onet', level: `level_${level}` });
            await maybeShowInterstitial();
            if (isLevelLockedByPaywall(level)) { setShowPaywall(true); return; }
            navigation.replace('OnetGame', { level: level + 1 });
          }}
        />
      )}

      <FullPackagePaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const ss = StyleSheet.create({
  root:      { overflow:'hidden' },
  hud:       { flexDirection:'row', alignItems:'center',
    paddingHorizontal:BTN_X, zIndex:10 },
  hudLeft:   { flexDirection:'row', alignItems:'center', gap:6, flex:1 },
  hudCenter: { alignItems:'center', justifyContent:'center', paddingHorizontal:4 },
  hudRight:  { flexDirection:'row', alignItems:'center', gap:8, flex:1, justifyContent:'flex-end' },
  scorePill: { flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.22)', borderRadius:999, paddingHorizontal:10 },
  circleBtn: {
    alignItems:'center', justifyContent:'center',
    shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:0, elevation:4,
  },
  hudTxt: {
    color:'#FFFFFF', fontFamily:'FredokaOne-Regular',
    textShadowColor:'rgba(0,0,0,0.35)', textShadowOffset:{width:0,height:2}, textShadowRadius:3,
  },
  timerTxt: {
    color:'#FFFFFF', fontFamily:'FredokaOne-Regular', fontWeight:'700',
    textShadowColor:'rgba(0,0,0,0.40)', textShadowOffset:{width:0,height:2}, textShadowRadius:3,
  },
  hudTiny: {
    color:'rgba(255,255,255,0.80)', fontFamily:'FredokaOne-Regular',
    textShadowColor:'rgba(0,0,0,0.30)', textShadowOffset:{width:0,height:1}, textShadowRadius:1,
  },
  badge: {
    position:'absolute', top:-4, right:-6,
    backgroundColor:RED, borderRadius:10,
    minWidth:18, height:18, alignItems:'center', justifyContent:'center',
    paddingHorizontal:2,
  },
  badgeTxt: { color:'#FFF', fontSize:10, fontWeight:'700' },
});