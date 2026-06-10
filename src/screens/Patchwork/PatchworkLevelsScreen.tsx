/**
 * PatchworkLevelsScreen.tsx
 * Patchwork ("Right Position") level picker.
 *
 * ─── Layout (matches screenshot + PatchworkController ObjC) ──────────────────
 *  • Dark purple background (#392635 / #4b3246) + floating dots
 *  • Back button — top-left (white circle + pink/red chevron)
 *  • 3-column grid of level cards:
 *      - Each card shows the background scene image
 *      - White border (2pt), rounded corners, 90% cell size
 *      - Completed levels show imgPath (full assembled image)
 *      - IAP-locked levels (index > FREE_PATCHWORK_COUNT) show lock overlay
 *
 * ─── Data ────────────────────────────────────────────────────────────────────
 *  patchworkService.getPatchworkLevels() — 3 bundled + any server levels
 *  Syncs from POST /levels (packageName="RightPosition") on focus.
 *
 * ─── Lock logic ──────────────────────────────────────────────────────────────
 *  FREE_PATCHWORK_COUNT = 2 → indices 0, 1, 2 free; 3+ require IAP.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PatchworkStackParamList } from '../../navigation/types';
import type { Level }                   from '../../types/models';

import { useProgressStore }    from '../../stores/useProgressStore';
import { soundService }        from '../../services/audio/soundService';
import { contractCircle }     from '../../utils/circularReveal';
import { FREE_PATCHWORK_COUNT } from '../../constants/gameConstants';
import {
  getPatchworkLevels,
  syncPatchworkLevels,
  type PatchworkLevel,
} from '../../services/data/patchworkService';

// ─── Image assets ─────────────────────────────────────────────────────────────
const BG_IMAGES: Record<string, ReturnType<typeof require>> = {
  p1_bg:  require('../../assets/images/patchwork_p1_bg.jpg'),
  p2_bg:  require('../../assets/images/patchwork_p2_bg.jpg'),
  p3_bg:  require('../../assets/images/patchwork_p3_bg.jpg'),
};
const DONE_IMAGES: Record<string, ReturnType<typeof require>> = {
  p1_img: require('../../assets/images/patchwork_p1_img.jpg'),
  p2_img: require('../../assets/images/patchwork_p2_img.jpg'),
  p3_img: require('../../assets/images/patchwork_p3_img.jpg'),
};

const COLS        = 3;
const PATCHWORK_SCALE = 1.35;   // ObjC: cellH = cellW / PatchworkScale
const CORNER_R    = 10;
const BORDER_W    = 2;
const CELL_MARGIN = 4;
const BG_COLOR    = '#2E1A38';

// ─── Floating dots ────────────────────────────────────────────────────────────
const DOTS = Array.from({ length: 18 }, (_, i) => ({
  id: i, size: 2.5 + Math.random() * 3.5,
  x: Math.random(), y: Math.random(),
  dur: 4000 + Math.random() * 3000,
  delay: Math.random() * 2000,
}));

function FloatingDot({ dot, W, H }: { dot: typeof DOTS[number]; W: number; H: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dot.dur, delay: dot.delay, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: dot.dur, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.5, 0.1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', borderRadius: dot.size / 2,
      width: dot.size, height: dot.size, backgroundColor: '#FFFFFF',
      left: dot.x * W, top: dot.y * H, opacity, transform: [{ translateY }],
    }} />
  );
}

// ─── Single level card ────────────────────────────────────────────────────────
interface CardProps {
  level:       PatchworkLevel;
  cellW:       number;
  cellH:       number;
  isCompleted: boolean;
  isLocked:    boolean;
  onPress:     () => void;
}

function LevelCard({ level, cellW, cellH, isCompleted, isLocked, onPress }: CardProps) {
  const imgSrc = (() => {
    if (isCompleted && DONE_IMAGES[level.imgPath]) return DONE_IMAGES[level.imgPath]!;
    if (BG_IMAGES[level.bgImgPath]) return BG_IMAGES[level.bgImgPath]!;
    return null;
  })();

  return (
    <TouchableOpacity
      style={[ss.card, { width: cellW, height: cellH }]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={isLocked}
    >
      {/* Background/completed scene image */}
      {imgSrc && (
        <Image
          source={imgSrc}
          style={ss.cardImage}
          resizeMode="cover"
        />
      )}

      {/* Lock overlay — dark blur + lock icon (IAP levels) */}
      {isLocked && (
        <View style={ss.lockOverlay}>
          <Image
            source={require('../../assets/images/lock.png')}
            style={{ width: cellH * 0.3, height: cellH * 0.3 }}
            resizeMode="contain"
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<PatchworkStackParamList, 'PatchworkLevels'>;

export default function PatchworkLevelsScreen({ navigation }: Props): React.JSX.Element {
  const { width: winW, height: winH } = useWindowDimensions();
  const dotW = Math.max(winW, winH);
  const dotH = Math.min(winW, winH);

  const { isCompleted, isPackagePurchased } = useProgressStore();
  const [levels, setLevels] = useState<PatchworkLevel[]>(() => getPatchworkLevels());

  // Measure the actual grid container width at runtime — the only reliable way
  // to compute cellW because SafeAreaView / notch insets reduce available width
  // below winW. We render nothing until width is known (avoids 1-frame overflow).
  const [gridW, setGridW] = useState(0);

  const SIDE_PAD = CELL_MARGIN;
  const CELL_GAP = CELL_MARGIN * 2;
  // cellW computed from MEASURED width, not window width
  const cellW = gridW > 0
    ? Math.floor((gridW - SIDE_PAD * 2 - CELL_GAP * (COLS - 1)) / COLS)
    : 0;
  const cellH = cellW > 0 ? Math.floor(cellW / PATCHWORK_SCALE) : 0;

  const BTN_SIZE = Math.round(Math.min(winW, winH) * 0.14);

  useFocusEffect(useCallback(() => {
    soundService.playMusic('menu_music');
    const fresh = getPatchworkLevels();
    setLevels(fresh);
    syncPatchworkLevels().then((updated) => {
      if (updated.length !== fresh.length) setLevels(updated);
    });
  }, []));

  const openLevel = useCallback((pl: PatchworkLevel) => {
    soundService.play('button_click');
    const level: Level = {
      id:              pl.name,
      name:            pl.name,
      packageName:     'RightPosition',
      imgUrl:          pl.isInitialData ? '' : pl.imgPath,
      imgPath:         pl.imgPath,
      layerImgPath:    pl.bgImgPath,
      order:           pl.order,
      imageDownloaded: pl.isInitialData,
      levelCompleted:  isCompleted('RightPosition', pl.name),
      isInitialData:   pl.isInitialData,
      descrip:         JSON.stringify(pl.pieces),
      titleColor:      '#FFFFFF',
    };
    navigation.navigate('PatchworkGame', { level, index: pl.index });
  }, [isCompleted, navigation]);

  const goBack = useCallback(() => {
    soundService.play('button_click');
    soundService.play('transition_out');
    contractCircle();
    navigation.goBack();
  }, [navigation]);

  const isPurchased = isPackagePurchased('Patchwork');

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[ss.root, { backgroundColor: BG_COLOR }]}>
      {DOTS.map((d) => <FloatingDot key={d.id} dot={d} W={dotW} H={dotH} />)}

      <SafeAreaView style={ss.safe}>
        {/* Back button — white circle + red/pink chevron */}
        <View style={ss.topBar}>
          <TouchableOpacity
            style={[ss.backBtn, { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2 }]}
            onPress={goBack}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image
              source={require('../../assets/images/jigsawBack.png')}
              style={{ width: BTN_SIZE * 0.55, height: BTN_SIZE * 0.55 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* 3-column level grid.
            onLayout on the scroll container gives the EXACT usable width —
            this drives cellW so no card ever overflows regardless of safe areas. */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ss.grid}
        >
          <View
            onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
            style={ss.gridInner}
          >
            {cellW > 0 && (() => {
              // Build rows of COLS items
              const rows: PatchworkLevel[][] = [];
              for (let i = 0; i < levels.length; i += COLS) {
                rows.push(levels.slice(i, i + COLS));
              }
              return rows.map((row, ri) => (
                <View key={ri} style={[ss.row, { gap: CELL_GAP, marginBottom: CELL_GAP }]}>
                  {row.map((item) => {
                    const locked = item.index > FREE_PATCHWORK_COUNT && !isPurchased;
                    const done   = isCompleted('RightPosition', item.name);
                    return (
                      <LevelCard
                        key={item.name}
                        level={item}
                        cellW={cellW}
                        cellH={cellH}
                        isCompleted={done}
                        isLocked={locked}
                        onPress={() => openLevel(item)}
                      />
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  topBar: {
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 12,
    paddingVertical:   8,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },

  grid: {
    flexGrow: 1,
  },
  gridInner: {
    paddingHorizontal: CELL_MARGIN,
    paddingVertical:   CELL_MARGIN * 2,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'flex-start',
  },

  card: {
    borderRadius:    CORNER_R,
    borderWidth:     BORDER_W,
    borderColor:     '#FFFFFF',
    overflow:        'hidden',
    backgroundColor: '#3A2A4E',
  },
  cardImage: {
    width:  '100%',
    height: '100%',
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
  },
});