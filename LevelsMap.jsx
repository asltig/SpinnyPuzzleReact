import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// TODO: replace with your real asset requires, e.g. require('./assets/world-farm-icon.png')
const ICONS = {
  Farm: require('./assets/world-farm-icon.png'),
  Insects: require('./assets/world-insects-icon.png'),
  Vehicles: require('./assets/world-vehicles-icon.png'),
  Savanna: require('./assets/world-savana-icon.png'),
  Seaworld: require('./assets/world-seaworld-icon.png'),
  Jungle: require('./assets/world-jungle-icon.png'),
  Dinosaurs: require('./assets/world-dinosaurs-icon.png'),
  ComingSoon: require('./assets/world-comingsoon-icon.png'),
};

// hex approximations of the oklch(0.72 0.16 hue) accent colors used per world
const HUE_COLOR = {
  85: '#c7c93f',
  110: '#7fc95a',
  230: '#5c9fe0',
  40: '#e0a53f',
  200: '#4bb8d6',
  150: '#4fc98a',
  25: '#e07a4f',
  280: '#a06adf',
};

const GAP = 100;
const START_X = 60;
const CENTER_Y = 190;
const ICON_WIDTH = 198;
const ICON_SLOT = 238;
const MAP_HEIGHT = 330;

const STAR_PATH =
  'M12,2.3c0.6,0,1.1,0.4,1.3,0.9l1.6,3.9c0.2,0.4,0.6,0.7,1,0.8l4.2,0.5c1.3,0.2,1.9,1.9,0.9,2.8l-3.1,2.9 c-0.4,0.3-0.5,0.8-0.4,1.3l0.9,4.1c0.3,1.3-1.1,2.4-2.3,1.7l-3.7-2.1c-0.4-0.2-0.9-0.2-1.3,0l-3.7,2.1c-1.2,0.7-2.6-0.3-2.3-1.7 l0.9-4.1c0.1-0.5-0.1-1-0.4-1.3l-3.1-2.9c-1-0.9-0.4-2.6,0.9-2.8l4.2-0.5c0.5-0.1,0.9-0.4,1-0.8l1.6-3.9C10.9,2.7,11.4,2.3,12,2.3z';

const WORLD_DEFS = [
  { name: 'Farm', hue: 85, total: 18, done: 6, locked: false, icon: 'Farm' },
  { name: 'Insects', hue: 110, total: 18, done: 0, locked: true, icon: 'Insects' },
  { name: 'Vehicles', hue: 230, total: 25, done: 0, locked: true, icon: 'Vehicles' },
  { name: 'Savanna', hue: 40, total: 20, done: 0, locked: true, icon: 'Savanna' },
  { name: 'Seaworld', hue: 200, total: 20, done: 0, locked: true, icon: 'Seaworld' },
  { name: 'Jungle', hue: 150, total: 22, done: 0, locked: true, icon: 'Jungle' },
  { name: 'Dinosaurs', hue: 25, total: 18, done: 0, locked: true, icon: 'Dinosaurs' },
  { name: 'More Soon', hue: 280, total: 0, done: 0, locked: true, icon: 'ComingSoon' },
];

function buildLayout() {
  const levels = [];
  const worldLabels = [];
  const pts = [];
  let cursorX = START_X;

  WORLD_DEFS.forEach((w) => {
    const color = HUE_COLOR[w.hue] || '#ffffff';
    const iconX = cursorX;
    cursorX += ICON_SLOT;

    const completed = w.locked ? 0 : w.done;
    worldLabels.push({ x: iconX, name: w.name, icon: w.icon, progress: w.total ? `${completed}/${w.total}` : '' });

    for (let i = 0; i < w.total; i++) {
      const x = cursorX;
      pts.push({ x, y: CENTER_Y, isFirstOfWorld: i === 0, isLastOfWorld: i === w.total - 1, iconX });

      const isDone = !w.locked && i < w.done;
      const isCurrent = !w.locked && i === w.done;
      const isLocked = w.locked || i > w.done;
      const starCount = isDone ? (i % 3) + 1 : 0;

      levels.push({
        x,
        y: CENTER_Y,
        nodeBg: isDone ? color : isCurrent ? '#eaf6fb' : 'rgba(255,255,255,0.1)',
        nodeBorder: isDone ? '#ffffff' : isCurrent ? color : 'rgba(255,255,255,0.3)',
        isCurrent,
        showLock: isLocked,
        starL: starCount >= 2,
        starM: starCount >= 1,
        starR: starCount >= 3,
        starMidSize: starCount === 3 ? 17 : 13,
      });

      cursorX += GAP;
    }
  });

  const radius = GAP / 2;
  const segments = []; // { type: 'line'|'arc', ... }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.isFirstOfWorld) {
      segments.push({ type: 'line', x1: p.iconX + 117, y1: CENTER_Y, x2: p.x - 28, y2: CENTER_Y });
    } else {
      const sweep = i % 2 === 0 ? 1 : 0;
      const prev = pts[i - 1];
      segments.push({ type: 'arc', x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, sweep, radius });
    }
    if (p.isLastOfWorld && i + 1 < pts.length) {
      const nextIconX = pts[i + 1].iconX;
      segments.push({ type: 'line', x1: p.x + 28, y1: CENTER_Y, x2: nextIconX + 81, y2: CENTER_Y });
    }
  }
  const lastWorld = WORLD_DEFS[WORLD_DEFS.length - 1];
  if (lastWorld.total === 0 && pts.length) {
    const lastPt = pts[pts.length - 1];
    const lastLabel = worldLabels[worldLabels.length - 1];
    segments.push({ type: 'line', x1: lastPt.x + 28, y1: CENTER_Y, x2: lastLabel.x + 81, y2: CENTER_Y });
  }

  const totalWidth = cursorX + 40;
  return { levels, worldLabels, segments, totalWidth };
}

function DashedPath({ segments }) {
  return segments.map((s, i) => {
    if (s.type === 'line') {
      return (
        <Path
          key={i}
          d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="4"
          strokeDasharray="2 14"
          strokeLinecap="round"
          fill="none"
        />
      );
    }
    const sweep = s.sweep;
    return (
      <Path
        key={i}
        d={`M ${s.x1} ${s.y1} A ${s.radius} ${s.radius} 0 0 ${sweep} ${s.x2} ${s.y2}`}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="4"
        strokeDasharray="2 14"
        strokeLinecap="round"
        fill="none"
      />
    );
  });
}

function Star({ size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ shadowColor: '#fff', shadowRadius: 2, shadowOpacity: 1 }}>
      <Path d={STAR_PATH} fill="#e8930a" transform="translate(0,1)" />
      <Path d={STAR_PATH} fill="#ffcb3d" />
    </Svg>
  );
}

function LockIcon({ size = 17 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="rgba(255,255,255,0.8)"
        d="M18,8h-1V6c0,-2.76,-2.24,-5,-5,-5S7,3.24,7,6v2H6c-1.1,0,-2,0.9,-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2,-0.9,2,-2V10 C20,8.9,19.1,8,18,8z M12,17c-1.1,0,-2,-0.9,-2,-2s0.9,-2,2,-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0,-1.71,1.39,-3.1,3.1,-3.1 s3.1,1.39,3.1,3.1V8z"
      />
    </Svg>
  );
}

export default function LevelsMap({ onBack }) {
  const { levels, worldLabels, segments, totalWidth } = buildLayout();

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path fill="#e0553f" d="M20,11H7.83l5.59,-5.59L12,4l-8,8l8,8l1.41,-1.41L7.83,13H20V11z" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Spinny Puzzle</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={{ width: totalWidth, height: MAP_HEIGHT }}>
          <Svg width={totalWidth} height={MAP_HEIGHT} style={StyleSheet.absoluteFill}>
            <DashedPath segments={segments} />
          </Svg>

          {worldLabels.map((wl, i) => (
            <View
              key={i}
              style={{ position: 'absolute', left: wl.x, top: CENTER_Y - 155, width: ICON_WIDTH }}
            >
              <Image source={ICONS[wl.icon]} style={{ width: ICON_WIDTH, height: ICON_WIDTH * 0.89, resizeMode: 'contain' }} />
            </View>
          ))}

          {levels.map((lvl, i) => (
            <View
              key={i}
              style={[
                styles.node,
                {
                  left: lvl.x - 28,
                  top: lvl.y - 28,
                  backgroundColor: lvl.nodeBg,
                  borderColor: lvl.nodeBorder,
                },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: lvl.showLock ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)',
                }}
              />
              {lvl.showLock ? (
                <View style={{ position: 'absolute' }}>
                  <LockIcon />
                </View>
              ) : null}
              {(lvl.starL || lvl.starM || lvl.starR) ? (
                <View style={styles.starRow}>
                  {lvl.starL ? <Star size={13} /> : null}
                  {lvl.starM ? <Star size={lvl.starMidSize} /> : null}
                  {lvl.starR ? <Star size={13} /> : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#392b38' },
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
  title: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  scroll: { flex: 1 },
  node: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    position: 'absolute',
    top: -17,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
  },
});
