/**
 * useGameStore.ts
 * Active session state — which game is running, which level, what tutorial step.
 * Replaces: AppManager (game-state subset) + GameManager singleton.
 *
 * NOT persisted to MMKV — resets each session.
 * Progress persistence lives in useProgressStore + WatermelonDB.
 */
import { create } from 'zustand';
import type { GameType, GameMode, TutorialStep, Level, PackageWithLevels } from '../types/models';

// ─────────────────────────────────────────────
// Tutorial step ordering (mirrors original enum)
// ─────────────────────────────────────────────

const TUTORIAL_SEQUENCE: TutorialStep[] = [
  'none',
  'select_spinny',
  'select_first_level',
  'rotate_ring',
  'tap_hint',
  'completed',
];

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface GameState {
  // ─── Active game ────────────────────────────
  gameType: GameType;
  activeLevel: Level | null;
  activePackage: PackageWithLevels | null;

  /**
   * Level queued to auto-play when SpinnyLevels next gains focus.
   * Set by LevelCompleteScreen.goNext (mirrors ObjC openNextLevelForLevel:).
   * Cleared by SpinnyLevelsScreen immediately after consumption.
   */
  pendingAutoPlay: { packageName: string; levelName: string } | null;

  /** Difficulty — replaces GameManager.gameMode (GameModeEasy/Medium/Hard) */
  gameMode: GameMode;

  // ─── Tutorial ───────────────────────────────
  /** Current tutorial step. Replaces AppManager.tutorialStep TutorialStep enum. */
  tutorialStep: TutorialStep;

  /** Index of the level being shown in the tutorial.
   *  Replaces AppManager.tutorialLevelIndex (NSUserDefaults-backed in original). */
  tutorialLevelIndex: number;

  /** Running count of completed levels (for ad / rate-us trigger).
   *  Replaces AppManager.completedFigurCount. */
  completedFigurCount: number;

  /** True while a level is in progress (not yet won or abandoned).
   *  Replaces AppManager.isInProgress. */
  isInProgress: boolean;

  // ─── Actions ────────────────────────────────
  setGameType: (type: GameType) => void;
  setGameMode: (mode: GameMode) => void;
  setActiveLevel: (level: Level, pkg: PackageWithLevels) => void;
  clearActiveLevel: () => void;

  advanceTutorialStep: () => void;
  setTutorialLevelIndex: (idx: number) => void;
  incrementCompletedCount: () => void;

  setIsInProgress: (v: boolean) => void;
  setPendingAutoPlay: (level: { packageName: string; levelName: string }) => void;
  clearPendingAutoPlay: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useGameStore = create<GameState>((set, get) => ({
  gameType:        'spinny',
  activeLevel:     null,
  activePackage:   null,
  pendingAutoPlay: null,
  gameMode:        'easy',
  tutorialStep: 'none',
  tutorialLevelIndex: 0,
  completedFigurCount: 0,
  isInProgress: false,

  setGameType: (type) => set({ gameType: type }),

  setGameMode: (mode) => set({ gameMode: mode }),

  setActiveLevel: (level, pkg) =>
    set({ activeLevel: level, activePackage: pkg, isInProgress: true }),

  clearActiveLevel: () =>
    set({ activeLevel: null, activePackage: null, isInProgress: false }),

  advanceTutorialStep: () => {
    const current = get().tutorialStep;
    const idx = TUTORIAL_SEQUENCE.indexOf(current);
    const next = TUTORIAL_SEQUENCE[idx + 1] ?? 'completed';
    set({ tutorialStep: next });
  },

  setTutorialLevelIndex: (idx) => set({ tutorialLevelIndex: idx }),

  incrementCompletedCount: () =>
    set((s) => ({ completedFigurCount: s.completedFigurCount + 1 })),

  setIsInProgress: (v) => set({ isInProgress: v }),

  setPendingAutoPlay: (level) => set({ pendingAutoPlay: level }),
  clearPendingAutoPlay: () => set({ pendingAutoPlay: null }),
}));
