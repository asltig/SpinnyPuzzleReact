/**
 * navigation/types.ts
 * Strongly-typed route params for every screen in the app.
 * Import NavigationProp / RouteProp from here — never use `any`.
 */

import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Level, PackageWithLevels } from '../types/models';

// ─────────────────────────────────────────────
// Root stack
// ─────────────────────────────────────────────

export type RootStackParamList = {
  ChooseGameType: undefined;
  SpinnyStack:    undefined;
  JigsawStack:    undefined;
  PatchworkStack: undefined;
  MemoryStack:    undefined;
  OnetStack:      undefined;
  // Modals
  WatchAd: { onRewarded: () => void };
  IAP:     { packageName: string };
  Language: undefined;
  RateUs:  undefined;
};

// ─────────────────────────────────────────────
// Spinny sub-stack
// ─────────────────────────────────────────────

export type SpinnyStackParamList = {
  /**
   * Steps 1–7: no params — screen uses hardcoded TEST_PACKAGE_WITH_LEVELS.
   * Step 5+: will accept optional { packageName, packageInfo } from a package
   * picker screen once the DB layer is wired.
   */
  SpinnyLevels: undefined;
  SpinnyGamePlay: {
    level: Level;
    packageInfo: PackageWithLevels;
  };
  LevelComplete: {
    level: Level;
    packageInfo: PackageWithLevels;
  };
};

// ─────────────────────────────────────────────
// Jigsaw sub-stack
// ─────────────────────────────────────────────

export type JigsawStackParamList = {
  JigsawLevels:  undefined;
  JigsawGame:    { level: Level };
};

// ─────────────────────────────────────────────
// Patchwork sub-stack
// ─────────────────────────────────────────────

export type PatchworkStackParamList = {
  PatchworkLevels: undefined;
  PatchworkGame:   { level: Level; index: number };
};

// ─────────────────────────────────────────────
// Convenience screen prop types
// ─────────────────────────────────────────────

export type SpinnyGamePlayScreenProps = NativeStackScreenProps<
  SpinnyStackParamList,
  'SpinnyGamePlay'
>;

export type SpinnyLevelsScreenProps = NativeStackScreenProps<
  SpinnyStackParamList,
  'SpinnyLevels'
>; // No typed params yet — screen uses hardcoded data (Steps 1–7)

export type LevelCompleteScreenProps = NativeStackScreenProps<
  SpinnyStackParamList,
  'LevelComplete'
>;

export type JigsawGameScreenProps = NativeStackScreenProps<
  JigsawStackParamList,
  'JigsawGame'
>;

export type PatchworkGameScreenProps = NativeStackScreenProps<
  PatchworkStackParamList,
  'PatchworkGame'
>;

// ─────────────────────────────────────────────
// Memory Match sub-stack
// ─────────────────────────────────────────────

export type MemoryStackParamList = {
  MemoryLevels: undefined;
  MemoryGame:   { level: number };
};

export type MemoryLevelsScreenProps = NativeStackScreenProps<MemoryStackParamList, 'MemoryLevels'>;
export type MemoryGameScreenProps   = NativeStackScreenProps<MemoryStackParamList, 'MemoryGame'>;

// ─────────────────────────────────────────────
// oNet Connect sub-stack
// ─────────────────────────────────────────────

export type OnetStackParamList = {
  OnetLevels: undefined;
  OnetGame:   { level: number };
};

export type OnetLevelsScreenProps = NativeStackScreenProps<OnetStackParamList, 'OnetLevels'>;
export type OnetGameScreenProps   = NativeStackScreenProps<OnetStackParamList, 'OnetGame'>;

export type RootNavProp = NativeStackNavigationProp<RootStackParamList>;
