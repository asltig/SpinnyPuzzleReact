/**
 * useProgressStore.ts
 * Level completion tracking + purchased package tracking.
 * Replaces: AppManager.saveCompletedLevel / isLevelCompleted + IAPHelp purchase state.
 *
 * Two-layer persistence:
 *   MMKV    — fast O(1) in-game lookup (queried during active gameplay)
 *   WatermelonDB — source of truth, added in Step 4 without changing this file's API.
 *
 * The store holds an in-memory Set for the fastest possible read during gesture callbacks.
 */
import { create } from 'zustand';
import * as progressStorage from '../storage/progressStorage';
import { levelKey, type LastPlayedLevel } from '../storage/progressStorage';

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface ProgressState {
  /** In-memory Set of completed level keys (`packageName_levelName`).
   *  Replaces the levelCompleted boolean scattered across CoreData Level records. */
  completedKeys: Set<string>;

  /** Package names the user has purchased via IAP.
   *  Replaces IAPHelp purchase state + Package.isPurchased CoreData field. */
  purchasedPackages: Set<string>;

  /** Last level the user played — drives the "Continue" button in SpinnyLevelsScreen.
   *  Replaces NSUserDefaults lastLevel / lastPackage keys in the original AppManager. */
  lastPlayedLevel: LastPlayedLevel | null;

  // ─── Actions ──────────────────────────────────

  /** Hydrate from MMKV on app start (called once in App.tsx / ChooseGameTypeScreen).
   *  Loads completed keys AND last-played level in one shot. */
  hydrate: () => void;

  /** Mark a level as completed. Writes to both in-memory Set and MMKV.
   *  Replaces AppManager.saveCompletedLevel + Level.levelCompleted = YES + saveContext.
   *  Returns a Promise so callers can await it (async for Step 4 WatermelonDB compat). */
  markCompleted: (packageName: string, levelName: string) => Promise<void>;

  /** O(1) completion check — called frequently during level-picker rendering.
   *  Replaces AppManager.isLevelCompleted. */
  isCompleted: (packageName: string, levelName: string) => boolean;

  /** Count of completed levels for a given package (for the level grid progress indicator). */
  completedCountForPackage: (packageName: string) => number;

  /** Persist and update the last-played level.
   *  Called on SpinnyGamePlayScreen mount. */
  setLastPlayedLevel: (packageName: string, levelName: string) => void;

  /** Add a purchased package after successful IAP. */
  addPurchasedPackage: (packageName: string) => void;

  /** True if a package has been purchased. */
  isPackagePurchased: (packageName: string) => boolean;

  /** Bulk-seed completed keys from WatermelonDB (called after DB sync in Step 4).
   *  Both args required only in Step 4; kept here with defaults for forward-compat. */
  seedFromDB: (keys?: string[], purchased?: string[]) => void;

  /** Earn stars for a completed level (never downgrades). */
  setLevelStars: (packageName: string, levelName: string, stars: number) => void;

  /** Read earned star count (0–3) for a level. */
  getLevelStars: (packageName: string, levelName: string) => number;

  /** Wipe all progress (debug / reset flow). */
  reset: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useProgressStore = create<ProgressState>((set, get) => ({
  completedKeys:     new Set<string>(),
  purchasedPackages: new Set<string>(),
  lastPlayedLevel:   null,

  hydrate: () => {
    const keys          = progressStorage.getAllCompletedKeys();
    const lastPlayed    = progressStorage.getLastPlayedLevel();
    set({
      completedKeys:   new Set(keys),
      lastPlayedLevel: lastPlayed,
      // purchasedPackages seeded by seedFromDB after WatermelonDB is ready (Step 4)
    });
  },

  markCompleted: async (packageName, levelName) => {
    const key = levelKey(packageName, levelName);
    progressStorage.markLevelCompleted(key);
    set((s) => ({ completedKeys: new Set([...s.completedKeys, key]) }));
  },

  isCompleted: (packageName, levelName) => {
    return get().completedKeys.has(levelKey(packageName, levelName));
  },

  completedCountForPackage: (packageName) => {
    const prefix = `${packageName}_`;
    let count = 0;
    for (const key of get().completedKeys) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  },

  setLastPlayedLevel: (packageName, levelName) => {
    progressStorage.setLastPlayedLevel(packageName, levelName);
    set({ lastPlayedLevel: { packageName, levelName } });
  },

  addPurchasedPackage: (packageName) => {
    set((s) => ({ purchasedPackages: new Set([...s.purchasedPackages, packageName]) }));
  },

  isPackagePurchased: (packageName) => {
    return get().purchasedPackages.has(packageName);
  },

  seedFromDB: (keys, purchased) => {
    // If called without args (Step 3), fall back to reading MMKV directly
    const resolvedKeys      = keys      ?? progressStorage.getAllCompletedKeys();
    const resolvedPurchased = purchased ?? [];
    progressStorage.seedCompletedKeys(resolvedKeys);
    set({
      completedKeys:     new Set(resolvedKeys),
      purchasedPackages: new Set(resolvedPurchased),
    });
  },

  setLevelStars: (packageName, levelName, stars) => {
    progressStorage.setLevelStars(packageName, levelName, stars);
  },

  getLevelStars: (_packageName, _levelName) => {
    return progressStorage.getLevelStars(_packageName, _levelName);
  },

  reset: () => {
    progressStorage.clearProgress();
    set({ completedKeys: new Set(), purchasedPackages: new Set(), lastPlayedLevel: null });
  },
}));
