/**
 * SpinnyLevelsScreen.tsx
 * Level-picker grid — matches SPLevelsController from the iOS ObjC source.
 *
 * Layout (matches screenshots):
 *   • Dark purple background (#392635) with animated floating dots
 *   • Back button — circular, top-left, absolute
 *   • Per-package section headers — CENTERED, white FredokaOne, uppercase, no count
 *   • Square cells: package backgroundColorDark fill, white border 4pt, cornerRadius 20
 *   • Cell content: animal image when completed, white silhouette outline when not
 *   • 3 columns; spacing = (collWidth − cols*cellSize) / (cols+1)
 */
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SectionList,
  Animated,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SpinnyStackParamList }   from '../../navigation/types';
import type { Level, PackageWithLevels } from '../../types/models';

import { useProgressStore }            from '../../stores/useProgressStore';
import { useGameStore }               from '../../stores/useGameStore';
import { getSpinnyPackagesWithLevels } from '../../services/data/levelLoader';
import { getLayerImage, getColorImage } from '../../assets/images/levels';
import { soundService }                 from '../../services/audio/soundService';
import { contractCircle, dismissRevealOverlay } from '../../utils/circularReveal';

// ─── Dimensions ──────────────────────────────────────────────────────────────
const sc    = Dimensions.get('screen');
const W     = Math.max(sc.width, sc.height);
const H     = Math.min(sc.width, sc.height);

// iOS: btnBack.frameWidth = screenHeight * BACK_SCALE (0.15)
const BTN_SIZE    = Math.round(H * 0.15);
const BTN_X       = Platform.OS === 'ios' ? 20 : 16;
// Collection view left/right margin = BTN_X + BTN_SIZE on both sides (symmetric)
const COLL_MARGIN = BTN_X + BTN_SIZE + 8;
const COLL_W      = W - COLL_MARGIN * 2;

// iOS: cellSize = 150 * deviceScale, deviceScale = H / 375
const CELL_SIZE = Math.round(150 * (H / 375));
const COLS      = 3;
const SPACING   = Math.round((COLL_W - COLS * CELL_SIZE) / (COLS + 1));

const HEADER_FONT = Math.round(25 * (H / 375));

// ─── Floating dots (matches BackgroundAnimationManager) ──────────────────────
// Kept at 8 dots (down from 18) — each runs a native-driver loop; too many
// concurrent loops cause frame drops on Android even with useNativeDriver.
const DOT_COLORS = ['#ff4444', '#44aaff', '#44ff88', '#ffcc44', '#cc44ff', '#ffffff88'];
const DOTS = Array.from({ length: 8 }, (_, i) => ({
  id:       i,
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

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.7, 0.15] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        width:           dot.size,
        height:          dot.size,
        borderRadius:    dot.size / 2,
        backgroundColor: dot.color,
        left:            dot.x,
        top:             dot.y,
        opacity,
        transform:       [{ translateY }],
      }}
    />
  );
}

// ─── Level cell ──────────────────────────────────────────────────────────────
// Mirrors SPLevelCell: mainImage fills cell minus 20pt margin.
// Completed → color photo; not completed → white silhouette outline placeholder.
interface LevelCellProps {
  level:   Level;
  bgColor: string;
  done:    boolean;
  onPress: () => void;
}

const LevelCell = memo(function LevelCell({ level, bgColor, done, onPress }: LevelCellProps) {
  const scale = useRef(new Animated.Value(1)).current;

  // Completed → color image; not completed → silhouette outline.
  // Falls back gracefully: color → layer → nothing.
  const colorImage = getColorImage(level.name);
  const layerImage = getLayerImage(level.name);
  const displayImg = done ? (colorImage ?? layerImage) : layerImage;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 70,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start(onPress);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Animated.View style={[styles.cell, { backgroundColor: bgColor, transform: [{ scale }] }]}>
        {displayImg != null && (
          <Image
            source={displayImg}
            // Fill the entire cell — `overflow:'hidden'` + borderRadius clips to circle corner
            style={styles.cellImage}
            resizeMode="contain"
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Section header ──────────────────────────────────────────────────────────
// Matches SPCollectionHeaderView: centered package name, white FredokaOne.
// Original uses localized key title_package_name_N → "Farm", "Insects", etc.
function SectionHeader({ name }: { name: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{name.toUpperCase()}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<SpinnyStackParamList, 'SpinnyLevels'>;

export default function SpinnyLevelsScreen({ navigation }: Props): React.JSX.Element {
  // Fade out the circular reveal overlay now that this screen is rendered.
  useEffect(() => { dismissRevealOverlay(); }, []);

  const isCompleted          = useProgressStore((s) => s.isCompleted);
  // Subscribe to completedKeys so the list re-renders when progress changes.
  useProgressStore((s) => s.completedKeys);
  const pendingAutoPlay      = useGameStore((s) => s.pendingAutoPlay);
  const clearPendingAutoPlay = useGameStore((s) => s.clearPendingAutoPlay);

  const packages  = useMemo(() => getSpinnyPackagesWithLevels(), []);
  const scrollRef = useRef<SectionList>(null);
  // Stores the pending scroll target so onScrollToIndexFailed can retry.
  const scrollTargetRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);

  // Ref always holds the latest pendingAutoPlay value so the useFocusEffect
  // closure (which has [] deps) can read it without becoming stale.
  const pendingRef = useRef(pendingAutoPlay);
  pendingRef.current = pendingAutoPlay;

  const navigateToLevel = useCallback(
    (packageInfo: PackageWithLevels, level: Level) => {
      soundService.play('button_click');
      soundService.play('transition_in');
      navigation.navigate('SpinnyGamePlay', { level, packageInfo });
    },
    [navigation],
  );

  // SectionList data: each section is a package, each item is a row of up to COLS levels.
  const sectionListData = useMemo(() => packages.map((pkg) => {
    const rows: Level[][] = [];
    for (let i = 0; i < pkg.levels.length; i += COLS) {
      rows.push(pkg.levels.slice(i, i + COLS));
    }
    return { pkg, data: rows };
  }), [packages]);

  // ── Auto-play on focus ────────────────────────────────────────────────────
  // Mirrors ObjC openNextLevelForLevel: → selectItemAtIndexPath:animated:YES
  //         → scrollViewDidEndScrollingAnimation → openPuzzleWithAnimation:
  //
  // [] deps intentional: the callback must NOT change when pendingAutoPlay changes.
  // If it did, useFocusEffect would call the *cleanup* of the previous effect,
  // which would clearTimeout the open-game timer before it fires.
  // Instead we read the latest value from pendingRef (always current).
  useFocusEffect(
    useCallback(() => {
      const auto = pendingRef.current;
      if (!auto) return;

      // Consume immediately so subsequent focuses don't re-trigger.
      clearPendingAutoPlay();

      const { packageName, levelName } = auto;
      const targetPkgInfo = packages.find((p) => p.package.name === packageName);
      const targetLevel   = targetPkgInfo?.levels.find((l) => l.name === levelName);
      if (!targetPkgInfo || !targetLevel) return;

      // 300ms: let the back-animation finish before scrolling.
      // Then 750ms scroll animation, then open the game.
      let gameTimer: ReturnType<typeof setTimeout>;
      const initTimer = setTimeout(() => {
        const sectionIndex = sectionListData.findIndex((s) => s.pkg.package.name === packageName);
        if (sectionIndex !== -1) {
          const rowIndex = Math.floor(
            targetPkgInfo.levels.findIndex((l) => l.name === levelName) / COLS,
          );
          const itemIndex = Math.max(0, rowIndex);
          scrollTargetRef.current = { sectionIndex, itemIndex };
          scrollRef.current?.scrollToLocation({
            sectionIndex,
            itemIndex,
            animated: true,
            viewOffset: H / 2 - CELL_SIZE / 2,
          });
        }

        gameTimer = setTimeout(() => {
          navigation.navigate('SpinnyGamePlay', {
            level:       targetLevel,
            packageInfo: targetPkgInfo,
          });
        }, 750);
      }, 300);

      // Cleanup only runs on screen BLUR — not on store-value change.
      return () => {
        clearTimeout(initTimer);
        clearTimeout(gameTimer);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []), // intentionally [] — see comment above
  );

  return (
    <View style={styles.root}>
      {/* Floating background dots — matches BackgroundAnimationManager */}
      {DOTS.map(d => <FloatingDot key={d.id} dot={d} />)}

      <SafeAreaView style={styles.safe}>
        {/* Back button — absolutely positioned top-left, matches btnBack */}
        <TouchableOpacity
          style={[styles.backBtn, { left: BTN_X, width: BTN_SIZE, height: BTN_SIZE }]}
          onPress={() => { soundService.play('button_click'); soundService.play('transition_out'); contractCircle(); navigation.goBack(); }}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/images/btnBack.png')}
            style={{ width: BTN_SIZE, height: BTN_SIZE }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Virtualized grid — only renders visible rows, matching iOS UICollectionView */}
        <SectionList
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: COLL_MARGIN },
          ]}
          sections={sectionListData}
          keyExtractor={(row, index) => String(index)}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          renderSectionHeader={({ section }) => (
            <SectionHeader name={section.pkg.package.name} />
          )}
          renderItem={({ item: row, section }) => (
            <View style={[styles.row, { gap: SPACING, marginBottom: SPACING }]}>
              {row.map((level) => (
                <LevelCell
                  key={level.id}
                  level={level}
                  bgColor={section.pkg.package.backgroundColorDark}
                  done={isCompleted(level.packageName, level.name)}
                  onPress={() => navigateToLevel(section.pkg, level)}
                />
              ))}
              {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, i) => (
                <View key={`sp-${i}`} style={styles.cellSpacer} />
              ))}
            </View>
          )}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          stickySectionHeadersEnabled={false}
          onScrollToIndexFailed={() => {
            // Target item wasn't rendered yet — wait one frame for the list to
            // extend its render window, then retry with the stored target.
            setTimeout(() => {
              const t = scrollTargetRef.current;
              if (!t) return;
              scrollRef.current?.scrollToLocation({
                sectionIndex: t.sectionIndex,
                itemIndex:    t.itemIndex,
                animated:     true,
                viewOffset:   H / 2 - CELL_SIZE / 2,
              });
            }, 100);
          }}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#392635',  // customParpleColor from ObjC
  },
  safe: {
    flex: 1,
  },

  // Absolutely positioned back button, top-left
  backBtn: {
    position:       'absolute',
    top:            BTN_X,
    zIndex:         10,
    alignItems:     'center',
    justifyContent: 'center',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    // paddingTop gives space for back button; section header aligns at same level
    paddingTop:    BTN_X,
    paddingBottom: Math.round(30 * (H / 375)),
  },

  sectionSeparator: {
    height: Math.round(30 * (H / 375)),
  },

  // Centered package title — white FredokaOne, all caps, matches iOS SPCollectionHeaderView
  sectionHeader: {
    alignItems:    'center',
    justifyContent:'center',
    height:        BTN_SIZE,           // same height as back button → visually on same row
    marginBottom:  Math.round(25 * (H / 375)),
  },
  sectionTitle: {
    color:      '#ffffff',
    fontFamily: 'FredokaOne-Regular',
    fontSize:   HEADER_FONT,
    letterSpacing: 1,
  },

  // Row of cells
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },

  // Cell — matches iOS: cornerRadius 20, borderWidth 4, white border, square.
  // No overflow:'hidden' — applying borderRadius to the image directly avoids
  // the expensive off-screen compositing that overflow+borderRadius requires on Android.
  cell: {
    width:        CELL_SIZE,
    height:       CELL_SIZE,
    borderRadius: 20,
    borderWidth:  4,
    borderColor:  '#ffffff',
    alignItems:   'center',
    justifyContent: 'center',
  },
  cellSpacer: {
    width:  CELL_SIZE,
    height: CELL_SIZE,
  },

  // Animal image — borderRadius clips it to rounded corners without needing
  // overflow:'hidden' on the parent (avoids expensive off-screen layer on Android).
  cellImage: {
    width:        CELL_SIZE,
    height:       CELL_SIZE,
    borderRadius: 16,
  },
});
