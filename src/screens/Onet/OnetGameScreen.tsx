
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
  Animated, useWindowDimensions,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { OnetGameScreenProps }  from '../../navigation/types';
import { useProgressStore }          from '../../stores/useProgressStore';
import { soundService }              from '../../services/audio/soundService';
import { getOnetLevelConfig }        from '../../services/data/onetService';

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

const CARD_BG    = require('../../assets/images/memory/onet_cell_bg.png');
const CARD_SEL   = require('../../assets/images/memory/onet_cell_selected.png');
const ALERT_WIN  = require('../../assets/images/alertBase.png');
const ALERT_FAIL = require('../../assets/images/alertBaseFail.png');
const STAR_ON    = require('../../assets/images/star_filled.png');
const STAR_OFF   = require('../../assets/images/star_empty.png');
const STAR_IMG   = require('../../assets/images/star_filled.png');
// Finish overlay buttons — match original iOS btnHome / icPlayWIthShadow / btnLevels
const FIN_HOME   = require('../../assets/images/btnHome.png');
const FIN_PLAY   = require('../../assets/images/icPlayWithShadow.png');
const FIN_LEVELS = require('../../assets/images/btnLevels.png');
// HUD buttons
const IC_HINT    = require('../../assets/images/onet_btn_hint.png');
const IC_BACK    = require('../../assets/images/onet_btn_home.png');
const IC_SHUFFLE = require('../../assets/images/onet_btn_shuffle.png');

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
// Matches original iOS PopupView:
//  • card + backdrop enter simultaneously (scale 0.05→1, fade 0→0.7, 300ms)
//  • 3 stars pop in with stagger (win only)
//  • center play button pulses on loop after entry
//  • win: blank alertBase.png + text overlays + confetti
//  • fail: alertBaseFail.png (text baked in, gray header)
//  • buttons: home (light-blue) | play/next (green, larger, pulsing) | levels (purple)
interface FinishProps {
  phase: 'won' | 'lost'; stars: number;
  W: number; H: number; hasNext: boolean;
  onHome: () => void; onRetry: () => void; onNext: () => void;
}
const FinishOverlay = React.memo(({ phase, stars, W, H, hasNext, onHome, onRetry, onNext }: FinishProps) => {
  const isWin       = phase === 'won';
  const backdrop    = useRef(new Animated.Value(0)).current;
  const cardScale   = useRef(new Animated.Value(0.05)).current;
  const playPulse   = useRef(new Animated.Value(1)).current;
  // One Animated.Value per star for individual spring pop
  const starScale0  = useRef(new Animated.Value(0)).current;
  const starScale1  = useRef(new Animated.Value(0)).current;
  const starScale2  = useRef(new Animated.Value(0)).current;
  const starScales  = [starScale0, starScale1, starScale2];

  // alertBase aspect ratio: 1224 × 900  (original iOS card: ~293pt wide)
  const popW  = Math.round(Math.min(W * 0.50, 330));
  const popH  = Math.round(popW * (900 / 1224));
  const btnSz = Math.round(popH * 0.19);
  const sSz   = Math.round(popW * 0.15);

  useEffect(() => {
    // Step 1: card + backdrop enter in parallel (matches iOS UIView.animate 0.3s)
    Animated.parallel([
      Animated.timing(backdrop,  { toValue:0.75, duration:300, useNativeDriver:true }),
      Animated.spring(cardScale, { toValue:1, friction:7, tension:90, useNativeDriver:true }),
    ]).start(() => {
      // Step 2: stars stagger in (win only)
      if (isWin) {
        Animated.stagger(110, starScales.map(s =>
          Animated.spring(s, { toValue:1, friction:4, tension:200, useNativeDriver:true }),
        )).start();
      }
      // Step 3: play button pulse loop
      Animated.loop(Animated.sequence([
        Animated.timing(playPulse, { toValue:1.25, duration:260, useNativeDriver:true }),
        Animated.timing(playPulse, { toValue:0.92, duration:200, useNativeDriver:true }),
        Animated.timing(playPulse, { toValue:1.12, duration:200, useNativeDriver:true }),
        Animated.timing(playPulse, { toValue:1.0,  duration:200, useNativeDriver:true }),
        Animated.delay(1400),
      ])).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex:500 }]}>
      {/* Dark backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill,
        { backgroundColor:'rgba(0,0,0,0.72)', opacity:backdrop }]} />

      {/* Confetti for win */}
      {isWin && <Confetti W={W} H={H} />}

      {/* Centered card — column layout so stars sit above card without clipping */}
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}
        pointerEvents="box-none">
        <Animated.View style={{ alignItems:'center', transform:[{ scale:cardScale }] }}>

          {/* Stars: rendered as normal flow ABOVE the card.
              Negative marginBottom pulls the card up so stars straddle the top edge. */}
          {isWin && (
            <View style={fss.starsRow} pointerEvents="none">
              {starScales.map((sv, i) => (
                <Animated.View key={i} style={{ transform:[{ scale:sv }], marginHorizontal:2 }}>
                  <Image source={i < stars ? STAR_ON : STAR_OFF}
                    style={{ width:sSz, height:sSz }} resizeMode="contain" />
                </Animated.View>
              ))}
            </View>
          )}

          {/* Card */}
          <View style={{ width:popW, height:popH }}>
            <Image source={isWin ? ALERT_WIN : ALERT_FAIL}
              style={{ position:'absolute', width:popW, height:popH }} resizeMode="stretch" />

            {/* Text overlays — win only; fail card has text baked in */}
            {isWin && (
              <>
                <Text style={[fss.header, { fontSize:Math.round(popH * 0.115) }]}>
                  Well Done!
                </Text>
                <Text style={[fss.body, { fontSize:Math.round(popH * 0.095) }]}>
                  Level{'\n'}Completed!
                </Text>
              </>
            )}

            {/* Three buttons: Home | Play/Next (larger, pulsing) | Levels */}
            <View style={[fss.btnRow, { bottom: Math.round(popH * 0.08) }]}>
              <TouchableOpacity onPress={onHome} activeOpacity={0.85}
                hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                <Image source={FIN_HOME} style={{ width:btnSz, height:btnSz }} resizeMode="contain" />
              </TouchableOpacity>

              <Animated.View style={{ transform:[{ scale:playPulse }] }}>
                <TouchableOpacity
                  onPress={isWin && hasNext ? onNext : onRetry}
                  activeOpacity={0.85}
                  hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                  <Image source={FIN_PLAY}
                    style={{ width:Math.round(btnSz*1.18), height:Math.round(btnSz*1.18) }}
                    resizeMode="contain" />
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity onPress={onHome} activeOpacity={0.85}
                hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                <Image source={FIN_LEVELS} style={{ width:btnSz, height:btnSz }} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>
      </View>
    </View>
  );
});

const fss = StyleSheet.create({
  starsRow: {
    // Flow-positioned row above the card; negative marginBottom makes stars straddle the card top
    flexDirection:'row', justifyContent:'center', alignItems:'center',
    marginBottom: -14, zIndex:10,
  },
  header: {
    position:'absolute', left:'8%', right:'8%', top:'8%', textAlign:'center',
    fontFamily:'FredokaOne-Regular', color:'#7B2FBE',
    textShadowColor:'rgba(255,255,255,0.9)', textShadowOffset:{width:0,height:1}, textShadowRadius:4,
    zIndex:5,
  },
  body: {
    position:'absolute', left:'12%', right:'12%', top:'37%', textAlign:'center',
    fontFamily:'FredokaOne-Regular', color:'#D47A00',
    textShadowColor:'rgba(180,100,0,0.5)', textShadowOffset:{width:0,height:2}, textShadowRadius:3,
    zIndex:5,
  },
  btnRow: {
    position:'absolute', left:0, right:0,
    flexDirection:'row', justifyContent:'center', alignItems:'center', gap:18, zIndex:5,
  },
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
  const bg = (isSel || isHint) ? CARD_SEL : CARD_BG;
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
        }}>
          <Image source={bg} style={{ width:cellSize, height:cellSize }} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center' }]}>
            {animal != null && TILE_IMGS[animal] != null && (
              <Image source={TILE_IMGS[animal]!}
                style={{ width:cellSize*0.64, height:cellSize*0.64 }} resizeMode="contain" />
            )}
          </View>
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
    style={{ alignItems:'center', justifyContent:'center', opacity: disabled ? 0.35 : 1 }}>
    <Image source={IC_SHUFFLE} style={{ width:size, height:size }} resizeMode="contain" />
    <View style={ss.badge}>
      <Text style={ss.badgeTxt}>{count}</Text>
    </View>
  </TouchableOpacity>
));

// ─── Main game screen ─────────────────────────────────────────────────────────
const TOTAL_HINTS    = 5;
const TOTAL_SHUFFLES = 3;
const BG_COLOR       = '#F38181';   // original iOS PetGameBGColor (salmon/pink)
const PATH_COLOR     = '#EAFFD0';   // original iOS PathView.swift default pathColor (pale lime)
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

  // ── Layout ─────────────────────────────────────────────────────────────────
  const BTN   = Math.round(minDim * 0.13);
  const TOP_H = BTN + 16;
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

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    soundService.playMusic('menu_music');
    navigation.goBack();
  }, [navigation]);

  // ── Path segments (yellow lines) ────────────────────────────────────────────
  interface Seg { x: number; y: number; w: number; h: number; }
  const pathSegments = useMemo<Seg[]>(() => {
    if (!matchPath || matchPath.length < 2) return [];
    const corners = pathCorners(matchPath);
    const LINE = Math.max(4, CELL * 0.06);
    return corners.slice(0, -1).map((a, i) => {
      const b = corners[i + 1]!;
      const ca = cellCentre(a.r, a.c);
      const cb = cellCentre(b.r, b.c);
      if (Math.abs(ca.y - cb.y) < 2)
        return { x:Math.min(ca.x,cb.x), y:ca.y - LINE/2, w:Math.abs(cb.x-ca.x), h:LINE };
      return { x:ca.x - LINE/2, y:Math.min(ca.y,cb.y), w:LINE, h:Math.abs(cb.y-ca.y) };
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
          <TouchableOpacity onPress={goBack} activeOpacity={0.85}>
            <Image source={IC_BACK} style={{ width:BTN, height:BTN }} resizeMode="contain" />
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
          <View ref={scorePillRef} onLayout={measureScorePill} style={ss.scorePill}>
            <Image source={STAR_IMG}
              style={{ width:BTN*0.50, height:BTN*0.50, marginRight:4 }} resizeMode="contain" />
            <Text style={[ss.hudTxt, { fontSize:Math.round(minDim*0.040) }]}>{score}</Text>
          </View>
          <ShuffleBtn
            count={shufflesLeft} size={BTN}
            onPress={handleShuffle}
            disabled={shufflesLeft <= 0 || phase !== 'playing' || busy}
          />
          <View style={{ alignItems:'center' }}>
            <TouchableOpacity onPress={handleHint} activeOpacity={0.85}
              disabled={hintsLeft <= 0 || phase !== 'playing' || busy}>
              <Image source={IC_HINT}
                style={{ width:BTN, height:BTN, opacity:hintsLeft > 0 ? 1 : 0.35 }}
                resizeMode="contain" />
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
      {pathSegments.map((seg, i) => (
        <View key={i} pointerEvents="none" style={{
          position:'absolute', left:seg.x, top:seg.y, width:seg.w, height:seg.h,
          backgroundColor:PATH_COLOR, borderRadius:3, zIndex:40,
        }} />
      ))}

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
          phase={phase} stars={winStars} W={W} H={H} hasNext={level < 29}
          onHome={goBack}
          onRetry={() => navigation.replace('OnetGame', { level })}
          onNext={()   => navigation.replace('OnetGame', { level: level + 1 })}
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:      { overflow:'hidden' },
  hud:       { flexDirection:'row', alignItems:'center',
    paddingHorizontal:8, zIndex:10 },
  hudLeft:   { flexDirection:'row', alignItems:'center', gap:6, flex:1 },
  hudCenter: { alignItems:'center', justifyContent:'center', paddingHorizontal:4 },
  hudRight:  { flexDirection:'row', alignItems:'center', gap:8, flex:1, justifyContent:'flex-end' },
  scorePill: { flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(0,0,0,0.22)', borderRadius:12, paddingHorizontal:7, paddingVertical:2 },
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
    backgroundColor:'#E74C3C', borderRadius:10,
    minWidth:18, height:18, alignItems:'center', justifyContent:'center',
    paddingHorizontal:2,
  },
  badgeTxt: { color:'#FFF', fontSize:10, fontWeight:'700' },
});