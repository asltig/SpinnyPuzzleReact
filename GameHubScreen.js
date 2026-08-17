/**
 * GameHubScreen.js
 * ------------------------------------------------------------------
 * React Native port of the game menu redesign (landscape layout).
 *
 * INSTALL (Expo):
 *   npx expo install expo-linear-gradient react-native-svg expo-font
 *
 * INSTALL (bare React Native CLI):
 *   npm install react-native-linear-gradient react-native-svg
 *   npm install @react-native-vector-icons/... (not needed, icons are inline SVG)
 *   npx pod-install   (iOS)
 *   // then swap the LinearGradient import below to 'react-native-linear-gradient'
 *
 * FONT (Baloo 2):
 *   Download the font family from https://fonts.google.com/specimen/Baloo+2
 *   Expo:  place .ttf files in ./assets/fonts, then in App.js:
 *     import { useFonts } from 'expo-font';
 *     const [loaded] = useFonts({
 *       'Baloo2-Bold': require('./assets/fonts/Baloo2-Bold.ttf'),
 *       'Baloo2-SemiBold': require('./assets/fonts/Baloo2-SemiBold.ttf'),
 *     });
 *   Bare RN: add the .ttf files to a fonts dir, link via react-native.config.js
 *     and `npx react-native-asset`, then reference by PostScript name.
 *   Until the font is linked, the styles below fall back to system fonts.
 * ------------------------------------------------------------------
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Line, Rect } from 'react-native-svg';

// ---------- design tokens ----------
const COLORS = {
  skyTop: '#3BB6E0',
  skyBot: '#1C8FC7',
  white: '#FFFFFF',
  gold: '#F0A93C',
  goldDeep: '#C9791F',
  plum: '#3A2340',
  plumDeep: '#241328',
  skyTile: '#8FD8F0',
  skyTileDeep: '#4CAFDA',
  mint: '#7BC9A6',
  mintDeep: '#4C9E7B',
  teal: '#3EA6A0',
  tealDeep: '#2C7C77',
  glass: 'rgba(255,255,255,0.16)',
  glassLine: 'rgba(255,255,255,0.35)',
  ink: 'rgba(9,54,77,0.28)',
};

const GAMES = [
  { key: 'spinny', label: 'Spinny Puzzle', emoji: '🐄', colors: [COLORS.gold, COLORS.goldDeep] },
  { key: 'jigsaw', label: 'Jigsaw Puzzle', emoji: '🧩', colors: [COLORS.plum, COLORS.plumDeep] },
  { key: 'patch', label: 'Patch Work', emoji: '✈️', colors: [COLORS.skyTile, COLORS.skyTileDeep] },
  { key: 'memory', label: 'Memory Match', emoji: '🦈', colors: [COLORS.mint, COLORS.mintDeep] },
  { key: 'onet', label: 'oNet Connect', emoji: '🐘', colors: [COLORS.teal, COLORS.tealDeep] },
];

// ---------- icons (inline SVG, no external icon lib needed) ----------
function SettingsIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth={1.8}>
      <Circle cx="12" cy="12" r="3.2" />
      <Path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.4-2-3.4-2.1.6a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.2a7.6 7.6 0 0 0-2.6 1.5l-2.1-.6-2 3.4L4.6 10a7.6 7.6 0 0 0 0 3l-1.8 1.4 2 3.4 2.1-.6c.77.66 1.65 1.17 2.6 1.5L10 22h4l.5-2.2c.95-.33 1.83-.84 2.6-1.5l2.1.6 2-3.4-1.8-1.4z" />
    </Svg>
  );
}

function LanguageIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth={1.8}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  );
}

function SoundOnIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={15} height={15} fill="white">
      <Path d="M4 9v6h4l5 4V5L8 9H4z" />
      <Path d="M16 9.5a3.5 3.5 0 0 1 0 5" stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function MusicOffIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round">
      <Path d="M9 17V6l10-2v11" fill="none" />
      <Circle cx="7" cy="17" r="2.4" />
      <Circle cx="17" cy="15" r="2.4" />
      <Line x1="3.5" y1="20.5" x2="20.5" y2="3.5" stroke="#FF5D5D" strokeWidth={2.2} />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="5" y="11" width="14" height="9" rx="2" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

function StarIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="#5EBF7C">
      <Path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.6 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.7z" />
    </Svg>
  );
}

// ---------- small reusable pieces ----------
function IconButton({ children, muted, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconBtn,
        muted && styles.iconBtnMuted,
        pressed && styles.pressedDown,
      ]}
    >
      {children}
    </Pressable>
  );
}

function StatusButton({ children, background, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.statusBtn,
        { backgroundColor: background },
        pressed && styles.pressedDown,
      ]}
    >
      {children}
    </Pressable>
  );
}

function GameTile({ game, onPress }) {
  return (
    <Pressable
      onPress={() => onPress?.(game.key)}
      accessibilityRole="button"
      accessibilityLabel={game.label}
      style={({ pressed }) => [styles.tileWrap]}
    >
      {({ pressed }) => (
        <>
          <LinearGradient
            colors={game.colors}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.tile, pressed && styles.tilePressed]}
          >
            <Text style={styles.emoji}>{game.emoji}</Text>
          </LinearGradient>
          <View style={styles.labelPill}>
            <Text style={styles.labelText} numberOfLines={1}>
              {game.label}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

// ---------- screen ----------
export default function GameHubScreen({ onSelectGame }) {
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <LinearGradient colors={[COLORS.skyTop, COLORS.skyBot]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topbar}>
          <View style={styles.iconCluster}>
            <IconButton accessibilityLabel="Settings">
              <SettingsIcon />
            </IconButton>
            <IconButton accessibilityLabel="Language">
              <LanguageIcon />
            </IconButton>
            <IconButton accessibilityLabel="Sound on">
              <SoundOnIcon />
            </IconButton>
            <IconButton muted accessibilityLabel="Music off">
              <MusicOffIcon />
            </IconButton>
          </View>

          <View style={styles.statusCluster}>
            <StatusButton background="#E44646" accessibilityLabel="Parental lock">
              <LockIcon />
            </StatusButton>
            <StatusButton background={COLORS.white} accessibilityLabel="Favorites">
              <StarIcon />
            </StatusButton>
          </View>
        </View>

        <View style={styles.row}>
          {GAMES.map((game) => (
            <GameTile key={game.key} game={game} onPress={onSelectGame} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.skyBot,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconCluster: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.glassLine,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#093654',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  iconBtnMuted: {
    opacity: 0.7,
  },
  statusCluster: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.glassLine,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#093654',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pressedDown: {
    transform: [{ translateY: 1 }],
    opacity: 0.9,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
  },
  tileWrap: {
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#082D40',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tilePressed: {
    transform: [{ translateY: 3 }],
  },
  emoji: {
    fontSize: 42,
  },
  labelPill: {
    backgroundColor: COLORS.ink,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  labelText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    // once linked, swap to: fontFamily: 'Baloo2-Bold',
    letterSpacing: 0.1,
  },
});
